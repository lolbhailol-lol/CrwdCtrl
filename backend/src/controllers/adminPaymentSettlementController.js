'use strict';

const multer = require('multer');
const { syncSettlements, autoSyncDashboardSettlements } = require('../services/cashfreeSettlementSync');
const { getPaymentSummary, getPaymentHistory, buildLinkedPaymentRows, serializePayout, exportPaymentCsv, markMindsparkMondayClearPaid, markEventBatchPaid } = require('../services/paymentSettlementService');
const {
  parseCsvBuffer,
  reconcileCashfreeRows,
  persistCsvFinanceExtras,
} = require('../services/paymentReconciliationService');
const ReconciliationImport = require('../model/reconciliation_import_model');
const OrganizerPayout = require('../model/organizer_payout_model');
const PaymentAuditLog = require('../model/payment_audit_log_model');
const { payoutOverrideKey } = require('../services/paymentSettlementMath');

const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const name = String(file.originalname || '').toLowerCase();
    const type = String(file.mimetype || '').toLowerCase();
    if (name.endsWith('.csv') || type.includes('csv') || type === 'text/plain') {
      cb(null, true);
      return;
    }
    cb(new Error('Upload a .csv file exported from Cashfree'));
  },
});

function actorEmail(req) {
  return req.user?.email || 'admin';
}

exports.csvUploadMiddleware = csvUpload.single('file');

exports.getSummary = async (req, res) => {
  try {
    const summary = await getPaymentSummary();
    res.json({ success: true, ...summary });
  } catch (err) {
    console.error('[adminPayments] summary', err);
    res.status(500).json({ success: false, message: 'Failed to load payment summary' });
  }
};

exports.getHistory = async (req, res) => {
  try {
    const data = await getPaymentHistory({
      page: req.query.page,
      limit: req.query.limit,
      bucket: req.query.bucket,
      payoutStatus: req.query.payoutStatus,
      q: req.query.q,
      weekStartYmd: req.query.weekStartYmd,
      weekEndYmd: req.query.weekEndYmd,
      clearMondayYmd: req.query.clearMondayYmd,
      stageGroup: req.query.stageGroup,
    });
    res.json({ success: true, ...data });
  } catch (err) {
    console.error('[adminPayments] history', err);
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
      bucket: req.query.bucket || undefined,
      kind,
      clearMondayYmd: req.query.clearMondayYmd || undefined,
      stageGroup: req.query.stageGroup || undefined,
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.status(200).send(result.csv);
  } catch (err) {
    console.error('[adminPayments] export', err);
    res.status(500).json({ success: false, message: 'Failed to export payments CSV' });
  }
};

exports.markMondayClearPaid = async (req, res) => {
  try {
    const result = await markMindsparkMondayClearPaid({
      actor: actorEmail(req),
      clearMondayYmd: req.body?.clearMondayYmd,
    });
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[adminPayments] monday clear paid', err);
    const code = err.code === 'NOTHING_TO_CLEAR' || err.code === 'NO_CLEAR_DATE' || err.code === 'UNKNOWN_BUCKET' ? 400 : 500;
    res.status(code).json({
      success: false,
      message: err.message || 'Failed to mark Monday clear as paid',
    });
  }
};

exports.markEventBatchPaid = async (req, res) => {
  try {
    const result = await markEventBatchPaid({
      actor: actorEmail(req),
      bucket: req.body?.bucket,
      clearMondayYmd: req.body?.clearMondayYmd,
      stageGroup: req.body?.stageGroup || 'ready',
    });
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[adminPayments] event batch paid', err);
    const code = ['NOTHING_TO_CLEAR', 'NO_CLEAR_DATE', 'UNKNOWN_BUCKET'].includes(err.code) ? 400 : 500;
    res.status(code).json({
      success: false,
      message: err.message || 'Failed to mark event batch as paid',
    });
  }
};

exports.syncSettlements = async (req, res) => {
  try {
    const dashboard = req.body?.dashboard === true || String(req.query?.dashboard || '') === 'true';
    const limit = req.body?.limit || req.query?.limit;
    const result = dashboard
      ? await autoSyncDashboardSettlements({
        actor: actorEmail(req),
        force: true,
        limit,
      })
      : await syncSettlements({
        limit,
        actor: actorEmail(req),
      });
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[adminPayments] settlement sync', err);
    const code = err.code === 'CASHFREE_CREDENTIALS_MISSING' ? 400 : 500;
    res.status(code).json({
      success: false,
      message: err.code === 'CASHFREE_CREDENTIALS_MISSING'
        ? 'Cashfree credentials are not configured'
        : 'Failed to sync Cashfree settlements',
    });
  }
};

