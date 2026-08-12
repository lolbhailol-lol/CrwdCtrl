const Registration = require('../model/registration_model');
const { createNotification } = require('../controllers/notificationController');

function pickPhone(user, responses = {}) {
    return String(
        user?.phone
        || user?.phoneNumber
        || responses.contact_no
        || responses.phone
        || responses.mobile
        || '',
    ).trim();
}

function pickName(user, responses = {}) {
    return String(
        user?.name
        || responses.full_name
        || responses.name
        || responses.leader_name
        || '',
    ).trim();
}

function responsesToObject(responses) {
    if (!responses) return {};
    if (responses instanceof Map) return Object.fromEntries(responses);
    if (typeof responses === 'object') return responses;
    return {};
}

/**
 * Build registration filter for outreach audiences.
 * audience: approved | pending | unpaid | not_in | checked_in | all_active
 */
function buildAudienceFilter({ festId, competitionId = null, audience = 'approved' }) {
    const filter = {
        fest: festId,
        user: { $ne: null },
        isProShow: { $ne: true },
    };
    if (competitionId) filter.competitionId = competitionId;

    switch (String(audience || 'approved')) {
        case 'pending':
            filter.status = 'pending';
            break;
        case 'unpaid':
            filter.status = { $in: ['pending', 'approved'] };
            filter.paymentStatus = 'pending';
            break;
        case 'not_in':
            filter.status = 'approved';
            filter.checkedIn = { $ne: true };
            break;
        case 'checked_in':
            filter.status = 'approved';
            filter.checkedIn = true;
            break;
        case 'all_active':
            filter.status = { $in: ['pending', 'approved'] };
            break;
        case 'approved':
        default:
            filter.status = 'approved';
            break;
    }
    return filter;
}

async function listFestContacts({
    festId,
    competitionId = null,
    audience = 'approved',
    limit = 200,
}) {
    const filter = buildAudienceFilter({ festId, competitionId, audience });
    const regs = await Registration.find(filter)
        .populate('user', 'name email phone phoneNumber')
        .populate('competitionId', 'name competitionName')
        .sort({ createdAt: -1 })
        .limit(Math.min(400, Math.max(10, Number(limit) || 200)))
        .lean();

    const seen = new Set();
    const contacts = [];
    for (const reg of regs) {
        const user = reg.user && typeof reg.user === 'object' ? reg.user : null;
        const responses = responsesToObject(reg.responses);
        const phone = pickPhone(user, responses);
        const name = pickName(user, responses) || 'Participant';
        const email = user?.email || responses.email || '';
        const key = phone || String(user?._id || reg._id);
        if (seen.has(key)) continue;
        seen.add(key);
        contacts.push({
            id: reg._id,
            userId: user?._id || reg.user,
            name,
            phone,
            email,
            status: reg.status,
            paymentStatus: reg.paymentStatus || 'free',
            amountPaid: Number(reg.amountPaid) || 0,
            checkedIn: Boolean(reg.checkedIn),
            competitionId: reg.competitionId?._id || reg.competitionId || null,
            competitionName: reg.competitionId?.name || reg.competitionId?.competitionName || '',
        });
    }

    return {
        audience,
        total: contacts.length,
        withPhone: contacts.filter((c) => c.phone).length,
        contacts,
    };
}

async function notifyFestParticipants({
    festId,
    festName,
    title,
    message,
    type = 'announcement',
    link = null,
    statusFilter = ['approved'],
    competitionId = null,
    audience = null,
}) {
    const filter = audience
        ? buildAudienceFilter({ festId, competitionId, audience })
        : {
            fest: festId,
            status: { $in: statusFilter },
            user: { $ne: null },
            ...(competitionId ? { competitionId } : {}),
        };

    const regs = await Registration.find(filter)
        .select('user')
        .lean();

    const userIds = [...new Set(regs.map((r) => String(r.user)).filter(Boolean))];
    let inApp = 0;
    for (const userId of userIds) {
        try {
            const created = await createNotification({
                userId,
                title,
                message,
                type,
                link: link || `/view-details/${festId}`,
                metadata: { festId, festName, source: 'fest_organizer', audience: audience || null },
            });
            if (created) inApp += 1;
        } catch (_) { /* continue */ }
    }

    return { participants: userIds.length, inApp };
}

module.exports = {
    notifyFestParticipants,
    listFestContacts,
    buildAudienceFilter,
};
