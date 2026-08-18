require('dotenv').config();
const mongoose = require('mongoose');
const Competition = require('../src/model/competition_model');

function cleanAbout(desc) {
  let body = String(desc || '').replace(/^Team size:[^\n]*\n*/i, '').trim();
  body = body.replace(/^Team size:[^.]*[.!]?\s*/i, '').trim();
  const cut = body.search(/\bEVENT\s+ST[RU]*CTURE\b|\bCATEGORIES\s*:|\bRULES\s*:|\bRound\s*\d+\s*:/i);
  if (cut > 40) body = body.slice(0, cut).trim();
  return body.replace(/\s+/g, ' ').trim();
}

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const comps = await Competition.find({ fest: '6a7f1010ed26d983b34e55c2' });
  let n = 0;
  for (const c of comps) {
    const next = cleanAbout(c.description);
    if (next && next !== String(c.description || '').trim()) {
      c.description = next;
      await c.save();
      n += 1;
      console.log('cleaned About:', c.name);
    } else if (/^Team size:/i.test(String(c.description || ''))) {
      c.description = next;
      await c.save();
      n += 1;
      console.log('stripped Team size:', c.name);
    }
  }

  const qq = await Competition.findOne({ fest: '6a7f1010ed26d983b34e55c2', name: /quant\s*quest/i });
  if (qq) {
    qq.description =
      "QuantQuest is a quiz under Quantumania at MindSpark'26 that tests analytical thinking, quantitative aptitude, and problem-solving speed across multiple rounds.";
    if (!(qq.commonRules || []).length) {
      qq.commonRules = [
        'Participants must carry a valid college ID card and registration receipt.',
        'Use of electronic devices during the quiz is strictly prohibited unless announced otherwise.',
        'Teams found using unfair means will be disqualified.',
        'Decision of the quiz masters and organizers will be final and binding.',
        'Rules may be changed without prior intimation.',
        "Participants are requested to check the MindSpark'26 website (www.mind-spark.org) regularly for updates.",
      ];
      qq.markModified('commonRules');
    }
    qq.registrationFee = qq.registrationFee || '₹199 per team';
    qq.feeAmount = qq.feeAmount || 199;
    await qq.save();
    console.log('QuantQuest refreshed');
  }

  const flash = await Competition.findOne({ fest: '6a7f1010ed26d983b34e55c2', name: /^FLASH$/i }).lean();
  console.log('\nFLASH ABOUT:', flash?.description);
  console.log(
    'FLASH ROUNDS:',
    (flash?.rounds || []).map((r) => `${r.title} :: ${String(r.description || '').slice(0, 90)}`),
  );
  console.log('Cleaned', n, 'abouts');
  await mongoose.disconnect();
})().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
