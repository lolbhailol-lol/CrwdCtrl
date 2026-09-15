const crypto = require('crypto');
const mongoose = require('mongoose');
const FestOrganizer = require('../model/fest_organizer_model');
const Registration = require('../model/registration_model');
const User = require('../model/usermodel');

const PASS_TYPES = ['online', 'offline', 'vip', 'guest', 'press', 'crew'];

function slugTierId(name, kind) {
    const base = String(name || kind || 'tier')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '')
        .slice(0, 40);
    return base || `tier_${crypto.randomBytes(3).toString('hex')}`;
}

function defaultTiers() {
    return [
        {
            id: 'early_bird',
            name: 'Early bird',
            kind: 'early_bird',
            price: 299,
            quota: 100,
            endsAt: null,
            order: 0,
            active: true,
        },
        {
            id: 'ga',
            name: 'General',
            kind: 'ga',
            price: 399,
            quota: 0,
            endsAt: null,
            order: 1,
            active: true,
        },
        {
            id: 'vip',
            name: 'VIP',
            kind: 'vip',
            price: 799,
            quota: 50,
            endsAt: null,
            order: 2,
            active: true,
        },
    ];
}

function normalizeTier(input) {
    if (!Array.isArray(input) || !input.length) return defaultTiers();
    const seen = new Set();
    return input.slice(0, 12).map((t, idx) => {
        const kind = ['early_bird', 'ga', 'vip', 'other'].includes(String(t.kind || ''))
            ? String(t.kind)
            : 'ga';
        let id = String(t.id || '').trim() || slugTierId(t.name, kind);
        if (seen.has(id)) id = `${id}_${idx}`;
        seen.add(id);
        return {
            id,
            name: String(t.name || kind).trim().slice(0, 80) || 'Tier',
            kind,
            price: Math.max(0, Number(t.price) || 0),
            quota: Math.max(0, Number(t.quota) || 0),
            endsAt: t.endsAt ? new Date(t.endsAt) : null,
            order: Number.isFinite(Number(t.order)) ? Number(t.order) : idx,
            active: t.active !== false,
        };
    }).sort((a, b) => a.order - b.order);
}

function formatConfig(proShow = {}) {
    return {
        enabled: Boolean(proShow.enabled),
        title: proShow.title || 'Pro Show',
        venue: proShow.venue || '',
        showAt: proShow.showAt || null,
        capacity: Math.max(0, Number(proShow.capacity) || 0),
        salesOpen: proShow.salesOpen !== false,
        notes: proShow.notes || '',
        tiers: normalizeTier(proShow.tiers),
        artists: [],
    };
}

function tierAvailability(tier, soldForTier, now = new Date()) {
    const quota = Math.max(0, Number(tier.quota) || 0);
    const sold = Number(soldForTier) || 0;
    const quotaLeft = quota > 0 ? Math.max(0, quota - sold) : null;
    const ended = tier.endsAt ? new Date(tier.endsAt).getTime() <= now.getTime() : false;
    const quotaFull = quota > 0 && sold >= quota;
    const selling = Boolean(tier.active) && !ended && !quotaFull;
    return {
        sold,
        quota,
        quotaLeft,
        ended,
        quotaFull,
        selling,
    };
}

function formatTicket(reg) {
    const user = reg.user && typeof reg.user === 'object' ? reg.user : null;
    const responses = reg.responses instanceof Map
        ? Object.fromEntries(reg.responses)
        : (reg.responses && typeof reg.responses === 'object' ? reg.responses : {});
    return {
        id: reg._id,
        name: user?.name || responses.full_name || responses.name || '—',
        email: user?.email || responses.email || '',
        phone: user?.phone || user?.phoneNumber || responses.phone || responses.contact_no || '',
        status: reg.status,
        paymentStatus: reg.paymentStatus || 'free',
        amountPaid: Number(reg.amountPaid) || 0,
        checkedIn: Boolean(reg.checkedIn),
        checkedInAt: reg.checkedInAt || null,
        tierId: reg.proShowTierId || responses.pro_show_tier_id || '',
        tierName: responses.pro_show_tier_name || '',
        passType: reg.proShowPassType || responses.pro_show_pass_type || 'online',
        note: responses.organizer_note || '',
        isManual: /^(yes|true|1)$/i.test(String(responses.manual_entry || '')),
        qrCodeData: reg.qrCodeData || null,
        createdAt: reg.createdAt,
        submittedAt: reg.submittedAt || reg.createdAt,
    };
}

