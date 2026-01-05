const nodemailer = require('nodemailer');

// Email configuration
const createTransporter = () => {
    // Check if email credentials are properly configured
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.warn('⚠️ WARNING: Email credentials (EMAIL_USER/EMAIL_PASS) not configured!');
        console.warn('⚠️ Emails will NOT be sent in production. Please configure environment variables.');
        console.warn('⚠️ EMAIL_USER:', process.env.EMAIL_USER ? 'SET' : 'NOT SET');
        console.warn('⚠️ EMAIL_PASS:', process.env.EMAIL_PASS ? 'SET' : 'NOT SET');
        
        // In production, throw error instead of silently failing
        if (process.env.NODE_ENV === 'production') {
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
    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });
};

// Send welcome email to new users
const sendWelcomeEmail = async (userData) => {
    try {
        console.log('🎉 Starting welcome email process for:', userData.email);
        console.log('📋 User data:', { name: userData.name, email: userData.email, isVerified: userData.isVerified });

        if (!userData.email) {
            console.error('❌ Cannot send welcome email: email is missing');
            throw new Error('User email is required to send welcome email');
        }

        const transporter = createTransporter();

        const mailOptions = {
            from: process.env.EMAIL_USER || 'noreply@crwdctrl.com',
            to: userData.email,
            subject: '🎉 Welcome to CrwdCtrl - Let\'s Explore Amazing Fests!',
            html: generateWelcomeEmailHTML(userData)
        };

        console.log('📤 Sending welcome email...');
        console.log('   From:', mailOptions.from);
        console.log('   To:', mailOptions.to);
        console.log('   Subject:', mailOptions.subject);
        
        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Welcome email sent successfully!');
        console.log('   Message ID:', info.messageId);
        console.log('   Response:', info.response);
        
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('❌ Welcome email sending failed!');
        console.error('   Error name:', error.name);
        console.error('   Error message:', error.message);
        console.error('   Full error:', error);
        throw error;
    }
};

// Generate HTML content for welcome email
const generateWelcomeEmailHTML = (userData) => {
    return `
    <!DOCTYPE html>
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
        
        const transporter = createTransporter();

        const mailOptions = {
            from: process.env.EMAIL_USER || 'noreply@crwdctrl.com',
            to: userEmail,
            subject: `Thank you for registering - ${festName}`,
            html: generateThankYouEmailHTML(userName, festName)
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Thank you email sent successfully:', info.messageId);
        return { success: true, messageId: info.messageId };
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
        
        const transporter = createTransporter();

        const mailOptions = {
            from: process.env.EMAIL_USER || 'noreply@crwdctrl.com',
            to: userEmail,
            subject: `Registration Confirmed - ${festName}`,
            html: generateConfirmationEmailHTML(userName, festName, competitionName, registrationId, submissionDate)
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Confirmation email sent successfully:', info.messageId);
        return { success: true, messageId: info.messageId };
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
        
        const transporter = createTransporter();

        const mailOptions = {
            from: process.env.EMAIL_USER || 'noreply@crwdctrl.com',
            to: organizerEmail,
            subject: `New Registration - ${festName}${competitionName ? ` (${competitionName})` : ''}`,
            html: generateOrganizerNotificationEmailHTML(userName, userEmail, festName, competitionName, registrationId, submissionDate)
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Organizer notification email sent successfully:', info.messageId);
        return { success: true, messageId: info.messageId };
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

module.exports = {
    // Generalized functions (ACTIVE)
    sendWelcomeEmail,
    sendRegistrationThankYouEmail,
    sendRegistrationConfirmationEmail,
    sendOrganizerNotificationEmail
};