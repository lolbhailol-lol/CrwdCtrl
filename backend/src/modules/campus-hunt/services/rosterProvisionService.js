const crypto = require('crypto');
const User = require('../../../model/usermodel');
const { encryptCredential } = require('../utils/credentialCipher');

function slugPart(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 24) || 'team';
}

function generatePassword(length = 8) {
  // Easy to read aloud on campus (no ambiguous 0/O/1/I)
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

function scannerEmail({ eventId, teamCode, slot }) {
  const code = slugPart(teamCode);
  const ev = String(eventId).slice(-6);
  return `ch.${ev}.${code}.m${slot}@hunt.crwdctrl.local`;
}

function leaderFallbackEmail({ eventId, teamCode }) {
  const code = slugPart(teamCode);
  const ev = String(eventId).slice(-6);
  return `ch.${ev}.${code}.leader@hunt.crwdctrl.local`;
}

/**
 * Ensure a User exists for a Campus Hunt scanner slot.
 * Returns { user, loginEmail, password, created }.
 */
async function ensureScannerUser({
  eventId,
  teamCode,
  slot,
  displayName,
  password,
}) {
  const loginEmail = scannerEmail({ eventId, teamCode, slot });
  let user = await User.findOne({ email: loginEmail });
  if (user) {
    user.name = displayName || user.name;
    user.password = password;
    user.isVerified = true;
    user.isDeleted = false;
    await user.save();
    return { user, loginEmail, password, created: false, reset: true };
  }

  user = await User.create({
    name: displayName || `Scanner ${slot}`,
    email: loginEmail,
    password,
    role: 'student',
    college: 'Campus Hunt',
    isVerified: true,
    signupMethod: 'password',
  });
  return { user, loginEmail, password, created: true, reset: false };
}

/** Create or reset a dedicated hunt-only leader account. */
async function ensureLeaderUser({
  eventId,
  teamCode,
  leaderEmail,
  leaderName,
  leaderPassword,
}) {
  const loginEmail = leaderFallbackEmail({ eventId, teamCode });
  const password = leaderPassword || generatePassword(8);
  let user = await User.findOne({ email: loginEmail });
  if (user) {
    user.password = password;
    user.name = leaderName || user.name;
    user.isVerified = true;
    await user.save();
    return {
      user,
      loginEmail,
      password,
      created: false,
      contactEmail: String(leaderEmail || '').trim().toLowerCase(),
      note: 'Dedicated Campus Hunt leader login reset',
    };
  }
  user = await User.create({
    name: leaderName || `${teamCode} Leader`,
    email: loginEmail,
    password,
    role: 'student',
    college: 'Campus Hunt',
    isVerified: true,
    signupMethod: 'password',
  });
  return {
    user,
    loginEmail,
    password,
    created: true,
    contactEmail: String(leaderEmail || '').trim().toLowerCase(),
    note: 'Dedicated Campus Hunt leader login created',
  };
}

/**
 * Build a full roster from leader email + member names (teamSize - 1 scanners).
 * Scanners share the same password (different login emails) so
 * checkpoint scans stay distinct user IDs.
 */
async function provisionTeamRoster({
  eventId,
  teamCode,
  teamName,
  leaderEmail,
  leaderName,
  leaderPassword,
  memberNames = [],
  scannerPassword,
  teamSize = 4,
}) {
  const size = Math.max(2, Math.min(8, Number(teamSize) || 4));
  const membersNeeded = size - 1;
  const names = (memberNames || [])
    .map((n) => String(n || '').trim())
    .filter(Boolean)
    .slice(0, membersNeeded);
  while (names.length < membersNeeded) {
    names.push(`Player ${names.length + 1}`);
  }
  if (names.length !== membersNeeded) {
    const err = new Error(`Provide exactly ${membersNeeded} member name(s) for scanners`);
    err.status = 400;
    err.code = 'ROSTER_NAMES';
    throw err;
  }

  const sharedScannerPassword = scannerPassword || generatePassword(8);
  const leader = await ensureLeaderUser({
    eventId,
    teamCode,
    leaderEmail,
    leaderName: leaderName || teamName,
    leaderPassword,
  });
  const resolvedLeaderPassword = leader.password || leaderPassword || generatePassword(8);

  const scanners = [];
  for (let i = 0; i < membersNeeded; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const slot = await ensureScannerUser({
      eventId,
      teamCode,
      slot: i + 1,
      displayName: names[i],
      password: sharedScannerPassword,
    });
    scanners.push({
      name: names[i],
      userId: String(slot.user._id),
      loginEmail: slot.loginEmail,
      password: sharedScannerPassword,
      role: 'scanner',
    });
  }

  const leaderUserId = String(leader.user._id);
  const memberUserIds = scanners.map((s) => s.userId);
  if (memberUserIds.includes(leaderUserId)) {
    const err = new Error('Leader cannot also be a scanner account');
    err.status = 400;
    throw err;
  }

  const resolvedLeaderName = String(leaderName || leader.user.name || teamName || '').trim();

  const credentials = {
    leader: {
      name: resolvedLeaderName,
      loginEmail: leader.loginEmail,
      contactEmail: leader.contactEmail || String(leaderEmail || '').trim().toLowerCase(),
      password: resolvedLeaderPassword,
      role: 'leader',
      note: leader.note,
      access: 'Full hunt — clues, answers, timer, scans',
    },
    scanners: scanners.map((s) => ({
      name: s.name,
      loginEmail: s.loginEmail,
      password: s.password,
      role: 'scanner',
      access: 'Scanner only — checkpoint QR / paste when required',
    })),
    sharedScannerPassword,
    teamPassword: String(resolvedLeaderPassword || sharedScannerPassword).trim()
      || sharedScannerPassword,
    allMemberNames: [resolvedLeaderName, ...names],
  };

  const accessPack = {
    leader: {
      name: credentials.leader.name,
      loginEmail: credentials.leader.loginEmail,
      contactEmail: credentials.leader.contactEmail,
      encryptedPassword: encryptCredential(credentials.leader.password || ''),
      note: credentials.leader.note || '',
    },
    scanners: credentials.scanners.map((s) => ({
      name: s.name,
      loginEmail: s.loginEmail,
      encryptedPassword: encryptCredential(s.password),
    })),
    encryptedSharedScannerPassword: encryptCredential(sharedScannerPassword),
    encryptedTeamPassword: encryptCredential(
      String(credentials.teamPassword || sharedScannerPassword).trim()
        || sharedScannerPassword,
    ),
  };

  return {
    leaderUserId,
    memberUserIds,
    leaderName: resolvedLeaderName,
    leaderContactEmail: credentials.leader.contactEmail,
    memberNames: names,
    allMemberNames: [resolvedLeaderName, ...names],
    credentials,
    accessPack,
  };
}

function memberNamesForTeam(team, teamSize = 4) {
  const membersNeeded = Math.max(1, Math.min(7, (Number(teamSize) || 4) - 1));
  const fromTeam = (team.memberNames || [])
    .map((n) => String(n || '').trim())
    .filter(Boolean)
    .slice(0, membersNeeded);
  if (fromTeam.length === membersNeeded) return fromTeam;
  const label = team.teamName || team.teamCode || 'Team';
  const names = [...fromTeam];
  while (names.length < membersNeeded) {
    names.push(`${label} · Player ${names.length + 1}`);
  }
  return names;
}

/**
 * Provision synthetic hunt accounts for a team missing leaderUserId / scanners.
 * Safe to re-run — resets passwords when accounts already exist.
 */
async function repairTeamRoster(team, event, {
  leaderPassword = 'HUNT2026',
  scannerPassword = 'HUNT2026',
} = {}) {
  const { isTeamRosterReady } = require('../utils/roster');
  const { resolveDemoScale } = require('../utils/demoScale');
  const scale = resolveDemoScale(event);
  if (isTeamRosterReady(team, scale.teamSize)) {
    return { repaired: false, teamCode: team.teamCode };
  }

  const provisioned = await provisionTeamRoster({
    eventId: event._id,
    teamCode: team.teamCode,
    teamName: team.teamName || team.teamCode,
    leaderEmail: team.leaderContactEmail || team.accessPack?.leader?.contactEmail || '',
    leaderName: team.leaderName || team.accessPack?.leader?.name || `${team.teamCode} Leader`,
    leaderPassword,
    memberNames: memberNamesForTeam(team, scale.teamSize),
    scannerPassword,
    teamSize: scale.teamSize,
  });

  team.leaderUserId = provisioned.leaderUserId;
  team.memberUserIds = provisioned.memberUserIds;
  team.leaderName = provisioned.leaderName;
  team.leaderContactEmail = provisioned.leaderContactEmail || team.leaderContactEmail;
  team.memberNames = provisioned.memberNames;
  team.accessPack = provisioned.accessPack;
  await team.save();

  return { repaired: true, teamCode: team.teamCode };
}

async function repairAllTeamRostersForEvent(eventId, options = {}) {
  const CampusHuntTeam = require('../models/CampusHuntTeam');
  const CampusHuntEvent = require('../models/CampusHuntEvent');
  const { isTeamRosterReady } = require('../utils/roster');
  const { resolveDemoScale } = require('../utils/demoScale');

  const event = await CampusHuntEvent.findById(eventId);
  if (!event) {
    const err = new Error('Event not found');
    err.status = 404;
    throw err;
  }
  const scale = resolveDemoScale(event);

  const teams = await CampusHuntTeam.find({ eventId: event._id }).sort({ teamCode: 1 });
  let repaired = 0;
  let alreadyReady = 0;
  const errors = [];

  for (const team of teams) {
    if (isTeamRosterReady(team, scale.teamSize)) {
      alreadyReady += 1;
      // eslint-disable-next-line no-continue
      continue;
    }
    try {
      // eslint-disable-next-line no-await-in-loop
      const result = await repairTeamRoster(team, event, options);
      if (result.repaired) repaired += 1;
    } catch (err) {
      errors.push({ teamCode: team.teamCode, message: err.message || 'Repair failed' });
    }
  }

  return {
    total: teams.length,
    repaired,
    alreadyReady,
    stillIncomplete: teams.length - alreadyReady - repaired,
    errors,
    teamSize: scale.teamSize,
    teamCapacity: scale.teamCapacity,
  };
}

module.exports = {
  generatePassword,
  provisionTeamRoster,
  ensureLeaderUser,
  ensureScannerUser,
  repairTeamRoster,
  repairAllTeamRostersForEvent,
};