async function loadOps(festId) {
    const fest = await FestOrganizer.findById(festId)
        .select('festName artists artistsHeading proShow venue festDate')
        .lean();
    if (!fest) return null;

    const config = formatConfig(fest.proShow || {});
    config.artists = (fest.artists || []).map((a) => ({
        name: a.name || '',
        genre: a.genre || '',
        image: a.image || '',
        collegeName: a.collegeName || '',
        message: a.message || '',
    }));
    if (!config.venue) config.venue = fest.venue || '';

    const base = { fest: festId, isProShow: true };
    const [rows, byTier, byPass] = await Promise.all([
        Registration.find({ ...base, status: { $in: ['pending', 'approved'] } })
            .select('status paymentStatus amountPaid checkedIn proShowTierId proShowPassType')
            .lean(),
        Registration.aggregate([
            { $match: { fest: new mongoose.Types.ObjectId(String(festId)), isProShow: true, status: 'approved' } },
            { $group: { _id: '$proShowTierId', count: { $sum: 1 }, revenue: { $sum: { $ifNull: ['$amountPaid', 0] } } } },
        ]),
        Registration.aggregate([
            { $match: { fest: new mongoose.Types.ObjectId(String(festId)), isProShow: true, status: 'approved' } },
            { $group: { _id: '$proShowPassType', count: { $sum: 1 } } },
        ]),
    ]);

    const approved = rows.filter((r) => r.status === 'approved');
    const pending = rows.filter((r) => r.status === 'pending');
    const sold = approved.length;
    const checkedIn = approved.filter((r) => r.checkedIn).length;
    const revenue = approved.reduce((s, r) => s + (Number(r.amountPaid) || 0), 0);
    const capacity = config.capacity;
    const remaining = capacity > 0 ? Math.max(0, capacity - sold) : null;
    const soldOut = capacity > 0 && sold >= capacity;

    const tierSoldMap = new Map(byTier.map((t) => [String(t._id || ''), t]));
    const now = new Date();
    const tiers = config.tiers.map((tier) => {
        const row = tierSoldMap.get(String(tier.id)) || { count: 0, revenue: 0 };
        const avail = tierAvailability(tier, row.count, now);
        return {
            ...tier,
            ...avail,
            revenue: Number(row.revenue) || 0,
        };
    });

    const passBreakdown = { online: 0, offline: 0, vip: 0, guest: 0, press: 0, crew: 0 };
    for (const row of byPass) {
        const key = PASS_TYPES.includes(row._id) ? row._id : 'offline';
        passBreakdown[key] = (passBreakdown[key] || 0) + (row.count || 0);
    }
    const offlineIssued = PASS_TYPES
        .filter((p) => p !== 'online')
        .reduce((s, k) => s + (passBreakdown[k] || 0), 0);

    const earlyBird = tiers.find((t) => t.kind === 'early_bird');
    const earlyBirdActive = Boolean(earlyBird?.selling);

    return {
        fest: { id: fest._id, festName: fest.festName, festDate: fest.festDate },
        config,
        stats: {
            sold,
            remaining,
            capacity,
            soldOut,
            pending: pending.length,
            checkedIn,
            checkInRate: sold > 0 ? Math.round((checkedIn / sold) * 100) : 0,
            revenue,
            offlineIssued,
            onlineSold: passBreakdown.online || 0,
            earlyBirdActive,
            earlyBirdSold: earlyBird?.sold || 0,
            earlyBirdLeft: earlyBird?.quotaLeft,
            salesOpen: config.salesOpen && !soldOut,
        },
        tiers,
        passBreakdown,
    };
}

