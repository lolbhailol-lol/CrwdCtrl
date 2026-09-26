/**
 * MindSpark Hackathon — CodeChef test notice
 * 1) Upsert contacts into Resend segment
 * 2) Create draft broadcast (do not send unless --send-broadcast)
 * 3) Batch-send transactional emails to leaders unless --draft-only
 *
 * Usage:
 *   node scripts/send-mindspark-hackathon-codechef-test.js
 *   node scripts/send-mindspark-hackathon-codechef-test.js --draft-only
 *   node scripts/send-mindspark-hackathon-codechef-test.js --send-broadcast
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Resend } = require('resend');

const SEGMENT_ID = 'ded7cdcb-607d-4a95-ab7b-d937793e36f7';
const SUBJECT = 'Hackathon Test Link — MindSpark (CodeChef)';
const FROM = 'CrwdCtrl <onboarding@crwdctrl.in>';
const REPLY_TO = 'coeptechmindspark@gmail.com';
const TEST_LINK = 'https://www.codechef.com/skill-test/MSPARKTST26';
const WINDOW = '5:00 PM - 7:30 PM';

const DRAFT_ONLY = process.argv.includes('--draft-only');
const SEND_BROADCAST = process.argv.includes('--send-broadcast');
const SYNC_CONTACTS = process.argv.includes('--sync-contacts');

const TEXT = `Dear Hackathon Participant,

Greetings from the MindSpark Team!

This is to inform you that the Hackathon Test will be conducted on CodeChef.

Test Link: ${TEST_LINK}

Test Window: ${WINDOW}

You may attempt the test anytime within the given window. Please ensure that you have a CodeChef account before attempting the test.

Also, please ensure that your CodeChef Profile Name is in the format:

LeaderName_TeamName

Best of luck for the test!

Note: If you don't have a team name, then the format would be — LeaderName

All Further Instructions have been updated on the MindSpark Website.

Regards,
MindSpark Hackathon Team`;

function htmlEmail() {
  const esc = (s) => String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>${esc(SUBJECT)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f4f4f5" style="background-color:#f4f4f5;">
<tr><td align="center" style="padding-top:24px;padding-bottom:24px;padding-left:12px;padding-right:12px;">
<table width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background-color:#ffffff;">
<tr><td bgcolor="#0b1220" style="background-color:#0b1220;padding-top:20px;padding-bottom:20px;padding-left:28px;padding-right:28px;">
<p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#94a3b8;letter-spacing:0.08em;text-transform:uppercase;">MindSpark Hackathon</p>
<p style="margin:8px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:22px;line-height:30px;color:#ffffff;font-weight:700;">CodeChef Test Link</p>
</td></tr>
<tr><td style="padding-top:28px;padding-bottom:8px;padding-left:28px;padding-right:28px;">
<p style="margin:0 0 14px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:24px;color:#111827;">Dear Hackathon Participant,</p>
<p style="margin:0 0 14px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:24px;color:#111827;">Greetings from the MindSpark Team!</p>
<p style="margin:0 0 14px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:24px;color:#111827;">This is to inform you that the Hackathon Test will be conducted on <strong>CodeChef</strong>.</p>
</td></tr>
<tr><td style="padding-left:28px;padding-right:28px;padding-bottom:8px;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f8fafc" style="background-color:#f8fafc;border:1px solid #e2e8f0;">
<tr><td style="padding:16px 18px;">
<p style="margin:0 0 6px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;">Test Link</p>
<p style="margin:0 0 14px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:22px;"><a href="${TEST_LINK}" style="color:#0ea5e9;text-decoration:underline;">${esc(TEST_LINK)}</a></p>
<p style="margin:0 0 6px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;">Test Window</p>
<p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:22px;color:#111827;font-weight:700;">${esc(WINDOW)}</p>
</td></tr>
</table>
</td></tr>
<tr><td style="padding-top:16px;padding-bottom:8px;padding-left:28px;padding-right:28px;">
<table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" bgcolor="#0ea5e9" style="background-color:#0ea5e9;">
<a href="${TEST_LINK}" style="display:inline-block;padding:14px 28px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:20px;color:#ffffff;text-decoration:none;font-weight:700;">Open CodeChef Test</a>
</td></tr></table>
</td></tr>
<tr><td style="padding-top:16px;padding-bottom:28px;padding-left:28px;padding-right:28px;">
<p style="margin:0 0 14px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:24px;color:#111827;">You may attempt the test anytime within the given window. Please ensure that you have a CodeChef account before attempting the test.</p>
<p style="margin:0 0 8px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:24px;color:#111827;">Also, please ensure that your CodeChef Profile Name is in the format:</p>
<p style="margin:0 0 14px 0;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:24px;color:#0f172a;font-weight:700;">LeaderName_TeamName</p>
<p style="margin:0 0 14px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#475569;"><strong>Note:</strong> If you don't have a team name, then the format would be — <strong>LeaderName</strong></p>
<p style="margin:0 0 14px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:24px;color:#111827;">Best of luck for the test!</p>
<p style="margin:0 0 14px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#475569;">All Further Instructions have been updated on the MindSpark Website.</p>
<p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:24px;color:#111827;">Regards,<br/>MindSpark Hackathon Team</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function chunk(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function loadLeaders() {
  const jsonPath = path.join(__dirname, '..', 'tmp', 'mindspark-hackathon-leaders.json');
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  return data.leaders || [];
}

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const apiKey = String(process.env.RESEND_AUDIT_API_KEY || process.env.RESEND_API_KEY || '').trim();
  if (!apiKey) throw new Error('RESEND_API_KEY / RESEND_AUDIT_API_KEY required');
  const resend = new Resend(apiKey);
  const leaders = loadLeaders();
  if (!leaders.length) throw new Error('No leaders — run export-mindspark-hackathon-leaders.js first');

  const csvPath = path.join(__dirname, '..', 'tmp', 'mindspark-hackathon-leaders.csv');
  const csv = fs.readFileSync(csvPath, 'utf8');

  console.log(JSON.stringify({ step: 'import_contacts', count: leaders.length, segmentId: SEGMENT_ID, sync: SYNC_CONTACTS }));
  if (SYNC_CONTACTS) {
    let ok = 0;
    let fail = 0;
    for (const batch of chunk(leaders, 25)) {
      await Promise.all(batch.map(async (l) => {
        try {
          const r = await resend.contacts.create({
            email: l.email,
            firstName: l.first_name || undefined,
            lastName: l.last_name || undefined,
            unsubscribed: false,
            segments: [{ id: SEGMENT_ID }],
          });
          if (r.error) {
            if (/already|exists|duplicate/i.test(String(r.error.message || ''))) ok += 1;
            else fail += 1;
          } else ok += 1;
        } catch {
          fail += 1;
        }
      }));
      await sleep(250);
    }
    console.log(JSON.stringify({ contactUpsert: { ok, fail } }));
  } else {
    console.log(JSON.stringify({ contactUpsert: 'skipped — use MCP import or --sync-contacts' }));
  }
  void csv;

  const html = htmlEmail();
  console.log(JSON.stringify({ step: 'create_broadcast_draft' }));
  const broadcast = await resend.broadcasts.create({
    name: 'MindSpark Hackathon — CodeChef Test Link',
    segmentId: SEGMENT_ID,
    from: FROM,
    replyTo: REPLY_TO,
    subject: SUBJECT,
    previewText: `CodeChef test today ${WINDOW}. Profile name: LeaderName_TeamName`,
    text: TEXT,
    html,
  });
  if (broadcast.error) throw new Error(`broadcast create failed: ${broadcast.error.message}`);
  const broadcastId = broadcast.data?.id;
  console.log(JSON.stringify({ broadcastId, draftUrl: `https://resend.com/broadcasts/${broadcastId}` }));

  if (SEND_BROADCAST && broadcastId) {
    const sent = await resend.broadcasts.send(broadcastId);
    console.log(JSON.stringify({ broadcastSend: sent.data || sent.error || sent }));
  }

  if (DRAFT_ONLY) {
    console.log(JSON.stringify({ ok: true, mode: 'draft_only', leaders: leaders.length, broadcastId }));
    return;
  }

  // Urgent transactional send to all leaders
  console.log(JSON.stringify({ step: 'batch_email', leaders: leaders.length }));
  let sent = 0;
  let failed = 0;
  const errors = [];
  for (const batch of chunk(leaders, 50)) {
    const payload = batch.map((l) => ({
      from: FROM,
      replyTo: REPLY_TO,
      to: [l.email],
      subject: SUBJECT,
      text: TEXT,
      html,
      tags: [
        { name: 'campaign', value: 'mindspark_hackathon_codechef_test' },
        { name: 'registration_id', value: String(l.registration_id || '').slice(0, 48) },
      ],
    }));
    const response = await resend.batch.send(payload);
    if (response.error) {
      failed += batch.length;
      errors.push(response.error.message);
      console.error('batch error', response.error);
    } else {
      const rows = response.data?.data || response.data || [];
      sent += Array.isArray(rows) ? rows.length : batch.length;
    }
    await sleep(400);
  }

  console.log(JSON.stringify({
    ok: true,
    mode: 'email_sent',
    leaders: leaders.length,
    withPhone: leaders.filter((l) => l.phone).length,
    emailSentApprox: sent,
    emailFailedApprox: failed,
    errors: errors.slice(0, 5),
    broadcastId,
    draftUrl: `https://resend.com/broadcasts/${broadcastId}`,
    note: 'No SMS provider configured — emailed all leaders. WhatsApp bulk needs an approved template.',
  }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
