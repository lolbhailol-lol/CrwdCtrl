require('dotenv').config();
const { sendWelcomeEmail } = require('./src/services/emailService');

// Test data
const testUserData = {
    name: 'Test User',
    email: 'vr7797387@gmail.com',
    isVerified: false,
    registrationType: 'Test'
};

console.log('🧪 Testing welcome email...');
console.log('📧 Sending to:', testUserData.email);
console.log('👤 User name:', testUserData.name);
console.log('');

sendWelcomeEmail(testUserData)
    .then(result => {
        console.log('✅ Test email sent successfully!');
        console.log('📨 Message ID:', result.messageId);
        console.log('');
        console.log('Please check the inbox at vr7797387@gmail.com');
        process.exit(0);
    })
    .catch(error => {
        console.error('❌ Failed to send test email:');
        console.error(error);
        process.exit(1);
    });
