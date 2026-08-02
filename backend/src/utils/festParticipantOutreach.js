const Registration = require('../model/registration_model');
const { createNotification } = require('../controllers/notificationController');

async function notifyFestParticipants({
    festId,
    festName,
    title,
    message,
    type = 'announcement',
    link = null,
    statusFilter = ['approved'],
    competitionId = null,
}) {
    const filter = {
        fest: festId,
        status: { $in: statusFilter },
        user: { $ne: null },
    };
    if (competitionId) filter.competitionId = competitionId;

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
                metadata: { festId, festName, source: 'fest_organizer' },
            });
            if (created) inApp += 1;
        } catch (_) { /* continue */ }
    }

    return { participants: userIds.length, inApp };
}

module.exports = { notifyFestParticipants };
