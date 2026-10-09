'use strict';

const mongoose = require('mongoose');
const FestTransferReceipt = require('../model/fest_transfer_receipt_model');
const { isMindSparkFestId } = require('../modules/fest/plugins/mindspark');
const {
  normalizeTransferReceiptInput,
  sumTransferReceiptAmounts,
} = require('../utils/mindSparkTransferReceipts');

function rejectNonMindSpark(req, res) {
  if (isMindSparkFestId(req.festId)) return false;
  res.status(404).json({ success: false, message: 'Transfer receipts are available for MindSpark only' });
  return true;
}

function publicReceipt(receipt) {
  return {
    id: String(receipt._id),
    amount: Number(receipt.amount) || 0,
    transferredAt: receipt.transferredAt,
    destination: receipt.destination || 'COEP account',
    proofUrl: receipt.proofUrl,
    note: receipt.note || '',
    status: receipt.status || 'successful',
    createdBy: receipt.createdBy || '',
    createdAt: receipt.createdAt,
  };
}

exports.list = async (req, res) => {
  try {
    if (rejectNonMindSpark(req, res)) return;
    const receipts = await FestTransferReceipt.find({ festId: req.festId })
      .sort({ transferredAt: -1, createdAt: -1 })
      .lean();
    res.json({
      success: true,
      destination: 'COEP account',
      totalTransferred: sumTransferReceiptAmounts(receipts),
      count: receipts.length,
      receipts: receipts.map(publicReceipt),
    });
  } catch (error) {
    console.error('[festTransferReceipt.list]', error);
    res.status(500).json({ success: false, message: 'Failed to load transfer receipts' });
  }
};

exports.create = async (req, res) => {
  try {
    if (rejectNonMindSpark(req, res)) return;
    let input;
    try {
      input = normalizeTransferReceiptInput(req.body);
    } catch (error) {
      return res.status(400).json({ success: false, message: error.message });
    }
    const receipt = await FestTransferReceipt.create({
      festId: req.festId,
      destination: 'COEP account',
      ...input,
      status: 'successful',
      createdBy: String(req.displayName || req.organizer?.username || '').trim(),
    });
    return res.status(201).json({ success: true, receipt: publicReceipt(receipt) });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ success: false, message: 'This transfer receipt is already recorded' });
    }
    console.error('[festTransferReceipt.create]', error);
    return res.status(500).json({ success: false, message: 'Failed to save transfer receipt' });
  }
};

exports.remove = async (req, res) => {
  try {
    if (rejectNonMindSpark(req, res)) return;
    if (!mongoose.Types.ObjectId.isValid(req.params.receiptId)) {
      return res.status(400).json({ success: false, message: 'Invalid receipt' });
    }
    const deleted = await FestTransferReceipt.findOneAndDelete({
      _id: req.params.receiptId,
      festId: req.festId,
    });
    if (!deleted) return res.status(404).json({ success: false, message: 'Receipt not found' });
    return res.json({ success: true });
  } catch (error) {
    console.error('[festTransferReceipt.remove]', error);
    return res.status(500).json({ success: false, message: 'Failed to delete transfer receipt' });
  }
};
