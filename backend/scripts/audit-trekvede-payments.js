/**
 * TrekkVede payment audit — config + booking ↔ PaymentOrder reconciliation.
 * Run: node scripts/audit-trekvede-payments.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const axios = require('axios');
const TrekCommunity = require('../src/model/trek_community_model');
const Trek = require('../src/model/trek_model');
const TrekBooking = require('../src/model/trek_booking_model');
const PaymentOrder = require('../src/model/payment_order_model');
const { splitTrekOrganizerPayment } = require('../src/utils/platformFee');
const {
  getRazorpayKeyId,
  getRazorpayKeySecret,
} = require('../src/services/razorpayService');

const findings = [];
function ok(msg) { findings.push({ level: 'ok', msg }); }
function warn(msg) { findings.push({ level: 'warn', msg }); }
function fail(msg) { findings.push({ level: 'fail', msg }); }

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
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
      ok(`Razorpay API auth OK — smoke order ${data.id}`);
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

    let totalConfirmed = 0;
    let totalGross = 0;
    let totalOrganizer = 0;
    let mismatches = 0;
    let orphans = 0;
    let cancelledAfterPay = 0;

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
        warn(`${name}: platformFeePercent=${t.platformFeePercent} (checkout still 0% for Razorpay — dashboard now treats Razorpay as 0%)`);
      }

      const bookings = await TrekBooking.find({ trekId: t._id })
        .select('status paymentStatus payment_order_id payment_gateway bookingDetails.amountPaid bookingDetails.people')
        .lean();

      const confirmed = bookings.filter((b) => b.status === 'confirmed');
      totalConfirmed += confirmed.length;

      let trekGross = 0;
      let trekOrganizer = 0;
      for (const b of confirmed) {
        const paid = Number(b.bookingDetails?.amountPaid) || 0;
        const people = Number(b.bookingDetails?.people) || 1;
        // Razorpay community → 0 platform fee
        const split = splitTrekOrganizerPayment(paid, 0, {
          registrationFeePerPerson: fee,
          people,
        });
        trekGross += split.grossCollected;
        trekOrganizer += split.organizerNet;

        if (paid > 0 && b.payment_order_id) {
          const order = await PaymentOrder.findOne({ orderId: b.payment_order_id }).lean();
          if (!order) {
            mismatches += 1;
            warn(`${name}: booking ${b._id} has payment_order_id but PaymentOrder missing`);
          } else {
            const orderAmt = Number(order.totalAmount) || 0;
            if (orderAmt > 0 && Math.abs(orderAmt - paid) > 1) {
              mismatches += 1;
              warn(`${name}: amount mismatch booking ₹${paid} vs order ₹${orderAmt} (${b.payment_order_id})`);
            }
            if (String(order.status || '').toUpperCase() !== 'PAID' && b.paymentStatus === 'paid') {
              mismatches += 1;
              warn(`${name}: booking paid but PaymentOrder status=${order.status}`);
            }
          }
        } else if (paid > 0 && mode === 'internal_form' && !b.payment_order_id) {
          mismatches += 1;
          warn(`${name}: paid booking ${b._id} missing payment_order_id`);
        }
      }

      const cancelledPaid = bookings.filter(
        (b) => b.status === 'cancelled' && (Number(b.bookingDetails?.amountPaid) > 0 || b.paymentStatus === 'paid'),
      );
      cancelledAfterPay += cancelledPaid.length;
      if (cancelledPaid.length) {
        warn(`${name}: ${cancelledPaid.length} cancelled booking(s) still marked paid — check refunds`);
      }

      // Orphan PAID PaymentOrders for this trek with no matching booking
      const paidOrders = await PaymentOrder.find({
        status: 'PAID',
        entityType: 'trek',
        entityId: t._id,
      }).select('orderId totalAmount').lean();

      const bookingOrderIds = new Set(
        bookings.map((b) => b.payment_order_id).filter(Boolean).map(String),
      );
      for (const order of paidOrders) {
        if (!bookingOrderIds.has(String(order.orderId))) {
          orphans += 1;
          warn(`${name}: orphan PAID order ${order.orderId} (₹${order.totalAmount}) — no matching booking`);
        }
      }

      totalGross += trekGross;
      totalOrganizer += trekOrganizer;

      if (confirmed.length || fee > 0) {
        ok(`${name}: ${confirmed.length} confirmed · gross ₹${trekGross.toLocaleString('en-IN')} · organizer ₹${trekOrganizer.toLocaleString('en-IN')}`);
      } else if (fee > 0 && mode === 'internal_form' && status === 'open' && dates.length && locs.length) {
        ok(`${name}: ₹${fee} · ready (no bookings yet)`);
      }
    }

    ok(`Totals: ${totalConfirmed} confirmed · gross ₹${totalGross.toLocaleString('en-IN')} · organizer ₹${totalOrganizer.toLocaleString('en-IN')}`);
    if (mismatches === 0) ok('No booking ↔ PaymentOrder amount mismatches');
    else warn(`${mismatches} payment reconciliation warning(s)`);
    if (orphans === 0) ok('No orphan PAID PaymentOrders');
    else warn(`${orphans} orphan PAID order(s)`);
    if (cancelledAfterPay === 0) ok('No cancelled-after-pay bookings');
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
