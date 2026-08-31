const CategoryRegistration = require('../model/category_registration_model');
const crypto = require('crypto');
const { createNotification } = require('../controllers/notificationController');
const { sendPushNotification } = require('../services/pushService');
const { sendTrekParticipantEmails } = require('../services/emailService');
const { normalizeRegistrationForFormat } = require('./runClubOrganizerFormat');
const { pickFormField } = require('./trekOrganizerFormat');
const { decryptRegistrationPii, decryptManyRegistrations } = require('./runClubPiiCrypto');
const SportsEvent = require('../model/sports_model');
const { resolveRunClubGroupLink } = require('./resolveRunClubGroupLink');
const { listingHubForRunClubId } = require('./listingHubCopy');
const { primaryCoverUrl } = require('./sanitizeCoverImages');

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

async function ensureRegistrationQrHash(registration) {
    const regId = registration?._id;
    if (!regId) return registration?.qrCodeData || '';
    if (registration.qrCodeData) return registration.qrCodeData;
    const qrHash = crypto.randomBytes(16).toString('hex');
    await CategoryRegistration.updateOne({ _id: regId }, { $set: { qrCodeData: qrHash } });
    return qrHash;
}

function pickBookingDateTime(registration, eventDoc) {
    const form = normalizeRegistrationForFormat(registration).formData || {};
    const date = registration.bookingDate
        || form.date
        || form.run_date
        || form.event_date
        || (eventDoc?.eventDate ? new Date(eventDoc.eventDate).toLocaleDateString('en-IN', {
            day: 'numeric', month: 'long', year: 'numeric',
        }) : '');
    const time = registration.bookingTime || form.time || form.time_slot || '';
    const venue = eventDoc?.venue || eventDoc?.city || form.venue || '';
    return { date: String(date || '').trim(), time: String(time || '').trim(), venue: String(venue || '').trim() };
}

async function loadConfirmedParticipants(eventId) {
    const [regs, event] = await Promise.all([
        CategoryRegistration.find({
            category: 'sports',
            eventId,
            status: 'confirmed',
        })
            .populate('user', 'name email phoneNumber notificationPreferences')
            .lean(),
        SportsEvent.findById(eventId).select('runClubId').lean(),
    ]);
    const runClubId = event?.runClubId || null;
    return decryptManyRegistrations(regs, runClubId);
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
    groupLink = '',
    communityName = '',
    paymentContext = null,
    includeGroupLink = false,
}) {
    const decrypted = decryptRegistrationPii(registration, registration?.runClubId);
    const userId = resolveUserId(decrypted);
    const email = resolveParticipantEmail(decrypted);
    const name = resolveParticipantName(decrypted);
    const prefs = decrypted.user?.notificationPreferences || {};
    const keys = preferenceKeysForType(type);

    let resolvedGroup = { groupLink: groupLink || '', communityName: communityName || '' };
    if (includeGroupLink && !resolvedGroup.groupLink && eventId) {
        resolvedGroup = await resolveRunClubGroupLink(eventId, {
            runClubId: registration?.runClubId || decrypted?.runClubId,
        });
    }

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

    // Booking confirmations are transactional — always email when we have an address.
    // Push/in-app still respect notification preferences.
    const isTransactionalRegistration = type === 'registration';
    const sendEmailToGuest = !userId && email;
    const sendEmailToUser = userId && email && (isTransactionalRegistration || shouldSendChannel(prefs, keys.email));

    if (!skipEmail && (sendEmailToGuest || sendEmailToUser)) {
        let coverImage = '';
        let product = 'run';
        let eventDoc = null;
        if (eventId) {
            try {
                eventDoc = await SportsEvent.findById(eventId)
                    .select('coverImage coverImages runClubId title eventDate venue city')
                    .lean();
                coverImage = primaryCoverUrl(eventDoc?.coverImages || {}, eventDoc?.coverImage || '') || '';
                const hub = await listingHubForRunClubId(eventDoc?.runClubId || registration?.runClubId || decrypted?.runClubId);
                if (hub === 'events') product = 'event';
            } catch (err) {
                console.warn('[notifyRunClubParticipant] cover/hub lookup failed:', err.message);
            }
        }

        const regId = decrypted._id ? String(decrypted._id) : '';
        const isConfirmedRegistration = type === 'registration' && decrypted.status === 'confirmed';
        const ticketHref = isConfirmedRegistration && regId
            ? `/qr-ticket/${regId}?type=sports`
            : (link || `/sports/run/${eventId}`);
        const bookingHref = regId
            ? `/registration-details/${regId}?type=sports`
            : (link || `/sports/run/${eventId}`);

        let ticket = null;
        if (isConfirmedRegistration && regId) {
            const qrHash = await ensureRegistrationQrHash(decrypted);
            const { date, time, venue } = pickBookingDateTime(decrypted, eventDoc);
            ticket = {
                qrHash,
                eventTitle: eventTitle || eventDoc?.title || '',
                participantName: name,
                date,
                time,
                venue,
                ticketHref,
                bookingHref,
            };
        }

        const emailResult = await sendTrekParticipantEmails([
            {
                email,
                name,
                subject: emailSubject || title,
                title,
                message,
                trekName: eventTitle || resolvedGroup.eventTitle || (product === 'event' ? 'Event' : 'Run'),
                link: ticketHref,
                kind: type,
                product,
                coverImage,
                groupLink: includeGroupLink ? resolvedGroup.groupLink : (groupLink || ''),
                communityName: includeGroupLink ? resolvedGroup.communityName : (communityName || ''),
                paymentContext,
                ticket,
            },
        ]);
        result.email = (emailResult?.success || 0) > 0;
    } else if (!skipEmail && !email) {
        console.warn('[notifyRunClubParticipant] No email address for participant', {
            eventId,
            registrationId: registration?._id ? String(registration._id) : undefined,
            userId: userId ? String(userId) : null,
            type,
        });
    }

    return result;
}

