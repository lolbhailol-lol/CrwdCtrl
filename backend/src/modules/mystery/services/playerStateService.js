const TeamInvestigationProgress = require('../models/TeamInvestigationProgress');
const EvidenceNode = require('../models/EvidenceNode');
const InvestigationBranch = require('../models/InvestigationBranch');
const FightsBackEvent = require('../models/FightsBackEvent');
const MysteryCase = require('../models/MysteryCase');
const FinalSubmission = require('../models/FinalSubmission');
const { sanitizeEvidence } = require('./evidenceService');
const { isPlayable } = require('../middleware/teamSession');
const { PROGRESS_STATUS, UNLOCK_SOURCE } = require('../constants');

const CASE_PLAYER_FIELDS = 'title tagline synopsis mysteryIdentityName mysteryIdentityPrompt difficulty estimatedMinutes';

async function ensureProgress(team) {
  const existing = await TeamInvestigationProgress.findOne({ teamId: team._id });
  if (existing) return existing;
  try {
    return await TeamInvestigationProgress.create({ teamId: team._id, caseId: team.caseId, eventId: team.eventId });
  } catch (err) {
    if (err.code === 11000) return TeamInvestigationProgress.findOne({ teamId: team._id });
    throw err;
  }
}

function unlockedIdSet(progress) {
  return new Set(progress.unlockedEvidence.map((u) => String(u.evidenceId)));
}

function chosenLeadSet(progress) {
  return new Set(progress.branchChoices.map((c) => `${c.branchId}:${c.chosenLeadId}`));
}

/** Prerequisites unlocked hain aur (agar branch-gated hai) team ne wahi lead choose kiya hai. */
function isEvidenceReachable(evidence, progress) {
  const unlocked = unlockedIdSet(progress);
  const prereqsMet = (evidence.unlockedByEvidenceIds || []).every((id) => unlocked.has(String(id)));
  if (!prereqsMet) return false;
  if (!evidence.unlockedByBranchId) return true;
  return chosenLeadSet(progress).has(`${evidence.unlockedByBranchId}:${evidence.unlockedByLeadId}`);
}

/** Evidence add karo + score + "Mystery Fights Back" trigger. Save caller karta hai. */
async function addUnlockedEvidence(progress, evidence, source) {
  if (unlockedIdSet(progress).has(String(evidence._id))) return false;
  progress.unlockedEvidence.push({ evidenceId: evidence._id, source });
  progress.totalScore += evidence.points || 0;

  const activeCount = progress.unlockedEvidence.filter((u) => !u.invalidatedAt).length;
  const triggers = await FightsBackEvent.find({
    caseId: progress.caseId,
    triggerAfterEvidenceCount: { $lte: activeCount },
  });
  const acked = new Set(progress.fightsBackAcknowledged.map((a) => String(a.fightsBackEventId)));
  for (const trig of triggers) {
    if (acked.has(String(trig._id))) continue;
    const target = progress.unlockedEvidence.find((u) => String(u.evidenceId) === String(trig.invalidatedEvidenceId));
    if (target && !target.invalidatedAt) target.invalidatedAt = new Date();
  }
  return true;
}

/** Bina-QR wale evidence jinke prerequisites pure ho gaye, apne aap unlock. */
async function autoUnlockReachable(progress) {
  const candidates = await EvidenceNode.find({ caseId: progress.caseId, requiresQR: false });
  let changed = false;
  let progressed = true;
  while (progressed) {
    progressed = false;
    for (const ev of candidates) {
      if (unlockedIdSet(progress).has(String(ev._id)) || !isEvidenceReachable(ev, progress)) continue;
      // eslint-disable-next-line no-await-in-loop
      await addUnlockedEvidence(progress, ev, ev.unlockedByBranchId ? UNLOCK_SOURCE.BRANCH : UNLOCK_SOURCE.AUTO);
      progressed = true;
      changed = true;
    }
  }
  return changed;
}

async function syncProgress(team, event, progress) {
  if (progress.status !== PROGRESS_STATUS.ACTIVE || !isPlayable(team, event)) return progress;
  if (await autoUnlockReachable(progress)) await progress.save();
  return progress;
}

/** Player ko jo dikhna chahiye — ground truth (reliability, connections, canonicalOrder) kabhi nahi. */
async function buildPlayerState(team, event, progress) {
  const [mysteryCase, evidence, branches, submission] = await Promise.all([
    MysteryCase.findById(team.caseId).select(CASE_PLAYER_FIELDS).lean(),
    EvidenceNode.find({ caseId: team.caseId }),
    InvestigationBranch.find({ caseId: team.caseId }).sort({ order: 1 }).lean(),
    FinalSubmission.findOne({ teamId: team._id }).select('submittedAt graded scoreBreakdown').lean(),
  ]);

  const evidenceById = new Map(evidence.map((e) => [String(e._id), e]));
  const unlocked = unlockedIdSet(progress);
  const chosenBranchIds = new Set(progress.branchChoices.map((c) => String(c.branchId)));

  const unlockedEvidence = progress.unlockedEvidence
    .map((u) => {
      const ev = evidenceById.get(String(u.evidenceId));
      if (!ev) return null;
      return { ...sanitizeEvidence(ev), source: u.source, unlockedAt: u.unlockedAt, invalidated: !!u.invalidatedAt };
    })
    .filter(Boolean);

  const scannable = evidence
    .filter((e) => e.requiresQR && !unlocked.has(String(e._id)) && isEvidenceReachable(e, progress))
    .map((e) => ({ code: e.code, world: e.world }));

  const pending = branches.find((b) => !chosenBranchIds.has(String(b._id)));
  const canPlay = progress.status === PROGRESS_STATUS.ACTIVE && isPlayable(team, event);
  const activeCount = unlockedEvidence.filter((e) => !e.invalidated).length;

  return {
    team: { _id: team._id, teamName: team.teamName, teamCode: team.teamCode, mode: team.mode, eventId: team.eventId },
    event: event ? { _id: event._id, title: event.title || event.name, status: event.status } : null,
    case: mysteryCase,
    status: progress.status,
    totalScore: progress.totalScore,
    startedAt: progress.startedAt,
    finishedAt: progress.finishedAt,
    canPlay,
    canSubmitFinal: canPlay && activeCount > 0 && !submission,
    unlockedEvidence,
    availableToUnlock: scannable,
    lockedEvidenceCount: evidence.length - unlocked.size,
    pendingBranch: pending ? { _id: pending._id, order: pending.order, prompt: pending.prompt, leads: pending.leads } : null,
    branchChoices: progress.branchChoices.map((c) => ({ branchId: c.branchId, leadId: c.chosenLeadId })),
    trustDecisions: progress.trustDecisions.map((t) => ({ evidenceId: t.evidenceId, trusted: t.trusted })),
    connectionsMade: progress.connectionsMade.map((c) => ({ evidenceIdA: c.evidenceIdA, evidenceIdB: c.evidenceIdB })),
    submission: submission || null,
  };
}

module.exports = {
  ensureProgress,
  unlockedIdSet,
  isEvidenceReachable,
  addUnlockedEvidence,
  autoUnlockReachable,
  syncProgress,
  buildPlayerState,
};
