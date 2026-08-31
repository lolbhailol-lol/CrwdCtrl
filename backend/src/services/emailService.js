const nodemailer = require('nodemailer');
const { Resend } = require('resend');

// Initialize Resend
let resendInstance = null;
if (process.env.RESEND_API_KEY) {
    resendInstance = new Resend(process.env.RESEND_API_KEY);
}

// ============================================
// 📧 EMAIL QUEUE SYSTEM - Prevents Rate Limiting
// ============================================
// Provider limits vary by service.
// This queue ensures emails are sent sequentially with proper delays and retries.

const emailQueue = [];
let isProcessingQueue = false;
const EMAIL_DELAY_MS = 1000; // 1s between emails
const MAX_RETRIES = 3;
const RATE_LIMIT_BACKOFF_MS = 2000;

// Add email to queue and process
const queueEmail = (emailFn) => {
    return new Promise((resolve, reject) => {
        emailQueue.push({ emailFn, resolve, reject, retries: 0 });
        processEmailQueue();
    });
};

// Process emails one at a time with delays and retries
const processEmailQueue = async () => {
    if (isProcessingQueue || emailQueue.length === 0) {
        return;
    }

    isProcessingQueue = true;

    while (emailQueue.length > 0) {
        const item = emailQueue.shift();
        const { emailFn, resolve, reject, retries } = item;

        try {
            const result = await emailFn();
            resolve(result);
        } catch (error) {
            const isRateLimited = error.message?.includes('rate') ||
                error.message?.includes('429') ||
                error.message?.includes('Too many');

            if (isRateLimited && retries < MAX_RETRIES) {
                // Rate limited - add back to queue with increased retry count
                console.log(`⏳ Rate limited, retry ${retries + 1}/${MAX_RETRIES} after ${RATE_LIMIT_BACKOFF_MS * (retries + 1)}ms...`);
                await new Promise(r => setTimeout(r, RATE_LIMIT_BACKOFF_MS * (retries + 1)));
                emailQueue.unshift({ emailFn, resolve, reject, retries: retries + 1 });
            } else {
                console.error('❌ Queued email failed:', error.message);
                reject(error);
            }
        }

        // Wait before sending next email to respect rate limit
        // Always wait, even after the last email, to prevent rapid subsequent calls
        await new Promise(r => setTimeout(r, EMAIL_DELAY_MS));
    }

    isProcessingQueue = false;
};

const getDefaultFrom = () => {
    if (process.env.RESEND_FROM) return process.env.RESEND_FROM;
    if (process.env.RESEND_API_KEY) return 'CrwdCtrl <onboarding@crwdctrl.in>';
    if (process.env.EMAIL_USER) return process.env.EMAIL_USER;
    return 'CrwdCtrl <onboarding@crwdctrl.in>';
};

