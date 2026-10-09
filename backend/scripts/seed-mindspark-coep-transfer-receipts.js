/**
 * Seed the seven successful MindSpark transfers visible in the supplied COEP receipt image.
 *
 * PowerShell:
 *   $env:RECEIPT_IMAGE='C:\path\to\receipt.jpeg'; node scripts/seed-mindspark-coep-transfer-receipts.js
 */
require('dotenv').config();

const fs = require('fs');
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;
const FestTransferReceipt = require('../src/model/fest_transfer_receipt_model');
const { MINDSPARK_FEST_ID } = require('../src/modules/fest/plugins/mindspark');
const { sumTransferReceiptAmounts } = require('../src/utils/mindSparkTransferReceipts');

const TRANSFERS = [
  { transferredAt: '2026-09-29T10:40:00.000Z', amount: 39045 },
  { transferredAt: '2026-09-28T12:20:00.000Z', amount: 173037 },
  { transferredAt: '2026-09-21T04:27:00.000Z', amount: 180032 },
  { transferredAt: '2026-09-14T13:45:00.000Z', amount: 538 },
  { transferredAt: '2026-09-14T13:39:00.000Z', amount: 31463 },
  { transferredAt: '2026-09-07T08:12:00.000Z', amount: 17389 },
  { transferredAt: '2026-08-31T08:58:00.000Z', amount: 29616 },
];

async function proofUrl() {
  const imagePath = String(process.env.RECEIPT_IMAGE || '').trim();
  if (imagePath) {
    if (!fs.existsSync(imagePath)) throw new Error(`Receipt image not found: ${imagePath}`);
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
    const uploaded = await cloudinary.uploader.upload(imagePath, {
      public_id: 'crwdctrl/fests/mindspark-receipts/coep-transfers-2026-08-31-to-09-29',
      overwrite: true,
      resource_type: 'image',
    });
    return uploaded.secure_url;
  }
  const existing = await FestTransferReceipt.findOne({ festId: MINDSPARK_FEST_ID })
    .select('proofUrl')
    .lean();
  if (!existing?.proofUrl) throw new Error('Set RECEIPT_IMAGE for the first seed run');
  return existing.proofUrl;
}

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error('MONGODB_URI or MONGO_URI is required');
  if (sumTransferReceiptAmounts(TRANSFERS) !== 471120) {
    throw new Error('Transfer list must total ₹4,71,120');
  }
  await mongoose.connect(uri);
  const imageUrl = await proofUrl();
  for (const transfer of TRANSFERS) {
    await FestTransferReceipt.updateOne(
      {
        festId: MINDSPARK_FEST_ID,
        transferredAt: new Date(transfer.transferredAt),
        amount: transfer.amount,
      },
      {
        $set: {
          destination: 'COEP account',
          proofUrl: imageUrl,
          note: 'Successful transfer shown in the supplied COEP account receipt',
          status: 'successful',
          createdBy: 'CrwdCtrl',
        },
      },
      { upsert: true },
    );
  }
  const receipts = await FestTransferReceipt.find({ festId: MINDSPARK_FEST_ID }).lean();
  console.log(JSON.stringify({
    ok: true,
    count: receipts.length,
    totalTransferred: sumTransferReceiptAmounts(receipts),
    proofUrl: imageUrl,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState) await mongoose.disconnect();
  });
