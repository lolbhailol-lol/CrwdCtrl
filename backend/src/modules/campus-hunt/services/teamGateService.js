const User = require('../../../model/usermodel');
const { encryptCredential, decryptCredential } = require('../utils/credentialCipher');

function readTeamPassword(team) {
  const pack = team?.accessPack || {};
  // Prefer explicit shared team gate password, then leader, then scanner shared.
  const candidates = [
    pack.encryptedTeamPassword,
    pack.leader?.encryptedPassword,
    pack.leader?.password,
    pack.encryptedSharedScannerPassword,
    pack.sharedScannerPassword,
  ];
  for (const value of candidates) {
    const decoded = decryptCredential(value || '');
    if (decoded) return decoded;
  }
  return '';
}

/** True when ciphertext exists but no key can decrypt it (key rotation / wrong env). */
function isCredentialVaultUnreadable(team) {
  const pack = team?.accessPack || {};
  const blobs = [
    pack.encryptedTeamPassword,
    pack.leader?.encryptedPassword,
    pack.encryptedSharedScannerPassword,
  ];
  const hasCiphertext = blobs.some((v) => String(v || '').startsWith('v1.'));
  if (!hasCiphertext) return false;
  return !readTeamPassword(team);
}

function passwordsMatch(provided, expected) {
  const a = String(provided || '').trim();
  const b = String(expected || '').trim();
  if (!a || !b) return false;
  return a === b;
}

/**
 * Set the one shared team password (gate + all member accounts).
 * Admin chooses this; every roster person uses it with the team code.
 */
async function setTeamSharedPassword(team, password) {
  const pass = String(password || '').trim();
  if (pass.length < 4) {
    const err = new Error('Password must be at least 4 characters');
    err.status = 400;
    err.code = 'WEAK_PASSWORD';
    throw err;
  }

  const scannerSlots = Math.max(
    1,
    Math.min(7, (team.memberUserIds || []).length || (team.memberNames || []).length || 1),
  );

  if (!team.accessPack) team.accessPack = {};
  team.accessPack.encryptedTeamPassword = encryptCredential(pass);
  team.accessPack.encryptedSharedScannerPassword = encryptCredential(pass);
  team.accessPack.sharedScannerPassword = undefined;

  if (!team.accessPack.leader) team.accessPack.leader = {};
  team.accessPack.leader.encryptedPassword = encryptCredential(pass);
  team.accessPack.leader.password = undefined;

  const scanners = Array.isArray(team.accessPack.scanners)
    ? [...team.accessPack.scanners]
    : [];
  while (scanners.length < scannerSlots) scanners.push({});
  team.accessPack.scanners = scanners.slice(0, scannerSlots).map((s) => ({
    ...(s.toObject?.() || s),
    encryptedPassword: encryptCredential(pass),
    password: undefined,
  }));
  team.markModified('accessPack');
  await team.save();

  const rosterIds = [
    team.leaderUserId,
    ...(team.memberUserIds || []),
  ].filter(Boolean);

  // Single round-trip to load all roster users, then save in parallel.
  // `password` is select:false — opt in so the pre-save hash hook fires.
  const users = await User.find({ _id: { $in: rosterIds } }).select('+password');
  await Promise.all(users.map((user) => {
    user.password = pass;
    user.isVerified = true;
    user.isDeleted = false;
    return user.save();
  }));

  return pass;
}

function resolveRosterUserId(team, role, slot) {
  const r = String(role || '').toLowerCase();
  if (r === 'leader') {
    if (!team.leaderUserId) {
      const err = new Error('Leader not assigned on this team');
      err.status = 409;
      throw err;
    }
    return team.leaderUserId;
  }
  if (r === 'scanner' || r === 'player') {
    const idx = Math.max(0, Number(slot) - 1);
    const userId = team.memberUserIds?.[idx];
    if (!userId) {
      const err = new Error('Player slot not found on this team');
      err.status = 409;
      throw err;
    }
    return userId;
  }
  const err = new Error('role must be leader or player');
  err.status = 400;
  throw err;
}

module.exports = {
  readTeamPassword,
  passwordsMatch,
  isCredentialVaultUnreadable,
  setTeamSharedPassword,
  resolveRosterUserId,
};