const getSiteUrl = () => (process.env.FRONTEND_URL || 'https://crwdctrl.in').replace(/\/$/, '');

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function buildQrImageUrl(qrHash) {
    const hash = String(qrHash || '').trim();
    if (!hash) return '';
    return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=10&data=${encodeURIComponent(hash)}`;
}

/** Inline ticket card for run / event-community confirmation emails. */
function buildBookingTicketBlock({
    eventTitle = '',
    participantName = '',
    date = '',
    time = '',
    venue = '',
    qrHash = '',
    ticketHref = '',
    bookingHref = '',
    product = 'event',
    extraRows = [],
}) {
    if (!qrHash) return '';
    const qrSrc = buildQrImageUrl(qrHash);
    if (!qrSrc) return '';

    const label = product === 'run'
        ? 'Run ticket'
        : product === 'competition'
            ? 'Competition ticket'
            : 'Event ticket';
    const detailRows = [
        participantName ? { label: 'Name', value: participantName } : null,
        date ? { label: 'Date', value: date } : null,
        time ? { label: 'Time', value: time } : null,
        venue ? { label: 'Venue', value: venue } : null,
        ...(Array.isArray(extraRows) ? extraRows.filter((r) => r?.label && r?.value) : []),
        eventTitle ? { label: product === 'run' ? 'Run' : 'Event', value: eventTitle } : null,
    ].filter(Boolean);

    const ticketUrl = resolveTicketHref(ticketHref);
    const bookingUrl = bookingHref ? resolveTicketHref(bookingHref) : ticketUrl;

    return `
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0 8px;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;background:#fafafa;">
            <tr>
                <td style="padding:16px 18px 10px;background:#111827;">
                    <p style="margin:0;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#0ECCEE;font-weight:600;">${escapeHtml(label)}</p>
                    <p style="margin:6px 0 0;font-size:18px;line-height:1.3;color:#ffffff;font-weight:700;">${escapeHtml(eventTitle || 'Your booking')}</p>
                </td>
            </tr>
            <tr>
                <td style="padding:18px;text-align:center;background:#ffffff;">
                    <img src="${qrSrc}" alt="Check-in QR code" width="220" height="220" style="display:block;margin:0 auto;width:220px;height:220px;border:1px solid #e5e7eb;border-radius:12px;" />
                    <p style="margin:14px 0 0;font-size:13px;line-height:1.5;color:#6b7280;">Show this QR at the venue for check-in.</p>
                </td>
            </tr>
            ${detailRows.length ? `
            <tr>
                <td style="padding:0 18px 16px;background:#ffffff;">
                    ${buildDetailsTable(detailRows)}
                </td>
            </tr>` : ''}
            <tr>
                <td style="padding:0 18px 18px;background:#ffffff;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                        <tr>
                            <td align="center" style="padding-bottom:10px;">
                                <a href="${ticketUrl}" style="display:inline-block;background:#0ECCEE;color:#111827;text-decoration:none;font-weight:700;font-size:14px;padding:12px 22px;border-radius:10px;">Open ticket</a>
                            </td>
                        </tr>
                        <tr>
                            <td align="center">
                                <a href="${bookingUrl}" style="font-size:13px;color:#2563eb;text-decoration:underline;">View booking details</a>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>`;
}

const EMAIL_ADDRESS_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const REGISTRATION_TYPE_META = {
    trek: { icon: '🥾', noun: 'Trek', thankHeadline: 'Thanks for booking!', confirmHeadline: 'Your trek is confirmed' },
    fest: { icon: '🎪', noun: 'Fest', thankHeadline: 'Thanks for registering!', confirmHeadline: 'Registration confirmed' },
    event: { icon: '🎟️', noun: 'Event', thankHeadline: 'Thanks for registering!', confirmHeadline: 'Your spot is confirmed' },
    competition: { icon: '🏆', noun: 'Competition', thankHeadline: 'Thanks for registering!', confirmHeadline: 'Registration confirmed' },
};

function resolveRegistrationMeta(type = 'fest') {
    return REGISTRATION_TYPE_META[type] || REGISTRATION_TYPE_META.fest;
}

function formatSubmissionDateIST(date = new Date()) {
    return new Date(date).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function resolveTicketHref(ticketLink) {
    if (!ticketLink) return `${getSiteUrl()}/profile/bookings`;
    return ticketLink.startsWith('http') ? ticketLink : `${getSiteUrl()}${ticketLink.startsWith('/') ? '' : '/'}${ticketLink}`;
}

function resolveEmailHeroImageUrl(raw) {
    const value = String(raw || '').trim();
    if (!value) return '';
    if (/^https:\/\//i.test(value)) return value;
    if (value.startsWith('//')) return `https:${value}`;
    if (value.startsWith('/')) return `${getSiteUrl()}${value}`;
    return '';
}

/** Shared responsive email shell — CrwdCtrl brand (clean, image-led when possible) */
function buildEmailShell({
    preheader = '',
    eyebrow = 'CrwdCtrl',
    title,
    subtitle = '',
    bodyHtml = '',
    ctaLabel = '',
    ctaHref = '',
    heroImageUrl = '',
    footnote = 'Need help? Reply to this email or contact us at team.crwdctrl@gmail.com',
}) {
    const safePreheader = String(preheader || '').replace(/"/g, '&quot;');
    const safeHero = (() => {
        const raw = String(heroImageUrl || '').trim();
        if (!raw) return '';
        try {
            const u = new URL(raw);
            return u.protocol === 'https:' ? u.toString() : '';
        } catch {
            return '';
        }
    })();

    const ctaBlock = ctaLabel && ctaHref ? `
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:28px 0 4px;">
            <tr>
                <td align="center">
                    <a href="${ctaHref}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;letter-spacing:0.01em;padding:14px 28px;border-radius:12px;">
                        ${ctaLabel}
                    </a>
                </td>
            </tr>
        </table>` : '';

    const heroBlock = safeHero ? `
                    <tr>
                        <td style="padding:0;line-height:0;font-size:0;">
                            <img src="${safeHero}" alt="" width="560" style="display:block;width:100%;max-width:560px;height:auto;border:0;outline:none;" />
                        </td>
                    </tr>` : `
                    <tr>
                        <td style="background:#111827;padding:22px 24px;text-align:left;">
                            <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#0ECCEE;">${eyebrow}</p>
                            <h1 style="margin:0;font-size:22px;line-height:1.25;color:#ffffff;font-weight:700;">${title}</h1>
                            ${subtitle ? `<p style="margin:8px 0 0;font-size:14px;line-height:1.45;color:rgba(255,255,255,0.72);">${subtitle}</p>` : ''}
                        </td>
                    </tr>`;

    const titleUnderHero = safeHero ? `
                    <tr>
                        <td style="padding:22px 24px 0;">
                            <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#6b7280;">${eyebrow}</p>
                            <h1 style="margin:0;font-size:22px;line-height:1.3;color:#111827;font-weight:700;">${title}</h1>
                            ${subtitle ? `<p style="margin:8px 0 0;font-size:15px;line-height:1.45;color:#4b5563;">${subtitle}</p>` : ''}
                        </td>
                    </tr>` : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111827;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${safePreheader}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f4f6;padding:28px 12px;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
                    ${heroBlock}
                    ${titleUnderHero}
                    <tr>
                        <td style="padding:${safeHero ? '18px' : '28px'} 24px 8px;font-size:15px;line-height:1.65;color:#374151;">
                            ${bodyHtml}
                            ${ctaBlock}
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:8px 24px 28px;">
                            <p style="margin:0;font-size:12px;line-height:1.6;color:#9ca3af;text-align:center;">${footnote}</p>
                            <p style="margin:10px 0 0;font-size:12px;color:#9ca3af;text-align:center;">CrwdCtrl</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
}

function buildDetailsTable(rows = []) {
    const items = (rows || []).filter((r) => r?.label && r?.value);
    if (!items.length) return '';
    const rowHtml = items.map((r, i) => `
        <tr>
            <td style="padding:12px 0;${i < items.length - 1 ? 'border-bottom:1px solid #f3f4f6;' : ''}font-size:13px;color:#6b7280;width:36%;vertical-align:top;">${r.label}</td>
            <td style="padding:12px 0;${i < items.length - 1 ? 'border-bottom:1px solid #f3f4f6;' : ''}font-size:14px;color:#111827;font-weight:600;text-align:right;vertical-align:top;">${r.value}</td>
        </tr>`).join('');
    return `
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:8px 0 4px;">
            ${rowHtml}
        </table>`;
}

function buildWhatsAppJoinBlock(groupLink, communityName, { product = 'trek' } = {}) {
    const url = String(groupLink || '').trim();
    if (!url) return '';
    const isPhoneChat = /^https?:\/\/wa\.me\//i.test(url);
    const fromLabel = communityName ? ` · ${communityName}` : '';
    const heading = isPhoneChat ? 'WhatsApp the organizers' : 'WhatsApp group';
    const cta = isPhoneChat ? 'Message on WhatsApp' : 'Join WhatsApp group';
    const blurb = isPhoneChat
        ? `Questions${fromLabel}? Message the organizers here.`
        : product === 'event'
            ? `Event updates & meetup details${fromLabel}.`
            : product === 'run'
                ? `Run updates & meetup details${fromLabel}.`
                : product === 'fest'
                    ? `Fest updates${fromLabel}.`
                    : product === 'competition'
                        ? `Competition updates & round info${fromLabel}.`
                        : `Trek updates & meetup details${fromLabel}.`;
    return `
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0 8px;">
            <tr>
                <td style="padding:0 0 10px;font-size:13px;font-weight:600;color:#111827;letter-spacing:0.02em;">${heading}</td>
            </tr>
            <tr>
                <td style="padding:0 0 14px;font-size:14px;line-height:1.55;color:#4b5563;">${blurb}</td>
            </tr>
            <tr>
                <td>
                    <a href="${url}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 18px;border-radius:10px;">${cta}</a>
                </td>
            </tr>
        </table>`;
}

function buildPaymentNotice(paymentContext = {}) {
    const status = paymentContext?.status || 'unknown';
    const method = paymentContext?.method || '';
    const methodLabel = method === 'cashfree' ? 'Cashfree' : method;

    if (status === 'paid') {
        return `
            <p style="margin:16px 0 4px;font-size:14px;line-height:1.55;color:#374151;">
                <span style="color:#059669;font-weight:600;">Payment confirmed</span>${methodLabel ? ` via ${methodLabel}` : ''}. You’re all set.
            </p>`;
    }
    if (status === 'free') {
        return `
            <p style="margin:16px 0 4px;font-size:14px;line-height:1.55;color:#374151;">
                <span style="color:#111827;font-weight:600;">Free registration</span> — no payment needed. See you there.
            </p>`;
    }
    if (status === 'pending') {
        return `
            <p style="margin:16px 0 4px;font-size:14px;line-height:1.55;color:#374151;">
                <span style="color:#b45309;font-weight:600;">Awaiting organizer approval</span> — ${paymentContext.message || 'your payment screenshot was submitted. You’ll get another email once it’s approved.'}

            </p>`;
    }
    if (status === 'failed') {
        return `
            <p style="margin:16px 0 4px;font-size:14px;line-height:1.55;color:#374151;">
                <span style="color:#b91c1c;font-weight:600;">Payment not approved</span> — ${paymentContext.message || 'you can register again from My Bookings.'}

            </p>`;
    }
    return '';
}

// ✅ UNIVERSAL EMAIL SENDER - Uses queue to prevent rate limiting
const sendEmail = async (mailOptions) => {
    return queueEmail(async () => {
        // PRIORITY 1: RESEND
        if (process.env.RESEND_API_KEY && resendInstance) {
            try {
                return await sendWithResend(mailOptions);
            } catch (error) {
                console.warn('🔄 Resend failed or domain mismatch, falling back to SMTP...', error.message);
            }
        } else {
            console.warn('⚠️ Resend not configured, using SMTP fallback...');
        }

        // PRIORITY 2: GMAIL/SMTP
        const transporter = createTransporter();
        const info = await transporter.sendMail(mailOptions);
        return { success: true, messageId: info.messageId };
    });
};

// ✅ NEW: BROADCAST FUNCTION
const sendEventBroadcast = async (userList, eventDetails) => {
    console.log(`📢 Starting broadcast for event: ${eventDetails.name}`);

    // Determine subject prefix based on whether it's an update or new event
    const isUpdate = eventDetails.name.includes('UPDATED');
    const subjectPrefix = isUpdate ? '🚨 Event Update:' : '🚀 New Tech Event:';

    // Process in chunks of 50 to prevent memory spikes
    const BATCH_SIZE = 50;
    const results = { success: 0, failed: 0 };

    for (let i = 0; i < userList.length; i += BATCH_SIZE) {
        const batch = userList.slice(i, i + BATCH_SIZE);

        const batchPromises = batch.map(user => {
            const mailOptions = {
                // We pass the verified domain here to ensure Resend success
                from: 'CrwdCtrl <onboarding@crwdctrl.in>',
                to: user.email,
                subject: `${subjectPrefix} ${eventDetails.name}!`,
                html: generateEventEmailHTML(user.name, eventDetails)
            };

            // This pushes the email into your existing Queue/Resend logic
            return sendEmail(mailOptions)
                .then(() => results.success++)
                .catch(() => results.failed++);
        });

        // Wait for this batch to be queued before starting the next
        await Promise.all(batchPromises);
        console.log(`⏳ Batched ${i + batch.length}/${userList.length} users...`);
    }

    console.log(`✅ Broadcast complete! Success: ${results.success}, Failed: ${results.failed}`);
    return results;
};

const generateTrekParticipantEmailHTML = ({
    name, title, message, trekName, link, kind, groupLink, communityName, product = 'trek', paymentContext = null, coverImage = '', ticket = null,
}) => {
    const isRun = product === 'run';
    const isFest = product === 'fest';
    const isEvent = product === 'event';
    const headerLabel = kind === 'registration'
        ? 'You’re booked'
        : kind === 'reminder'
            ? (isEvent ? 'Event reminder' : isRun ? 'Run reminder' : isFest ? 'Fest reminder' : 'Trek reminder')
            : kind === 'organizer'
                ? 'Message from organizer'
                : (isEvent ? 'Event update' : isRun ? 'Run update' : isFest ? 'Fest update' : 'Trek update');
    const ticketHref = ticket?.ticketHref || link;
    const fullLink = resolveTicketHref(ticketHref || link || (isEvent || isRun ? '/sports' : isFest ? '/fests' : '/treks'));
    const bodyMessage = String(message || '').replace(/\n/g, '<br/>');
    const entityLabel = isEvent ? 'Event' : isRun ? 'Run' : isFest ? 'Fest' : 'Trek';
    const paymentNoticeHtml = paymentContext ? buildPaymentNotice(paymentContext) : '';
    const displayTitle = kind === 'registration'
        ? (String(title || '').toLowerCase().includes('await') || String(title || '').toLowerCase().includes('submitted')
            ? title
            : 'You’re in')
        : title;
    const showInlineTicket = kind === 'registration' && ticket?.qrHash;
    const ticketBlockHtml = showInlineTicket
        ? buildBookingTicketBlock({
            eventTitle: ticket.eventTitle || trekName,
            participantName: ticket.participantName || name,
            date: ticket.date,
            time: ticket.time,
            venue: ticket.venue,
            qrHash: ticket.qrHash,
            ticketHref: ticket.ticketHref || link,
            bookingHref: ticket.bookingHref || link,
            product: isEvent ? 'event' : isRun ? 'run' : 'trek',
            extraRows: ticket.extraRows,
        })
        : '';

    return buildEmailShell({
        preheader: `${trekName} — ${displayTitle}`,
        eyebrow: headerLabel,
        title: displayTitle,
        subtitle: trekName,
        heroImageUrl: coverImage,
        bodyHtml: `
            <p style="margin:0 0 10px;">Hi ${escapeHtml(name || 'there')},</p>
            <p style="margin:0 0 4px;line-height:1.6;">${bodyMessage}</p>
            ${paymentNoticeHtml}
            ${showInlineTicket ? ticketBlockHtml : buildDetailsTable([{ label: entityLabel, value: trekName }])}
            ${buildWhatsAppJoinBlock(groupLink, communityName, { product: isEvent ? 'event' : isRun ? 'run' : isFest ? 'fest' : 'trek' })}
        `,
        ctaLabel: showInlineTicket
            ? ''
            : ((isRun || isEvent) && kind === 'registration' && String(title || '').toLowerCase().includes('approved')
                ? 'Open ticket'
                : (isFest ? 'View fest' : 'View booking')),
        ctaHref: showInlineTicket ? '' : fullLink,
        footnote: isEvent
            ? 'You received this about your event booking on CrwdCtrl.'
            : isRun
                ? 'You received this about your run booking on CrwdCtrl.'
                : isFest
                    ? 'You received this about your fest registration on CrwdCtrl.'
                    : 'You received this about your trek on CrwdCtrl.',
    });
};

const sendTrekParticipantEmails = async (recipients = [], { product = 'trek' } = {}) => {
    const results = { success: 0, failed: 0 };
    const list = Array.isArray(recipients) ? recipients : [];
    const defaultSubject = product === 'fest'
        ? 'Update from your fest organizer'
        : 'Update from your trek organizer';

    for (const item of list) {
        if (!item?.email) {
            results.failed += 1;
            continue;
        }
        try {
            await sendEmail({
                from: getDefaultFrom(),
                to: item.email,
                subject: item.subject || item.title || defaultSubject,
                html: generateTrekParticipantEmailHTML({ ...item, product: item.product || product }),
            });
            results.success += 1;
        } catch (err) {
            console.error('❌ Participant email failed:', item.email, err.message);
            results.failed += 1;
        }
    }

    return results;
};

const sendFestParticipantEmails = (recipients = []) => sendTrekParticipantEmails(recipients, { product: 'fest' });

const generateAdminCampaignEmailHTML = ({ name, title, message, link, eventContext = null }) => {
    const escapeHtml = (value) =>
        String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');

    const safeHttpsImage = (url) => {
        const raw = String(url || '').trim();
        if (!raw) return '';
        try {
            const parsed = new URL(raw);
            if (parsed.protocol !== 'https:') return '';
            return parsed.toString();
        } catch {
            return '';
        }
    };

    const safeName = escapeHtml(name || 'there');
    const safeTitle = escapeHtml(title || 'Update from CrwdCtrl');
    const bodyMessage = escapeHtml(message || '').replace(/\n/g, '<br/>');
    const ctx = eventContext && typeof eventContext === 'object' ? eventContext : null;
    const ctaPath = ctx?.ctaPath || link || '/';
    const ctaHref = resolveTicketHref(ctaPath);
    const ctaLabel = escapeHtml(ctx?.ctaLabel || (link ? 'Open on CrwdCtrl' : 'Visit CrwdCtrl'));

    if (!ctx || !ctx.name) {
        return buildEmailShell({
            preheader: safeTitle,
            eyebrow: 'CrwdCtrl announcement',
            title: safeTitle,
            subtitle: '',
            bodyHtml: `
                <p style="margin:0 0 12px;">Hi <strong>${safeName}</strong>,</p>
                <p style="margin:0 0 12px;line-height:1.6;">${bodyMessage}</p>
            `,
            ctaLabel,
            ctaHref,
            footnote: 'You received this because you have an account on CrwdCtrl. Manage notification preferences in your profile.',
        });
    }

    const imageUrl = safeHttpsImage(ctx.imageUrl);
    const eventName = escapeHtml(ctx.name);
    const heroBlock = imageUrl
        ? `
        <div style="margin:0 0 20px;border-radius:14px;overflow:hidden;">
            <img src="${escapeHtml(imageUrl)}" alt="${eventName}" width="512" style="display:block;width:100%;max-width:512px;height:auto;border:0;" />
        </div>`
        : '';

    const detailRows = [
        ctx.dateLabel ? { label: 'When', value: escapeHtml(ctx.dateLabel) } : null,
        ctx.placeLabel ? { label: 'Where', value: escapeHtml(ctx.placeLabel) } : null,
        ctx.subtitle ? { label: 'About', value: escapeHtml(ctx.subtitle) } : null,
    ].filter(Boolean);

    return buildEmailShell({
        preheader: escapeHtml(`${ctx.name} — ${title || 'Update from CrwdCtrl'}`),
        eyebrow: 'On CrwdCtrl',
        title: title ? safeTitle : escapeHtml(`Update: ${ctx.name}`),
        subtitle: eventName,
        bodyHtml: `
            ${heroBlock}
            <p style="margin:0 0 12px;">Hi <strong>${safeName}</strong>,</p>
            <p style="margin:0 0 12px;line-height:1.6;">${bodyMessage}</p>
            ${buildDetailsTable(detailRows)}
        `,
        ctaLabel,
        ctaHref,
        footnote: 'You received this about an event on CrwdCtrl. Manage notification preferences in your profile.',
    });
};

/** Queue admin Notification Center campaign emails (batched via existing sendEmail). */
const sendAdminCampaignEmails = async (recipients = []) => {
    const results = { success: 0, failed: 0 };
    const list = Array.isArray(recipients) ? recipients : [];

    for (const item of list) {
        if (!item?.email) {
            results.failed += 1;
            continue;
        }
        try {
            await sendEmail({
                from: getDefaultFrom(),
                to: item.email,
                subject: item.subject || item.title || 'Update from CrwdCtrl',
                html: generateAdminCampaignEmailHTML(item),
            });
            results.success += 1;
        } catch (err) {
            console.error('❌ Admin campaign email failed:', item.email, err.message);
            results.failed += 1;
        }
    }

    return results;
};

/** Return HTML for admin compose preview (same template as production). */
const previewAdminCampaignEmailHTML = ({ name, title, message, link, eventContext }) =>
    generateAdminCampaignEmailHTML({ name, title, message, link, eventContext });

// ✅ HTML Generator for Broadcasts
const generateEventEmailHTML = (userName, event) => {
    const isUpdate = event.name.includes('UPDATED');
    const headerColor = isUpdate ? '#e11d48' : '#053780'; // Red for updates, Blue for new
    const cleanName = event.name.replace('UPDATED: ', '');

    return `
    <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
        <div style="background: linear-gradient(135deg, ${headerColor}, #0ECCEE); padding: 30px; text-align: center; color: white;">
            <h1 style="margin: 0; font-size: 24px;">${isUpdate ? 'Important Update! 🚨' : 'New Event Alert! 🚀'}</h1>
        </div>
        <div style="padding: 30px; color: #333; line-height: 1.6;">
            <p style="font-size: 16px;">Hi <b>${userName}</b>,</p>
            <p style="font-size: 16px;">${isUpdate ? 'There has been a change to an event you might be interested in:' : 'A new event has just been posted on <b>CrwdCtrl</b>:'}</p>
            
            <div style="background: #f0f9ff; padding: 20px; border-radius: 10px; border-left: 5px solid #0ECCEE; margin: 20px 0;">
                <h2 style="margin: 0 0 10px 0; color: #053780; font-size: 20px;">${cleanName}</h2>
                <p style="margin: 5px 0; font-size: 15px;">🗓 <b>Date:</b> ${event.date}</p>
                <p style="margin: 5px 0; font-size: 15px;">📍 <b>Venue:</b> ${event.location}</p>
            </div>

            <p style="text-align: center; margin-top: 30px;">
                <a href="https://crwdctrl.in/fests/${event.id}" 
                   style="background: #053780; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                   View Event Details
                </a>
            </p>
            
            <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;">
            <p style="font-size: 12px; color: #777; text-align: center;">
                You received this because you enabled email reminders on CrwdCtrl. 
                Manage your preferences in your profile settings.
            </p>
        </div>
    </div>
    `;
};

// Email configuration (SMTP fallback for local development)
const createTransporter = () => {
    // Check if email credentials are properly configured
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.warn('⚠️ WARNING: Email credentials (EMAIL_USER/EMAIL_PASS) not configured!');
        console.warn('⚠️ Emails will NOT be sent in production. Please configure environment variables.');
        console.warn('⚠️ EMAIL_USER:', process.env.EMAIL_USER ? 'SET' : 'NOT SET');
        console.warn('⚠️ EMAIL_PASS:', process.env.EMAIL_PASS ? 'SET' : 'NOT SET');

        // In production, do not allow SMTP fallback without credentials
        if (process.env.NODE_ENV === 'production') {
            throw new Error('SMTP credentials not configured in production environment');
        }

        console.log('📧 Using test email account (development only)');
        return nodemailer.createTransport({
            host: 'smtp.ethereal.email',
            port: 587,
            auth: {
                user: 'ethereal.user@ethereal.email',
                pass: 'ethereal.pass'
            }
        });
    }

    console.log('✅ Email transporter configured with:', process.env.EMAIL_USER);
    console.log('📧 Creating Gmail SMTP transporter...');
    console.log('📋 Password length:', process.env.EMAIL_PASS.length, '(should be 19 with spaces)');
    console.log('📋 Password contains spaces:', process.env.EMAIL_PASS.includes(' '));

    // ✅ Use port 587 with STARTTLS - more reliable on cloud platforms (Railway, etc.)
    // Port 465 (SSL) is often blocked by cloud providers
    const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false, // Use STARTTLS (upgrades to TLS)
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        },
        tls: {
            rejectUnauthorized: false, // Accept self-signed certs (needed for some cloud environments)
            minVersion: 'TLSv1.2'
        },
        connectionTimeout: 30000, // 30 seconds
        greetingTimeout: 30000,
        socketTimeout: 60000 // 60 seconds for actual send
    });
    console.log('✅ Gmail SMTP transporter created (port 587 STARTTLS)');
    return transporter;
};

const sendWithResend = async (mailOptions) => {
    if (!resendInstance) throw new Error('Resend API key not configured');
    console.log('💎 [RESEND] Attempting delivery...');

    try {
        const { data, error } = await resendInstance.emails.send({
            // Change from hardcoded string to mailOptions.from
            from: mailOptions.from || 'CrwdCtrl <onboarding@crwdctrl.in>',
            to: Array.isArray(mailOptions.to) ? mailOptions.to : [mailOptions.to],
            subject: mailOptions.subject,
            html: mailOptions.html,
            text: mailOptions.text,
            reply_to: 'team.crwdctrl@gmail.com'
        });

        if (error) throw error;
        console.log('✅ [RESEND] Success! ID:', data.id);
        return { success: true, messageId: data.id };
    } catch (error) {
        console.error('❌ [RESEND] API Error:', error.message);
        throw error;
    }
};

const sendWelcomeEmail = async (userData) => {
    console.log("🚀🚀🚀 RESEND FUNCTION DEFINITELY HIT 🚀🚀🚀");
    try {
        console.log('🔥 [RESEND ONLY] Sending welcome email to:', userData.email);

        if (!process.env.RESEND_API_KEY || !resendInstance) {
            throw new Error('Resend not configured');
        }

        const { data, error } = await resendInstance.emails.send({
            from: 'CrwdCtrl <onboarding@crwdctrl.in>', // ✅ IMPORTANT
            to: [userData.email],
            subject: "🎉 Welcome to CrwdCtrl — explore fests, runs & more!",
            html: generateWelcomeEmailHTML(userData)
        });

        if (error) {
            console.error('❌ Resend error:', error);
            throw new Error(error.message);
        }

        console.log('✅ Welcome email sent via RESEND!', data.id);
        return data;

    } catch (error) {
        console.error('❌ Welcome email failed:', error.message);
        throw error;
    }
};

// Generate HTML content for welcome email
const CRWDCTRL_EXPLORE_EMAIL_IMAGES = {
    hero: 'https://b9kqebckzmreaq9waa54apdm8ecy3yrh3uhmwux93pi.canva-cdn.email/de062643409b8c5b636a1181e5c0be95.jpg',
    footer: 'https://b9kqebckzmreaq9waa54apdm8ecy3yrh3uhmwux93pi.canva-cdn.email/5493b3562ba4d78ebbee8b983115a29f.jpg',
};

const SUPPORT_EMAIL = 'crwdctrl.in@gmail.com';

function buildExploreCategoryCell(category, siteUrl) {
    const href = `${siteUrl}${category.path.startsWith('/') ? '' : '/'}${category.path}`;
    return `
        <td width="50%" valign="top" style="padding:6px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:2px solid #15c0e1;border-radius:16px;background:#f8fdff;">
                <tr>
                    <td style="padding:18px 14px;text-align:center;font-family:Arial,Helvetica,sans-serif;">
                        <p style="margin:0 0 6px;font-size:28px;line-height:1;">${category.emoji}</p>
                        <p style="margin:0 0 4px;font-size:15px;font-weight:700;color:#053780;line-height:1.3;">${escapeHtml(category.label)}</p>
                        <p style="margin:0 0 12px;font-size:12px;color:#64748b;line-height:1.4;">${escapeHtml(category.desc)}</p>
                        <a href="${href}" style="display:inline-block;background:#15c0e1;color:#ffffff;text-decoration:none;font-size:12px;font-weight:700;padding:8px 14px;border-radius:999px;">Explore</a>
                    </td>
                </tr>
            </table>
        </td>`;
}

/** Four discovery tiles — includes College Fests as the 4th box. */
function buildExploreCategoryGrid(siteUrl) {
    const categories = [
        { emoji: '🏃', label: 'Run Clubs', desc: 'Weekly runs & sports communities', path: '/sports' },
        { emoji: '🎟️', label: 'Events', desc: 'Communities, meetups & game nights', path: '/events' },
        { emoji: '🎪', label: 'College Fests', desc: 'Competitions, pro-shows & campus fests', path: '/fests' },
        { emoji: '🥾', label: 'Treks', desc: 'Weekend treks & outdoor trips', path: '/treks' },
    ];
    const row1 = categories.slice(0, 2).map((c) => buildExploreCategoryCell(c, siteUrl)).join('');
    const row2 = categories.slice(2, 4).map((c) => buildExploreCategoryCell(c, siteUrl)).join('');
    return `
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 8px;">
            <tr>${row1}</tr>
        </table>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 16px;">
            <tr>${row2}</tr>
        </table>`;
}

function buildCrwdCtrlExploreEmailHTML({
    userName = 'there',
    headline = 'Welcome to CrwdCtrl',
    message = '',
    loginTime = '',
    preheader = '',
}) {
    const siteUrl = getSiteUrl();
    const safeName = escapeHtml(userName || 'there');
    const safeHeadline = escapeHtml(headline);
    const safeMessage = escapeHtml(message);
    const safePreheader = escapeHtml(preheader || headline);
    const loginMeta = loginTime
        ? `<p class="login-meta" style="margin:14px auto 0;max-width:420px;padding:10px 14px;border-radius:12px;background:#f8fafc;border:1px solid #e2e8f0;font-size:12px;color:#64748b;line-height:1.5;text-align:center;">Logged in at ${escapeHtml(loginTime)} (IST)</p>`
        : '';

    return `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="x-apple-disable-message-reformatting" />
    <meta name="format-detection" content="telephone=no,email=no,address=no" />
    <title>${safeHeadline}</title>
    <style>
        body { margin:0 !important; padding:0 !important; width:100% !important; }
        img { border:0; outline:none; text-decoration:none; -ms-interpolation-mode:bicubic; }
        table { border-collapse:collapse; mso-table-lspace:0; mso-table-rspace:0; }
        a { text-decoration:none; }
        @media only screen and (max-width: 620px) {
            .ecw { width:100% !important; min-width:0 !important; border-radius:0 !important; }
            .shell-pad { padding:12px 8px !important; }
            .copy-pad { padding:20px 18px 8px !important; }
            .grid-pad { padding:8px 10px 4px !important; }
            .headline { font-size:21px !important; line-height:1.25 !important; }
            .body-copy { font-size:14px !important; line-height:1.65 !important; }
            .cta-pad { padding:8px 14px 18px !important; }
            .cta-btn { display:block !important; width:100% !important; box-sizing:border-box !important; text-align:center !important; }
            .cta-btn a { display:block !important; width:100% !important; box-sizing:border-box !important; padding:14px 18px !important; }
            .footer-pad { padding:14px 18px 20px !important; }
        }
    </style>
    <!--[if mso]><style>table{border-collapse:collapse;}td{font-family:Arial,Helvetica,sans-serif;}</style><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#f0f1f5;-webkit-text-size-adjust:100%;text-size-adjust:100%;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${safePreheader}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#f0f1f5" style="background-color:#f0f1f5;">
        <tr>
            <td align="center" class="shell-pad" style="padding:20px 10px;">
                <table role="presentation" width="600" cellspacing="0" cellpadding="0" class="ecw" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 16px 40px rgba(15,23,42,0.08);">
                    <tr>
                        <td style="padding:0;line-height:0;font-size:0;">
                            <img src="${CRWDCTRL_EXPLORE_EMAIL_IMAGES.hero}" width="600" alt="CrwdCtrl — discover events near you" style="display:block;width:100%;max-width:600px;height:auto;border:0;" />
                        </td>
                    </tr>
                    <tr>
                        <td class="copy-pad" style="padding:26px 28px 10px;font-family:Arial,Helvetica,sans-serif;text-align:center;">
                            <p class="headline" style="margin:0 0 10px;font-size:24px;font-weight:800;color:#053780;line-height:1.25;letter-spacing:-0.02em;">${safeHeadline}</p>
                            <p class="body-copy" style="margin:0;font-size:15px;color:#475569;line-height:1.65;">Hi ${safeName}, ${safeMessage}</p>
                            ${loginMeta}
                        </td>
                    </tr>
                    <tr>
                        <td class="grid-pad" style="padding:10px 16px 6px;">
                            ${buildExploreCategoryGrid(siteUrl)}
                        </td>
                    </tr>
                    <tr>
                        <td align="center" class="cta-pad" style="padding:6px 24px 22px;">
                            <table role="presentation" cellspacing="0" cellpadding="0" width="100%" style="max-width:320px;">
                                <tr>
                                    <td class="cta-btn" bgcolor="#15c0e1" align="center" style="border-radius:999px;background-color:#15c0e1;box-shadow:0 10px 24px rgba(21,192,225,0.35);">
                                        <a href="${siteUrl}" target="_blank" rel="noopener" style="display:inline-block;padding:14px 32px;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:800;color:#ffffff;text-decoration:none;letter-spacing:0.04em;">EXPLORE NOW !</a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:0;line-height:0;font-size:0;">
                            <img src="${CRWDCTRL_EXPLORE_EMAIL_IMAGES.footer}" width="600" alt="CrwdCtrl" style="display:block;width:100%;max-width:600px;height:auto;border:0;" />
                        </td>
                    </tr>
                    <tr>
                        <td class="footer-pad" style="padding:18px 24px 24px;font-family:Arial,Helvetica,sans-serif;">
                            <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#111827;">Questions?</p>
                            <p style="margin:0;font-size:12px;color:#475569;line-height:1.55;">
                                Reach us at
                                <a href="mailto:${SUPPORT_EMAIL}" style="color:#0ab6d7;font-weight:700;text-decoration:none;">${SUPPORT_EMAIL}</a>
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
}

