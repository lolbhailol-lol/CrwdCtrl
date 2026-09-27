'use strict';

const jwt = require('jsonwebtoken');
const FestOrganizerAccount = require('../model/fest_organizer_account_model');
const { getJwtSecret } = require('../config/jwtSecret');
const { normalizeUsername, organizerCanAccessFest, getOrganizerFests } = require('../utils/festOrganizerAccess');
const { MINDSPARK_FEST_ID, mindsparkPlugin } = require('../modules/fest/plugins/mindspark');
const { mindSparkLockedTotals, round2 } = require('../utils/cashfreeGatewayFee');
const { syncSettlements, autoSyncDashboardSettlements } = require('../services/cashfreeSettlementSync');
const { getPaymentSummary, getPaymentHistory, exportPaymentCsv } = require('../services/paymentSettlementService');
const PaymentOrder = require('../model/payment_order_model');
const MindSparkBundle = require('../model/mindspark_bundle_model');
const Competition = require('../model/competition_model');

const TOKEN_TTL = '7d';
const BUCKET = 'mindspark';

function actorLabel(req) {
    return req.organizer?.username || 'mindspark-payments';
}

function scopeSummaryToMindspark(summary, razorpayActivity = null) {
    const buckets = (summary.buckets || []).filter((b) => b.id === BUCKET);
    const override = mindsparkPlugin.settlementOverride;
    let liveGross = 0;
    let livePayable = 0;
    if (buckets[0] && override) {
        liveGross = Number(buckets[0].gross) || 0;
        livePayable = Number(buckets[0].organizerPayable) || 0;
        const feeRate = Number(override.gatewayFeeRate || 0);
        const extra = Number(override.additionalDeduction) || 0;
        const razorpayOrders = round2(Number(razorpayActivity?.totalCollected) || 0);
        const razorpayNet = round2(razorpayOrders * (1 - feeRate));
        const cashfreeLiveGross = razorpayOrders > 0 && liveGross + 0.01 >= razorpayOrders
            ? round2(Math.max(0, liveGross - razorpayOrders))
            : 0;
        const cashfreeLiveRevenue = razorpayOrders > 0 && liveGross + 0.01 >= razorpayOrders
            ? round2(Math.max(0, livePayable - razorpayNet))
            : 0;
        const locked = mindSparkLockedTotals({
            cashfreeGross: cashfreeLiveGross,
            cashfreeRevenue: cashfreeLiveRevenue,
            razorpayGross: razorpayOrders,
            override,
        });
        const gross = locked.grossCollected;
        const organizerPayable = locked.revenue;
        buckets[0].razorpayPaidGross = locked.razorpayPaidGross;
        buckets[0].razorpayPaidRevenue = locked.razorpayPaidRevenue;
        const fee = locked.gatewayFees;
        buckets[0] = {
            ...buckets[0],
            gross,
            fee,
            additionalDeduction: extra,
            organizerPayable,
            liveGross,
            liveOrganizerPayable: livePayable,
        };
    }
    const ms = buckets[0] || {};
    const schedule = summary.schedule || {};
    const events = (schedule.events || []).filter((e) => e.id === BUCKET);
    return {
        feeRate: summary.feeRate,
        tPlusDays: summary.tPlusDays,
        duplicateOrderIds: [],
        buckets,
        totals: {
            totalCollected: ms.gross || 0,
            crwdctrlFee: ms.fee || 0,
            organizerPayable: ms.organizerPayable || 0,
            settlementSuccess: ms.settlementSuccess || 0,
            successfulPayments: ms.registrations || ms.successfulPayments || 0,
            settlementPendingCount: Math.max(
                0,
                (ms.registrations || ms.successfulPayments || 0) - (ms.settlementSuccess || 0),
            ),
            alreadyPaid: ms.alreadyPaid || 0,
            alreadyPaidCount: ms.alreadyPaidCount || 0,
            refunds: ms.refunded || 0,
            additionalDeduction: ms.additionalDeduction || 0,
            totalDeductions: (ms.fee || 0) + (ms.additionalDeduction || 0),
            // Actual live confirmed paid (Cashfree SUCCESS/PENDING/SETTLED + Razorpay)
            actualPaidGross: liveGross || ms.liveGross || 0,
            actualPaidRevenue: livePayable || ms.liveOrganizerPayable || 0,
            cashfreeLockGross: override?.cashfreeLockGross || 442381,
            cashfreeLockRevenue: override?.cashfreeLockRevenue || 435303,
            razorpayPaidGross: ms.razorpayPaidGross || override?.razorpayPaidGross || 0,
            razorpayPaidRevenue: ms.razorpayPaidRevenue || override?.razorpayPaidRevenue || 0,
        },
        schedule: {
            ...schedule,
            events,
            mindspark: schedule.mindspark || events[0] || null,
            touchGrass: undefined,
        },
        payouts: (summary.payouts || []).filter((p) => p.bucket === BUCKET),
    };
}

