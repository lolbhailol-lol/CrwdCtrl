const mongoose = require('mongoose');
const FestInterestLead = require('../model/fest_interest_lead_model');
const FestOrganizer = require('../model/fest_organizer_model');
const Competition = require('../model/competition_model');
const { findByIdOrSlug } = require('../utils/slug');

/** Stall day boundaries always use India time so Railway UTC doesn't hide leads. */
const STALL_TZ = 'Asia/Kolkata';

/** Short in-memory cache — QR scans hammer the same fest meta repeatedly */
const stallCache = new Map();
const STALL_CACHE_TTL_MS = 60_000;

function cacheGet(key) {
    const hit = stallCache.get(key);
    if (!hit) return null;
    if (Date.now() > hit.expiresAt) {
        stallCache.delete(key);
        return null;
    }
    return hit.value;
}

function cacheSet(key, value, ttlMs = STALL_CACHE_TTL_MS) {
    stallCache.set(key, { value, expiresAt: Date.now() + ttlMs });
    return value;
}

function ymdInTz(date = new Date(), timeZone = STALL_TZ) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(date);
    const get = (type) => parts.find((p) => p.type === type)?.value;
    return `${get('year')}-${get('month')}-${get('day')}`;
}

function dayRangeIST(dateStr) {
    const raw = String(dateStr || '').trim();
    if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
    const start = new Date(`${raw}T00:00:00+05:30`);
    if (Number.isNaN(start.getTime())) return null;
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    return { start, end, date: raw };
}

function startOfToday() {
    return dayRangeIST(ymdInTz(new Date())).start;
}

function endOfToday() {
    return dayRangeIST(ymdInTz(new Date())).end;
}

function dateFilterFromReq(query = {}) {
    if (query.date) {
        const range = dayRangeIST(query.date);
        if (range) return range;
    }
    const todayOnly = String(query.today || '') === '1' || String(query.today || '') === 'true';
    if (todayOnly) {
        return dayRangeIST(ymdInTz(new Date()));
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
    const key = `fest:${String(idOrSlug || '').trim().toLowerCase()}`;
    const cached = cacheGet(key);
    if (cached) return cached;
    const fest = await findByIdOrSlug(FestOrganizer, idOrSlug, {
        select: 'festName collegeName city slug coverImage status isApproved',
        pickName: (row) => row.festName || '',
    });
    if (fest) cacheSet(key, fest);
    return fest;
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
    const safeSource = FestInterestLead.SOURCES.includes(source) ? source : 'shubharam_stall';

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
            source: safeSource,
        },
    };
}

async function loadFestCompetitions(festId) {
    const key = `comps:${String(festId)}`;
    const cached = cacheGet(key);
    if (cached) return cached;
    const rows = await Competition.find({ fest: festId }).select('name').sort({ name: 1 }).lean();
    return cacheSet(key, rows);
}

/** Only the comps the student picked — keeps submit fast under load */
async function loadCompetitionsByIds(festId, ids = []) {
    const unique = [...new Set((ids || []).map(String).filter((id) => mongoose.Types.ObjectId.isValid(id)))].slice(0, 20);
    if (!unique.length) return [];
    return Competition.find({
        fest: festId,
        _id: { $in: unique.map((id) => new mongoose.Types.ObjectId(id)) },
    })
        .select('name')
        .lean();
}