const generateWelcomeEmailHTML = (userData) => {
    return buildCrwdCtrlExploreEmailHTML({
        userName: userData?.name,
        headline: 'Welcome to CrwdCtrl',
        message: 'thanks for joining! Pick a category below and start exploring runs, college fests, treks and communities near you.',
        preheader: 'Welcome to CrwdCtrl — explore runs, college fests, treks and more.',
    });
};

// Send immediate thank you email after registration submission
const sendRegistrationThankYouEmail = async (userEmail, userName, eventName, options = {}) => {
    try {
        console.log('📧 Sending thank you email to:', userEmail);

        if (!userEmail) {
            console.error('❌ Thank you email skipped: user email missing');
            return { success: false, error: 'User email missing' };
        }

        const meta = resolveRegistrationMeta(options.type);
        const mailOptions = {
            from: getDefaultFrom(),
            to: userEmail,
            subject: `${meta.icon} You're in — ${eventName}`,
            html: generateThankYouEmailHTML(userName, eventName, options),
        };

        const result = await sendEmail(mailOptions);
        console.log('✅ Thank you email sent successfully:', result.messageId);
        return result;
    } catch (error) {
        console.error('❌ Thank you email sending failed:', error);
        return { success: false, error: error.message };
    }
};

function generateCompetitionRegistrationEmailHTML({
    userName,
    festName,
    competitionName,
    registrationId,
    qrHash,
    coverImageUrl = '',
    submissionDate,
    paymentContext = {},
}) {
    const meta = resolveRegistrationMeta('competition');
    const ticketLink = paymentContext.ticketLink || `/qr-ticket/${registrationId}`;
    const ticketHref = resolveTicketHref(ticketLink);
    const rows = [
        { label: 'Name', value: userName },
        { label: meta.noun, value: festName },
        competitionName ? { label: 'Competition', value: competitionName } : null,
        { label: 'Booking ID', value: registrationId },
        { label: 'Registered on', value: submissionDate },
        ...(Array.isArray(paymentContext.details) ? paymentContext.details : []),
    ].filter(Boolean);

    const ticketBlockHtml = qrHash
        ? buildBookingTicketBlock({
            eventTitle: competitionName || festName,
            participantName: userName,
            qrHash,
            ticketHref: ticketLink,
            bookingHref: ticketLink,
            product: 'competition',
            extraRows: rows.filter((row) => row.label !== 'Name'),
        })
        : '';

    return buildEmailShell({
        preheader: `You're in — ${competitionName || festName}. Show your QR at check-in.`,
        eyebrow: `${meta.icon} You're in`,
        title: "You're in",
        subtitle: competitionName ? `${competitionName} · ${festName}` : festName,
        heroImageUrl: resolveEmailHeroImageUrl(coverImageUrl),
        bodyHtml: `
            <p style="margin:0 0 12px;">Hi <strong>${escapeHtml(userName || 'there')}</strong>,</p>
            <p style="margin:0 0 8px;">Your registration for <strong>${escapeHtml(competitionName || festName)}</strong> is confirmed. Save this email and show your QR at the venue.</p>
            ${ticketBlockHtml || buildDetailsTable(rows)}
            ${buildPaymentNotice(paymentContext)}
            ${buildWhatsAppJoinBlock(paymentContext.groupLink, paymentContext.communityName, { product: 'competition' })}
            <p style="margin:16px 0 0;font-size:14px;color:#6b7280;">Need your ticket again? Open My Bookings anytime in CrwdCtrl.</p>
        `,
        ctaLabel: qrHash ? '' : 'View ticket & QR',
        ctaHref: qrHash ? '' : ticketHref,
    });
}

