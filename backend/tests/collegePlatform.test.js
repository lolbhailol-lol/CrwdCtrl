const test = require('node:test');
const assert = require('node:assert/strict');
const {
  aggregateRankings,
  collegeAcceptsEmail,
  placementPoints,
  teamReadyForCheckIn,
  isWithinCheckInWindow,
  fulfillGameRegistration,
  signedPassToken,
  verifyPassToken,
} = require('../src/modules/college-platform/service');
const { GameRegistration } = require('../src/modules/college-platform/models');
const {
  College,
  CollegeGame,
  CampusHostProfile,
  CampusHuntOperatorGrant,
  CampusHuntHostCheckInPack,
} = require('../src/modules/college-platform/models');
const CampusHuntOfflineInstall = require('../src/modules/campus-hunt/models/CampusHuntOfflineInstall');
const collegePlatformController = require('../src/modules/college-platform/controller');
const { economicsForDraft, normalizeDraft, hostIsApproved } = require('../src/modules/college-platform/hostService');

test('college email verification requires an exact approved domain', () => {
  const college = { emailDomains: ['college.edu', 'students.college.ac.in'] };
  assert.equal(collegeAcceptsEmail(college, 'captain@college.edu'), true);
  assert.equal(collegeAcceptsEmail(college, 'member@students.college.ac.in'), true);
  assert.equal(collegeAcceptsEmail(college, 'member@othercollege.edu'), false);
  assert.equal(collegeAcceptsEmail(college, 'member@fake.college.edu'), false);
});

test('placement points follow 100, 80, 60 then ten-point reductions with a floor', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 8, 20].map((rank) => placementPoints({}, rank)), [100, 80, 60, 50, 40, 10, 10]);
});

test('game passes are signed for one registration and reject tampering', () => {
  const originalSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'college-platform-test-secret';
  const token = signedPassToken({ _id: 'registration1', gameId: 'game1', passId: 'CC-GP-1' });
  assert.deepEqual(verifyPassToken(token), { registrationId: 'registration1', gameId: 'game1', passId: 'CC-GP-1' });
  assert.equal(verifyPassToken(token.replace('game1', 'game2')), null);
  process.env.JWT_SECRET = originalSecret;
});

test('check-in requires all teammates and enforces the event time window', () => {
  assert.equal(teamReadyForCheckIn([{ status: 'verified' }, { status: 'substitution_approved' }]), true);
  assert.equal(teamReadyForCheckIn([{ status: 'verified' }, { status: 'invited' }]), false);
  const game = { startsAt: '2026-10-05T10:00:00.000Z', endsAt: '2026-10-05T12:00:00.000Z' };
  assert.equal(isWithinCheckInWindow(game, '2026-10-05T07:00:00.000Z'), true);
  assert.equal(isWithinCheckInWindow(game, '2026-10-05T13:00:00.000Z'), true);
  assert.equal(isWithinCheckInWindow(game, '2026-10-05T13:00:00.001Z'), false);
});

test('paid-order fulfillment replay returns an existing confirmed registration', async () => {
  const originalFindById = GameRegistration.findById;
  const confirmed = { _id: 'registration1', status: 'confirmed', passId: 'CC-GP-1' };
  let reads = 0;
  GameRegistration.findById = () => ({
    select: async () => { reads += 1; return confirmed; },
  });
  try {
    const result = await fulfillGameRegistration({
      entityType: 'game_registration',
      orderId: 'order_replay',
      orderTags: { registrationId: 'registration1' },
    });
    assert.equal(result.registration, confirmed);
    assert.equal(reads, 1);
  } finally {
    GameRegistration.findById = originalFindById;
  }
});

test('participant lock uses a unique multikey index to stop simultaneous duplicate teams', () => {
  const indexes = GameRegistration.schema.indexes();
  const participantIndex = indexes.find(([fields]) => fields.participantKeys === 1);
  assert.ok(participantIndex);
  assert.equal(participantIndex[1].unique, true);
  assert.equal(participantIndex[1].sparse, true);
});