exports.getProShowOps = async (req, res) => {
    try {
        const ops = await loadOps(req.festId);
        if (!ops) return res.status(404).json({ success: false, message: 'Fest not found' });

        const recent = await Registration.find({ fest: req.festId, isProShow: true })
            .populate('user', 'name email phone phoneNumber')
            .sort({ createdAt: -1 })
            .limit(12)
            .lean();

        res.json({
            success: true,
            ...ops,
            recentTickets: recent.map(formatTicket),
        });
    } catch (error) {
        console.error('[festProShow.getOps]', error);
        res.status(500).json({ success: false, message: 'Failed to load Pro Show desk' });
    }
};

exports.updateProShowConfig = async (req, res) => {
    try {
        const fest = await FestOrganizer.findById(req.festId);
        if (!fest) return res.status(404).json({ success: false, message: 'Fest not found' });

        const body = req.body || {};
        const current = fest.proShow?.toObject?.() || fest.proShow || {};
        const next = {
            enabled: body.enabled !== undefined ? Boolean(body.enabled) : Boolean(current.enabled),
            title: body.title !== undefined ? String(body.title || 'Pro Show').trim().slice(0, 120) : (current.title || 'Pro Show'),
            venue: body.venue !== undefined ? String(body.venue || '').trim().slice(0, 200) : (current.venue || ''),
            showAt: body.showAt !== undefined
                ? (body.showAt ? new Date(body.showAt) : null)
                : (current.showAt || null),
            capacity: body.capacity !== undefined
                ? Math.max(0, Number(body.capacity) || 0)
                : Math.max(0, Number(current.capacity) || 0),
            salesOpen: body.salesOpen !== undefined ? Boolean(body.salesOpen) : (current.salesOpen !== false),
            notes: body.notes !== undefined ? String(body.notes || '').trim().slice(0, 1000) : (current.notes || ''),
            tiers: body.tiers !== undefined ? normalizeTier(body.tiers) : normalizeTier(current.tiers),
        };

        if (next.enabled && (!next.tiers || !next.tiers.length)) {
            next.tiers = defaultTiers();
        }

        fest.proShow = next;
        fest.markModified('proShow');
        await fest.save();

        const ops = await loadOps(req.festId);
        res.json({ success: true, message: 'Pro Show updated', ...ops });
    } catch (error) {
        console.error('[festProShow.updateConfig]', error);
        res.status(500).json({ success: false, message: 'Failed to update Pro Show' });
    }
};

exports.listProShowTickets = async (req, res) => {
    try {
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(100, Math.max(10, Number(req.query.limit) || 30));
        const skip = (page - 1) * limit;
        const status = String(req.query.status || '').trim();
        const passType = String(req.query.passType || '').trim();
        const tierId = String(req.query.tierId || '').trim();
        const checkInStatus = String(req.query.checkInStatus || '').trim();
        const search = String(req.query.search || '').trim();

        const filter = { fest: req.festId, isProShow: true };
        if (['pending', 'approved', 'rejected'].includes(status)) filter.status = status;
        else filter.status = { $in: ['pending', 'approved'] };
        if (PASS_TYPES.includes(passType)) filter.proShowPassType = passType;
        if (tierId) filter.proShowTierId = tierId;
        if (checkInStatus === 'checked_in') filter.checkedIn = true;
        if (checkInStatus === 'not_in') {
            filter.checkedIn = { $ne: true };
            filter.status = 'approved';
        }

        if (search) {
            const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            const userIds = await User.find({
                $or: [{ name: regex }, { email: regex }, { phone: regex }, { phoneNumber: regex }],
            }).select('_id').lean();
            filter.user = { $in: userIds.map((u) => u._id) };
        }

        const [total, rows] = await Promise.all([
            Registration.countDocuments(filter),
            Registration.find(filter)
                .populate('user', 'name email phone phoneNumber')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
        ]);

        res.json({
            success: true,
            tickets: rows.map(formatTicket),
            pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
        });
    } catch (error) {
        console.error('[festProShow.listTickets]', error);
        res.status(500).json({ success: false, message: 'Failed to list tickets' });
    }
};

