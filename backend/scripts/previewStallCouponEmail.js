/**
 * Preview MindSpark registration email with Svvad Pro stall offer.
 * Usage: node scripts/previewStallCouponEmail.js
 */
const fs = require('fs');
const path = require('path');

// Local Vite serves /svvad-pro/* from frontend/public — use that for preview images.
process.env.FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

const { previewCompetitionRegistrationEmailHTML } = require('../src/services/emailService');

const html = previewCompetitionRegistrationEmailHTML({
  userName: 'Karan',
  festName: 'MindSpark 2026',
  competitionName: 'Game of Innovation',
  registrationId: 'PREVIEW-REG-001',
  qrHash: 'crwdctrl-checkin:PREVIEW-REG-001:mindspark-goi',
  coverImageUrl: '',
  submissionDate: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
  paymentContext: {
    status: 'paid',
    method: 'cashfree',
    type: 'competition',
    ticketLink: '/qr-ticket/PREVIEW-REG-001',
    groupLink: 'https://chat.whatsapp.com/preview',
    communityName: 'Game of Innovation',
    venue: 'COEP Technological University, Pune',
    details: [{ label: 'Amount paid', value: '₹299' }],
    stallCoupon: {
      brand: 'Svvad Pro',
      discountPercent: 20,
    },
  },
});

const out = path.join(__dirname, 'preview-stall-coupon-email.html');
fs.writeFileSync(out, html, 'utf8');
console.log('Wrote', out);