/** Single competition registration email — QR, cover image, and booking details in one message. */
const sendCompetitionRegistrationEmail = async ({
    userEmail,
    userName,
    festName,
    competitionName,
    registrationId,
    qrHash = '',
    coverImageUrl = '',
    submissionDate = formatSubmissionDateIST(),
    paymentContext = {},
}) => {
    try {
        const email = String(userEmail || '').trim().toLowerCase();
        if (!email || !EMAIL_ADDRESS_REGEX.test(email)) {
            console.error('❌ Competition registration email skipped: invalid user email', userEmail);
            return { success: false, error: 'User email missing or invalid' };
        }

        const meta = resolveRegistrationMeta('competition');
        const mailOptions = {
            from: getDefaultFrom(),
            to: email,
            subject: `${meta.icon} You're in — ${competitionName || festName}`,
            html: generateCompetitionRegistrationEmailHTML({
                userName,
                festName,
                competitionName,
                registrationId,
                qrHash,
                coverImageUrl,
                submissionDate,
                paymentContext,
            }),
        };

        const result = await sendEmail(mailOptions);
        console.log('✅ Competition registration email sent:', result.messageId);
        return result;
    } catch (error) {
        console.error('❌ Competition registration email failed:', error);
        return { success: false, error: error.message };
    }
};

