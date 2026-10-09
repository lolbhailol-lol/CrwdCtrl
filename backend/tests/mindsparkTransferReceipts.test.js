const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeTransferReceiptInput,
  sumTransferReceiptAmounts,
} = require('../src/utils/mindSparkTransferReceipts');

test('seven supplied COEP transfers total 471120', () => {
  const amounts = [39045, 173037, 180032, 538, 31463, 17389, 29616];
  assert.equal(sumTransferReceiptAmounts(amounts.map((amount) => ({ amount }))), 471120);
});

test('receipt input requires positive amount, date and uploaded proof URL', () => {
  const input = normalizeTransferReceiptInput({
    amount: '39045',
    transferredAt: '2026-09-29T10:40:00.000Z',
    proofUrl: 'https://res.cloudinary.com/demo/image/upload/receipt.jpg',
    note: 'COEP transfer',
  });
  assert.equal(input.amount, 39045);
  assert.equal(input.transferredAt.toISOString(), '2026-09-29T10:40:00.000Z');
  assert.equal(input.note, 'COEP transfer');
  assert.throws(() => normalizeTransferReceiptInput({ amount: 0 }), /valid transfer amount/);
  assert.throws(() => normalizeTransferReceiptInput({ amount: 1, transferredAt: 'bad' }), /valid transfer date/);
});
