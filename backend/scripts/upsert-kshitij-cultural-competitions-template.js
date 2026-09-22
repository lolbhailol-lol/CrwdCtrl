/**
 * Upsert + publish the Kshitij cultural competitions outreach template in Resend.
 * Does NOT send — only saves the template for later campaigns.
 *
 * Required: RESEND_API_KEY or RESEND_AUDIT_API_KEY
 * Run: node scripts/upsert-kshitij-cultural-competitions-template.js
 */
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { Resend } = require('resend');

const TEMPLATE_NAME = 'Kshitij Pune Multicity — Cultural Competitions';
const TEMPLATE_ALIAS = 'kshitij-pune-multicity-cultural-competitions-2026';
const SUBJECT = 'Kshitij Pune Multicity cultural comps are open — register on CrwdCtrl';
const FROM = 'CrwdCtrl <onboarding@crwdctrl.in>';
const REPLY_TO = 'team.crwdctrl@gmail.com';

async function main() {
  const apiKey = String(process.env.RESEND_AUDIT_API_KEY || process.env.RESEND_API_KEY || '').trim();
  if (!apiKey) throw new Error('RESEND_API_KEY or RESEND_AUDIT_API_KEY is required');

  const htmlPath = path.join(__dirname, '..', '..', 'preview', 'emails', 'kshitij-pune-multicity-cultural-competitions-2026.html');
  const html = fs.readFileSync(htmlPath, 'utf8');
  const resend = new Resend(apiKey);

  const listed = await resend.templates.list({ limit: 100 });
  if (listed.error) throw new Error(`Unable to list templates: ${listed.error.message}`);

  const existing = (listed.data?.data || []).find(
    (template) => template.alias === TEMPLATE_ALIAS || template.name === TEMPLATE_NAME
  );

  let templateId;
  if (existing) {
    templateId = existing.id;
    const updated = await resend.templates.update(templateId, {
      name: TEMPLATE_NAME,
      alias: TEMPLATE_ALIAS,
      subject: SUBJECT,
      from: FROM,
      replyTo: REPLY_TO,
      html,
    });
    if (updated.error) throw new Error(`Unable to update template: ${updated.error.message}`);
  } else {
    const created = await resend.templates.create({
      name: TEMPLATE_NAME,
      alias: TEMPLATE_ALIAS,
      subject: SUBJECT,
      from: FROM,
      replyTo: REPLY_TO,
      html,
    });
    if (created.error) throw new Error(`Unable to create template: ${created.error.message}`);
    templateId = created.data.id;
  }

  const published = await resend.templates.publish(templateId);
  if (published.error) throw new Error(`Unable to publish template: ${published.error.message}`);

  console.log(JSON.stringify({
    ok: true,
    templateId,
    templateAlias: TEMPLATE_ALIAS,
    templateName: TEMPLATE_NAME,
    subject: SUBJECT,
    htmlPath,
    status: 'published',
    cta: 'https://www.crwdctrl.in/view-details/kshitij-pune-multicity-event-2026',
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