async function sendCompetitionRegistrationEmailForRecord({
    user,
    fest,
    competition,
    registration,
}) {
    if (!user?.email || !registration?._id) {
        return { success: false, error: 'Missing user email or registration id' };
    }

    const ticketLink = `/qr-ticket/${registration._id}`;
    const amountPaid = Number(registration.amountPaid) || 0;
    const paymentStatus = registration.paymentStatus || 'free';

    return sendCompetitionRegistrationEmail({
        userEmail: user.email,
        userName: user.name,
        festName: fest?.festName || fest?.name || 'Fest',
        competitionName: competition?.name || '',
        registrationId: String(registration._id),
        qrHash: registration.qrCodeData || '',
        coverImageUrl: competition?.coverImage || competition?.image || '',
        submissionDate: formatSubmissionDateIST(registration.submittedAt || new Date()),
        paymentContext: {
            status: paymentStatus,
            method: paymentStatus === 'paid' ? (registration.payment_gateway || 'cashfree') : '',
            type: 'competition',
            ticketLink,
            groupLink: String(competition?.registration?.whatsappGroupLink || '').trim()
                || String(fest?.registration?.whatsappCommunityLink || '').trim(),
            communityName: competition?.name || fest?.festName || '',
            details: amountPaid > 0 ? [{ label: 'Amount paid', value: `₹${amountPaid}` }] : [],
        },
    });
}

