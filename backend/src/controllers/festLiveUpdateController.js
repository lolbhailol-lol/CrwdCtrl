const mongoose = require('mongoose');
const FestLiveUpdate = require('../model/fest_live_update_model');
const FestOrganizer = require('../model/fest_organizer_model');
const { notifyFestParticipants } = require('../utils/festParticipantOutreach');
const { findByIdOrSlug } = require('../utils/slug');

const UPDATE_TYPES = FestLiveUpdate.UPDATE_TYPES;
const TYPE_META = {
    happening_now: { label: 'Happening now', emoji: '🔴' },
    schedule: { label: 'Schedule', emoji: '🗓️' },
    venue: { label: 'Venue / location', emoji: '📍' },
    competition: { label: 'Competition', emoji: '🏆' },
    pro_show: { label: 'Pro Show', emoji: '🎤' },
    delay: { label: 'Delay', emoji: '⏳' },
    result: { label: 'Results', emoji: '🏁' },
    food: { label: 'Food / stalls', emoji: '🍔' },
    lost_found: { label: 'Lost & found', emoji: '🎒' },
    emergency: { label: 'Emergency', emoji: '🚨' },
    general: { label: 'General', emoji: '📢' },
};

const TEMPLATES = [
    {
        id: 'gates_open',
        type: 'happening_now',
        title: 'Gates are open',
        body: 'Entry has started. Bring your QR ticket and head to the main gate.',
        locationLabel: 'Main gate',
        urgent: false,
        notifyOnPublish: true,
    },
    {
        id: 'comp_starting',
        type: 'competition',
        title: 'Competition starting soon',
        body: 'Participants please report to the venue 15 minutes early with your QR.',
        locationLabel: '',
        urgent: false,
        notifyOnPublish: true,
    },
    {
        id: 'venue_change',
        type: 'venue',
        title: 'Venue changed',
        body: 'This activity has moved. Follow the new location below.',
        locationLabel: '',
        urgent: true,
        notifyOnPublish: true,
    },
    {
        id: 'delay',
        type: 'delay',
        title: 'Running late',
        body: 'Sorry for the delay — we will start shortly. Stay nearby.',
        locationLabel: '',
        urgent: true,
        notifyOnPublish: true,
    },
    {
        id: 'pro_show_doors',
        type: 'pro_show',
        title: 'Pro Show doors opening',
        body: 'Pro Show entry is open. Have your pass ready at the gate.',
        locationLabel: 'Pro Show gate',
        urgent: false,
        notifyOnPublish: true,
    },
    {
        id: 'food',
        type: 'food',
        title: 'Food stalls open',
        body: 'Food court is live — grab a bite between events.',
        locationLabel: 'Food court',
        urgent: false,
        notifyOnPublish: false,
    },
    {
        id: 'results',
        type: 'result',
        title: 'Results announced',
        body: 'Results are out. Check the fest page or notice board for winners.',
        locationLabel: '',
        urgent: false,
        notifyOnPublish: true,
    },
    {
        id: 'lost_found',
        type: 'lost_found',
        title: 'Lost & found',
        body: 'Lost something? Visit the help desk with a description.',
        locationLabel: 'Help desk',
        urgent: false,
        notifyOnPublish: false,
    },
];

