const mongoose = require('mongoose');
const FestInterestLead = require('../model/fest_interest_lead_model');
const FestOrganizer = require('../model/fest_organizer_model');
const Competition = require('../model/competition_model');
const { findByIdOrSlug } = require('../utils/slug');

function startOfToday() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
}

function endOfToday() {
    const d = startOfToday();
    d.setDate(d.getDate() + 1);
    return d;
}

/** Parse YYYY-MM-DD (local calendar day). Returns { start, end } or null for invalid. */
function dayRangeFromQuery(dateStr) {
    const raw = String(dateStr || '').trim();
    if (!raw) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
    const [y, m, d] = raw.split('-').map(Number);
    const start = new Date(y, m - 1, d, 0, 0, 0, 0);
    if (Number.isNaN(start.getTime())) return null;
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start, end, date: raw };
}

function dateFilterFromReq(query = {}) {
    const range = dayRangeFromQuery(query.date);
    if (range) return range;
    const todayOnly = String(query.today || '') === '1' || String(query.today || '') === 'true';
    if (todayOnly) {
        const start = startOfToday();
        const end = endOfToday();
        const y = start.getFullYear();
        const m = String(start.getMonth() + 1).padStart(2, '0');
        const d = String(start.getDate()).padStart(2, '0');
        return { start, end, date: `${y}-${m}-${d}` };
    }
    return null;
}

function serializeLead(lead) {
    return {
        id: lead._id,
        fest: lead.fest,
        name: lead.name,
        phone: lead.phone,
        year: lead.year || '',
        branch: lead.branch || '',
        interest: lead.interest,
        volunteerTeams: Array.isArray(lead.volunteerTeams) ? lead.volunteerTeams : [],
        competitions: Array.isArray(lead.competitions)
            ? lead.competitions.map((c) => ({
                id: c.id || c._id || null,
                name: c.name || '',
            }))
            : [],
        source: lead.source,
        note: lead.note || '',
        contacted: Boolean(lead.contacted),
        contactedAt: lead.contactedAt || null,
        capturedBy: lead.capturedBy || null,
        createdAt: lead.createdAt,
        updatedAt: lead.updatedAt,
    };
}

async function resolveFest(idOrSlug) {
    return findByIdOrSlug(FestOrganizer, idOrSlug, {
        select: 'festName collegeName city slug coverImage status isApproved',
        pickName: (row) => row.festName || '',
    });
}

function parseLeadBody(body = {}, festCompetitions = []) {
    const name = String(body.name || '').trim();
    const phoneDigits = String(body.phone || '').replace(/\D/g, '');
    const phone = phoneDigits.length >= 10 ? phoneDigits.slice(-10) : phoneDigits;
    const year = String(body.year || '').trim();
    const branch = String(body.branch || '').trim();
    const interest = String(body.interest || '').trim().toLowerCase();
    const note = String(body.note || '').trim();
    const source = String(body.source || '').trim() || 'shubharam_stall';

    if (!name || name.length < 2) {
        return { error: 'Name is required' };
    }
    if (!phone || phone.length !== 10) {
        return { error: 'Enter a valid 10-digit phone number' };
    }
    if (!FestInterestLead.INTERESTS.includes(interest)) {
        return { error: 'Choose volunteer, participate, or both' };
    }
    if (!FestInterestLead.SOURCES.includes(source)) {
        return { error: 'Invalid source' };
    }

    const wantsVolunteer = interest === 'volunteer' || interest === 'both';
    const wantsParticipate = interest === 'participate' || interest === 'both';

    const teamIds = FestInterestLead.VOLUNTEER_TEAM_IDS;
    const rawTeams = Array.isArray(body.volunteerTeams)
        ? body.volunteerTeams
        : String(body.volunteerTeams || '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
    const volunteerTeams = wantsVolunteer
        ? [...new Set(rawTeams.map((t) => String(t).toLowerCase()).filter((t) => teamIds.includes(t)))].slice(0, 8)
        : [];

    const compById = new Map(
        (festCompetitions || []).map((c) => [String(c._id || c.id), { id: c._id || c.id, name: c.name || 'Competition' }]),
    );
    const rawCompIds = Array.isArray(body.competitionIds)
        ? body.competitionIds
        : Array.isArray(body.competitions)
            ? body.competitions.map((c) => (typeof c === 'object' ? c.id || c._id : c))
            : String(body.competitionIds || '')
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean);

    let competitions = [];
    if (wantsParticipate) {
        competitions = [...new Set(rawCompIds.map(String))]
            .map((id) => compById.get(id))
            .filter(Boolean)
            .slice(0, 20)
            .map((c) => ({ id: c.id, name: String(c.name).slice(0, 120) }));
    }

    return {
        data: {
            name: name.slice(0, 120),
            phone: phone.slice(0, 20),
            year: year.slice(0, 40),
            branch: branch.slice(0, 80),
            interest,
            volunteerTeams,
            competitions,
            note: note.slice(0, 500),
            source,
        },
    };
}