exports.reconcileUpload = async (req, res) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ success: false, message: 'CSV file is required (field name: file)' });
    }
    const cashfreeRows = await parseCsvBuffer(req.file.buffer);
    const { rows: payments } = await buildLinkedPaymentRows();
    const result = reconcileCashfreeRows(payments, cashfreeRows);
    await persistCsvFinanceExtras(cashfreeRows, actorEmail(req));
    const saved = await ReconciliationImport.create({
      fileName: req.file.originalname || 'cashfree.csv',
      uploadedBy: actorEmail(req),
      ...result,
    });
    await PaymentAuditLog.create({
      action: 'reconciliation_import',
      actor: actorEmail(req),
      source: 'csv',
      after: {
        importId: String(saved._id),
        fileName: saved.fileName,
        matchedCount: saved.matchedCount,
        unmatchedCashfreeCount: saved.unmatchedCashfreeCount,
        unmatchedCrwdctrlCount: saved.unmatchedCrwdctrlCount,
        amountMismatchCount: saved.amountMismatchCount,
        duplicateCount: saved.duplicateCount,
      },
    });
    res.json({
      success: true,
      id: String(saved._id),
      fileName: saved.fileName,
      ...result,
    });
  } catch (err) {
    console.error('[adminPayments] reconcile', err);
    res.status(400).json({ success: false, message: err.message || 'Failed to reconcile CSV' });
  }
};

exports.getReconciliation = async (req, res) => {
  try {
    const { id } = req.params;
    const doc = id === 'latest'
      ? await ReconciliationImport.findOne({}).sort({ createdAt: -1 }).lean()
      : await ReconciliationImport.findById(id).lean();
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Reconciliation import not found' });
    }
    res.json({
      success: true,
      id: String(doc._id),
      fileName: doc.fileName,
      uploadedBy: doc.uploadedBy,
      createdAt: doc.createdAt,
      rowCount: doc.rowCount,
      matchedCount: doc.matchedCount,
      unmatchedCashfreeCount: doc.unmatchedCashfreeCount,
      unmatchedCrwdctrlCount: doc.unmatchedCrwdctrlCount,
      amountMismatchCount: doc.amountMismatchCount,
      duplicateCount: doc.duplicateCount,
      rows: doc.rows || [],
    });
  } catch (err) {
    console.error('[adminPayments] get recon', err);
    res.status(500).json({ success: false, message: 'Failed to load reconciliation' });
  }
};

exports.listPayouts = async (req, res) => {
  try {
    const summary = await getPaymentSummary();
    const stored = await OrganizerPayout.find({}).sort({ updatedAt: -1 }).lean();
    const storedByKey = new Map(stored.map((row) => [payoutOverrideKey(row), row]));
    const derived = summary.organizers.map((org) => {
      const existing = storedByKey.get(payoutOverrideKey(org));
      return {
        organizerType: org.organizerType,
        organizerId: org.organizerId,
        organizerName: org.organizerName,
        bucket: org.bucket,
        eventId: org.eventId,
        eventName: org.eventName,
        suggestedAmount: org.organizerPayable,
        settlementPending: org.settlementPending,
        readyForPayout: org.readyForPayout,
        derivedStatus: org.payout,
        payout: existing ? serializePayout(existing) : null,
      };
    });
    res.json({
      success: true,
      derived,
      payouts: stored.map(serializePayout),
    });
  } catch (err) {
    console.error('[adminPayments] list payouts', err);
    res.status(500).json({ success: false, message: 'Failed to load payouts' });
  }
};

exports.updatePayout = async (req, res) => {
  try {
    const {
      payoutId,
      organizerType,
      organizerId,
      organizerName,
      bucket,
      eventId,
      eventName,
      amount,
      status,
      note,
    } = req.body || {};
    const nextStatus = String(status || '').toLowerCase();
    if (!['pending', 'ready', 'paid'].includes(nextStatus)) {
      return res.status(400).json({ success: false, message: 'status must be pending, ready, or paid' });
    }

    let doc = payoutId ? await OrganizerPayout.findById(payoutId) : null;
    if (!doc) {
      if (!organizerType || !organizerId) {
        return res.status(400).json({ success: false, message: 'organizerType and organizerId are required' });
      }
      doc = await OrganizerPayout.findOne({
        organizerType,
        organizerId,
        eventId: eventId || '',
        bucket: bucket || 'other',
      });
    }

    const before = doc ? doc.toObject() : null;
    if (!doc) {
      doc = new OrganizerPayout({
        organizerType,
        organizerId,
        organizerName: organizerName || '',
        bucket: bucket || 'other',
        eventId: eventId || '',
        eventName: eventName || '',
        amount: Number(amount) || 0,
        status: nextStatus,
        note: note || '',
        createdBy: actorEmail(req),
      });
    }

    if (organizerName) doc.organizerName = organizerName;
    if (eventName) doc.eventName = eventName;
    if (amount != null && amount !== '') doc.amount = Number(amount) || 0;
    doc.status = nextStatus;
    if (note != null) doc.note = String(note);
    if (nextStatus === 'paid') doc.paidAt = doc.paidAt || new Date();
    else doc.paidAt = null;
    await doc.save();

    await PaymentAuditLog.create({
      action: 'payout_status',
      actor: actorEmail(req),
      payoutId: String(doc._id),
      source: 'admin',
      before,
      after: serializePayout(doc),
    });

    res.json({ success: true, payout: serializePayout(doc) });
  } catch (err) {
    console.error('[adminPayments] update payout', err);
    res.status(500).json({ success: false, message: 'Failed to update payout' });
  }
};
