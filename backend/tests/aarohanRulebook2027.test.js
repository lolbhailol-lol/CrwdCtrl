const test = require('node:test');
const assert = require('node:assert/strict');
const rulebook = require('../scripts/data/aarohan-2027-rulebook.json');

const expectedFees = {
  InSync: 2500,
  'Head Bang': 2500,
  Dastak: 2500,
  'Inner Flame': 600,
  Humming: 600,
  Platform: 600,
  'Art Maestro': 600,
  Euphony: 600,
  'Glamour Nova': 800,
  'Box Football': 1200,
  'Box Cricket': 1200,
  'Solo Smash': 300,
  'Shuttle Synergy': 500,
  'Velocity Table': 250,
};

test('Aarohan 2027 rulebook covers all competitions with exact entry fees and rounds', () => {
  assert.equal(rulebook.source, 'AAROHAN RULEBOOK 2027');
  assert.equal(rulebook.competitions.length, 14);
  assert.deepEqual(
    Object.fromEntries(rulebook.competitions.map((entry) => [entry.name, entry.feeAmount])),
    expectedFees,
  );
  for (const entry of rulebook.competitions) {
    assert.ok(entry.rounds.length >= 1, `${entry.name} must define at least one round`);
    assert.ok(entry.rounds.every((round) => round.title && Array.isArray(round.rules)), `${entry.name} has an invalid round`);
  }
});

test('rulebook preserves every specified elimination flow', () => {
  const byName = Object.fromEntries(rulebook.competitions.map((entry) => [entry.name, entry]));
  for (const name of ['InSync', 'Head Bang', 'Dastak', 'Inner Flame', 'Humming', 'Glamour Nova', 'Solo Smash', 'Shuttle Synergy', 'Velocity Table']) {
    assert.match(byName[name].rounds.map((round) => round.title).join(' '), /elimination|knockout/i);
  }
});
