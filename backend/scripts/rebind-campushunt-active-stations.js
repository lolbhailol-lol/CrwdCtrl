/**
 * Rebind campushunt layout teams to active places (stationCount, e.g. S01–S06),
 * refresh clues, recreate schedule for dry run. Preserves roster names.
 *
 * Usage: node scripts/rebind-campushunt-active-stations.js [eventSlug]
 */
require('dotenv').config();
const mongoose = require('mongoose');
const CampusHuntEvent = require('../src/modules/campus-hunt/models/CampusHuntEvent');
const CampusHuntTeam = require('../src/modules/campus-hunt/models/CampusHuntTeam');
const CampusHuntRound = require('../src/modules/campus-hunt/models/CampusHuntRound');
const CampusHuntCheckpoint = require('../src/modules/campus-hunt/models/CampusHuntCheckpoint');
const { bootstrapRound1Defaults } = require('../src/modules/campus-hunt/services/round1BootstrapService');
const {
  generateSchedule,
  lockSchedule,
} = require('../src/modules/campus-hunt/services/startScheduleService');
const {
  resolveCampusStations,
} = require('../src/modules/campus-hunt/services/stationCatalogService');

const LAYOUT_CODES = [
  'CC001', 'CC002', 'CC003', 'CC004',
  'CC005', 'CC006', 'CC007', 'CC008',
];

