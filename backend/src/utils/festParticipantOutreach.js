const Registration = require('../model/registration_model');
const { createNotification } = require('../controllers/notificationController');
const { sendFestParticipantEmails } = require('../services/emailService');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

function pickPhone(user, responses = {}) {
    const members = responses.team_members;
    const leadPhone = Array.isArray(members) && members[0] && typeof members[0] === 'object'
        ? String(members[0].phone || members[0].mobile || '').trim()
        : '';
    return String(
        user?.phone
        || user?.phoneNumber
        || responses.contact_no
        || responses.phone
        || responses.mobile
        || leadPhone
        || '',
    ).trim();
}

function pickName(user, responses = {}) {
    const members = responses.team_members;
    const leadName = Array.isArray(members) && members[0] && typeof members[0] === 'object'
        ? String(members[0].name || '').trim()
        : '';
    return String(
        user?.name
        || responses.full_name
        || responses.name
        || responses.leader_name
        || leadName
        || '',
    ).trim();
}

function pickEmail(user, responses = {}) {
    const members = responses.team_members;
    const leadEmail = Array.isArray(members) && members[0] && typeof members[0] === 'object'
        ? String(members[0].email || '').trim().toLowerCase()
        : '';
    const email = String(user?.email || responses.email || leadEmail || '').trim().toLowerCase();
    return EMAIL_REGEX.test(email) ? email : '';
}

function responsesToObject(responses) {
    if (!responses) return {};
    if (responses instanceof Map) return Object.fromEntries(responses);
    if (typeof responses === 'object') return responses;
    return {};
}

function parseNotifyChannels(body = {}) {
    const raw = body.channels;
    if (Array.isArray(raw)) {
        return {
            inApp: raw.includes('inApp') || raw.includes('in_app') || raw.includes('app'),
            email: raw.includes('email'),
        };
    }
    if (body.sendEmail === true) {
        return { inApp: body.sendInApp !== false, email: true };
    }
    return {
        inApp: body.sendInApp !== false,
        email: Boolean(body.email),
    };
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
        const email = pickEmail(user, responses);
        const key = phone || email || String(user?._id || reg._id);
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
        withEmail: contacts.filter((c) => c.email).length,
        contacts,
    };
}

async function notifyFestParticipant({
    registration,
    festId,
    festName,
    title,
    message,
    type = 'announcement',
    link = null,
    channels = { inApp: true, email: false },
    competitionName = '',
}) {
    const reg = registration;
    const user = reg.user && typeof reg.user === 'object' ? reg.user : null;
    const userId = user?._id || reg.user || null;
    const responses = responsesToObject(reg.responses);
    const name = pickName(user, responses) || 'Participant';
    const email = pickEmail(user, responses);
    const compName = competitionName
        || reg.competitionId?.name
        || reg.competitionId?.competitionName
        || '';

    const result = { inApp: false, email: false, userId, emailAddress: email || null };

    if (channels.inApp !== false && userId) {
        try {
            const created = await createNotification({
                userId,
                title,
                message,
                type,
                link: link || `/view-details/${festId}`,
                metadata: {
                    festId,
                    festName,
                    registrationId: reg._id,
                    competitionId: reg.competitionId?._id || reg.competitionId || null,
                    source: 'fest_organizer',
                },
            });
            result.inApp = !!created;
        } catch (_) { /* continue */ }
    }

    if (channels.email && email) {
        const emailResult = await sendFestParticipantEmails([{
            email,
            name,
            subject: title,
            title,
            message,
            trekName: compName ? `${festName} — ${compName}` : (festName || 'Fest'),
            link: link || `/view-details/${festId}`,
            kind: type === 'reminder' ? 'reminder' : 'organizer',
            product: 'fest',
        }]);
        result.email = (emailResult?.success || 0) > 0;
    }

    return result;
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
    channels = { inApp: true, email: false },
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
        .populate('user', 'name email phone phoneNumber')
        .populate('competitionId', 'name competitionName')
        .lean();

    const stats = { participants: regs.length, inApp: 0, email: 0, skipped: 0 };
    const emailed = new Set();

    for (const reg of regs) {
        const user = reg.user && typeof reg.user === 'object' ? reg.user : null;
        const userId = user?._id || reg.user;
        const email = pickEmail(user, responsesToObject(reg.responses));
        if (!userId && !email) {
            stats.skipped += 1;
            continue;
        }

        const result = await notifyFestParticipant({
            registration: reg,
            festId,
            festName,
            title,
            message,
            type,
            link,
            channels: {
                inApp: channels.inApp !== false && Boolean(userId),
                email: channels.email && Boolean(email) && !emailed.has(email),
            },
        });

        if (result.inApp) stats.inApp += 1;
        if (result.email) {
            stats.email += 1;
            if (email) emailed.add(email);
        }
    }

    return stats;
}

module.exports = {
    notifyFestParticipants,
    notifyFestParticipant,
    listFestContacts,
    buildAudienceFilter,
    parseNotifyChannels,
};
