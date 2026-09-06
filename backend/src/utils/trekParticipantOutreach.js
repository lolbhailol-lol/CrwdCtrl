const TrekBooking = require('../model/trek_booking_model');
const { createNotification } = require('../controllers/notificationController');
const { sendPushNotification } = require('../services/pushService');
const { sendTrekParticipantEmails } = require('../services/emailService');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

function pickFormEmail(formData = {}) {
    const keys = ['email', 'e_mail', 'Email', 'E-mail', 'user_email'];
    for (const key of keys) {
        const val = formData[key];
        if (val && EMAIL_REGEX.test(String(val).trim())) {
            return String(val).trim().toLowerCase();
        }
    }
    return null;
}

function resolveParticipantEmail(booking) {
    const populated = booking.userId && typeof booking.userId === 'object' ? booking.userId : null;
    const email = (populated?.email || booking.userEmail || pickFormEmail(booking.formData) || '').trim().toLowerCase();
    return EMAIL_REGEX.test(email) ? email : null;
}

function resolveParticipantName(booking) {
    const populated = booking.userId && typeof booking.userId === 'object' ? booking.userId : null;
    return populated?.name || booking.userName || 'Participant';
}

function resolveUserId(booking) {
    if (!booking.userId) return null;
    return booking.userId._id || booking.userId;
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

async function loadConfirmedParticipants(trekId) {
    return TrekBooking.find({ trekId, status: 'confirmed' })
        .populate('userId', 'name email notificationPreferences')
        .select('userId userName userEmail formData')
        .lean();
}

/**
 * Notify a trek participant via in-app, push, and/or email.
 */
async function notifyTrekParticipant({
    booking,
    trekId,
    trekName,
    title,
    message,
    type,
    link,
    emailSubject,
    metadata = {},
    skipEmail = false,
}) {
    const userId = resolveUserId(booking);
    const email = resolveParticipantEmail(booking);
    const name = resolveParticipantName(booking);
    const prefs = booking.userId?.notificationPreferences || {};
    const keys = preferenceKeysForType(type);

    const result = { inApp: false, push: false, email: false, userId, emailAddress: email };

    if (userId) {
        const created = await createNotification({
            userId,
            title,
            message,
            type,
            link,
            metadata: { trekId, ...metadata },
        });
        result.inApp = !!created;

        if (shouldSendChannel(prefs, keys.push)) {
            const pushResult = await sendPushNotification(userId, {
                title,
                body: message,
                link,
                type,
            }, { preferenceKey: keys.push });
            result.push = !!pushResult?.success;
        }
    }

    const sendEmailToGuest = !userId && email;
    const sendEmailToUser = userId && email && shouldSendChannel(prefs, keys.email);

    if (!skipEmail && (sendEmailToGuest || sendEmailToUser)) {
        const emailResult = await sendTrekParticipantEmails([{
            email,
            name,
            subject: emailSubject || title,
            title,
            message,
            trekName: trekName || 'Trek',
            link: link || `/trek/${trekId}`,
            kind: type,
        }]);
        result.email = (emailResult?.success || 0) > 0;
    }

    return result;
}

/**
 * Notify many participants; dedupes in-app/push by userId and email by address.
 */
async function notifyTrekParticipants({
    trekId,
    trekName,
    title,
    message,
    type,
    link,
    emailSubject,
    metadata = {},
}) {
    const bookings = await loadConfirmedParticipants(trekId);
    const stats = { inApp: 0, push: 0, email: 0, participants: bookings.length, skipped: 0 };
    const emailed = new Set();

    for (const booking of bookings) {
        const userId = resolveUserId(booking);
        const email = resolveParticipantEmail(booking);
        if (!userId && !email) {
            stats.skipped += 1;
            continue;
        }

        const result = await notifyTrekParticipant({
            booking,
            trekId,
            trekName,
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
    notifyTrekParticipant,
    notifyTrekParticipants,
    resolveParticipantEmail,
    resolveParticipantName,
    resolveUserId,
};
