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
    res.status(409).json({ error: 'Case already submit ho chuka hai', code: 'CASE_FINISHED' });
    return null;
  }
  return progress;
}

async function respondWithState(req, res, progress, extra = {}, status = 200) {
  const state = await buildPlayerState(req.mysteryTeam, req.mysteryEvent, progress);
  return res.status(status).json({ ...state, ...extra });
}

// Investigation shuru karo / resume karo — idempotent, poora player-state return karta hai
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

// QR scan karke evidence unlock karo
const unlockViaQR = async (req, res) => {
  try {
    const qrSecret = String(req.body.qrSecret || '').trim();
    if (!qrSecret) return res.status(400).json({ error: 'qrSecret required hai' });

    const progress = await loadActiveProgress(req, res);
    if (!progress) return undefined;

    const evidence = await EvidenceNode.findOne({ qrSecret, caseId: req.mysteryTeam.caseId });
    if (!evidence) return res.status(404).json({ error: 'Invalid QR code' });

    if (unlockedIdSet(progress).has(String(evidence._id))) {
      return respondWithState(req, res, progress, { alreadyUnlocked: true, lastUnlocked: sanitizeEvidence(evidence) });
    }
    if (!isEvidenceReachable(evidence, progress)) {
      return res.status(400).json({ error: 'Ye clue abhi locked hai — pehle baaki leads follow karo', code: 'EVIDENCE_LOCKED' });
    }

    await addUnlockedEvidence(progress, evidence, UNLOCK_SOURCE.QR);
    await autoUnlockReachable(progress);
    await progress.save();
    return respondWithState(req, res, progress, { lastUnlocked: sanitizeEvidence(evidence) });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to unlock evidence', detail: err.message });
  }
};

// Ek lead (branch-option) choose karo — uske peeche ka evidence unlock hoga
const chooseBranch = async (req, res) => {
  try {
    const { branchId, leadId } = req.body;
    if (!mongoose.isValidObjectId(branchId) || !leadId) {
      return res.status(400).json({ error: 'branchId aur leadId required hain' });
    }

    const progress = await loadActiveProgress(req, res);
    if (!progress) return undefined;

    const branch = await InvestigationBranch.findOne({ _id: branchId, caseId: req.mysteryTeam.caseId });
    if (!branch) return res.status(404).json({ error: 'Branch not found' });
    if (!branch.leads.some((l) => l.id === leadId)) return res.status(404).json({ error: 'Invalid lead id' });
    if (progress.branchChoices.some((c) => String(c.branchId) === String(branchId))) {
      return res.status(409).json({ error: 'Is decision pe lead already choose ho chuka hai' });
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

// Team apni trust-decision batati hai ek evidence ke upar (final verdicts ka default yahi banta hai)
const setTrustDecision = async (req, res) => {
  try {
    const { evidenceId } = req.body;
    const trusted = req.body.trusted !== undefined ? !!req.body.trusted : req.body.decision === 'reliable';

    const progress = await loadActiveProgress(req, res);
    if (!progress) return undefined;
    if (!unlockedIdSet(progress).has(String(evidenceId))) {
      return res.status(400).json({ error: 'Pehle ye evidence unlock karo' });
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

// Team 2 evidence ko "connected" mark karti hai
const connectEvidence = async (req, res) => {
  try {
    const evidenceIdA = String(req.body.evidenceIdA || '');
    const evidenceIdB = String(req.body.evidenceIdB || '');
    if (!evidenceIdA || !evidenceIdB || evidenceIdA === evidenceIdB) {
      return res.status(400).json({ error: 'Do alag evidence IDs chahiye' });
    }

    const progress = await loadActiveProgress(req, res);
    if (!progress) return undefined;
    const unlocked = unlockedIdSet(progress);
    if (!unlocked.has(evidenceIdA) || !unlocked.has(evidenceIdB)) {
      return res.status(400).json({ error: 'Dono evidence pehle unlock hone chahiye' });
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

// Team "Mystery Fights Back" wala update dekh ke acknowledge karti hai
const acknowledgeFightsBack = async (req, res) => {
  try {
    const fightsBackEventId = String(req.body.fightsBackEventId || '');
    if (!mongoose.isValidObjectId(fightsBackEventId)) {
      return res.status(400).json({ error: 'fightsBackEventId required hai' });
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

// Sirf wahi twists jinhone is team ka koi evidence sach me invalidate kiya aur abhi ack nahi hue
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