async function getRazorpayMindSparkActivity() {
    const [competitions, bundles] = await Promise.all([
        Competition.find({ fest: MINDSPARK_FEST_ID }).select('_id name').lean(),
        MindSparkBundle.find({ fest: MINDSPARK_FEST_ID }).select('_id').lean(),
    ]);
    const competitionNameById = new Map(competitions.map((row) => [String(row._id), row.name]));
    const orders = await PaymentOrder.find({
        gateway: 'razorpay',
        status: 'PAID',
        $or: [
            { entityType: 'competition', entityId: { $in: competitions.map((row) => row._id) } },
            { entityType: 'competition_bundle', entityId: { $in: bundles.map((row) => row._id) } },
            { entityType: 'fest', entityId: MINDSPARK_FEST_ID },
        ],
    })
        .sort({ updatedAt: -1 })
        .select('orderId paymentId entityType entityId totalAmount customerEmail orderTags createdAt updatedAt')
        .lean();

    // One merchant capture once: skip retired/reissued bundle orders and duplicate paymentIds.
    const seenPaymentIds = new Set();
    const seenOrderIds = new Set();
    const rows = [];
    let skippedExtra = 0;
    for (const order of orders) {
        const orderId = String(order.orderId || '');
        const paymentId = String(order.paymentId || '').trim();
        const retired = Boolean(order.orderTags?.retired);
        if (retired) {
            skippedExtra += 1;
            continue;
        }
        if (orderId && seenOrderIds.has(orderId)) {
            skippedExtra += 1;
            continue;
        }
        if (paymentId && seenPaymentIds.has(paymentId)) {
            skippedExtra += 1;
            continue;
        }
        if (orderId) seenOrderIds.add(orderId);
        if (paymentId) seenPaymentIds.add(paymentId);
        rows.push({
            orderId,
            paymentId,
            gateway: 'razorpay',
            status: 'paid',
            eventName: order.entityType === 'competition_bundle'
                ? (order.orderTags?.bundleName || 'MindSpark bundle')
                : competitionNameById.get(String(order.entityId))
                    || order.orderTags?.competitionName
                    || order.orderTags?.festName
                    || 'MindSpark',
            amount: Number(order.totalAmount) || 0,
            customerEmail: order.customerEmail || '',
            paidAt: order.updatedAt || order.createdAt,
        });
    }
    return {
        count: rows.length,
        totalCollected: rows.reduce((sum, row) => sum + row.amount, 0),
        skippedExtra,
        rows,
    };
}

exports.getRazorpayMindSparkActivity = getRazorpayMindSparkActivity;

