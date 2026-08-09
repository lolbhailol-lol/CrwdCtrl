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
 * Build a full 4-person roster from leader email + 3 member names.
 * All 3 scanners share the same password (different login emails) so
 * checkpoint scans stay 4 distinct user IDs.
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
}) {
  const names = (memberNames || [])
    .map((n) => String(n || '').trim())
    .filter(Boolean);
  if (names.length !== 3) {
    const err = new Error('Provide exactly 3 member names for scanners');
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

  const scanners = [];
  for (let i = 0; i < 3; i += 1) {
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
      password: leader.password || '',
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
    sharedScannerPassword: sharedScannerPassword,
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

module.exports = {
  generatePassword,
  provisionTeamRoster,
  ensureLeaderUser,
  ensureScannerUser,
};