function formatUpdate(doc) {
    const row = doc.toObject ? doc.toObject() : doc;
    const type = UPDATE_TYPES.includes(row.type) ? row.type : 'general';
    const meta = TYPE_META[type] || TYPE_META.general;
    return {
        id: row._id,
        festId: row.fest,
        title: row.title,
        body: row.body || '',
        type,
        typeLabel: meta.label,
        status: row.status || 'draft',
        pinned: Boolean(row.pinned),
        urgent: Boolean(row.urgent),
        locationLabel: row.locationLabel || '',
        locationMapUrl: row.locationMapUrl || '',
        happensAt: row.happensAt || null,
        endsAt: row.endsAt || null,
        competitionId: row.competition || null,
        competitionName: row.competitionName || '',
        imageUrl: row.imageUrl || '',
        tags: Array.isArray(row.tags) ? row.tags : [],
        notifyOnPublish: Boolean(row.notifyOnPublish),
        notifiedAt: row.notifiedAt || null,
        publishedAt: row.publishedAt || null,
        sortOrder: Number(row.sortOrder) || 0,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
}

function parseBody(reqBody = {}) {
    const title = String(reqBody.title || '').trim().slice(0, 160);
    const body = String(reqBody.body || '').trim().slice(0, 2000);
    const type = UPDATE_TYPES.includes(String(reqBody.type || ''))
        ? String(reqBody.type)
        : 'general';
    const locationLabel = String(reqBody.locationLabel || '').trim().slice(0, 160);
    const locationMapUrl = String(reqBody.locationMapUrl || '').trim().slice(0, 500);
    const imageUrl = String(reqBody.imageUrl || '').trim().slice(0, 500);
    const competitionId = mongoose.Types.ObjectId.isValid(String(reqBody.competitionId || ''))
        ? String(reqBody.competitionId)
        : null;
    const tags = Array.isArray(reqBody.tags)
        ? reqBody.tags.map((t) => String(t || '').trim()).filter(Boolean).slice(0, 8)
        : String(reqBody.tags || '')
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
            .slice(0, 8);

    return {
        title,
        body,
        type,
        pinned: Boolean(reqBody.pinned),
        urgent: Boolean(reqBody.urgent) || type === 'emergency',
        locationLabel,
        locationMapUrl,
        happensAt: reqBody.happensAt ? new Date(reqBody.happensAt) : null,
        endsAt: reqBody.endsAt ? new Date(reqBody.endsAt) : null,
        competitionId,
        imageUrl,
        tags,
        notifyOnPublish: Boolean(reqBody.notifyOnPublish),
        sortOrder: Number.isFinite(Number(reqBody.sortOrder)) ? Number(reqBody.sortOrder) : 0,
        publish: reqBody.publish === true || reqBody.status === 'published',
        status: ['draft', 'published', 'archived'].includes(String(reqBody.status || ''))
            ? String(reqBody.status)
            : null,
    };
}

async function resolveCompetitionName(festId, competitionId) {
    if (!competitionId) return '';
    const Competition = mongoose.model('Competition');
    const c = await Competition.findOne({ _id: competitionId, fest: festId }).select('name').lean();
    return c?.name || '';
}

async function maybeNotify(festId, update, force = false) {
    if (!update.notifyOnPublish && !force) return null;
    if (update.status !== 'published') return null;
    if (update.notifiedAt && !force) return { skipped: true, reason: 'already_notified' };

    const fest = await FestOrganizer.findById(festId).select('festName').lean();
    const title = update.urgent
        ? `⚠️ ${update.title}`
        : `${update.title}`;
    const parts = [update.body || ''];
    if (update.locationLabel) parts.push(`Where: ${update.locationLabel}`);
    if (update.happensAt) {
        try {
            parts.push(`When: ${new Date(update.happensAt).toLocaleString('en-IN')}`);
        } catch { /* ignore */ }
    }
    const message = parts.filter(Boolean).join('\n').slice(0, 500) || 'New fest day update.';

    const stats = await notifyFestParticipants({
        festId,
        festName: fest?.festName || 'Fest',
        title,
        message,
        type: update.urgent || update.type === 'emergency' ? 'reminder' : 'announcement',
        link: `/view-details/${festId}`,
        audience: 'approved',
        competitionId: update.competition || null,
    });

    update.notifiedAt = new Date();
    await update.save();
    return stats;
}

/** Organizer: meta + templates + competitions for composer */
exports.getLiveUpdateMeta = async (req, res) => {
    try {
        const Competition = mongoose.model('Competition');
        const competitions = await Competition.find({ fest: req.festId })
            .select('name')
            .sort({ name: 1 })
            .lean();
        res.json({
            success: true,
            types: UPDATE_TYPES.map((id) => ({ id, ...(TYPE_META[id] || {}) })),
            templates: TEMPLATES,
            competitions: competitions.map((c) => ({ id: c._id, name: c.name || 'Competition' })),
        });
    } catch (error) {
        console.error('[festLiveUpdates.meta]', error);
        res.status(500).json({ success: false, message: 'Failed to load live update meta' });
    }
};

exports.listLiveUpdates = async (req, res) => {
    try {
        const status = String(req.query.status || '').trim();
        const type = String(req.query.type || '').trim();
        const search = String(req.query.search || '').trim();
        const filter = { fest: req.festId };

        if (['draft', 'published', 'archived'].includes(status)) filter.status = status;
        else if (status === 'active') filter.status = { $in: ['draft', 'published'] };
        if (UPDATE_TYPES.includes(type)) filter.type = type;
        if (search) {
            const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            filter.$or = [
                { title: regex },
                { body: regex },
                { locationLabel: regex },
                { competitionName: regex },
            ];
        }

        const [rows, counts] = await Promise.all([
            FestLiveUpdate.find(filter)
                .sort({ pinned: -1, publishedAt: -1, createdAt: -1 })
                .limit(200)
                .lean(),
            FestLiveUpdate.aggregate([
                { $match: { fest: new mongoose.Types.ObjectId(String(req.festId)) } },
                { $group: { _id: '$status', count: { $sum: 1 } } },
            ]),
        ]);

        const byStatus = { draft: 0, published: 0, archived: 0, total: 0 };
        for (const row of counts) {
            if (byStatus[row._id] !== undefined) byStatus[row._id] = row.count;
            byStatus.total += row.count;
        }

        res.json({
            success: true,
            counts: byStatus,
            updates: rows.map(formatUpdate),
        });
    } catch (error) {
        console.error('[festLiveUpdates.list]', error);
        res.status(500).json({ success: false, message: 'Failed to list live updates' });
    }
};

exports.createLiveUpdate = async (req, res) => {
    try {
        const parsed = parseBody(req.body);
        if (!parsed.title || parsed.title.length < 2) {
            return res.status(400).json({ success: false, message: 'Title is required' });
        }

        const competitionName = await resolveCompetitionName(req.festId, parsed.competitionId);
        const wantPublish = parsed.publish || parsed.status === 'published';
        const row = await FestLiveUpdate.create({
            fest: req.festId,
            title: parsed.title,
            body: parsed.body,
            type: parsed.type,
            status: wantPublish ? 'published' : 'draft',
            pinned: parsed.pinned,
            urgent: parsed.urgent,
            locationLabel: parsed.locationLabel,
            locationMapUrl: parsed.locationMapUrl,
            happensAt: parsed.happensAt,
            endsAt: parsed.endsAt,
            competition: parsed.competitionId,
            competitionName,
            imageUrl: parsed.imageUrl,
            tags: parsed.tags,
            notifyOnPublish: parsed.notifyOnPublish,
            publishedAt: wantPublish ? new Date() : null,
            createdByOrganizer: req.organizerId || null,
            sortOrder: parsed.sortOrder,
        });

        let notify = null;
        if (wantPublish && parsed.notifyOnPublish) {
            notify = await maybeNotify(req.festId, row);
        }

        res.status(201).json({
            success: true,
            message: wantPublish ? 'Update published' : 'Draft saved',
            update: formatUpdate(row),
            notify,
        });
    } catch (error) {
        console.error('[festLiveUpdates.create]', error);
        res.status(500).json({ success: false, message: 'Failed to create update' });
    }
};

exports.updateLiveUpdate = async (req, res) => {
    try {
        const { updateId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(updateId)) {
            return res.status(400).json({ success: false, message: 'Invalid id' });
        }
        const row = await FestLiveUpdate.findOne({ _id: updateId, fest: req.festId });
        if (!row) return res.status(404).json({ success: false, message: 'Not found' });

        const parsed = parseBody(req.body);
        if (req.body.title !== undefined) {
            if (!parsed.title) return res.status(400).json({ success: false, message: 'Title is required' });
            row.title = parsed.title;
        }
        if (req.body.body !== undefined) row.body = parsed.body;
        if (req.body.type !== undefined) row.type = parsed.type;
        if (req.body.pinned !== undefined) row.pinned = parsed.pinned;
        if (req.body.urgent !== undefined) row.urgent = parsed.urgent;
        if (req.body.locationLabel !== undefined) row.locationLabel = parsed.locationLabel;
        if (req.body.locationMapUrl !== undefined) row.locationMapUrl = parsed.locationMapUrl;
        if (req.body.happensAt !== undefined) row.happensAt = parsed.happensAt;
        if (req.body.endsAt !== undefined) row.endsAt = parsed.endsAt;
        if (req.body.imageUrl !== undefined) row.imageUrl = parsed.imageUrl;
        if (req.body.tags !== undefined) row.tags = parsed.tags;
        if (req.body.notifyOnPublish !== undefined) row.notifyOnPublish = parsed.notifyOnPublish;
        if (req.body.sortOrder !== undefined) row.sortOrder = parsed.sortOrder;
        if (req.body.competitionId !== undefined) {
            row.competition = parsed.competitionId;
            row.competitionName = await resolveCompetitionName(req.festId, parsed.competitionId);
        }

        if (parsed.status) {
            if (parsed.status === 'published' && row.status !== 'published') {
                row.publishedAt = new Date();
            }
            row.status = parsed.status;
        } else if (parsed.publish && row.status !== 'published') {
            row.status = 'published';
            row.publishedAt = new Date();
        }

        await row.save();

        let notify = null;
        if (req.body.sendNotify === true || (parsed.publish && parsed.notifyOnPublish && !row.notifiedAt)) {
            notify = await maybeNotify(req.festId, row, req.body.sendNotify === true);
        }

        res.json({
            success: true,
            message: 'Updated',
            update: formatUpdate(row),
            notify,
        });
    } catch (error) {
        console.error('[festLiveUpdates.update]', error);
        res.status(500).json({ success: false, message: 'Failed to update' });
    }
};

exports.publishLiveUpdate = async (req, res) => {
    try {
        const { updateId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(updateId)) {
            return res.status(400).json({ success: false, message: 'Invalid id' });
        }
        const row = await FestLiveUpdate.findOne({ _id: updateId, fest: req.festId });
        if (!row) return res.status(404).json({ success: false, message: 'Not found' });

        row.status = 'published';
        if (!row.publishedAt) row.publishedAt = new Date();
        if (req.body.notifyOnPublish !== undefined) {
            row.notifyOnPublish = Boolean(req.body.notifyOnPublish);
        }
        await row.save();

        const notify = await maybeNotify(
            req.festId,
            row,
            req.body.forceNotify === true,
        );

        res.json({
            success: true,
            message: 'Published to live feed',
            update: formatUpdate(row),
            notify,
        });
    } catch (error) {
        console.error('[festLiveUpdates.publish]', error);
        res.status(500).json({ success: false, message: 'Failed to publish' });
    }
};

exports.archiveLiveUpdate = async (req, res) => {
    try {
        const { updateId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(updateId)) {
            return res.status(400).json({ success: false, message: 'Invalid id' });
        }
        const row = await FestLiveUpdate.findOneAndUpdate(
            { _id: updateId, fest: req.festId },
            { $set: { status: 'archived', pinned: false } },
            { new: true },
        );
        if (!row) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, message: 'Archived', update: formatUpdate(row) });
    } catch (error) {
        console.error('[festLiveUpdates.archive]', error);
        res.status(500).json({ success: false, message: 'Failed to archive' });
    }
};