// Send registration confirmation email with details
const sendRegistrationConfirmationEmail = async (userEmail, userName, festName, competitionName, registrationId, submissionDate, paymentContext = {}) => {
    try {
        console.log('📧 Sending confirmation email to:', userEmail);

        if (!userEmail) {
            console.error('❌ Confirmation email skipped: user email missing');
            return { success: false, error: 'User email missing' };
        }

        const meta = resolveRegistrationMeta(paymentContext.type);
        const mailOptions = {
            from: getDefaultFrom(),
            to: userEmail,
            subject: `${meta.icon} ${meta.confirmHeadline} — ${festName}`,
            html: generateConfirmationEmailHTML(userName, festName, competitionName, registrationId, submissionDate, paymentContext),
        };

        const result = await sendEmail(mailOptions);
        console.log('✅ Confirmation email sent successfully:', result.messageId);
        return result;
    } catch (error) {
        console.error('❌ Confirmation email sending failed:', error);
        return { success: false, error: error.message };
    }
};

/** Trek booking — confirmation first (critical), then thank-you. Never skip confirm if thank-you fails. */
const sendTrekRegistrationEmails = async ({
    userEmail,
    userName,
    trekName,
    bookingId,
    bookingDetails = {},
    amountPaid = 0,
    groupLink = '',
    communityName = '',
    ticketLink: ticketLinkOverride = '',
}) => {
    const email = String(userEmail || '').trim().toLowerCase();
    if (!email || !EMAIL_ADDRESS_REGEX.test(email)) {
        console.error('❌ Trek confirmation skipped: invalid user email', userEmail);
        return { success: false, error: 'User email missing or invalid' };
    }

    const paid = Number(amountPaid) || 0;
    const submissionDate = formatSubmissionDateIST();
    const ticketLink = ticketLinkOverride || `/registration-details/${bookingId}?type=trek`;
    const details = [
        bookingDetails.date ? { label: 'Date', value: bookingDetails.date } : null,
        bookingDetails.time ? { label: 'Time', value: bookingDetails.time } : null,
        { label: 'Tickets', value: '1 person' },
        paid > 0 ? { label: 'Amount paid', value: `₹${paid}` } : null,
    ].filter(Boolean);
    const payment = {
        status: paid > 0 ? 'paid' : 'free',
        method: paid > 0 ? 'cashfree' : '',
        type: 'trek',
        ticketLink,
        details,
        groupLink,
        communityName,
    };

    console.log(`📧 Trek confirmation → ${email} · booking ${bookingId} · ${trekName}`);

    // Confirmation is the user-facing proof of booking — send it first
    const confirmation = await sendRegistrationConfirmationEmail(
        email,
        userName || 'there',
        trekName,
        null,
        String(bookingId),
        submissionDate,
        payment,
    );

    // Thank-you is secondary; failure must not affect confirmation result
    let thankYou = { success: false, skipped: true };
    try {
        thankYou = await sendRegistrationThankYouEmail(email, userName || 'there', trekName, {
            type: 'trek',
            ticketLink,
            details,
            groupLink,
            communityName,
        });
    } catch (err) {
        console.error('[Trek Email] Thank-you failed (confirmation already attempted):', err.message);
        thankYou = { success: false, error: err.message };
    }

    const success = !!(confirmation && confirmation.success !== false && !confirmation.error);
    if (!success) {
        console.error('❌ Trek confirmation email failed:', confirmation?.error || confirmation);
    } else {
        console.log('✅ Trek confirmation email queued/sent for', email);
    }

    return {
        success,
        confirmation,
        thankYou,
        error: success ? undefined : (confirmation?.error || 'Confirmation email failed'),
    };
};

// Generate HTML content for thank you email
const generateThankYouEmailHTML = (userName, eventName, options = {}) => {
    const meta = resolveRegistrationMeta(options.type);
    const ticketHref = resolveTicketHref(options.ticketLink);
    const details = options.details || [];

    return buildEmailShell({
        preheader: `We received your ${meta.noun.toLowerCase()} registration for ${eventName}.`,
        eyebrow: `${meta.icon} Registration received`,
        title: meta.thankHeadline,
        subtitle: eventName,
        bodyHtml: `
            <p style="margin:0 0 12px;">Hi <strong>${userName || 'there'}</strong>,</p>
            <p style="margin:0 0 12px;">Your registration for <strong>${eventName}</strong> is in. We've saved your spot and sent a confirmation with your booking details.</p>
            ${buildDetailsTable(details)}
            ${buildWhatsAppJoinBlock(options.groupLink, options.communityName)}
            <p style="margin:16px 0 0;font-size:14px;color:#6b7280;">Keep this email handy. You can also view your ticket anytime from My Bookings in the app.</p>
        `,
        ctaLabel: options.ticketLink ? 'View ticket' : 'Open My Bookings',
        ctaHref: ticketHref,
    });
};

// Generate HTML content for confirmation email
const generateConfirmationEmailHTML = (userName, festName, competitionName, registrationId, submissionDate, paymentContext = {}) => {
    const meta = resolveRegistrationMeta(paymentContext.type);
    const ticketHref = resolveTicketHref(paymentContext.ticketLink);
    const extraDetails = paymentContext.details || [];

    const rows = [
        { label: 'Name', value: userName },
        { label: meta.noun, value: festName },
        competitionName ? { label: 'Activity', value: competitionName } : null,
        { label: 'Booking ID', value: registrationId },
        { label: 'Registered on', value: submissionDate },
        ...extraDetails,
    ].filter(Boolean);

    return buildEmailShell({
        preheader: `Confirmed — ${festName}. Booking ID ${registrationId}`,
        eyebrow: `${meta.icon} Confirmed`,
        title: meta.confirmHeadline,
        subtitle: festName,
        bodyHtml: `
            <p style="margin:0 0 12px;">Hi <strong>${userName || 'there'}</strong>,</p>
            <p style="margin:0 0 8px;">You're all set! Here are your registration details:</p>
            ${buildDetailsTable(rows)}
            ${buildPaymentNotice(paymentContext)}
            ${buildWhatsAppJoinBlock(paymentContext.groupLink, paymentContext.communityName)}
            <p style="margin:16px 0 0;font-size:14px;color:#6b7280;">Show your ticket at check-in. We'll notify you if anything changes.</p>
        `,
        ctaLabel: paymentContext.ticketLink ? 'View ticket & QR' : 'View My Bookings',
        ctaHref: ticketHref,
    });
};

// Send organizer notification email when user registers
const sendOrganizerNotificationEmail = async (organizerEmail, userName, userEmail, festName, competitionName, registrationId, submissionDate) => {
    try {
        console.log('📧 Sending organizer notification email to:', organizerEmail);

        if (!organizerEmail) {
            console.error('❌ Organizer email skipped: organizer email missing');
            return { success: false, error: 'Organizer email missing' };
        }

        const mailOptions = {
            from: getDefaultFrom(),
            to: organizerEmail,
            subject: `New Registration - ${festName}${competitionName ? ` (${competitionName})` : ''}`,
            html: generateOrganizerNotificationEmailHTML(userName, userEmail, festName, competitionName, registrationId, submissionDate)
        };

        const result = await sendEmail(mailOptions);
        console.log('✅ Organizer notification email sent successfully:', result.messageId);
        return result;
    } catch (error) {
        console.error('❌ Organizer notification email sending failed:', error);
        // Don't throw error - email failure shouldn't break registration
        return { success: false, error: error.message };
    }
};

