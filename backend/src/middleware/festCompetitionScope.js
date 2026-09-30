const mongoose = require('mongoose');
const Registration = require('../model/registration_model');
const { getCompetitionScope } = require('../utils/festOrganizerPages');

const idOf = (value) => String(value?._id || value || '');

function deny(res, message = 'You do not have access to this competition') {
    return res.status(403).json({ success: false, message });
}

/** Read access to participant data: participants or scanner section. */
function readableIds(scope) {
    return new Set([...scope.participants, ...scope.scanner]);
}

/**
 * Filter a JSON response for competition-limited co-heads.
 * `transform` receives the body and returns the filtered body.
 */
function filterJson(res, transform) {
    const original = res.json.bind(res);
    res.json = (body) => {
        if (body && typeof body === 'object' && body.success !== false) {
            try {
                return original(transform(body));
            } catch (error) {
                console.error('[festCompetitionScope] response filter failed', error);
                return original({ success: false, message: 'Access filter failed' });
            }
        }
        return original(body);
    };
}

const MONEY_FIELDS = ['revenue', 'grossCollected'];

function scopeDashboard(body, scope) {
    const visible = scope.all;
    const rows = (Array.isArray(body.competitions) ? body.competitions : [])
        .filter((row) => row.id && visible.has(idOf(row.id)))
        .map((row) => {
            if (scope.revenue.has(idOf(row.id))) return row;
            const copy = { ...row };
            MONEY_FIELDS.forEach((key) => { if (key in copy) copy[key] = 0; });
            return copy;
        });
    const sum = (key) => rows.reduce((total, row) => total + (Number(row[key]) || 0), 0);
    const approved = sum('approved');
    const checkedIn = sum('checkedIn');
    const revenue = Math.round(sum('revenue') * 100) / 100;
    const visibleNames = new Set(rows.map((row) => String(row.name || '').toLowerCase()));
    return {
        ...body,
        competitionScoped: true,
        stats: {
            totalRegistrations: approved,
            totalParticipants: sum('participants'),
            festDayAttendees: 0,
            pendingRegistrations: sum('pending'),
            rejectedRegistrations: sum('rejected'),
            allActive: approved + sum('pending'),
            checkedIn,
            pendingCheckIn: Math.max(0, approved - checkedIn),
            checkInRate: approved > 0 ? Math.round((checkedIn / approved) * 100) : 0,
            revenue,
            grossCollected: Math.round(sum('grossCollected') * 100) / 100,
            earlierClearGross: 0,
            earlierClearRevenue: 0,
            razorpayPaidGross: 0,
            razorpayPaidRevenue: 0,
            cashfreeLockGross: 0,
            cashfreeLockRevenue: 0,
            gatewayFees: 0,
            additionalDeduction: 0,
            totalDeductions: 0,
            todayRegistrations: 0,
            competitionCount: rows.length,
            payments: { free: 0, pending: 0, paid: 0, failed: 0, unknown: 0, paidAmount: 0 },
        },
        competitions: rows,
        recent: (Array.isArray(body.recent) ? body.recent : [])
            .filter((row) => visibleNames.has(String(row.competitionName || '').toLowerCase()))
            .map((row) => {
                const comp = rows.find((r) => String(r.name || '').toLowerCase() === String(row.competitionName || '').toLowerCase());
                return comp && scope.revenue.has(idOf(comp.id)) ? row : { ...row, amountPaid: 0 };
            }),
    };
}

function scopeDesk(body, scope) {
    const allowed = scope.desk;
    const competitions = (Array.isArray(body.competitions) ? body.competitions : [])
        .filter((row) => allowed.has(idOf(row._id || row.id)));
    const names = new Set(competitions.map((row) => String(row.name || '').toLowerCase()));
    return {
        ...body,
        festDayAttendees: 0,
        competitions,
        activity: (Array.isArray(body.activity) ? body.activity : [])
            .filter((row) => allowed.has(idOf(row.competitionId))),
        bundleActivity: (Array.isArray(body.bundleActivity) ? body.bundleActivity : [])
            .filter((row) => {
                const list = Array.isArray(row.competitionNames) ? row.competitionNames : [];
                return list.length && list.every((name) => names.has(String(name || '').toLowerCase()));
            }),
    };
}

function scopeCompetitionList(body, allowed) {
    const out = { ...body };
    if (Array.isArray(body.competitions)) {
        out.competitions = body.competitions.filter((row) => allowed.has(idOf(row.id || row._id)));
    }
    return out;
}

