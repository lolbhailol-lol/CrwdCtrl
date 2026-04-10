const nodemailer = require('nodemailer');
const Brevo = require('@getbrevo/brevo');
const { Resend } = require('resend');

// Initialize Resend
let resendInstance = null;
if (process.env.RESEND_API_KEY) {
    resendInstance = new Resend(process.env.RESEND_API_KEY);
}

// ============================================
// 📧 EMAIL QUEUE SYSTEM - Prevents Rate Limiting
// ============================================
// Brevo free tier allows 300 emails/day.
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

// ✅ BREVO API CLIENT (HTTP-based, works on Railway/cloud platforms)
// Free tier: 300 emails/day forever, no trial expiry
let brevoApiInstance = null;
if (process.env.BREVO_API_KEY) {
    brevoApiInstance = new Brevo.TransactionalEmailsApi();
    brevoApiInstance.setApiKey(Brevo.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY);
}

// Check if Brevo is available
const useBrevo = () => {
    if (brevoApiInstance && process.env.BREVO_API_KEY) {
        console.log('📧 Using Brevo API for email delivery');
        return true;
    }
    console.log('⚠️ Brevo API key not configured, falling back to SMTP (may fail on cloud)');
    return false;
};

// ✅ BREVO EMAIL SENDER (HTTP-based - works on Railway!)
const sendWithBrevo = async (mailOptions) => {
    if (!brevoApiInstance) {
        throw new Error('Brevo API key not configured');
    }

    console.log('📧 Sending email via Brevo API...');
    console.log('   To:', mailOptions.to);
    console.log('   Subject:', mailOptions.subject);
    console.log('   Timestamp:', new Date().toISOString());

    const sendSmtpEmail = new Brevo.SendSmtpEmail();
    sendSmtpEmail.sender = {
        name: 'CrwdCtrl',
        email: mailOptions.from || process.env.BREVO_SENDER_EMAIL || 'onboarding@crwdctrl.in'
    };
    sendSmtpEmail.to = Array.isArray(mailOptions.to)
        ? mailOptions.to.map(email => ({ email }))
        : [{ email: mailOptions.to }];
    sendSmtpEmail.subject = mailOptions.subject;
    sendSmtpEmail.htmlContent = mailOptions.html;
    if (mailOptions.text) {
        sendSmtpEmail.textContent = mailOptions.text;
    }
    sendSmtpEmail.replyTo = {
        email: process.env.BREVO_REPLY_TO || 'team.crwdctrl@gmail.com'
    };

    try {
        const data = await brevoApiInstance.sendTransacEmail(sendSmtpEmail);
        console.log('✅ Email sent via Brevo! MessageId:', data?.body?.messageId || data?.messageId || 'OK');
        return { success: true, messageId: data?.body?.messageId || data?.messageId || 'brevo-ok' };
    } catch (error) {
        const errMsg = error?.body?.message || error?.message || 'Brevo API failed';
        console.error('❌ Brevo API error:', errMsg);
        throw new Error(errMsg);
    }
};