const sendEventOrganizerApprovalEmail = async ({
    toEmail,
    organizerName,
    username,
    loginUrl,
    eventTitles = [],
    temporaryPassword = '',
    accountCreatedByAdmin = false,
}) => {
    try {
        const email = String(toEmail || '').trim().toLowerCase();
        if (!email || !EMAIL_ADDRESS_REGEX.test(email)) {
            return { success: false, error: 'Organizer email missing or invalid' };
        }
        const eventsList = (Array.isArray(eventTitles) ? eventTitles : [])
            .map((t) => String(t || '').trim())
            .filter(Boolean)
            .slice(0, 8);
        const eventsHtml = eventsList.length
            ? `<ul style="margin:10px 0 0 18px;padding:0;color:#374151;font-size:14px;line-height:1.6;">
                ${eventsList.map((t) => `<li style="margin:0 0 6px;">${t}</li>`).join('')}
            </ul>`
            : '<p style="margin:8px 0 0;font-size:14px;color:#6b7280;">Your assigned events are visible after login.</p>';
        const safeLogin = String(loginUrl || `${getSiteUrl()}/event-organizer/login`).trim();
        const hasTempPassword = String(temporaryPassword || '').trim().length > 0;
        const accountTypeLabel = accountCreatedByAdmin ? 'Organizer account created' : 'Organizer approval';
        const subject = accountCreatedByAdmin
            ? '✅ Your CrwdCtrl event organizer account is ready'
            : '✅ Your CrwdCtrl organizer account is approved';
        const mailOptions = {
            from: getDefaultFrom(),
            to: email,
            subject,
            html: buildEmailShell({
                preheader: accountCreatedByAdmin
                    ? 'Your organizer account has been created and is ready to use'
                    : 'Your organizer account is now active',
                eyebrow: accountTypeLabel,
                title: accountCreatedByAdmin
                    ? 'Your organizer account is ready'
                    : 'Your organizer account is approved',
                subtitle: 'You can now log in and manage registrations.',
                bodyHtml: `
                    <p style="margin:0 0 12px;">Hi <strong>${organizerName || 'Organizer'}</strong>,</p>
                    <p style="margin:0 0 12px;">
                        ${accountCreatedByAdmin
        ? 'Your Event Organizer account on CrwdCtrl has been created by the admin team and is active now.'
        : 'Your Event Organizer access on CrwdCtrl is now approved.'}
                    </p>
                    <p style="margin:0 0 8px;"><strong>Login details</strong></p>
                    <p style="margin:0 0 12px;font-size:14px;color:#374151;">
                        Username: <strong>${username || '—'}</strong><br/>
                        ${hasTempPassword ? `Temporary password: <strong>${String(temporaryPassword)}</strong><br/>` : ''}
                        Portal: <a href="${safeLogin}" style="color:#0ea5e9;text-decoration:underline;">${safeLogin}</a>
                    </p>
                    <div style="margin:14px 0;padding:14px;border-radius:12px;background:#f9fafb;border:1px solid #e5e7eb;">
                        <p style="margin:0;font-size:13px;color:#6b7280;">Assigned events</p>
                        ${eventsHtml}
                    </div>
                    <p style="margin:14px 0 0;font-size:13px;color:#6b7280;">
                        ${hasTempPassword
        ? 'For security, please change this temporary password after your first login.'
        : 'If you forgot your password, contact the CrwdCtrl admin team to reset it.'}
                    </p>
                `,
                ctaLabel: 'Open organizer portal',
                ctaHref: safeLogin,
                footnote: 'This approval email was sent automatically by CrwdCtrl.',
            }),
        };
        return await sendEmail(mailOptions);
    } catch (error) {
        console.error('❌ Event organizer approval email failed:', error.message);
        return { success: false, error: error.message };
    }
};

const sendCommunityOrganizerApprovalEmail = async ({
    toEmail,
    organizerName,
    username,
    loginUrl,
    signupUrl,
    communityName = '',
    eventTitles = [],
    listingHub = 'sports',
    accountCreatedByAdmin = false,
    existingAccountApproved = false,
    temporaryPassword = '',
}) => {
    try {
        const email = String(toEmail || '').trim().toLowerCase();
        if (!email || !EMAIL_ADDRESS_REGEX.test(email)) {
            return { success: false, error: 'Organizer email missing or invalid' };
        }
        const isEvents = listingHub === 'events';
        const portalLabel = isEvents ? 'Event community organizer' : 'Run club organizer';
        const safeLogin = String(loginUrl || `${getSiteUrl()}/run-club-organizer/login`).trim();
        const safeSignup = String(signupUrl || `${getSiteUrl()}/run-club-organizer/signup${isEvents ? '?hub=events' : ''}`).trim();
        const eventsList = (Array.isArray(eventTitles) ? eventTitles : [])
            .map((t) => String(t || '').trim())
            .filter(Boolean)
            .slice(0, 8);
        const eventsHtml = eventsList.length
            ? `<ul style="margin:10px 0 0 18px;padding:0;color:#374151;font-size:14px;line-height:1.6;">
                ${eventsList.map((t) => `<li style="margin:0 0 6px;">${t}</li>`).join('')}
            </ul>`
            : `<p style="margin:8px 0 0;font-size:14px;color:#6b7280;">Your ${isEvents ? 'events' : 'runs'} appear in the portal after login.</p>`;
        const hasTempPassword = String(temporaryPassword || '').trim().length > 0;
        const subject = accountCreatedByAdmin
            ? `✅ Your CrwdCtrl ${portalLabel} account is ready`
            : `✅ Your CrwdCtrl ${portalLabel} account is approved`;
        const credentialsHint = accountCreatedByAdmin
            ? ''
            : existingAccountApproved
                ? `<p style="margin:0 0 12px;font-size:13px;color:#6b7280;">Sign in with the username and password you chose when you requested access.</p>`
                : (!hasTempPassword
                    ? `<p style="margin:0 0 12px;font-size:13px;color:#6b7280;">No account yet? <a href="${safeSignup}" style="color:#0ea5e9;">Create one here</a> with this email after CrwdCtrl invites you.</p>`
                    : '');
        const mailOptions = {
            from: getDefaultFrom(),
            to: email,
            subject,
            html: buildEmailShell({
                preheader: accountCreatedByAdmin
                    ? 'Your organizer account is ready to use'
                    : 'You can sign in and manage your community',
                eyebrow: portalLabel,
                title: accountCreatedByAdmin ? 'Account ready' : 'You\'re approved',
                subtitle: communityName ? `Community: ${communityName}` : 'CrwdCtrl organizer portal',
                bodyHtml: `
                    <p style="margin:0 0 12px;">Hi <strong>${organizerName || 'Organizer'}</strong>,</p>
                    <p style="margin:0 0 12px;">
                        ${accountCreatedByAdmin
        ? `Your ${portalLabel} account on CrwdCtrl is active. Use the details below to sign in.`
        : `Your ${portalLabel} access is approved. Sign in to manage registrations, scan guests in, and send updates.`}
                    </p>
                    <p style="margin:0 0 8px;"><strong>Login</strong></p>
                    <p style="margin:0 0 12px;font-size:14px;color:#374151;">
                        Username: <strong>${username || '—'}</strong><br/>
                        ${hasTempPassword ? `Temporary password: <strong>${String(temporaryPassword)}</strong><br/>` : ''}
                        Portal: <a href="${safeLogin}" style="color:#0ea5e9;text-decoration:underline;">${safeLogin}</a>
                    </p>
                    ${credentialsHint}
                    <div style="margin:14px 0;padding:14px;border-radius:12px;background:#f9fafb;border:1px solid #e5e7eb;">
                        <p style="margin:0;font-size:13px;color:#6b7280;">${isEvents ? 'Your events' : 'Your runs'}</p>
                        ${eventsHtml}
                    </div>
                `,
                ctaLabel: 'Open organizer portal',
                ctaHref: safeLogin,
                footnote: 'This email was sent automatically by CrwdCtrl.',
            }),
        };
        return await sendEmail(mailOptions);
    } catch (error) {
        console.error('❌ Community organizer approval email failed:', error.message);
        return { success: false, error: error.message };
    }
};

