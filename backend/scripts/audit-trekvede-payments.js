/**
 * Payment + TrekkVede audit (read-only + light Razorpay credential check).
 * Run: node scripts/audit-trekvede-payments.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const axios = require('axios');
const TrekCommunity = require('../src/model/trek_community_model');
const Trek = require('../src/model/trek_model');
const {
  getRazorpayKeyId,
  getRazorpayKeySecret,
  toPaise,
} = require('../src/services/razorpayService');

const findings = [];
function ok(msg) { findings.push({ level: 'ok', msg }); }
function warn(msg) { findings.push({ level: 'warn', msg }); }
function fail(msg) { findings.push({ level: 'fail', msg }); }

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    fail('MONGODB_URI missing');
    return;
  }

  const keyId = getRazorpayKeyId();
  const keySecret = getRazorpayKeySecret();
  if (!keyId || !keySecret) fail('RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET missing in backend/.env');
  else {
    ok(`Razorpay keys present (${keyId.slice(0, 8)}…)`);
    if (!keyId.startsWith('rzp_live_') && !keyId.startsWith('rzp_test_')) {
      warn(`Unexpected key id prefix: ${keyId.slice(0, 12)}`);
    }
  }

  // Live credential smoke: create ₹1 order then ignore (or create and note)
  if (keyId && keySecret) {
    try {
      const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
      const { data } = await axios.post(
        'https://api.razorpay.com/v1/orders',
        {
          amount: 100,
          currency: 'INR',
          receipt: `audit_${Date.now()}`.slice(0, 40),
          notes: { purpose: 'crwdctrl_audit' },
        },
        {
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
          timeout: 20000,
        },
      );
      ok(`Razorpay API auth OK — created smoke order ${data.id} (₹1)`);
    } catch (err) {
      const desc = err.response?.data?.error?.description || err.message;
      fail(`Razorpay API auth/create failed: ${desc}`);
    }
  }

  await mongoose.connect(uri);
  const community = await TrekCommunity.findOne({
    $or: [{ slug: /trekk?vede/i }, { name: /trekk?vede/i }],
  }).lean();

  if (!community) {
    fail('TrekkVede community not found');
  } else {
    ok(`Community ${community.name} (${community._id})`);
    if (community.paymentGateway !== 'razorpay') {
      fail(`paymentGateway is "${community.paymentGateway || 'unset'}" — expected razorpay`);
    } else {
      ok('Community paymentGateway = razorpay');
    }
  }

  if (community) {
    const treks = await Trek.find({ communityId: community._id }).lean();
    const published = treks.filter((t) => t.status === 'published');
    ok(`${published.length} published treks under TrekkVede`);

    for (const t of published) {
      const name = t.trekName || t._id;
      const fee = Number(t.registrationFee) || 0;
      const mode = t.registration?.mode || 'internal_form';
      const dates = t.registration?.availableDates || [];
      const locs = t.registration?.locationOptions || [];
      const status = t.registration?.status || 'open';

      if (mode === 'organizer_qr') {
        warn(`${name}: organizer_qr mode — will not use Razorpay`);
      } else if (mode !== 'internal_form') {
        warn(`${name}: mode=${mode} (not online Razorpay checkout)`);
      }

      if (fee <= 0 && mode === 'internal_form') {
        warn(`${name}: registrationFee is 0 — booking skips payment`);
      }
      if (status !== 'open') warn(`${name}: registration.status=${status}`);
      if (!dates.length) warn(`${name}: no availableDates`);
      if (!locs.length) warn(`${name}: no locationOptions (meeting points)`);
      if (!t.slug) warn(`${name}: missing slug`);
      if (Number(t.platformFeePercent) > 0) {
        // Display only — createTrekOrder zeros fee for razorpay communities
        warn(`${name}: platformFeePercent=${t.platformFeePercent} (checkout still 0% for Razorpay community)`);
      }

      if (fee > 0 && mode === 'internal_form' && status === 'open' && dates.length && locs.length) {
        ok(`${name}: ₹${fee} · ${mode} · ${dates.length} dates · ${locs.length} pickups · ready`);
      }
    }
  }

  await mongoose.disconnect();

  console.log('\n=== AUDIT REPORT ===');
  for (const f of findings) {
    const tag = f.level === 'ok' ? 'OK  ' : f.level === 'warn' ? 'WARN' : 'FAIL';
    console.log(`[${tag}] ${f.msg}`);
  }
  const fails = findings.filter((f) => f.level === 'fail').length;
  const warns = findings.filter((f) => f.level === 'warn').length;
  console.log(`\nSummary: ${fails} fail, ${warns} warn, ${findings.length - fails - warns} ok`);
  process.exit(fails ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
