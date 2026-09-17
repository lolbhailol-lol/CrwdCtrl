/**
 * Apply Aarohan content updates from organizer copy.
 * Usage: node scripts/update-aarohan-2027-content.js [--dry-run]
 */
require('dotenv').config();
const mongoose = require('mongoose');

const DRY = process.argv.includes('--dry-run');
const REFUND_LINE =
  '50% of the registration fee shall be refunded only upon elimination.';

const FLAGSHIP = new Set(['InSync', 'Head Bang', 'Dastak']);

function mapRules(rules, mapper) {
  return (Array.isArray(rules) ? rules : []).map(mapper);
}

function ensureRefundLine(rules = []) {
  const next = [];
  let inserted = false;
  for (const rule of rules) {
    const text = String(rule || '');
    if (/registration fee.*refund|fee refunded|fees will only be refunded|fee shall be refunded/i.test(text)) {
      if (!inserted) {
        next.push(REFUND_LINE);
        inserted = true;
      }
      continue;
    }
    next.push(text);
  }
  if (!inserted) {
    // Prefer after offline/same-rules lines when present
    const idx = next.findIndex((r) => /same rules as final/i.test(r));
    if (idx >= 0) next.splice(idx + 1, 0, REFUND_LINE);
    else next.unshift(REFUND_LINE);
  }
  return next;
}

function bumpEmail(text) {
  return String(text || '').replace(/aarohan\.competitions2026@gmail\.com/gi, 'aarohan.competitions2027@gmail.com');
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const fest =
    (await mongoose.connection.collection('festorganizers').findOne({ slug: 'aarohan-2027' })) ||
    (await mongoose.connection.collection('festorganizers').findOne({ festName: /aarohan\s*2027/i }));
  if (!fest) throw new Error('AAROHAN 2027 not found');

  const comps = mongoose.connection.collection('competitions');
  const rows = await comps.find({ fest: fest._id }).toArray();
  console.log(`Fest ${fest.festName} — ${rows.length} comps — dryRun=${DRY}`);

  for (const c of rows) {
    const set = {};
    let rounds = Array.isArray(c.rounds) ? JSON.parse(JSON.stringify(c.rounds)) : [];

    // Email year bump everywhere in rounds
    rounds = rounds.map((round) => ({
      ...round,
      description: bumpEmail(round.description || ''),
      roundRulesMessage: bumpEmail(round.roundRulesMessage || ''),
      rules: mapRules(round.rules, bumpEmail),
      offline: {
        ...(round.offline || {}),
        rules: mapRules(round.offline?.rules, bumpEmail),
      },
      online: {
        ...(round.online || {}),
        rules: mapRules(round.online?.rules, bumpEmail),
      },
    }));

    if (c.name === 'InSync') {
      set.teamSizeMin = 6;
      set.teamSizeMax = 20;
      set.teamSizeLabel = 'Team of 6–20';
      rounds = rounds.map((round) => ({
        ...round,
        rules: mapRules(round.rules, (rule) =>
          String(rule)
            .replace(/Group size:\s*6 to 16 members\.?/i, 'Group size: 6 to 20 members.')
            .replace(/6 to 16/gi, '6 to 20'),
        ),
      }));
      // Flagship refund wording
      rounds = rounds.map((round, i) =>
        i === 0 ? { ...round, rules: ensureRefundLine(round.rules) } : round,
      );
      console.log('InSync → team 6–20 + refund line');
    }

    if (FLAGSHIP.has(c.name) && c.name !== 'InSync') {
      rounds = rounds.map((round, i) =>
        i === 0 ? { ...round, rules: ensureRefundLine(round.rules) } : round,
      );
      console.log(`${c.name} → flagship refund line`);
    }

    if (c.name === 'Glamour Nova') {
      rounds = [
        {
          roundNumber: 1,
          title: 'Offline Elimination Round',
          description:
            'The Glamour Nova competition will be conducted in multiple rounds to ensure fair judging and maximum participation.\n\nOffline Elimination Round\n\nFinal Round',
          rules: [
            'There will be two rounds for all the participants.',
            'The time limit for performances including introduction is 5 minutes.',
            'Outfit and makeup for elimination round will not be provided by the organisers.',
            'The participants must come to MIT-WPU campus on a given date and time for Elimination Round.',
            'The costumes must be approved a week before the event.',
            'The organizers will not be responsible for any delays of the pageant.',
            'Please maintain decency in every prospect.',
            'Send the costumes on aarohan.competitions2027@gmail.com',
          ],
          offline: { rules: [] },
          online: { rules: [] },
          roundRulesMessage: '',
          dateTime: '',
          venue: 'MIT World Peace University, Pune',
        },
        {
          roundNumber: 2,
          title: 'Final Round',
          description: '',
          rules: [
            'There will be two rounds for all the participants.',
            'The time limit for performances including introduction is 5 minutes.',
            'Kindly provide your body measurements for the outfit.',
            'The participants must bring their make-up for their concerned safety.',
            'The participants must come to MIT-WPU campus on a given date and time for fitting purposes.',
            'The organizers will not be responsible for any delays of the pageant.',
            'Please maintain decency in every prospect.',
          ],
          offline: { rules: [] },
          online: { rules: [] },
          roundRulesMessage: '',
          dateTime: '',
          venue: 'MIT World Peace University, Pune',
        },
      ];
      console.log('Glamour Nova → Offline Elimination + Final rounds');
    }

    if (c.name === 'Box Football') {
      rounds = rounds.map((round) => {
        const rules = [];
        let teamLineDone = false;
        let subLineDone = false;
        for (const raw of round.rules || []) {
          const rule = String(raw || '');
          if (/each team will consist of 8 players/i.test(rule) || /only 6 players are allowed on the pitch/i.test(rule)) {
            if (!teamLineDone) {
              rules.push(
                'Each team will consist of 8 players. At any time, only 6 players from each team are allowed on the pitch, with 2 substitutes available.',
              );
              teamLineDone = true;
            }
            continue;
          }
          if (/unlimited rolling substitutions/i.test(rule)) {
            if (!subLineDone) {
              rules.push(
                'Unlimited rolling substitutions are allowed throughout the match, with the 2 substitutes rotating freely with the players on the pitch.',
              );
              subLineDone = true;
            }
            continue;
          }
          if (/during substitutions, the exiting player/i.test(rule)) {
            // Covered by unlimited rolling line
            continue;
          }
          if (/2 rolling substitutes permitted/i.test(rule)) {
            continue;
          }
          rules.push(rule);
        }
        if (!teamLineDone) {
          rules.unshift(
            'Each team will consist of 8 players. At any time, only 6 players from each team are allowed on the pitch, with 2 substitutes available.',
          );
        }
        if (!subLineDone) {
          rules.splice(
            1,
            0,
            'Unlimited rolling substitutions are allowed throughout the match, with the 2 substitutes rotating freely with the players on the pitch.',
          );
        }
        return { ...round, rules };
      });
      console.log('Box Football → team/substitution wording');
    }

    set.rounds = rounds;

    if (!DRY) {
      await comps.updateOne({ _id: c._id }, { $set: set });
    }
  }

  // Keep repair metadata script values in sync for InSync team size
  console.log('Done');
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
