/**
 * Campus Hunt smoke check. With MONGODB_URI + CAMPUS_HUNT_SMOKE_SLUG it also
 * validates topology, roster assignment, and lifecycle readiness.
 *
 * Usage:
 *   node scripts/campus-hunt-smoke.js
 *   BASE_URL=http://localhost:8080 node scripts/campus-hunt-smoke.js
 */
require('dotenv').config();
const base = (process.env.BASE_URL || 'http://localhost:8080').replace(/\/$/, '');

function assert(condition, message) {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

async function request(path, { token, ...options } = {}) {
  const headers = { ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${base}${path}`, { ...options, headers });
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

async function login(slug, teamCode, email, password) {
  const result = await request(
    `/api/campus-hunt/events/by-slug/${encodeURIComponent(slug)}`
      + `/teams/${encodeURIComponent(teamCode)}/login`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    },
  );
  assert(result.response.ok && result.body?.data?.token, `login succeeds for ${email}`);
  return result.body.data.token;
}

async function main() {
  const url = `${base}/api/campus-hunt/status`;
  console.log('GET', url);
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  console.log('HTTP', res.status, data);

  if (!res.ok) {
    console.error('FAIL: status endpoint should always respond');
    process.exit(1);
  }

  if (data?.data?.enabled) {
    console.log('Campus Hunt ENABLED — eventsVisible:', data.data.eventsVisible?.length ?? 0);
  } else {
    console.log('Campus Hunt DISABLED (expected until pilot flags are set)');
  }

  if (process.env.MONGODB_URI && process.env.CAMPUS_HUNT_SMOKE_SLUG) {
    const mongoose = require('mongoose');
    const Event = require('../src/modules/campus-hunt/models/CampusHuntEvent');
    const Round = require('../src/modules/campus-hunt/models/CampusHuntRound');
    const Route = require('../src/modules/campus-hunt/models/CampusHuntRoute');
    const StartingPoint = require('../src/modules/campus-hunt/models/CampusHuntStartingPoint');
    const Challenge = require('../src/modules/campus-hunt/models/CampusHuntChallenge');
    const Checkpoint = require('../src/modules/campus-hunt/models/CampusHuntCheckpoint');
    const Team = require('../src/modules/campus-hunt/models/CampusHuntTeam');
    const Volunteer = require('../src/modules/campus-hunt/models/CampusHuntVolunteerAccess');
    await mongoose.connect(process.env.MONGODB_URI);
    const event = await Event.findOne({ slug: process.env.CAMPUS_HUNT_SMOKE_SLUG });
    assert(event, 'smoke event exists');
    const [round, routes, starts, teams, volunteers] = await Promise.all([
      Round.findOne({ eventId: event._id, roundNumber: 1 }),
      Route.find({ eventId: event._id, active: true }),
      StartingPoint.find({ eventId: event._id, active: true }).sort({ displayOrder: 1 }),
      Team.find({ eventId: event._id }),
      Volunteer.countDocuments({ eventId: event._id, enabled: true }),
    ]);
    assert(round, 'Round 1 exists');
    assert(routes.length > 0, 'at least one active route exists');
    assert(starts.length > 0, 'at least one active starting point exists');
    assert(teams.length > 0, 'at least one team exists');
    assert(volunteers > 0, 'checkpoint-bound volunteers exist');
    assert(round.releaseIntervalMinutes >= 1, 'release interval is configured');
    assert(['sequential', 'route_balanced'].includes(round.assignmentStrategy), 'assignment strategy is valid');
    assert(['draft', 'locked'].includes(round.scheduleStatus), 'schedule status is valid');
    assert(
      starts.reduce((sum, point) => sum + point.capacity, 0) >= teams.length,
      'starting capacity covers all teams',
    );
    for (const route of routes) {
      // eslint-disable-next-line no-await-in-loop
      const [clues, checkpoints] = await Promise.all([
        Challenge.find({ eventId: event._id, routeId: route._id, active: true })
          .select('challengeNumber variantKey startingPointId firstCheckpointId difficulty'),
        Checkpoint.find({ eventId: event._id, routeId: route._id, active: true })
          .select(
            'locationName code progressionKey startingPointId allowedTeamIds '
            + 'capacityGuidance concurrencyGuidance',
          ),
      ]);
      const clueNumbers = new Set(clues.map((clue) => clue.challengeNumber));
      assert(
        [1, 2, 3, 4].every((number) => clueNumbers.has(number)),
        `Route ${route.routeKey} has exact 4/4 progression`,
      );
      const clue1 = clues.filter((clue) => clue.challengeNumber === 1);
      assert(clue1.length >= starts.length, `Route ${route.routeKey} covers every start with Clue 1`);
      assert(
        clue1.every((clue) => clue.startingPointId && clue.firstCheckpointId && clue.variantKey),
        `Route ${route.routeKey} Clue 1 variants are fully linked`,
      );
      assert(
        [2, 3, 4].every((number) => clues.some(
          (clue) => clue.challengeNumber === number && clue.variantKey === 'DEFAULT',
        )),
        `Route ${route.routeKey} later clues use DEFAULT variants`,
      );
      assert(
        ['1', '2', '3', 'FINISH'].every((key) => checkpoints.some(
          (checkpoint) => checkpoint.progressionKey === key,
        )),
        `Route ${route.routeKey} has exact 4/4 checkpoint progression`,
      );
      assert(
        checkpoints.every((checkpoint) => (
          !/Route\s+[A-Z0-9]+\s+(Checkpoint|Finish Zone)/i.test(checkpoint.locationName || '')
        )),
        `Route ${route.routeKey} has no placeholder checkpoint locations`,
      );
      assert(
        checkpoints.every((checkpoint) => checkpoint.code),
        `Route ${route.routeKey} checkpoints have station codes`,
      );
      assert(
        checkpoints.filter((checkpoint) => checkpoint.progressionKey === '1')
          .every((checkpoint) => checkpoint.startingPointId && checkpoint.capacityGuidance),
        `Route ${route.routeKey} first checkpoints carry start/capacity guidance`,
      );
    }
    for (const team of teams) {
      assert(team.routeId, `Team ${team.teamCode} has a route`);
      assert(team.memberUserIds.length === 3, `Team ${team.teamCode} has four members`);
      assert(team.uniqueMemberIds().length === 4, `Team ${team.teamCode} roster is exactly 4/4`);
      assert(team.startingPointId, `Team ${team.teamCode} has a starting point`);
      assert(team.scheduledStartAt, `Team ${team.teamCode} has a scheduled start`);
      assert(team.clue1ChallengeId, `Team ${team.teamCode} has a Clue 1 variant`);
      assert(team.firstCheckpointId, `Team ${team.teamCode} has a first checkpoint`);
      assert(
        ['WAITING', 'READY', 'RELEASED', 'ACTIVE', 'COMPLETED', 'CANCELLED']
          .includes(team.startStatus),
        `Team ${team.teamCode} has valid start status`,
      );
    }
    const destinationIds = new Set(teams.map((team) => String(team.firstCheckpointId)));
    assert(
      teams.length < 2 || destinationIds.size > 1,
      'first-checkpoint destinations are distributed',
    );
    for (const start of starts) {
      const assigned = teams.filter(
        (team) => String(team.startingPointId) === String(start._id),
      );
      assert(assigned.length <= start.capacity, `${start.code} stays within capacity`);
    }
    await mongoose.disconnect();
    console.log(
      `Topology OK: ${routes.length} routes, ${starts.length} starts, ${teams.length} teams`,
    );
  }

  if (
    process.env.CAMPUS_HUNT_SMOKE_SLUG
    && process.env.CAMPUS_HUNT_SMOKE_TEAM_CODE
    && process.env.CAMPUS_HUNT_SMOKE_EMAIL
    && process.env.CAMPUS_HUNT_SMOKE_PASSWORD
  ) {
    const token = await login(
      process.env.CAMPUS_HUNT_SMOKE_SLUG,
      process.env.CAMPUS_HUNT_SMOKE_TEAM_CODE,
      process.env.CAMPUS_HUNT_SMOKE_EMAIL,
      process.env.CAMPUS_HUNT_SMOKE_PASSWORD,
    );
    const eventResult = await request(
      `/api/campus-hunt/events/by-slug/${
        encodeURIComponent(process.env.CAMPUS_HUNT_SMOKE_SLUG)
      }`,
    );
    const eventId = eventResult.body?.data?.event?.id
      || eventResult.body?.data?.event?._id
      || eventResult.body?.data?._id
      || eventResult.body?.data?.id;
    assert(eventResult.response.ok && eventId, 'smoke event is publicly readable');
    const me = await request(
      `/api/campus-hunt/me/team?eventId=${encodeURIComponent(eventId)}`,
      { token },
    );
    assert(me.response.ok, 'leader/scanner can load assigned team');
    const teamId = me.body?.data?.team?._id || me.body?.data?.team?.id;
    assert(teamId, 'team response includes team ID');
    console.log('Team login/progress OK');

    if (
      process.env.CAMPUS_HUNT_SMOKE_SCANNER_EMAIL
      && process.env.CAMPUS_HUNT_SMOKE_SCANNER_PASSWORD
    ) {
      const scannerToken = await login(
        process.env.CAMPUS_HUNT_SMOKE_SLUG,
        process.env.CAMPUS_HUNT_SMOKE_TEAM_CODE,
        process.env.CAMPUS_HUNT_SMOKE_SCANNER_EMAIL,
        process.env.CAMPUS_HUNT_SMOKE_SCANNER_PASSWORD,
      );
      const scannerProgress = await request(
        `/api/campus-hunt/teams/${encodeURIComponent(teamId)}/progress`,
        { token: scannerToken },
      );
      assert(scannerProgress.response.ok, 'scanner can load checkpoint progress');
      const clue1 = scannerProgress.body?.data?.challenges?.find(
        (challenge) => challenge.challengeNumber === 1,
      );
      assert(!clue1?.prompt, 'scanner cannot see leader-only Clue 1');
      const forbidden = await request(
        `/api/campus-hunt/teams/${encodeURIComponent(teamId)}/challenges/1/submit`,
        {
          token: scannerToken,
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ answer: 'smoke-role-check' }),
        },
      );
      assert(forbidden.response.status === 403, 'scanner cannot submit leader-only Clue 1');
      console.log('Role visibility OK');
    }
  }

  console.log('OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