/** Fire-and-forget confirmation for a confirmed sports / event-community registration. */
async function sendRunClubRegistrationConfirmation({
    registration,
    eventId,
    eventTitle,
    runClubId,
    paymentStatus = 'free',
    paymentGateway = '',
    stage = 'confirmed',
}) {
    if (!registration || registration.status !== 'confirmed') return null;

    const regId = registration._id ? String(registration._id) : '';
    const ticketLink = `/qr-ticket/${regId}?type=sports`;
    const isPaid = paymentStatus === 'paid' || Number(registration.amountPaid) > 0;

    return notifyRunClubParticipant({
        registration,
        eventId,
        eventTitle,
        title: stage === 'confirmed_resend' ? 'You’re in' : 'You’re in',
        message: `You’re confirmed for ${eventTitle}. Your ticket is below — save this email or open it in the app. Join the WhatsApp group for updates.`,
        type: 'registration',
        link: ticketLink,
        emailSubject: `You’re in — ${eventTitle}`,
        metadata: {
            registrationId: String(registration._id),
            stage: stage === 'confirmed_resend' ? 'confirmed_resend' : 'confirmed',
        },
        includeGroupLink: true,
        paymentContext: {
            status: isPaid ? 'paid' : 'free',
            method: paymentGateway || registration.payment_gateway || '',
        },
    });
}

function queueRunClubRegistrationConfirmation(args) {
    sendRunClubRegistrationConfirmation(args).catch((err) => {
        console.error('[sendRunClubRegistrationConfirmation]', err.message);
    });
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
    includeGroupLink = false,
}) {
    const registrations = await loadConfirmedParticipants(eventId);
    const groupInfo = includeGroupLink
        ? await resolveRunClubGroupLink(eventId)
        : { groupLink: '', communityName: '' };
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
            groupLink: groupInfo.groupLink,
            communityName: groupInfo.communityName,
            includeGroupLink,
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
    sendRunClubRegistrationConfirmation,
    queueRunClubRegistrationConfirmation,
};