async function registrationCompetitionIds(ids, festId) {
    const valid = (ids || []).filter((id) => mongoose.Types.ObjectId.isValid(String(id)));
    if (!valid.length) return [];
    const rows = await Registration.find({ _id: { $in: valid }, fest: festId }).select('competitionId').lean();
    return rows.map((row) => idOf(row.competitionId));
}

/**
 * Enforce per-competition access for competition-limited co-heads.
 * Runs after page-level checks in requireFestAccess.
 */
async function enforceCompetitionScope(req, res, next) {
    const scope = getCompetitionScope(req.organizer, req.festId);
    if (!scope) return next();
    req.competitionScope = scope;

    const method = String(req.method || 'GET').toUpperCase();
    const path = String(req.path || '');
    const body = req.body || {};
    const query = req.query || {};
    const readable = readableIds(scope);

    try {
        if (/\/dashboard$/.test(path)) {
            filterJson(res, (b) => scopeDashboard(b, scope));
            return next();
        }

        if (/\/competitions\/probables/.test(path)) return deny(res);
        const compMatch = path.match(/\/competitions\/([a-f0-9]{24})(\/|$)/i);
        if (compMatch) {
            if (method !== 'GET') return deny(res, 'Competition-limited access is read-only here');
            return scope.all.has(compMatch[1]) ? next() : deny(res);
        }
        if (/\/competitions$/.test(path)) {
            if (method !== 'GET') return deny(res, 'Competition-limited access cannot create competitions');
            filterJson(res, (b) => scopeCompetitionList(b, scope.all));
            return next();
        }

        if (/\/checkin$/.test(path) && method === 'POST') {
            const competitionId = String(body.competitionId || '');
            if (body.proShowOnly || body.proShow) return deny(res);
            if (!scope.scanner.has(competitionId)) return deny(res, 'Pick one of your competitions to scan');
            return next();
        }
        if (/\/checkin\/stats$/.test(path)) {
            return scope.scanner.has(String(query.competitionId || '')) ? next() : deny(res, 'Pick one of your competitions');
        }

        if (/\/fest-day-desk$/.test(path) && method === 'GET') {
            filterJson(res, (b) => scopeDesk(b, scope));
            return next();
        }
        if (/\/fest-day-desk\/registrations$/.test(path)) {
            return scope.desk.has(String(body.competitionId || '')) ? next() : deny(res);
        }
        if (/\/fest-day-desk\/bundles$/.test(path)) {
            const items = Array.isArray(body.items) ? body.items : [];
            const ok = items.length && items.every((item) => scope.desk.has(idOf(item?.competitionId)));
            return ok ? next() : deny(res, 'Every event in this bundle must be one of your competitions');
        }
        if (/\/fest-day-desk\/orders\/[^/]+\/refresh$/.test(path)) return next();
        if (/\/fest-day-desk/.test(path)) return deny(res, 'Only main organizers can do this');

        if (/\/participants\/manual$/.test(path)) {
            return scope.participants.has(String(body.competitionId || '')) ? next() : deny(res);
        }
        if (/\/participants\/bulk-status$/.test(path)) {
            const comps = await registrationCompetitionIds(body.registrationIds || body.ids, req.festId);
            return comps.length && comps.every((id) => scope.participants.has(id)) ? next() : deny(res);
        }
        if (/\/participants(\/export|\/lookup)?$/.test(path) && method === 'GET') {
            const requested = String(query.competitionId || '');
            if (requested && !readable.has(requested)) return deny(res);
            if (query.proShow || query.proShowOnly) return deny(res);
            filterJson(res, (b) => scopeCompetitionList(b, readable));
            return next();
        }
        const regMatch = path.match(/\/participants\/([a-f0-9]{24})(\/|$)/i);
        if (regMatch) {
            const [competitionId] = await registrationCompetitionIds([regMatch[1]], req.festId);
            const allowed = method === 'GET' ? readable : scope.participants;
            return competitionId && allowed.has(competitionId) ? next() : deny(res);
        }

        return next();
    } catch (error) {
        console.error('[festCompetitionScope]', error);
        return res.status(500).json({ success: false, message: 'Access check failed' });
    }
}

/** Mongo competitionId filter for list/export/lookup queries, or null when unscoped. */
function scopedCompetitionFilter(req) {
    if (!req.competitionScope) return null;
    const ids = [...readableIds(req.competitionScope)]
        .filter((id) => mongoose.Types.ObjectId.isValid(id))
        .map((id) => new mongoose.Types.ObjectId(id));
    return { $in: ids };
}

module.exports = {
    enforceCompetitionScope,
    scopedCompetitionFilter,
};