async function loadFestCompetitions(festId) {
    return Competition.find({ fest: festId }).select('name').sort({ name: 1 }).lean();
}

/** Upsert same phone + fest within today */
async function upsertSameDayLead({ festId, payload, capturedBy = null }) {
    const todayStart = startOfToday();
    const todayEnd = endOfToday();
    const existing = await FestInterestLead.findOne({
        fest: festId,
        phone: payload.phone,
        createdAt: { $gte: todayStart, $lt: todayEnd },
    });

    if (existing) {
        existing.name = payload.name;
        existing.interest = payload.interest;
        existing.volunteerTeams = payload.volunteerTeams || [];
        existing.competitions = payload.competitions || [];
        if (payload.year) existing.year = payload.year;
        if (payload.branch) existing.branch = payload.branch;
        if (payload.note) existing.note = payload.note;
        if (payload.source) existing.source = payload.source;
        if (capturedBy) existing.capturedBy = capturedBy;
        await existing.save();
        return { lead: existing, updated: true };
    }

    const lead = await FestInterestLead.create({
        fest: festId,
        ...payload,
        capturedBy: capturedBy || null,
    });
    return { lead, updated: false };
}

exports.getPublicStallMeta = async (req, res) => {
    try {
        const fest = await resolveFest(req.params.id || req.params.idOrSlug);
        if (!fest) {
            return res.status(404).json({ success: false, message: 'Fest not found' });
        }
        if (fest.isApproved === false) {
            return res.status(404).json({ success: false, message: 'Fest not available' });
        }

        const competitions = await loadFestCompetitions(fest._id);

        res.json({
            success: true,
            fest: {
                id: fest._id,
                festName: fest.festName,
                collegeName: fest.collegeName || '',
                city: fest.city || '',
                slug: fest.slug || '',
                coverImage: fest.coverImage || '',
                status: fest.status || '',
            },
            volunteerTeams: FestInterestLead.VOLUNTEER_TEAMS,
            competitions: competitions.map((c) => ({
                id: c._id,
                name: c.name || 'Competition',
            })),
        });
    } catch (error) {
        console.error('[stall.getPublicStallMeta]', error);
        res.status(500).json({ success: false, message: 'Failed to load stall' });
    }
};

exports.createPublicStallLead = async (req, res) => {
    try {
        const fest = await resolveFest(req.params.id || req.params.idOrSlug);
        if (!fest) {
            return res.status(404).json({ success: false, message: 'Fest not found' });
        }
        if (fest.isApproved === false) {
            return res.status(404).json({ success: false, message: 'Fest not available' });
        }

        const festCompetitions = await loadFestCompetitions(fest._id);
        const parsed = parseLeadBody({
            ...req.body,
            source: req.body.source || 'shubharam_stall',
        }, festCompetitions);
        if (parsed.error) {
            return res.status(400).json({ success: false, message: parsed.error });
        }

        const { lead, updated } = await upsertSameDayLead({
            festId: fest._id,
            payload: parsed.data,
        });

        res.status(updated ? 200 : 201).json({
            success: true,
            message: updated
                ? 'Updated your interest for today — thanks!'
                : 'Thanks! We saved your interest.',
            lead: serializeLead(lead),
            fest: {
                id: fest._id,
                festName: fest.festName,
                slug: fest.slug || '',
            },
        });
    } catch (error) {
        console.error('[stall.createPublicStallLead]', error);
        res.status(500).json({ success: false, message: 'Failed to save interest' });
    }
};

exports.listLeads = async (req, res) => {
    try {
        const festId = req.festId;
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(100, Math.max(10, Number(req.query.limit) || 50));
        const skip = (page - 1) * limit;
        const interest = String(req.query.interest || '').trim().toLowerCase();
        const search = String(req.query.search || '').trim();
        const day = dateFilterFromReq(req.query);

        const filter = { fest: festId };
        if (FestInterestLead.INTERESTS.includes(interest)) {
            filter.interest = interest;
        }
        if (day) {
            filter.createdAt = { $gte: day.start, $lt: day.end };
        }
        if (search) {
            const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            const digits = FestInterestLead.normalizePhone(search);
            filter.$or = [
                { name: regex },
                { phone: regex },
                ...(digits ? [{ phone: new RegExp(digits) }] : []),
            ];
        }

        const [total, rows, festCompetitions] = await Promise.all([
            FestInterestLead.countDocuments(filter),
            FestInterestLead.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            loadFestCompetitions(festId),
        ]);

        res.json({
            success: true,
            date: day?.date || null,
            leads: rows.map(serializeLead),
            volunteerTeams: FestInterestLead.VOLUNTEER_TEAMS,
            competitions: festCompetitions.map((c) => ({
                id: c._id,
                name: c.name || 'Competition',
            })),
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit) || 1,
            },
        });
    } catch (error) {
        console.error('[stall.listLeads]', error);
        res.status(500).json({ success: false, message: 'Failed to load leads' });
    }
};