// ✅ UNIVERSAL EMAIL SENDER - Uses queue to prevent rate limiting
const sendEmail = async (mailOptions) => {
    return queueEmail(async () => {
        // PRIORITY 1: RESEND
        if (process.env.RESEND_API_KEY && resendInstance) {
            try {
                return await sendWithResend(mailOptions);
            } catch (error) {
                console.warn('🔄 Resend failed or Domain mismatch, falling back to Brevo...');
            }
        }

        // PRIORITY 2: BREVO
        if (useBrevo()) {
            return await sendWithBrevo(mailOptions);
        }

        // PRIORITY 3: GMAIL/SMTP
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

        // In production without Brevo, throw error
        if (process.env.NODE_ENV === 'production' && !useBrevo()) {
            throw new Error('Email credentials not configured in production environment');
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

// Send immediate thank you email after registration submission (GENERALIZED)
const sendRegistrationThankYouEmail = async (userEmail, userName, festName) => {
    try {
        console.log('📧 Sending thank you email to:', userEmail);

        const mailOptions = {
            from: process.env.EMAIL_USER || 'noreply@crwdctrl.com',
            to: userEmail,
            subject: `Thank you for registering - ${festName}`,
            html: generateThankYouEmailHTML(userName, festName)
        };

        const result = await sendEmail(mailOptions);
        console.log('✅ Thank you email sent successfully:', result.messageId);
        return result;
    } catch (error) {
        console.error('❌ Thank you email sending failed:', error);
        // Don't throw error - email failure shouldn't break registration
        return { success: false, error: error.message };
    }
};

// Send registration confirmation email with details (GENERALIZED)
const sendRegistrationConfirmationEmail = async (userEmail, userName, festName, competitionName, registrationId, submissionDate) => {
    try {
        console.log('📧 Sending confirmation email to:', userEmail);

        const mailOptions = {
            from: process.env.EMAIL_USER || 'noreply@crwdctrl.com',
            to: userEmail,
            subject: `Registration Confirmed - ${festName}`,
            html: generateConfirmationEmailHTML(userName, festName, competitionName, registrationId, submissionDate)
        };

        const result = await sendEmail(mailOptions);
        console.log('✅ Confirmation email sent successfully:', result.messageId);
        return result;
    } catch (error) {
        console.error('❌ Confirmation email sending failed:', error);
        // Don't throw error - email failure shouldn't break registration
        return { success: false, error: error.message };
    }
};

// Generate HTML content for thank you email (GENERALIZED)
const generateThankYouEmailHTML = (userName, festName) => {
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
                text-align: center;
            }
            .message {
                font-size: 18px;
                line-height: 1.8;
                color: #555;
            }
            .fest-name {
                color: #053780;
                font-weight: bold;
                font-size: 20px;
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
                <h1>🎉 Thank You!</h1>
            </div>
            
            <div class="content">
                <div class="message">
                    <p>Hi <strong>${userName}</strong>,</p>
                    <p>Thank you for registering for</p>
                    <p class="fest-name">${festName}</p>
                    <p>We're processing your registration and will send you a confirmation email shortly.</p>
                </div>
            </div>
            
            <div class="footer">
                <p><strong>Team CrwdCtrl</strong></p>
                <p style="font-size: 12px; color: #999;">This is an automated email</p>
            </div>
        </div>
    </body>
    </html>
    `;
};

// Generate HTML content for confirmation email (GENERALIZED)
const generateConfirmationEmailHTML = (userName, festName, competitionName, registrationId, submissionDate) => {
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
            .success-message {
                text-align: center;
                margin-bottom: 30px;
                padding: 20px;
                background: #d4edda;
                border: 2px solid #c3e6cb;
                border-radius: 8px;
            }
            .success-message h2 {
                color: #155724;
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
                background: #e3f2fd;
                padding: 15px;
                border-radius: 8px;
                text-align: center;
                margin: 20px 0;
                border: 2px solid #bbdefb;
            }
            .registration-id strong {
                color: #053780;
                font-size: 18px;
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
                <h1>✅ Registration Confirmed</h1>
            </div>
            
            <div class="content">
                <div class="success-message">
                    <h2>Registration Successful!</h2>
                    <p>Your registration has been confirmed</p>
                </div>

                <div class="registration-id">
                    <p>Registration ID</p>
                    <strong>${registrationId}</strong>
                </div>

                <div class="registration-details">
                    <div class="detail-row">
                        <span class="detail-label">Name</span>
                        <span class="detail-value">${userName}</span>
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
                        <span class="detail-label">Submission Date</span>
                        <span class="detail-value">${submissionDate}</span>
                    </div>
                </div>

                <div style="background: #e8f5e8; padding: 20px; border-radius: 8px; text-align: center; margin-top: 25px; border: 2px solid #c3e6cb;">
                    <p style="color: #155724; margin: 0; font-size: 16px;">
                        <strong>Thank you for registering!</strong><br>
                        We'll keep you updated with further information.
                    </p>
                </div>

                <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 20px; border-radius: 8px; margin: 25px 0;">
                    <h4 style="color: #856404; margin-bottom: 15px;">🚀 What happens next?</h4>
                    <ul style="margin: 10px 0; padding-left: 20px;">
                        <li style="color: #856404; margin-bottom: 8px;">Payment screenshot will be reviewed manually</li>
                        <li style="color: #856404; margin-bottom: 8px;">We'll review your registration details for completeness and accuracy</li>
                    <li style="color: #856404; margin-bottom: 8px;">We'll review your registration details for completeness and accuracy</li>
                    </ul>
                    <p style="color: #856404; margin: 15px 0 5px 0;">– Team ${festName}</p>
                    <p style="font-size: 12px; color: #777; margin: 5px 0 0 0;">This is an automated message. Please do not reply.</p>
                </div>
            </div>
            
            <div class="footer">
                <p><strong>Team CrwdCtrl</strong></p>
                <p style="font-size: 12px; color: #999;">This is an automated confirmation email</p>
            </div>
        </div>
    </body>
    </html>
    `;
};

// Send organizer notification email when user registers
const sendOrganizerNotificationEmail = async (organizerEmail, userName, userEmail, festName, competitionName, registrationId, submissionDate) => {
    try {
        console.log('📧 Sending organizer notification email to:', organizerEmail);

        const mailOptions = {
            from: process.env.EMAIL_USER || 'noreply@crwdctrl.com',
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
            throw new Error('User email is required to send login confirmation email');
        }

        const mailOptions = {
            from: process.env.EMAIL_USER || 'noreply@crwdctrl.com',
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
    sendOrganizerNotificationEmail,
    sendLoginConfirmationEmail,
    sendEventBroadcast
};