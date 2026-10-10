const MysteryTeam = require('../models/MysteryTeam');
const TeamInvestigationProgress = require('../models/TeamInvestigationProgress');
const EvidenceNode = require('../models/EvidenceNode');
const InvestigationBranch = require('../models/InvestigationBranch');
const FightsBackEvent = require('../models/FightsBackEvent');
const { sanitizeEvidence, getUnlockableEvidence } = require('../services/evidenceService');

// Investigation shuru karo — initial unlockable evidence + available branches return karega
const startSession = async (req, res) => {
  try {
    const { teamId } = req.params;
    const team = await MysteryTeam.findById(teamId);
    if (!team) return res.status(404).json({ error: 'Team not found' });

    let progress = await TeamInvestigationProgress.findOne({ teamId });
    if (!progress) {
      progress = await TeamInvestigationProgress.create({ teamId, caseId: team.caseId, eventId: team.eventId });
    }

    const unlockedIds = progress.unlockedEvidence.map((u) => u.evidenceId);
    const unlockable = await getUnlockableEvidence(team.caseId, unlockedIds);
    const branches = await InvestigationBranch.find({ caseId: team.caseId }).sort({ order: 1 });

    res.status(200).json({
      progress,
      availableEvidence: unlockable.map(sanitizeEvidence),
      branches: branches.map((b) => ({ _id: b._id, order: b.order, prompt: b.prompt, leads: b.leads })),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to start session', detail: err.message });
  }
};

// Current state wapas do (refresh/resume ke liye)
const getState = async (req, res) => {
  try {
    const { teamId } = req.params;
    const progress = await TeamInvestigationProgress.findOne({ teamId });
    if (!progress) return res.status(404).json({ error: 'Session not started yet' });

    const team = await MysteryTeam.findById(teamId);
    const unlockedIds = progress.unlockedEvidence.filter((u) => !u.invalidatedAt).map((u) => u.evidenceId);
    const unlockedEvidenceDocs = await EvidenceNode.find({ _id: { $in: unlockedIds } });
    const unlockable = await getUnlockableEvidence(team.caseId, unlockedIds);

    res.status(200).json({
      progress,
      unlockedEvidence: unlockedEvidenceDocs.map(sanitizeEvidence),
      availableToUnlock: unlockable.map(sanitizeEvidence),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch state' });
  }
};

// QR scan karke evidence unlock karo
const unlockViaQR = async (req, res) => {
  try {
    const { teamId } = req.params;
    const { qrSecret } = req.body;

    const evidence = await EvidenceNode.findOne({ qrSecret });
    if (!evidence) return res.status(404).json({ error: 'Invalid QR code' });

    await unlockEvidenceForTeam(teamId, evidence, 'qr');
    res.status(200).json({ unlocked: true, evidence: sanitizeEvidence(evidence) });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to unlock evidence' });
  }
};

// Ek lead (branch-option) choose karo — uske peeche ka evidence unlock hoga
const chooseBranch = async (req, res) => {
  try {
    const { teamId } = req.params;
    const { branchId, leadId } = req.body;

    const branch = await InvestigationBranch.findById(branchId);
    if (!branch) return res.status(404).json({ error: 'Branch not found' });
    const lead = branch.leads.find((l) => l.id === leadId);
    if (!lead) return res.status(404).json({ error: 'Invalid lead id' });

    const progress = await TeamInvestigationProgress.findOne({ teamId });
    if (!progress) return res.status(404).json({ error: 'Session not found' });

    progress.branchChoices.push({ branchId, chosenLeadId: leadId });
    await progress.save();

    const unlockedEvidence = await EvidenceNode.find({ unlockedByBranchId: branchId, unlockedByLeadId: leadId });
    for (const ev of unlockedEvidence) {
      await unlockEvidenceForTeam(teamId, ev, 'branch');
    }

    res.status(200).json({ unlockedEvidence: unlockedEvidence.map(sanitizeEvidence) });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to choose branch' });
  }
};

// Shared helper — evidence unlock karo + "Mystery Fights Back" trigger check karo
async function unlockEvidenceForTeam(teamId, evidence, source) {
  const progress = await TeamInvestigationProgress.findOne({ teamId });
  if (!progress) throw new Error('Session not found');

  const already = progress.unlockedEvidence.some((u) => String(u.evidenceId) === String(evidence._id));
  if (already) return progress;

  progress.unlockedEvidence.push({ evidenceId: evidence._id, source });
  progress.totalScore += evidence.points;
  await progress.save();

  // Fights-back check: kitna evidence unlock hua hai ab, kya koi trigger-threshold cross hua?
  const activeCount = progress.unlockedEvidence.filter((u) => !u.invalidatedAt).length;
  const pendingTriggers = await FightsBackEvent.find({
    caseId: progress.caseId,
    triggerAfterEvidenceCount: { $lte: activeCount },
  });
  for (const trig of pendingTriggers) {
    const alreadyAck = progress.fightsBackAcknowledged.some((a) => String(a.fightsBackEventId) === String(trig._id));
    if (alreadyAck) continue;
    const target = progress.unlockedEvidence.find((u) => String(u.evidenceId) === String(trig.invalidatedEvidenceId));
    if (target && !target.invalidatedAt) target.invalidatedAt = new Date();
  }
  await progress.save();
  return progress;
}

// Team apni khud ki trust-decision batati hai ek evidence ke upar (final-score me nahi, sirf UI-tracking ke liye)
const setTrustDecision = async (req, res) => {
  try {
    const { teamId } = req.params;
    const { evidenceId, trusted } = req.body;

    const progress = await TeamInvestigationProgress.findOne({ teamId });
    if (!progress) return res.status(404).json({ error: 'Session not found' });

    const existing = progress.trustDecisions.find((t) => String(t.evidenceId) === String(evidenceId));
    if (existing) existing.trusted = trusted;
    else progress.trustDecisions.push({ evidenceId, trusted });

    await progress.save();
    res.status(200).json({ message: 'Trust decision saved', progress });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save trust decision' });
  }
};

// Team 2 evidence ko "connected" mark karti hai
const connectEvidence = async (req, res) => {
  try {
    const { teamId } = req.params;
    const { evidenceIdA, evidenceIdB } = req.body;
    if (!evidenceIdA || !evidenceIdB) return res.status(400).json({ error: 'Dono evidence IDs chahiye' });

    const progress = await TeamInvestigationProgress.findOne({ teamId });
    if (!progress) return res.status(404).json({ error: 'Session not found' });

    const alreadyConnected = progress.connectionsMade.some(
      (c) => (String(c.evidenceIdA) === evidenceIdA && String(c.evidenceIdB) === evidenceIdB)
        || (String(c.evidenceIdA) === evidenceIdB && String(c.evidenceIdB) === evidenceIdA),
    );
    if (alreadyConnected) return res.status(200).json({ message: 'Already connected', progress });

    progress.connectionsMade.push({ evidenceIdA, evidenceIdB });
    await progress.save();
    res.status(200).json({ message: 'Connection saved', progress });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save connection' });
  }
};

// Team "Mystery Fights Back" wala update dekh ke acknowledge karti hai
const acknowledgeFightsBack = async (req, res) => {
  try {
    const { teamId } = req.params;
    const { fightsBackEventId } = req.body;

    const progress = await TeamInvestigationProgress.findOne({ teamId });
    if (!progress) return res.status(404).json({ error: 'Session not found' });

    const already = progress.fightsBackAcknowledged.some((a) => String(a.fightsBackEventId) === fightsBackEventId);
    if (!already) progress.fightsBackAcknowledged.push({ fightsBackEventId });
    await progress.save();

    res.status(200).json({ message: 'Acknowledged', progress });
  } catch (err) {
    res.status(500).json({ error: 'Failed to acknowledge' });
  }
};

// Pending fights-back updates check karo (poll karne ke liye frontend se)
const getPendingFightsBack = async (req, res) => {
  try {
    const { teamId } = req.params;
    const progress = await TeamInvestigationProgress.findOne({ teamId });
    if (!progress) return res.status(404).json({ error: 'Session not found' });

    const activeCount = progress.unlockedEvidence.filter((u) => !u.invalidatedAt || true).length;
    const triggers = await FightsBackEvent.find({ caseId: progress.caseId, triggerAfterEvidenceCount: { $lte: activeCount } });
    const ackIds = new Set(progress.fightsBackAcknowledged.map((a) => String(a.fightsBackEventId)));
    const pending = triggers.filter((t) => !ackIds.has(String(t._id)));

    res.status(200).json(pending.map((t) => ({ _id: t._id, systemMessage: t.systemMessage, invalidatedEvidenceId: t.invalidatedEvidenceId })));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch fights-back updates' });
  }
};

module.exports = {
  startSession, getState, unlockViaQR, chooseBranch,
  setTrustDecision, connectEvidence, acknowledgeFightsBack, getPendingFightsBack,
};