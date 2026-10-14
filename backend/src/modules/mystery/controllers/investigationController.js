const mongoose = require('mongoose');
const EvidenceNode = require('../models/EvidenceNode');
const InvestigationBranch = require('../models/InvestigationBranch');
const FightsBackEvent = require('../models/FightsBackEvent');
const { sanitizeEvidence } = require('../services/evidenceService');
const {
  ensureProgress, unlockedIdSet, isEvidenceReachable, addUnlockedEvidence,
  autoUnlockReachable, syncProgress, buildPlayerState,
} = require('../services/playerStateService');
const { PROGRESS_STATUS, UNLOCK_SOURCE } = require('../constants');

async function loadActiveProgress(req, res) {
  const progress = await ensureProgress(req.mysteryTeam);
  if (progress.status !== PROGRESS_STATUS.ACTIVE) {
    res.status(409).json({ error: 'This case has already been submitted', code: 'CASE_FINISHED' });
    return null;
  }
  return progress;
}

async function respondWithState(req, res, progress, extra = {}, status = 200) {
  const state = await buildPlayerState(req.mysteryTeam, req.mysteryEvent, progress);
  return res.status(status).json({ ...state, ...extra });
}

// Start or resume the investigation — idempotent, returns the full player state
const startSession = async (req, res) => {
  try {
    const progress = await ensureProgress(req.mysteryTeam);
    await syncProgress(req.mysteryTeam, req.mysteryEvent, progress);
    return respondWithState(req, res, progress);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to start session', detail: err.message });
  }
};

const getState = startSession;

// Unlock evidence by scanning a QR code
const unlockViaQR = async (req, res) => {
  try {
    const qrSecret = String(req.body.qrSecret || '').trim();
    if (!qrSecret) return res.status(400).json({ error: 'qrSecret is required' });

    const progress = await loadActiveProgress(req, res);
    if (!progress) return undefined;

    const evidence = await EvidenceNode.findOne({ qrSecret, caseId: req.mysteryTeam.caseId });
    if (!evidence) return res.status(404).json({ error: 'Invalid QR code' });

    if (unlockedIdSet(progress).has(String(evidence._id))) {
      return respondWithState(req, res, progress, { alreadyUnlocked: true, lastUnlocked: sanitizeEvidence(evidence) });
    }
    if (!isEvidenceReachable(evidence, progress)) {
      return res.status(400).json({ error: 'This clue is still locked — follow the other leads first', code: 'EVIDENCE_LOCKED' });
    }

    await addUnlockedEvidence(progress, evidence, UNLOCK_SOURCE.QR);
    await autoUnlockReachable(progress);
    await progress.save();
    return respondWithState(req, res, progress, { lastUnlocked: sanitizeEvidence(evidence) });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to unlock evidence', detail: err.message });
  }
};

// Choose a lead (branch option) — unlocks the evidence behind it
const chooseBranch = async (req, res) => {
  try {
    const { branchId, leadId } = req.body;
    if (!mongoose.isValidObjectId(branchId) || !leadId) {
      return res.status(400).json({ error: 'branchId and leadId are required' });
    }

    const progress = await loadActiveProgress(req, res);
    if (!progress) return undefined;

    const branch = await InvestigationBranch.findOne({ _id: branchId, caseId: req.mysteryTeam.caseId });
    if (!branch) return res.status(404).json({ error: 'Branch not found' });
    if (!branch.leads.some((l) => l.id === leadId)) return res.status(404).json({ error: 'Invalid lead id' });
    if (progress.branchChoices.some((c) => String(c.branchId) === String(branchId))) {
      return res.status(409).json({ error: 'A lead has already been chosen for this decision' });
    }

    progress.branchChoices.push({ branchId, chosenLeadId: leadId });
    const leadEvidence = await EvidenceNode.find({
      caseId: req.mysteryTeam.caseId, unlockedByBranchId: branchId, unlockedByLeadId: leadId,
    });
    for (const ev of leadEvidence) {
      // eslint-disable-next-line no-await-in-loop
      if (isEvidenceReachable(ev, progress)) await addUnlockedEvidence(progress, ev, UNLOCK_SOURCE.BRANCH);
    }
    await autoUnlockReachable(progress);
    await progress.save();
    return respondWithState(req, res, progress);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to choose branch', detail: err.message });
  }
};

