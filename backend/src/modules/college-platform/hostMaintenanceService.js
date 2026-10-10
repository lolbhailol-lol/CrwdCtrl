const bcrypt = require('bcryptjs');
const { logger } = require('../../utils/logger');
const OrganizerPayout = require('../../model/organizer_payout_model');
const CampusHuntOfflineInstall = require('../campus-hunt/models/CampusHuntOfflineInstall');
const {
  CollegeGame,
  CampusHostProfile,
  CampusHuntPermission,
  CampusHuntOperatorGrant,
  CampusHuntHostCheckInPack,
} = require('./models');
const { reconcileHostedGame } = require('./hostService');

const SIX_HOURS = 6 * 60 * 60 * 1000;
const SECRET_RETENTION = 7 * 24 * 60 * 60 * 1000;
let timer = null;

async function runHostMaintenance() {
  const now = new Date();
  await Promise.all([
    CampusHostProfile.updateMany({ status: 'approved', verifiedUntil: { $lte: now } }, { $set: { status: 'expired' }, $push: { audit: { action: 'verification_expired', actor: 'system' } } }),
    CampusHuntPermission.updateMany({ status: 'approved', expiresAt: { $lte: now } }, { $set: { status: 'expired' }, $push: { audit: { action: 'permission_expired', actor: 'system' } } }),
    CampusHuntOperatorGrant.updateMany({ enabled: true, expiresAt: { $lte: now } }, { $set: { enabled: false, revokedAt: now }, $push: { audit: { action: 'grant_expired', actor: 'system' } } }),
    CampusHuntHostCheckInPack.updateMany({ revokedAt: null, expiresAt: { $lte: now } }, { $set: { revokedAt: now }, $push: { audit: { action: 'pack_expired', actor: 'system' } } }),
  ]);

  const games = await CollegeGame.find({ ownerHostProfileId: { $ne: null } }).select('_id engine operationalStatus updatedAt').limit(500).lean();
  const reports = [];
  for (const game of games) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const report = await reconcileHostedGame(game._id);
      if (report.issues.length) reports.push(report);
    } catch (error) {
      reports.push({ gameId: String(game._id), issues: [`reconciliation_failed:${error.message}`] });
    }
  }
  if (reports.length) logger.warn('Campus Hunt host reconciliation mismatches', { reports });

  const cutoff = new Date(Date.now() - SECRET_RETENTION);
  const paidPayouts = await OrganizerPayout.find({ organizerType: 'college_game', status: 'paid', paidAt: { $lte: cutoff } }).select('eventId').lean();
  const purgeGameIds = paidPayouts.map((row) => row.eventId).filter(Boolean);
  const cancelled = await CollegeGame.find({ ownerHostProfileId: { $ne: null }, operationalStatus: 'cancelled', updatedAt: { $lte: cutoff } }).select('_id engine.eventId').lean();
  purgeGameIds.push(...cancelled.map((row) => String(row._id)));
  const eventIds = cancelled.map((row) => row.engine?.eventId).filter(Boolean);
  const paidGames = purgeGameIds.length ? await CollegeGame.find({ _id: { $in: purgeGameIds } }).select('engine.eventId').lean() : [];
  eventIds.push(...paidGames.map((row) => row.engine?.eventId).filter(Boolean));
  if (purgeGameIds.length || eventIds.length) {
    const destroyedHash = await bcrypt.hash(`destroyed-${Date.now()}`, 10);
    await Promise.all([
      CampusHuntHostCheckInPack.deleteMany({ gameId: { $in: purgeGameIds } }),
      CampusHuntOfflineInstall.deleteMany({ eventId: { $in: eventIds } }),
      CampusHuntOperatorGrant.updateMany({ gameId: { $in: purgeGameIds } }, { $set: { enabled: false, revokedAt: now, passwordHash: destroyedHash, deviceIdHash: '' } }),
    ]);
  }
  return { reconciliationIssues: reports.length, purgedGames: purgeGameIds.length };
}

function initHostMaintenanceCron() {
  if (timer) return timer;
  runHostMaintenance().catch((error) => logger.warn('Campus Hunt host maintenance failed', { error: error.message }));
  timer = setInterval(() => {
    runHostMaintenance().catch((error) => logger.warn('Campus Hunt host maintenance failed', { error: error.message }));
  }, SIX_HOURS);
  timer.unref?.();
  return timer;
}

module.exports = { runHostMaintenance, initHostMaintenanceCron };
