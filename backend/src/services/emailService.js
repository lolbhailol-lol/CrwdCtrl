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

/** Shared responsive email shell — CrwdCtrl brand */
function buildEmailShell({
    preheader = '',
    eyebrow = 'CrwdCtrl',
    title,
    subtitle = '',
    bodyHtml = '',
    ctaLabel = '',
    ctaHref = '',
    footnote = 'Need help? Reply to this email or contact us at team.crwdctrl@gmail.com',
}) {
    const safePreheader = preheader.replace(/"/g, '&quot;');
    const ctaBlock = ctaLabel && ctaHref ? `
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 28px 0 8px;">
            <tr>
                <td align="center">
                    <a href="${ctaHref}" style="display: inline-block; background: linear-gradient(135deg, #053780, #0a5ea8); color: #ffffff; text-decoration: none; font-weight: 700; font-size: 15px; padding: 14px 28px; border-radius: 999px;">
                        ${ctaLabel}
                    </a>
                </td>
            </tr>
        </table>` : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#eef2f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1f2937;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${safePreheader}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef2f7;padding:24px 12px;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 8px 30px rgba(5,55,128,0.08);">
                    <tr>
                        <td style="background:linear-gradient(135deg,#053780 0%,#0ECCEE 100%);padding:28px 24px;text-align:center;">
                            <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.85);">${eyebrow}</p>
                            <h1 style="margin:0;font-size:24px;line-height:1.3;color:#ffffff;font-weight:800;">${title}</h1>
                            ${subtitle ? `<p style="margin:10px 0 0;font-size:14px;line-height:1.5;color:rgba(255,255,255,0.92);">${subtitle}</p>` : ''}
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:28px 24px 12px;font-size:15px;line-height:1.7;color:#374151;">
                            ${bodyHtml}
                            ${ctaBlock}
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:0 24px 24px;">
                            <p style="margin:0;font-size:12px;line-height:1.6;color:#9ca3af;text-align:center;">${footnote}</p>
                            <p style="margin:8px 0 0;font-size:12px;color:#9ca3af;text-align:center;">© ${new Date().getFullYear()} CrwdCtrl</p>
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
    const rowHtml = items.map((r) => `
        <tr>
            <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;font-size:13px;color:#6b7280;width:38%;vertical-align:top;">${r.label}</td>
            <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;font-size:14px;color:#111827;font-weight:600;text-align:right;vertical-align:top;">${r.value}</td>
        </tr>`).join('');
    return `
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0;background:#f9fafb;border:1px solid #e5e7eb;border-radius:14px;padding:4px 16px;">
            ${rowHtml}
        </table>`;
}

function buildWhatsAppJoinBlock(groupLink, communityName, { product = 'trek' } = {}) {
    const url = String(groupLink || '').trim();
    if (!url) return '';
    const isPhoneChat = /^https?:\/\/wa\.me\//i.test(url);
    const fromLabel = communityName ? ` from <strong>${communityName}</strong>` : '';
    const heading = isPhoneChat ? 'Message on WhatsApp' : 'Join the WhatsApp group';
    const cta = isPhoneChat ? 'Message club on WhatsApp' : 'Join WhatsApp group';
    const blurb = isPhoneChat
        ? `Have a question${fromLabel}? Reach the club on WhatsApp.`
        : product === 'run'
            ? `Get run updates, meetup details and announcements${fromLabel}.`
            : `Get trek updates, meetup details and announcements${fromLabel}.`;
    return `
        <div style="margin:20px 0;padding:18px;border-radius:14px;background:#ecfdf5;border:1px solid #6ee7b7;">
            <p style="margin:0 0 8px;font-size:15px;font-weight:700;color:#065f46;">${heading}</p>
            <p style="margin:0 0 14px;font-size:13px;line-height:1.6;color:#047857;">${blurb}</p>
            <a href="${url}" style="display:inline-block;background:#25D366;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 20px;border-radius:999px;">${cta}</a>
            <p style="margin:14px 0 0;font-size:12px;line-height:1.5;color:#047857;word-break:break-all;">Or copy this link: <a href="${url}" style="color:#047857;">${url}</a></p>
        </div>`;
}