(async () => {
  const slug = String(process.argv[2] || 'campushunt').trim();
  await mongoose.connect(process.env.MONGODB_URI);

  const event = await CampusHuntEvent.findOne({ slug });
  if (!event) throw new Error(`Event not found: ${slug}`);

  // Keep demo layout size
  event.teamCapacity = 8;
  event.teamSize = 3;
  event.startCount = Math.max(1, Number(event.startCount) || 1);
  event.stationCount = Math.max(1, Math.min(10, Number(event.stationCount) || 6));
  if (event.status === 'finale') event.status = 'live';
  await event.save();

  const activeStations = resolveCampusStations(event);
  const activeCodes = activeStations.map((s) => s.code);
  console.log(`# ${slug} · capacity ${event.teamCapacity} · size ${event.teamSize}`);
  console.log(`# Active places: ${activeStations.map((s) => `${s.code}:${s.name}`).join(', ')}`);

  const namesBefore = await CampusHuntTeam.find({
    eventId: event._id,
    teamCode: { $in: LAYOUT_CODES },
  }).select('teamCode teamName leaderName memberNames').sort({ teamCode: 1 }).lean();

  console.log('# Bootstrap clues + shared station QRs (no new teams)…');
  const boot = await bootstrapRound1Defaults({
    eventId: event._id,
    actor: { actorType: 'script', actorId: 'rebind-active-stations' },
    createTeams: false,
    enablePublicLeaderboard: event.publicLeaderboardLive !== false,
    challengeNumbers: null,
  });

  // Retire scan posters outside the active place set
  const retired = await CampusHuntCheckpoint.updateMany(
    {
      eventId: event._id,
      stationCode: { $nin: activeCodes },
      progressionKey: { $in: ['1', '2', '3', '4'] },
    },
    {
      $set: {
        active: false,
        concurrencyGuidance: 'Retired — outside active stationCount for this event.',
      },
    },
  );
  console.log(`# Retired out-of-layout checkpoints: ${retired.modifiedCount || 0}`);

  const round = await CampusHuntRound.findOne({ eventId: event._id, roundNumber: 1 });
  if (!round) throw new Error('Round 1 not found');

  // Park leftover teams so lock/capacity only sees the 8 layout teams
  const leftovers = await CampusHuntTeam.updateMany(
    {
      eventId: event._id,
      teamCode: { $nin: LAYOUT_CODES },
    },
    {
      $set: { startStatus: 'CANCELLED', currentStage: 'WAITING' },
      $unset: {
        startingPointId: 1,
        scheduledStartAt: 1,
        clue1ChallengeId: 1,
        firstCheckpointId: 1,
        clue2ChallengeId: 1,
        secondCheckpointId: 1,
        clue3ChallengeId: 1,
        thirdCheckpointId: 1,
        roundId: 1,
      },
    },
  );
  console.log(`# Parked leftover teams: ${leftovers.modifiedCount || 0}`);

  // Dry-run friendly start: first release in ~2 minutes
  const startsAt = new Date(Date.now() + 2 * 60 * 1000);
  round.scheduleStatus = 'draft';
  round.startsAt = startsAt;
  round.releaseIntervalMinutes = 5;
  round.assignmentStrategy = 'route_balanced';
  if (round.status !== 'live') round.status = 'live';
  await round.save();

  console.log(`# Generate schedule from ${startsAt.toISOString()}…`);
  const generated = await generateSchedule({
    eventId: event._id,
    roundId: round._id,
    startsAt,
    releaseIntervalMinutes: 5,
    assignmentStrategy: 'route_balanced',
    confirm: true,
    forceResetProgress: true,
    actor: { actorType: 'script', actorId: 'rebind-active-stations' },
    reason: 'Rebind layout teams to active S01–S04 places for dry run',
  });

  console.log('# Lock schedule…');
  // Relink only layout teams onto this round before lock
  await CampusHuntTeam.updateMany(
    { eventId: event._id, teamCode: { $in: LAYOUT_CODES } },
    { $set: { roundId: round._id } },
  );
  const locked = await lockSchedule({
    eventId: event._id,
    roundId: round._id,
    actor: { actorType: 'script', actorId: 'rebind-active-stations' },
    reason: 'Dry-run schedule lock after active-station rebind',
  });

  // Restore names if bootstrap somehow touched them (it shouldn't with createTeams:false)
  for (const row of namesBefore) {
    // eslint-disable-next-line no-await-in-loop
    await CampusHuntTeam.updateOne(
      { eventId: event._id, teamCode: row.teamCode },
      {
        $set: {
          teamName: row.teamName,
          leaderName: row.leaderName,
          memberNames: row.memberNames,
        },
      },
    );
  }

  const teams = await CampusHuntTeam.find({
    eventId: event._id,
    teamCode: { $in: LAYOUT_CODES },
  }).sort({ teamCode: 1 });

  const cps = await CampusHuntCheckpoint.find({
    _id: {
      $in: teams.flatMap((t) => [
        t.firstCheckpointId,
        t.secondCheckpointId,
        t.thirdCheckpointId,
      ]).filter(Boolean),
    },
  }).select('locationName stationCode progressionKey').lean();
  const byId = new Map(cps.map((c) => [String(c._id), c]));

  console.log('teamCode\tname\tcp1\tcp2\tcp3\tok');
  let bad = 0;
  for (const t of teams) {
    const a = byId.get(String(t.firstCheckpointId || ''));
    const b = byId.get(String(t.secondCheckpointId || ''));
    const c = byId.get(String(t.thirdCheckpointId || ''));
    const codes = [a, b, c].map((x) => x?.stationCode);
    const ok = codes.every((code) => activeCodes.includes(code));
    if (!ok) bad += 1;
    console.log(
      `${t.teamCode}\t${t.teamName}\t${a?.locationName || '?'}(${a?.stationCode})\t`
      + `${b?.locationName || '?'}(${b?.stationCode})\t${c?.locationName || '?'}(${c?.stationCode})\t`
      + `${ok ? 'YES' : 'NO'}`,
    );
  }

  console.log(JSON.stringify({
    cluesCreated: boot.cluesCreated,
    checkpointsCreated: boot.checkpointsCreated,
    teamsScheduled: generated.teamsScheduled,
    teamsReady: locked.teamsReady,
    startsAt,
    badBindings: bad,
  }, null, 2));

  await mongoose.disconnect();
  process.exit(bad > 0 ? 2 : 0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
