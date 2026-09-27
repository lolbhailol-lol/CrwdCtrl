const test = require('node:test');
const assert = require('node:assert/strict');
const { countFestDayAttendees } = require('../src/utils/festDayHeadcount');

const bundled = (bundleId, members, teamSize = members.length) => ({
  responses: { mindspark_bundle_id: bundleId, team_members: members, team_size: teamSize },
});

test('a repeated three-person bundle roster counts three people once', () => {
  const roster = [
    { name: 'A', email: 'a@example.com' },
    { name: 'B', phone: '9000000002' },
    { name: 'C', phone: '9000000003' },
  ];
  assert.equal(countFestDayAttendees([
    bundled('bundle-1', roster),
    bundled('bundle-1', roster),
    bundled('bundle-1', roster),
  ]), 3);
});

test('different teammates across bundle competitions are counted once each', () => {
  assert.equal(countFestDayAttendees([
    bundled('bundle-1', [{ email: 'a@example.com' }, { email: 'b@example.com' }]),
    bundled('bundle-1', [{ email: 'a@example.com' }, { email: 'c@example.com' }]),
  ]), 3);
});

test('standalone teams and incomplete bundle rosters retain declared headcount', () => {
  assert.equal(countFestDayAttendees([
    { responses: { team_size: 4, team_members: [{ name: 'Lead' }] } },
    bundled('bundle-2', [], 3),
    bundled('bundle-2', [], 3),
  ]), 7);
});
