'use strict';

function round2(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function sumTransferReceiptAmounts(receipts = []) {
  return round2((receipts || []).reduce((sum, receipt) => sum + (Number(receipt?.amount) || 0), 0));
}

function normalizeTransferReceiptInput(body = {}) {
  const amount = round2(body.amount);
  const transferredAt = new Date(body.transferredAt);
  const proofUrl = String(body.proofUrl || '').trim();
  const note = String(body.note || '').trim().slice(0, 500);

  if (!(amount > 0)) throw new Error('Enter a valid transfer amount');
  if (Number.isNaN(transferredAt.getTime())) throw new Error('Choose a valid transfer date and time');
  if (!/^https:\/\//i.test(proofUrl)) throw new Error('Upload a receipt image');

  return { amount, transferredAt, proofUrl, note };
}

module.exports = {
  normalizeTransferReceiptInput,
  sumTransferReceiptAmounts,
};