function buildPaymentNotice(paymentContext = {}) {
    const status = paymentContext?.status || 'unknown';
    const method = paymentContext?.method || '';
    const methodLabel = method === 'cashfree' ? 'Cashfree' : method;

    if (status === 'paid') {
        return `
            <div style="margin:18px 0;padding:16px 18px;border-radius:14px;background:#ecfdf5;border:1px solid #a7f3d0;">
                <p style="margin:0 0 6px;font-size:14px;font-weight:700;color:#065f46;">Payment received</p>
                <p style="margin:0;font-size:13px;line-height:1.6;color:#047857;">Your payment${methodLabel ? ` via ${methodLabel}` : ''} is confirmed. You're all set.</p>
            </div>`;
    }
    if (status === 'free') {
        return `
            <div style="margin:18px 0;padding:16px 18px;border-radius:14px;background:#eff6ff;border:1px solid #bfdbfe;">
                <p style="margin:0 0 6px;font-size:14px;font-weight:700;color:#1e40af;">Free registration</p>
                <p style="margin:0;font-size:13px;line-height:1.6;color:#1d4ed8;">No payment was required. See you there!</p>
            </div>`;
    }
    if (status === 'pending') {
        return `
            <div style="margin:18px 0;padding:16px 18px;border-radius:14px;background:#fffbeb;border:1px solid #fde68a;">
                <p style="margin:0 0 6px;font-size:14px;font-weight:700;color:#92400e;">Waiting for organizer approval</p>
                <p style="margin:0;font-size:13px;line-height:1.6;color:#b45309;">${paymentContext.message || 'Your payment screenshot was submitted. The organizer will review it and confirm your spot. You’ll get another email once it’s approved.'}</p>
            </div>`;
    }
    if (status === 'failed') {
        return `
            <div style="margin:18px 0;padding:16px 18px;border-radius:14px;background:#fef2f2;border:1px solid #fecaca;">
                <p style="margin:0 0 6px;font-size:14px;font-weight:700;color:#991b1b;">Payment not approved</p>
                <p style="margin:0;font-size:13px;line-height:1.6;color:#b91c1c;">${paymentContext.message || 'Your payment was not approved. You can register again from My Bookings or the run page.'}</p>
            </div>`;
    }
    return `
        <div style="margin:18px 0;padding:16px 18px;border-radius:14px;background:#f9fafb;border:1px solid #e5e7eb;">
            <p style="margin:0;font-size:13px;line-height:1.6;color:#4b5563;">We'll share updates and next steps closer to the date.</p>
        </div>`;
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
    name, title, message, trekName, link, kind, groupLink, communityName, product = 'trek', paymentContext = null,
}) => {
    const isRun = product === 'run';
    const headerLabel = kind === 'registration'
        ? 'Booking update'
        : kind === 'reminder'
            ? (isRun ? 'Run reminder' : 'Trek reminder')
            : kind === 'organizer'
                ? 'Message from organizer'
                : (isRun ? 'Run update' : 'Trek update');
    const fullLink = resolveTicketHref(link || (isRun ? '/sports' : '/treks'));
    const bodyMessage = String(message || '').replace(/\n/g, '<br/>');
    const entityLabel = isRun ? 'Run' : 'Trek';
    const paymentNoticeHtml = paymentContext ? buildPaymentNotice(paymentContext) : '';

    return buildEmailShell({
        preheader: `${trekName} — ${title}`,
        eyebrow: headerLabel,
        title,
        subtitle: trekName,
        bodyHtml: `
            <p style="margin:0 0 12px;">Hi <strong>${name || 'there'}</strong>,</p>
            <p style="margin:0 0 12px;line-height:1.6;">${bodyMessage}</p>
            ${paymentNoticeHtml}
            ${buildDetailsTable([{ label: entityLabel, value: trekName }])}
            ${buildWhatsAppJoinBlock(groupLink, communityName, { product: isRun ? 'run' : 'trek' })}
        `,
        ctaLabel: isRun && kind === 'registration' && String(title || '').toLowerCase().includes('approved')
            ? 'Download ticket'
            : 'View booking',
        ctaHref: fullLink,
        footnote: isRun
            ? 'You received this about your run booking on CrwdCtrl.'
            : 'You received this about your trek on CrwdCtrl.',
    });
};