exports.createKioskLead = async (req, res) => {
    try {
        const festCompetitions = await loadFestCompetitions(req.festId);
        const parsed = parseLeadBody({
            ...req.body,
            source: req.body.source || 'organizer_kiosk',
        }, festCompetitions);
        if (parsed.error) {
            return res.status(400).json({ success: false, message: parsed.error });
        }

        const { lead, updated } = await upsertSameDayLead({
            festId: req.festId,
            payload: {
                ...parsed.data,
                source: 'organizer_kiosk',
            },
            capturedBy: req.organizer?._id || null,
        });

        res.status(updated ? 200 : 201).json({
            success: true,
            message: updated ? 'Updated existing lead for today' : 'Lead saved',
            lead: serializeLead(lead),
            updated,
        });
    } catch (error) {
        console.error('[stall.createKioskLead]', error);
        res.status(500).json({ success: false, message: 'Failed to save lead' });
    }
};

exports.getLeadStats = async (req, res) => {
    try {
        const festId = req.festId;
        const festOid = new mongoose.Types.ObjectId(String(festId));
        const day = dateFilterFromReq(req.query);

        const scopeMatch = { fest: festOid };
        if (day) {
            scopeMatch.createdAt = { $gte: day.start, $lt: day.end };
        }

        const [allTime, scopedCount, byInterest] = await Promise.all([
            FestInterestLead.countDocuments({ fest: festId }),
            FestInterestLead.countDocuments(scopeMatch),
            FestInterestLead.aggregate([
                { $match: scopeMatch },
                { $group: { _id: '$interest', count: { $sum: 1 } } },
            ]),
        ]);

        const interestCounts = { volunteer: 0, participate: 0, both: 0 };
        for (const row of byInterest) {
            if (interestCounts[row._id] !== undefined) {
                interestCounts[row._id] = row.count;
            }
        }

        res.json({
            success: true,
            date: day?.date || null,
            stats: {
                allTime,
                today: scopedCount,
                day: scopedCount,
                volunteer: interestCounts.volunteer,
                participate: interestCounts.participate,
                both: interestCounts.both,
            },
        });
    } catch (error) {
        console.error('[stall.getLeadStats]', error);
        res.status(500).json({ success: false, message: 'Failed to load stats' });
    }
};

exports.updateLeadContacted = async (req, res) => {
    try {
        const leadId = req.params.leadId;
        if (!mongoose.Types.ObjectId.isValid(String(leadId))) {
            return res.status(400).json({ success: false, message: 'Invalid lead id' });
        }
        const contacted = Boolean(req.body?.contacted);
        const lead = await FestInterestLead.findOneAndUpdate(
            { _id: leadId, fest: req.festId },
            {
                contacted,
                contactedAt: contacted ? new Date() : null,
            },
            { new: true },
        );
        if (!lead) {
            return res.status(404).json({ success: false, message: 'Lead not found' });
        }
        res.json({ success: true, lead: serializeLead(lead) });
    } catch (error) {
        console.error('[stall.updateLeadContacted]', error);
        res.status(500).json({ success: false, message: 'Failed to update lead' });
    }
};

exports.exportLeads = async (req, res) => {
    try {
        const fest = await FestOrganizer.findById(req.festId).select('festName').lean();
        const day = dateFilterFromReq(req.query);
        const filter = { fest: req.festId };
        if (day) {
            filter.createdAt = { $gte: day.start, $lt: day.end };
        }

        const rows = await FestInterestLead.find(filter).sort({ createdAt: -1 }).lean();
        const header = ['id', 'name', 'phone', 'year', 'branch', 'interest', 'volunteerTeams', 'competitions', 'source', 'note', 'contacted', 'createdAt'];
        const lines = [header.join(',')];
        for (const row of rows) {
            const teams = (row.volunteerTeams || []).join('|');
            const comps = (row.competitions || []).map((c) => c.name || '').filter(Boolean).join('|');
            lines.push([
                row._id,
                JSON.stringify(row.name || ''),
                JSON.stringify(row.phone || ''),
                JSON.stringify(row.year || ''),
                JSON.stringify(row.branch || ''),
                row.interest,
                JSON.stringify(teams),
                JSON.stringify(comps),
                row.source,
                JSON.stringify(row.note || ''),
                row.contacted ? 'yes' : 'no',
                row.createdAt ? new Date(row.createdAt).toISOString() : '',
            ].join(','));
        }

        const safeName = (fest?.festName || 'fest').replace(/[^a-z0-9-_]+/gi, '_');
        const dateSuffix = day?.date ? `_${day.date}` : '';
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${safeName}_stall_leads${dateSuffix}.csv"`);
        res.send(lines.join('\n'));
    } catch (error) {
        console.error('[stall.exportLeads]', error);
        res.status(500).json({ success: false, message: 'Export failed' });
    }
};
