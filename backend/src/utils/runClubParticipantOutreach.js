const CategoryRegistration = require('../model/category_registration_model');
const { createNotification } = require('../controllers/notificationController');
const { sendPushNotification } = require('../services/pushService');
const { sendTrekParticipantEmails } = require('../services/emailService');
const { responsesToObject, normalizeRegistrationForFormat } = require('./runClubOrganizerFormat');
const { pickFormField } = require('./trekOrganizerFormat');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

function resolveParticipantEmail(reg) {
    const booking = normalizeRegistrationForFormat(reg);
    const email = (booking.userEmail || pickFormField(booking.formData, ['email', 'e_mail', 'Email']) || '')
        .trim()
        .toLowerCase();
    return EMAIL_REGEX.test(email) ? email : null;
}

function resolveParticipantName(reg) {
    const booking = normalizeRegistrationForFormat(reg);
    return booking.userName || pickFormField(booking.formData, ['full_name', 'name']) || 'Participant';
}

function resolveUserId(reg) {
    if (!reg.user) return null;
    return reg.user._id || reg.user;
}

function preferenceKeysForType(type) {
    if (type === 'registration') {
        return { push: 'registrationAlerts', email: 'registrationAlerts' };
    }
    return { push: 'pushReminders', email: 'emailReminders' };
}

function shouldSendChannel(prefs = {}, key) {
    return prefs[key] !== false;
}

async function loadConfirmedParticipants(eventId) {
    return CategoryRegistration.find({
        category: 'sports',
        eventId,
        status: 'confirmed',
    })
        .populate('user', 'name email phoneNumber notificationPreferences')
        .lean();
}

async function notifyRunClubParticipant({
    registration,
    eventId,
    eventTitle,
    title,
    message,
    type,
    link,
    emailSubject,
    metadata = {},
    skipEmail = false,
}) {
    const userId = resolveUserId(registration);
    const email = resolveParticipantEmail(registration);
    const name = resolveParticipantName(registration);
    const prefs = registration.user?.notificationPreferences || {};
    const keys = preferenceKeysForType(type);

    const result = { inApp: false, push: false, email: false, userId, emailAddress: email };

    if (userId) {
        const created = await createNotification({
            userId,
            title,
            message,
            type,
            link,
            metadata: { eventId, ...metadata },
        });
        result.inApp = !!created;

        if (shouldSendChannel(prefs, keys.push)) {
            const pushResult = await sendPushNotification(
                userId,
                { title, body: message, link, type },
                { preferenceKey: keys.push },
            );
            result.push = !!pushResult?.success;
        }
    }

    const sendEmailToGuest = !userId && email;
    const sendEmailToUser = userId && email && shouldSendChannel(prefs, keys.email);

    if (!skipEmail && (sendEmailToGuest || sendEmailToUser)) {
        const emailResult = await sendTrekParticipantEmails([
            {
                email,
                name,
                subject: emailSubject || title,
                title,
                message,
                trekName: eventTitle || 'Run',
                link: link || `/sports/run/${eventId}`,
                kind: type,
            },
        ]);
        result.email = (emailResult?.success || 0) > 0;
    }

    return result;
}

async function notifyRunClubParticipants({
    eventId,
    eventTitle,
    title,
    message,
    type,
    link,
    emailSubject,
    metadata = {},
}) {
    const registrations = await loadConfirmedParticipants(eventId);
    const stats = { inApp: 0, push: 0, email: 0, participants: registrations.length, skipped: 0 };
    const emailed = new Set();

    for (const registration of registrations) {
        const userId = resolveUserId(registration);
        const email = resolveParticipantEmail(registration);
        if (!userId && !email) {
            stats.skipped += 1;
            continue;
        }

        const result = await notifyRunClubParticipant({
            registration,
            eventId,
            eventTitle,
            title,
            message,
            type,
            link,
            emailSubject,
            metadata,
            skipEmail: email ? emailed.has(email) : false,
        });

        if (result.inApp) stats.inApp += 1;
        if (result.push) stats.push += 1;
        if (result.email && email) {
            emailed.add(email);
            stats.email += 1;
        }
    }

    return stats;
}

module.exports = {
    loadConfirmedParticipants,
    notifyRunClubParticipant,
    notifyRunClubParticipants,
};