const sendCommunityOrganizerProfileInviteEmail = async ({
    toEmail,
    signupUrl,
    listingHub = 'sports',
    note = '',
}) => {
    try {
        const email = String(toEmail || '').trim().toLowerCase();
        if (!email || !EMAIL_ADDRESS_REGEX.test(email)) {
            return { success: false, error: 'Email missing or invalid' };
        }
        const isEvents = listingHub === 'events';
        const portalLabel = isEvents ? 'Event community organizer' : 'Run club organizer';
        const safeSignup = String(signupUrl || `${getSiteUrl()}/run-club-organizer/signup${isEvents ? '?hub=events' : ''}`).trim();
        const mailOptions = {
            from: getDefaultFrom(),
            to: email,
            subject: `You're invited — CrwdCtrl ${portalLabel}`,
            html: buildEmailShell({
                preheader: 'Create your organizer account on CrwdCtrl',
                eyebrow: 'Organizer invite',
                title: `Join as ${portalLabel}`,
                subtitle: 'CrwdCtrl approved your email for the organizer portal',
                bodyHtml: `
                    <p style="margin:0 0 12px;">Hi,</p>
                    <p style="margin:0 0 12px;">
                        CrwdCtrl added your email for <strong>${portalLabel}</strong> access.
                        Create your account with this same email — we'll review and approve your login shortly.
                    </p>
                    ${note ? `<p style="margin:0 0 12px;font-size:13px;color:#6b7280;"><em>Note from admin: ${note}</em></p>` : ''}
                    <p style="margin:0 0 12px;font-size:14px;color:#374151;">
                        Signup link: <a href="${safeSignup}" style="color:#0ea5e9;text-decoration:underline;">${safeSignup}</a>
                    </p>
                    <p style="margin:0;font-size:13px;color:#6b7280;">Use the email this message was sent to when signing up.</p>
                `,
                ctaLabel: 'Create organizer account',
                ctaHref: safeSignup,
            }),
        };
        return await sendEmail(mailOptions);
    } catch (error) {
        console.error('❌ Community organizer invite email failed:', error.message);
        return { success: false, error: error.message };
    }
};

// Generate HTML content for organizer notification email
const generateOrganizerNotificationEmailHTML = (userName, userEmail, festName, competitionName, registrationId, submissionDate) => {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body { 
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                line-height: 1.6; 
                color: #333; 
                margin: 0; 
                padding: 0;
                background-color: #f5f5f5;
            }
            .container { 
                max-width: 600px; 
                margin: 20px auto; 
                background: white;
                border-radius: 12px;
                overflow: hidden;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .header { 
                background: linear-gradient(135deg, #053780, #0ECCEE); 
                color: white; 
                padding: 30px 20px; 
                text-align: center;
            }
            .header h1 {
                margin: 0;
                font-size: 28px;
                font-weight: bold;
            }
            .content { 
                padding: 30px 20px;
            }
            .notification-message {
                text-align: center;
                margin-bottom: 30px;
                padding: 20px;
                background: #e3f2fd;
                border: 2px solid #bbdefb;
                border-radius: 8px;
            }
            .notification-message h2 {
                color: #053780;
                font-size: 24px;
                margin: 0 0 10px 0;
            }
            .registration-details {
                background: #f8f9fa;
                padding: 20px;
                border-radius: 8px;
                margin: 25px 0;
            }
            .detail-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 8px 0;
                border-bottom: 1px solid #e9ecef;
            }
            .detail-row:last-child {
                border-bottom: none;
            }
            .detail-label {
                font-weight: 600;
                color: #495057;
            }
            .detail-value {
                color: #6c757d;
                text-align: right;
                font-weight: 500;
            }
            .registration-id {
                background: #fff3cd;
                padding: 15px;
                border-radius: 8px;
                text-align: center;
                margin: 20px 0;
                border: 2px solid #ffeaa7;
            }
            .registration-id strong {
                color: #856404;
                font-size: 18px;
            }
            .action-note {
                background: #d1ecf1;
                border: 1px solid #bee5eb;
                padding: 20px;
                border-radius: 8px;
                margin: 25px 0;
            }
            .footer {
                background: #f8f9fa;
                padding: 20px;
                text-align: center;
                border-top: 1px solid #e9ecef;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🔔 New Registration</h1>
            </div>
            
            <div class="content">
                <div class="notification-message">
                    <h2>New Registration Received!</h2>
                    <p>A user has registered for your event</p>
                </div>

                <div class="registration-id">
                    <p>Registration ID</p>
                    <strong>${registrationId}</strong>
                </div>

                <div class="registration-details">
                    <div class="detail-row">
                        <span class="detail-label">Participant Name</span>
                        <span class="detail-value">${userName}</span>
                    </div>
                    
                    <div class="detail-row">
                        <span class="detail-label">Email</span>
                        <span class="detail-value">${userEmail}</span>
                    </div>
                    
                    <div class="detail-row">
                        <span class="detail-label">Fest</span>
                        <span class="detail-value">${festName}</span>
                    </div>
                    
                    ${competitionName ? `
                    <div class="detail-row">
                        <span class="detail-label">Competition</span>
                        <span class="detail-value">${competitionName}</span>
                    </div>
                    ` : ''}
                    
                    <div class="detail-row">
                        <span class="detail-label">Registration Date</span>
                        <span class="detail-value">${submissionDate}</span>
                    </div>
                </div>

                <div style="background: #e8f5e8; padding: 20px; border-radius: 8px; text-align: center; margin-top: 25px; border: 2px solid #c3e6cb;">
                    <p style="color: #155724; margin: 0; font-size: 16px;">
                        <strong>Registration notification from CrwdCtrl</strong><br>
                        This email was sent automatically when a user registered for your event.
                    </p>
                </div>
            </div>
            
            <div class="footer">
                <p><strong>Team CrwdCtrl</strong></p>
                <p style="font-size: 12px; color: #999;">This is an automated notification email</p>
            </div>
        </div>
    </body>
    </html>
    `;
};

// Send login confirmation email
const sendLoginConfirmationEmail = async (userData) => {
    try {
        console.log('🔐 Starting login confirmation email process for:', userData.email);

        if (!userData.email) {
            console.error('❌ Cannot send login confirmation email: email is missing');
            return { success: false, error: 'User email is required to send login confirmation email' };
        }

        const mailOptions = {
            from: getDefaultFrom(),
            to: userData.email,
            subject: '✅ You\'re logged in — explore CrwdCtrl',
            html: generateLoginConfirmationEmailHTML(userData)
        };

        console.log('📤 Sending login confirmation email...');
        console.log('   From:', mailOptions.from);
        console.log('   To:', mailOptions.to);
        console.log('   Subject:', mailOptions.subject);

        // ✅ Use universal email sender (Resend API or SMTP fallback)
        const result = await sendEmail(mailOptions);
        console.log('✅ Login confirmation email sent successfully!');
        return result;

    } catch (error) {
        console.error('❌ Login confirmation email sending failed!');
        console.error('   Error name:', error.name);
        console.error('   Error message:', error.message);
        console.error('   Error code:', error.code);
        console.error('   Full error:', error);
        // Don't throw - don't block login if email fails
        return { success: false, error: error.message };
    }
};

// Generate HTML for login confirmation email
const generateLoginConfirmationEmailHTML = (userData) => {
    const loginTime = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    return buildCrwdCtrlExploreEmailHTML({
        userName: userData?.name,
        headline: 'You\'re logged in!',
        message: 'your CrwdCtrl account is active. Explore run clubs, college fests, treks and event communities — or tap Explore Now to jump back in.',
        loginTime,
        preheader: 'Login confirmed — discover runs, college fests, treks and events on CrwdCtrl.',
    });
};

module.exports = {
    // Generalized functions (ACTIVE)
    sendWelcomeEmail,
    sendRegistrationThankYouEmail,
    sendRegistrationConfirmationEmail,
    sendCompetitionRegistrationEmail,
    sendCompetitionRegistrationEmailForRecord,
    sendTrekRegistrationEmails,
    sendOrganizerNotificationEmail,
    sendEventOrganizerApprovalEmail,
    sendCommunityOrganizerApprovalEmail,
    sendCommunityOrganizerProfileInviteEmail,
    sendLoginConfirmationEmail,
    sendEventBroadcast,
    sendTrekParticipantEmails,
    sendFestParticipantEmails,
    sendAdminCampaignEmails,
    previewAdminCampaignEmailHTML,
    previewLoginEmailHTML: generateLoginConfirmationEmailHTML,
    previewWelcomeEmailHTML: generateWelcomeEmailHTML,
};