test('college rankings count only the best three teams per game and break ties by wins', () => {
  const collegeA = { _id: 'a', name: 'Alpha College', shortName: 'Alpha' };
  const collegeB = { _id: 'b', name: 'Beta College', shortName: 'Beta' };
  const results = [
    { collegeId: collegeA, gameId: 'g1', registrationId: 'a1', teamName: 'A One', placement: 1, points: 100 },
    { collegeId: collegeA, gameId: 'g1', registrationId: 'a2', teamName: 'A Two', placement: 2, points: 80 },
    { collegeId: collegeA, gameId: 'g1', registrationId: 'a3', teamName: 'A Three', placement: 3, points: 60 },
    { collegeId: collegeA, gameId: 'g1', registrationId: 'a4', teamName: 'A Four', placement: 4, points: 50 },
    { collegeId: collegeB, gameId: 'g1', registrationId: 'b1', teamName: 'B One', placement: 1, points: 90 },
    { collegeId: collegeB, gameId: 'g1', registrationId: 'b2', teamName: 'B Two', placement: 2, points: 80 },
    { collegeId: collegeB, gameId: 'g1', registrationId: 'b3', teamName: 'B Three', placement: 3, points: 70 },
  ];
  const ranking = aggregateRankings(results);
  assert.equal(ranking.colleges[0].collegeName, 'Alpha');
  assert.equal(ranking.colleges[0].points, 240);
  assert.equal(ranking.colleges[0].teams, 3);
  assert.equal(ranking.colleges[1].points, 240);
});

test('hosted Campus Hunt draft enforces the V1 team and capacity limits', () => {
  const draft = normalizeDraft({ teamSize: 99, capacity: 99, minimumTeams: 99, feePerTeam: 500, prizeAmount: 1000 });
  assert.equal(draft.teamSize, 12);
  assert.equal(draft.capacity, 20);
  assert.equal(draft.minimumTeams, 20);
  assert.equal(economicsForDraft(draft).platformFeePercent, 40);
  assert.equal(economicsForDraft(draft).gatewayFeeEstimatePercent, 1.6);
});

test('host approval requires an unexpired annual verification and verified phone', () => {
  assert.equal(hostIsApproved({ status: 'approved', phoneVerifiedAt: new Date(), verifiedUntil: new Date(Date.now() + 1000) }), true);
  assert.equal(hostIsApproved({ status: 'approved', verifiedUntil: new Date(Date.now() + 1000) }), false);
  assert.equal(hostIsApproved({ status: 'approved', phoneVerifiedAt: new Date(), verifiedUntil: new Date(Date.now() - 1000) }), false);
});

test('self-service host records retain scoped roles and device-bound check-in batches', () => {
  assert.deepEqual(CampusHostProfile.schema.path('status').enumValues, ['pending', 'changes_required', 'approved', 'suspended', 'expired', 'rejected']);
  assert.deepEqual(CampusHuntOperatorGrant.schema.path('role').enumValues, ['emergency_operator', 'checkpoint_volunteer']);
  assert.ok(CampusHuntHostCheckInPack.schema.path('deviceIdHash'));
  assert.ok(CampusHuntHostCheckInPack.schema.path('exportBatchId'));
  assert.ok(CollegeGame.schema.path('turnoutDecisionRequested'));
  assert.ok(CampusHuntOfflineInstall.schema.path('deviceIdHash'));
  assert.ok(CampusHuntOfflineInstall.schema.path('trustedTimeActivatedAt'));
});

test('admin college save is idempotent by normalized slug', async () => {
  const originalFindOneAndUpdate = College.findOneAndUpdate;
  let received;
  College.findOneAndUpdate = async (query, update, options) => {
    received = { query, update, options };
    return { _id: 'college1', ...update.$set };
  };
  const response = {
    statusCode: 0,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return body; },
  };
  let nextError;
  try {
    await collegePlatformController.adminCreateCollege({
      body: { name: 'Example College', city: 'Pune', emailDomains: ['example.edu'] },
    }, response, (error) => { nextError = error; });
    assert.equal(nextError, undefined);
    assert.equal(response.statusCode, 200);
    assert.equal(received.query.slug, 'example-college');
    assert.equal(received.options.upsert, true);
    assert.deepEqual(received.update.$set.emailDomains, ['example.edu']);
  } finally {
    College.findOneAndUpdate = originalFindOneAndUpdate;
  }
});