// Team records its trust decision on a piece of evidence (used as the default for final verdicts)
const setTrustDecision = async (req, res) => {
  try {
    const { evidenceId } = req.body;
    const trusted = req.body.trusted !== undefined ? !!req.body.trusted : req.body.decision === 'reliable';

    const progress = await loadActiveProgress(req, res);
    if (!progress) return undefined;
    if (!unlockedIdSet(progress).has(String(evidenceId))) {
      return res.status(400).json({ error: 'Unlock this evidence first' });
    }

    const existing = progress.trustDecisions.find((t) => String(t.evidenceId) === String(evidenceId));
    if (existing) {
      existing.trusted = trusted;
      existing.decidedAt = new Date();
    } else {
      progress.trustDecisions.push({ evidenceId, trusted });
    }
    await progress.save();
    return respondWithState(req, res, progress);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to save trust decision' });
  }
};

// Team marks two pieces of evidence as "connected"
const connectEvidence = async (req, res) => {
  try {
    const evidenceIdA = String(req.body.evidenceIdA || '');
    const evidenceIdB = String(req.body.evidenceIdB || '');
    if (!evidenceIdA || !evidenceIdB || evidenceIdA === evidenceIdB) {
      return res.status(400).json({ error: 'Two different evidence IDs are required' });
    }

    const progress = await loadActiveProgress(req, res);
    if (!progress) return undefined;
    const unlocked = unlockedIdSet(progress);
    if (!unlocked.has(evidenceIdA) || !unlocked.has(evidenceIdB)) {
      return res.status(400).json({ error: 'Both pieces of evidence must be unlocked first' });
    }

    const alreadyConnected = progress.connectionsMade.some(
      (c) => (String(c.evidenceIdA) === evidenceIdA && String(c.evidenceIdB) === evidenceIdB)
        || (String(c.evidenceIdA) === evidenceIdB && String(c.evidenceIdB) === evidenceIdA),
    );
    if (!alreadyConnected) {
      progress.connectionsMade.push({ evidenceIdA, evidenceIdB });
      await progress.save();
    }
    return respondWithState(req, res, progress);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to save connection' });
  }
};

// Team acknowledges a "Mystery Fights Back" update after seeing it
const acknowledgeFightsBack = async (req, res) => {
  try {
    const fightsBackEventId = String(req.body.fightsBackEventId || '');
    if (!mongoose.isValidObjectId(fightsBackEventId)) {
      return res.status(400).json({ error: 'fightsBackEventId is required' });
    }

    const progress = await ensureProgress(req.mysteryTeam);
    const already = progress.fightsBackAcknowledged.some((a) => String(a.fightsBackEventId) === fightsBackEventId);
    if (!already) {
      progress.fightsBackAcknowledged.push({ fightsBackEventId });
      await progress.save();
    }
    return respondWithState(req, res, progress);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to acknowledge' });
  }
};

// Only twists that actually invalidated one of this team's evidence and are not yet acknowledged
const getPendingFightsBack = async (req, res) => {
  try {
    const progress = await ensureProgress(req.mysteryTeam);
    const invalidated = new Set(
      progress.unlockedEvidence.filter((u) => u.invalidatedAt).map((u) => String(u.evidenceId)),
    );
    const acked = new Set(progress.fightsBackAcknowledged.map((a) => String(a.fightsBackEventId)));
    const triggers = await FightsBackEvent.find({ caseId: progress.caseId });
    const pending = triggers.filter((t) => !acked.has(String(t._id)) && invalidated.has(String(t.invalidatedEvidenceId)));

    return res.status(200).json(pending.map((t) => ({
      _id: t._id, systemMessage: t.systemMessage, invalidatedEvidenceId: t.invalidatedEvidenceId,
    })));
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch fights-back updates' });
  }
};

module.exports = {
  startSession, getState, unlockViaQR, chooseBranch,
  setTrustDecision, connectEvidence, acknowledgeFightsBack, getPendingFightsBack,
};