/** Upsert same phone + fest within today (IST) — single atomic write when possible */
async function upsertSameDayLead({ festId, payload, capturedBy = null }) {
    const festOid = mongoose.Types.ObjectId.isValid(String(festId))
        ? new mongoose.Types.ObjectId(String(festId))
        : festId;
    const dayKey = ymdInTz(new Date());
    const setFields = {
        name: payload.name,
        interest: payload.interest,
        volunteerTeams: Array.isArray(payload.volunteerTeams) ? payload.volunteerTeams : [],
        competitions: Array.isArray(payload.competitions) ? payload.competitions : [],
        year: payload.year || '',
        branch: payload.branch || '',
        note: payload.note || '',
        source: payload.source || 'shubharam_stall',
        dayKey,
    };
    if (capturedBy) setFields.capturedBy = capturedBy;

    try {
        const lead = await FestInterestLead.findOneAndUpdate(
            { fest: festOid, phone: payload.phone, dayKey },
            {
                $set: setFields,
                $setOnInsert: {
                    fest: festOid,
                    phone: payload.phone,
                },
            },
            {
                upsert: true,
                new: true,
                setDefaultsOnInsert: true,
                runValidators: true,
            },
        );
        const createdMs = new Date(lead.createdAt).getTime();
        const updatedMs = new Date(lead.updatedAt).getTime();
        const updated = Number.isFinite(createdMs) && Number.isFinite(updatedMs) && (updatedMs - createdMs) > 800;
        return { lead, updated };
    } catch (error) {
        // Concurrent duplicate key — retry as update
        if (error?.code === 11000) {
            const lead = await FestInterestLead.findOneAndUpdate(
                { fest: festOid, phone: payload.phone, dayKey },
                { $set: setFields },
                { new: true, runValidators: true },
            );
            if (lead) return { lead, updated: true };

            // Legacy row without dayKey — update today's phone match
            const todayStart = startOfToday();
            const todayEnd = endOfToday();
            const legacy = await FestInterestLead.findOneAndUpdate(
                {
                    fest: festOid,
                    phone: payload.phone,
                    $or: [{ dayKey: '' }, { dayKey: null }, { dayKey: { $exists: false } }],
                    createdAt: { $gte: todayStart, $lt: todayEnd },
                },
                { $set: setFields },
                { new: true, runValidators: true, sort: { createdAt: -1 } },
            );
            if (legacy) return { lead: legacy, updated: true };
        }
        throw error;
    }
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

        res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');
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

        const rawCompIds = Array.isArray(req.body?.competitionIds)
            ? req.body.competitionIds
            : Array.isArray(req.body?.competitions)
                ? req.body.competitions.map((c) => (typeof c === 'object' ? c.id || c._id : c))
                : [];
        // Only fetch selected comps — avoid loading the full fest catalog on every submit
        const festCompetitions = await loadCompetitionsByIds(fest._id, rawCompIds);
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
        res.status(500).json({
            success: false,
            message: error?.message?.includes('validation') || error?.name === 'ValidationError'
                ? error.message
                : 'Failed to save interest',
        });
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
        const team = String(req.query.team || '').trim().toLowerCase();
        const competitionId = String(req.query.competitionId || '').trim();
        const day = dateFilterFromReq(req.query);

        const festOid = new mongoose.Types.ObjectId(String(festId));
        const filter = { fest: festOid };
        if (interest === 'volunteer') {
            filter.interest = { $in: ['volunteer', 'both'] };
        } else if (interest === 'participate') {
            filter.interest = { $in: ['participate', 'both'] };
        } else if (FestInterestLead.INTERESTS.includes(interest)) {
            filter.interest = interest;
        }
        if (team && FestInterestLead.VOLUNTEER_TEAM_IDS.includes(team)) {
            filter.volunteerTeams = team;
            if (!filter.interest) {
                filter.interest = { $in: ['volunteer', 'both'] };
            }
        }
        if (competitionId && mongoose.Types.ObjectId.isValid(competitionId)) {
            filter['competitions.id'] = new mongoose.Types.ObjectId(competitionId);
            if (!filter.interest) {
                filter.interest = { $in: ['participate', 'both'] };
            }
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
            loadFestCompetitions(festOid),
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
        res.status(500).json({
            success: false,
            message: error?.name === 'ValidationError' ? error.message : 'Failed to save lead',
        });
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
            FestInterestLead.countDocuments({ fest: festOid }),
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

exports.deleteLead = async (req, res) => {
    try {
        const leadId = req.params.leadId;
        if (!mongoose.Types.ObjectId.isValid(String(leadId))) {
            return res.status(400).json({ success: false, message: 'Invalid lead id' });
        }
        const lead = await FestInterestLead.findOneAndDelete({
            _id: leadId,
            fest: req.festId,
        });
        if (!lead) {
            return res.status(404).json({ success: false, message: 'Lead not found' });
        }
        res.json({ success: true, message: 'Lead deleted', id: lead._id });
    } catch (error) {
        console.error('[stall.deleteLead]', error);
        res.status(500).json({ success: false, message: 'Failed to delete lead' });
    }
};

exports.exportLeads = async (req, res) => {
    try {
        const ExcelJS = require('exceljs');
        const fest = await FestOrganizer.findById(req.festId).select('festName').lean();
        const day = dateFilterFromReq(req.query);
        const filter = { fest: req.festId };
        if (day) {
            filter.createdAt = { $gte: day.start, $lt: day.end };
        }

        const rows = await FestInterestLead.find(filter).sort({ createdAt: -1 }).lean();
        const teamLabel = Object.fromEntries(
            (FestInterestLead.VOLUNTEER_TEAMS || []).map((t) => [t.id, t.label]),
        );
        const sourceLabel = {
            shubharam_stall: 'QR / stall',
            organizer_kiosk: 'Kiosk',
            other: 'Other',
        };

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'CrwdCtrl';
        workbook.created = new Date();
        const sheet = workbook.addWorksheet('Stall leads', {
            views: [{ state: 'frozen', ySplit: 1 }],
        });

        const header = [
            'Name',
            'Phone',
            'Year',
            'Branch / Dept',
            'Interest',
            'Volunteer teams',
            'Competitions',
            'Source',
            'Note',
            'Contacted',
            'Submitted at (IST)',
            'Lead ID',
        ];
        sheet.addRow(header);
        const headerRow = sheet.getRow(1);
        headerRow.font = { bold: true };
        headerRow.alignment = { vertical: 'middle', wrapText: true };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE8F8FC' },
        };

        for (const row of rows) {
            const teams = (row.volunteerTeams || [])
                .map((id) => teamLabel[id] || id)
                .join(', ');
            const comps = (row.competitions || [])
                .map((c) => c.name || '')
                .filter(Boolean)
                .join(', ');
            let submitted = '';
            if (row.createdAt) {
                try {
                    submitted = new Date(row.createdAt).toLocaleString('en-IN', {
                        timeZone: 'Asia/Kolkata',
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                    });
                } catch {
                    submitted = new Date(row.createdAt).toISOString();
                }
            }
            sheet.addRow([
                row.name || '',
                row.phone || '',
                row.year || '',
                row.branch || '',
                row.interest || '',
                teams,
                comps,
                sourceLabel[row.source] || row.source || '',
                row.note || '',
                row.contacted ? 'Yes' : 'No',
                submitted,
                String(row._id),
            ]);
        }

        header.forEach((_, colIdx) => {
            const column = sheet.getColumn(colIdx + 1);
            let max = String(header[colIdx] || '').length;
            sheet.eachRow((r, rowNumber) => {
                if (rowNumber === 1) return;
                const len = String(r.getCell(colIdx + 1).value ?? '').length;
                if (len > max) max = len;
            });
            column.width = Math.min(40, Math.max(12, max + 2));
        });

        // Phone as text so Excel doesn't mangle numbers
        sheet.getColumn(2).numFmt = '@';

        const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
        const safeName = (fest?.festName || 'fest').replace(/[^a-z0-9-_]+/gi, '_');
        const dateSuffix = day?.date ? `_${day.date}` : '';
        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        );
        res.setHeader(
            'Content-Disposition',
            `attachment; filename="${safeName}_stall_leads${dateSuffix}.xlsx"`,
        );
        res.send(buffer);
    } catch (error) {
        console.error('[stall.exportLeads]', error);
        res.status(500).json({ success: false, message: 'Export failed' });
    }
};
