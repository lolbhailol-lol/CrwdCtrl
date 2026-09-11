/**
 * Generate local HTML previews for login & welcome emails.
 * Run: node backend/scripts/previewExploreEmails.js
 */
const fs = require('fs');
const path = require('path');

process.env.FRONTEND_URL = process.env.FRONTEND_URL || 'https://www.crwdctrl.in';

const {
  previewLoginEmailHTML,
  previewWelcomeEmailHTML,
} = require('../src/services/emailService');

const outDir = path.join(__dirname, '..', '..', 'preview', 'emails');
fs.mkdirSync(outDir, { recursive: true });

const sampleUser = { name: 'Karan', email: 'karan@example.com' };

const files = [
  ['login-email-preview.html', previewLoginEmailHTML(sampleUser)],
  ['welcome-email-preview.html', previewWelcomeEmailHTML(sampleUser)],
];

for (const [name, html] of files) {
  const filePath = path.join(outDir, name);
  fs.writeFileSync(filePath, html, 'utf8');
  console.log('Wrote', filePath);
}