exports.login = async (req, res) => {
    try {
        const username = normalizeUsername(req.body.username || req.body.email);
        const password = String(req.body.password || '');

        if (!username || !password) {
            return res.status(400).json({ success: false, message: 'Username and password are required' });
        }

        const organizer = await FestOrganizerAccount.findOne({
            $or: [{ username }, { email: username }],
        });
        if (!organizer) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        const valid = await organizer.comparePassword(password);
        if (!valid) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        const status = FestOrganizerAccount.effectiveStatus(organizer);
        if (status === 'pending') {
            return res.status(403).json({
                success: false,
                code: 'pending_approval',
                message: 'Account awaiting CrwdCtrl approval.',
            });
        }
        if (status === 'rejected' || !organizer.isActive) {
            return res.status(403).json({
                success: false,
                message: 'This organizer account is not active. Contact CrwdCtrl.',
            });
        }

        if (!organizerCanAccessFest(organizer, MINDSPARK_FEST_ID)) {
            return res.status(403).json({
                success: false,
                message: 'This login is for MindSpark payments only',
            });
        }

        organizer.lastLoginAt = new Date();
        if (!organizer.status) organizer.status = 'approved';
        await organizer.save();

        const displayName = organizer.name || organizer.username || 'MindSpark';
        const token = jwt.sign(
            {
                organizerId: organizer._id,
                role: 'fest_organizer',
                username: organizer.username,
                displayName,
            },
            getJwtSecret(),
            { expiresIn: TOKEN_TTL },
        );

        const fests = (await getOrganizerFests(organizer))
            .filter((fest) => String(fest._id) === MINDSPARK_FEST_ID);

        res.json({
            success: true,
            token,
            organizer: {
                id: organizer._id,
                name: displayName,
                username: organizer.username,
                assignedFestIds: organizer.assignedFestIds || [],
            },
            fests,
        });
    } catch (error) {
        console.error('[mindsparkPayments.login]', error);
        res.status(500).json({ success: false, message: 'Login failed' });
    }
};

exports.getMe = async (req, res) => {
    res.json({
        success: true,
        organizer: {
            id: req.organizer._id,
            name: req.organizer.name,
            username: req.organizer.username,
        },
        festId: MINDSPARK_FEST_ID,
        bucket: BUCKET,
    });
};

exports.getSummary = async (req, res) => {
    try {
        const [summary, razorpay] = await Promise.all([
            getPaymentSummary(),
            getRazorpayMindSparkActivity(),
        ]);
        res.json({ success: true, ...scopeSummaryToMindspark(summary, razorpay), razorpay });
    } catch (err) {
        console.error('[mindsparkPayments] summary', err);
        res.status(500).json({ success: false, message: 'Failed to load payment summary' });
    }
};

exports.getHistory = async (req, res) => {
    try {
        const data = await getPaymentHistory({
            page: req.query.page,
            limit: req.query.limit,
            bucket: BUCKET,
            payoutStatus: req.query.payoutStatus,
            q: req.query.q,
            weekStartYmd: req.query.weekStartYmd,
            weekEndYmd: req.query.weekEndYmd,
            clearMondayYmd: req.query.clearMondayYmd,
            stageGroup: req.query.stageGroup,
        });
        res.json({ success: true, ...data });
    } catch (err) {
        console.error('[mindsparkPayments] history', err);
        res.status(500).json({ success: false, message: 'Failed to load payment history' });
    }
};

exports.exportPayments = async (req, res) => {
    try {
        const kind = String(req.query.kind || 'history').toLowerCase();
        if (!['history', 'monday_clear', 'ready_batch'].includes(kind)) {
            return res.status(400).json({ success: false, message: 'kind must be history, monday_clear, or ready_batch' });
        }
        const result = await exportPaymentCsv({
            bucket: BUCKET,
            kind,
            clearMondayYmd: req.query.clearMondayYmd || undefined,
            stageGroup: req.query.stageGroup || undefined,
        });
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
        res.status(200).send(result.csv);
    } catch (err) {
        console.error('[mindsparkPayments] export', err);
        res.status(500).json({ success: false, message: 'Failed to export payments CSV' });
    }
};

exports.syncSettlements = async (req, res) => {
    try {
        const dashboard = req.body?.dashboard === true || String(req.query?.dashboard || '') === 'true';
        const limit = req.body?.limit || req.query?.limit;
        const result = dashboard
            ? await autoSyncDashboardSettlements({
                actor: actorLabel(req),
                force: true,
                limit,
            })
            : await syncSettlements({
                limit,
                actor: actorLabel(req),
            });
        res.json({ success: true, ...result });
    } catch (err) {
        console.error('[mindsparkPayments] settlement sync', err);
        const code = err.code === 'CASHFREE_CREDENTIALS_MISSING' ? 400 : 500;
        res.status(code).json({
            success: false,
            message: err.code === 'CASHFREE_CREDENTIALS_MISSING'
                ? 'Cashfree credentials are not configured'
                : 'Failed to sync Cashfree settlements',
        });
    }
};