/** Issue offline / VIP / guest / press / crew pass (same QR as online) */
exports.issueProShowPass = async (req, res) => {
    try {
        const fest = await FestOrganizer.findById(req.festId).select('festName proShow').lean();
        if (!fest) return res.status(404).json({ success: false, message: 'Fest not found' });

        const config = formatConfig(fest.proShow || {});
        if (!config.enabled) {
            return res.status(400).json({ success: false, message: 'Enable Pro Show first' });
        }

        const name = String(req.body.name || '').trim().slice(0, 120);
        const phone = String(req.body.phone || '').trim().replace(/\s+/g, '').slice(0, 20);
        const email = String(req.body.email || '').trim().toLowerCase();
        const note = String(req.body.note || '').trim().slice(0, 500);
        const passTypeRaw = String(req.body.passType || 'offline').trim().toLowerCase();
        const passType = PASS_TYPES.includes(passTypeRaw) ? passTypeRaw : 'offline';
        const tierId = String(req.body.tierId || '').trim();

        if (!name || name.length < 2) {
            return res.status(400).json({ success: false, message: 'Name is required' });
        }
        if (!phone && !email) {
            return res.status(400).json({ success: false, message: 'Phone or email is required' });
        }

        const ops = await loadOps(req.festId);
        if (ops.stats.soldOut && !['vip', 'guest', 'press', 'crew', 'offline'].includes(passType)) {
            return res.status(400).json({ success: false, message: 'Pro Show is sold out' });
        }

        let tier = config.tiers.find((t) => t.id === tierId) || null;
        if (!tier) {
            if (passType === 'vip') tier = config.tiers.find((t) => t.kind === 'vip') || config.tiers[0];
            else tier = config.tiers.find((t) => t.kind === 'ga') || config.tiers[0];
        }
        if (!tier) {
            return res.status(400).json({ success: false, message: 'Add at least one ticket tier' });
        }

        const paymentStatusRaw = String(req.body.paymentStatus || (passType === 'online' ? 'paid' : 'free')).trim().toLowerCase();
        const paymentStatus = ['free', 'pending', 'paid', 'failed'].includes(paymentStatusRaw)
            ? paymentStatusRaw
            : 'free';
        let amountPaid = Number(req.body.amountPaid);
        if (!Number.isFinite(amountPaid)) {
            amountPaid = paymentStatus === 'paid' ? Number(tier.price) || 0 : 0;
        }
        amountPaid = Math.max(0, amountPaid);

        let user = null;
        if (email) user = await User.findOne({ email });
        if (!user && phone) {
            user = await User.findOne({ $or: [{ phone }, { phoneNumber: phone }] });
        }
        if (!user) {
            user = new User({
                name,
                email: email || `proshow+${crypto.randomBytes(6).toString('hex')}@crwdctrl.local`,
                ...(phone ? { phoneNumber: phone } : {}),
                password: crypto.randomBytes(24).toString('hex'),
                isVerified: true,
                signupMethod: 'password',
            });
            await user.save();
        }

        const responses = {
            full_name: name,
            ...(phone ? { phone } : {}),
            ...(email ? { email } : {}),
            pro_show: 'yes',
            pro_show_tier_id: tier.id,
            pro_show_tier_name: tier.name,
            pro_show_pass_type: passType,
            manual_entry: 'yes',
            added_by_organizer: 'yes',
            organizer_note: note || `Issued ${passType} pass`,
        };

        const reg = await Registration.create({
            fest: req.festId,
            user: user._id,
            isProShow: true,
            proShowTierId: tier.id,
            proShowPassType: passType,
            responses,
            status: 'approved',
            paymentStatus,
            amountPaid,
            payment_gateway: 'manual_organizer',
            submittedAt: new Date(),
        });

        const populated = await Registration.findById(reg._id)
            .populate('user', 'name email phone phoneNumber')
            .lean();

        const fresh = await loadOps(req.festId);
        res.status(201).json({
            success: true,
            message: `${passType} pass issued`,
            ticket: formatTicket(populated),
            stats: fresh.stats,
            tiers: fresh.tiers,
        });
    } catch (error) {
        console.error('[festProShow.issuePass]', error);
        if (error?.code === 11000) {
            return res.status(409).json({ success: false, message: 'Duplicate ticket conflict' });
        }
        res.status(500).json({ success: false, message: 'Failed to issue pass' });
    }
};