exports.deleteLiveUpdate = async (req, res) => {
    try {
        const { updateId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(updateId)) {
            return res.status(400).json({ success: false, message: 'Invalid id' });
        }
        const row = await FestLiveUpdate.findOneAndDelete({ _id: updateId, fest: req.festId });
        if (!row) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, message: 'Deleted' });
    } catch (error) {
        console.error('[festLiveUpdates.delete]', error);
        res.status(500).json({ success: false, message: 'Failed to delete' });
    }
};

/** Public: published feed for student UI (later) */
exports.listPublicLiveUpdates = async (req, res) => {
    try {
        const fest = await findByIdOrSlug(FestOrganizer, req.params.id || req.params.festIdOrSlug, {
            select: 'festName slug status isApproved',
        });
        if (!fest || fest.status === 'draft' || fest.isApproved === false) {
            return res.status(404).json({ success: false, message: 'Fest not found' });
        }

        const type = String(req.query.type || '').trim();
        const since = req.query.since ? new Date(req.query.since) : null;
        const filter = { fest: fest._id, status: 'published' };
        if (UPDATE_TYPES.includes(type)) filter.type = type;
        if (since && !Number.isNaN(since.getTime())) {
            filter.publishedAt = { $gte: since };
        }

        const rows = await FestLiveUpdate.find(filter)
            .sort({ pinned: -1, urgent: -1, publishedAt: -1 })
            .limit(100)
            .lean();

        res.set('Cache-Control', 'public, max-age=15, stale-while-revalidate=30');
        res.json({
            success: true,
            fest: { id: fest._id, festName: fest.festName, slug: fest.slug || '' },
            serverTime: new Date().toISOString(),
            updates: rows.map(formatUpdate),
        });
    } catch (error) {
        console.error('[festLiveUpdates.public]', error);
        res.status(500).json({ success: false, message: 'Failed to load live updates' });
    }
};

/** Admin: read-only overview across a fest */
exports.adminListLiveUpdates = async (req, res) => {
    try {
        const festId = req.params.festId;
        if (!mongoose.Types.ObjectId.isValid(festId)) {
            return res.status(400).json({ success: false, message: 'Invalid fest id' });
        }
        const rows = await FestLiveUpdate.find({ fest: festId })
            .sort({ pinned: -1, createdAt: -1 })
            .limit(300)
            .lean();
        res.json({ success: true, updates: rows.map(formatUpdate) });
    } catch (error) {
        console.error('[festLiveUpdates.adminList]', error);
        res.status(500).json({ success: false, message: 'Failed to load updates' });
    }
};