const sendTrekParticipantEmails = async (recipients = []) => {
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
                subject: item.subject || item.title || 'Update from your trek organizer',
                html: generateTrekParticipantEmailHTML(item),
            });
            results.success += 1;
        } catch (err) {
            console.error('❌ Trek participant email failed:', item.email, err.message);
            results.failed += 1;
        }
    }

    return results;
};

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
            subject: "🎉 Welcome to CrwdCtrl - Let's Explore Amazing Fests!",
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
const generateWelcomeEmailHTML = (userData) => {
    return `
    <!DOCTYPE html>>
    <html>
    <head>
        <style>
            body { 
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                line-height: 1.8; 
                color: #333; 
                margin: 0; 
                padding: 0;
                background-color: #f5f5f5;
            }
            .container { 
                max-width: 600px; 
                margin: 40px auto; 
                background: white;
                border-radius: 12px;
                overflow: hidden;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .header { 
                background: linear-gradient(135deg, #053780, #0ECCEE); 
                color: white; 
                padding: 40px 30px; 
                text-align: center;
            }
            .header h1 {
                margin: 0;
                font-size: 32px;
                font-weight: bold;
                letter-spacing: 2px;
            }
            .content { 
                padding: 40px 30px;
            }
            .content p {
                color: #555;
                font-size: 16px;
                line-height: 1.8;
                margin-bottom: 15px;
            }
            .greeting {
                font-weight: 600;
                color: #053780;
                font-size: 18px;
            }
            .footer {
                background: #f8f9fa;
                padding: 25px 30px;
                text-align: left;
                border-top: 1px solid #e9ecef;
            }
            .footer p {
                margin: 5px 0;
                color: #666;
                font-size: 15px;
            }
            .team-signature {
                margin-top: 20px;
                font-weight: 600;
                color: #053780;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🎊 CRWDCTRL 🎊</h1>
            </div>
            
            <div class="content">
                <p class="greeting">Hi ${userData.name},</p>
                <p>Thank you for registering on CrwdCtrl! 🎊</p>
                
                <p>You're now ready to explore all the exciting fest events, competitions, and activities happening around you. Dive in, discover opportunities, and make the most of your experience!</p>
                
                <p>If you have any questions or need support, we're here to help.</p>
            </div>
            
            <div class="footer">
                <p class="team-signature">Welcome aboard,</p>
                <p class="team-signature">Team CrwdCtrl</p>
            </div>
        </div>
    </body>
    </html>
    `;
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
            subject: '✅ Login Confirmed - CrwdCtrl Account',
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
            .success-badge {
                display: inline-block;
                background: #10b981;
                color: white;
                padding: 8px 16px;
                border-radius: 20px;
                font-weight: 600;
                margin-bottom: 20px;
            }
            .info-box {
                background: #f0f9ff;
                border-left: 4px solid #0ECCEE;
                padding: 15px;
                margin: 20px 0;
                border-radius: 4px;
            }
            .info-box p {
                margin: 8px 0;
                color: #333;
            }
            .label {
                font-weight: 600;
                color: #053780;
            }
            .footer {
                background: #f8f9fa;
                padding: 20px;
                text-align: center;
                border-top: 1px solid #e9ecef;
            }
            .footer p {
                margin: 8px 0;
                color: #666;
                font-size: 13px;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>✅ Login Successful!</h1>
            </div>
            
            <div class="content">
                <p class="greeting">Hi <strong>${userData.name || 'User'}</strong>,</p>
                
                <p>Your account has been accessed successfully. This is a security confirmation that you recently logged into your CrwdCtrl account.</p>
                
                <div class="info-box">
                    <p><span class="label">📧 Account Email:</span></p>
                    <p>${userData.email}</p>
                    
                    <p style="margin-top: 15px;"><span class="label">🕐 Login Time:</span></p>
                    <p>${loginTime} (IST)</p>
                    
                    <p style="margin-top: 15px;"><span class="label">📱 Account Status:</span></p>
                    <p><strong style="color: #10b981;">✓ Active</strong></p>
                </div>
                
                <p style="color: #666; font-size: 14px; margin-top: 25px;">
                    If you did not log in to your account, please <a href="mailto:${process.env.ADMIN_EMAIL || 'support@crwdctrl.com'}" style="color: #0ECCEE; text-decoration: none;">contact our support team</a> immediately.
                </p>
                
                <p style="margin-top: 20px; color: #888; font-size: 13px;">
                    Stay safe and enjoy exploring amazing fests on CrwdCtrl! 🎉
                </p>
            </div>
            
            <div class="footer">
                <p style="margin-bottom: 15px;"><strong>Team CrwdCtrl</strong></p>
                <p>This is an automated security notification email</p>
                <p style="margin-top: 10px; color: #999;">© ${new Date().getFullYear()} CrwdCtrl. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
    `;
};

module.exports = {
    // Generalized functions (ACTIVE)
    sendWelcomeEmail,
    sendRegistrationThankYouEmail,
    sendRegistrationConfirmationEmail,
    sendTrekRegistrationEmails,
    sendOrganizerNotificationEmail,
    sendEventOrganizerApprovalEmail,
    sendLoginConfirmationEmail,
    sendEventBroadcast,
    sendTrekParticipantEmails,
    sendAdminCampaignEmails,
    previewAdminCampaignEmailHTML,
};