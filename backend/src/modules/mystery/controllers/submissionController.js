const mongoose = require('mongoose');
const FinalSubmission = require('../models/FinalSubmission');
const TeamInvestigationProgress = require('../models/TeamInvestigationProgress');
const EvidenceNode = require('../models/EvidenceNode');
const { scoreConnections, scoreTimeline, scoreVerdicts, scoreConfidenceBonus } = require('../services/scoringService');
const { ensureProgress, unlockedIdSet, buildPlayerState } = require('../services/playerStateService');
const { PROGRESS_STATUS } = require('../constants');

function clamp(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

/** Sirf unlocked evidence, har evidence ek hi baar — duplicate entries se points farm nahi honge. */
function uniqueUnlockedEntries(entries, unlocked) {
  const seen = new Set();
  return (Array.isArray(entries) ? entries : []).filter((entry) => {
    const id = String(entry?.evidenceId || '');
    if (!unlocked.has(id) || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

// Final case submit karo — timeline + verdicts + theory + confidence
const submitFinalCase = async (req, res) => {
  try {
    const team = req.mysteryTeam;
    const identityTheory = String(req.body.identityTheory || '').trim().slice(0, 500);
    const fullExplanation = String(req.body.fullExplanation || '').trim().slice(0, 5000);
    if (!identityTheory || !fullExplanation) {
      return res.status(400).json({ error: 'identityTheory aur fullExplanation required hain' });
    }

    const progress = await ensureProgress(team);
    if (progress.status !== PROGRESS_STATUS.ACTIVE || await FinalSubmission.exists({ teamId: team._id })) {
      return res.status(409).json({ error: 'Is team ne already submit kar diya hai' });
    }

    const unlocked = unlockedIdSet(progress);
    const verdictInput = Array.isArray(req.body.evidenceVerdicts) && req.body.evidenceVerdicts.length
      ? req.body.evidenceVerdicts
      : progress.trustDecisions.map((t) => ({ evidenceId: t.evidenceId, verdict: t.trusted ? 'reliable' : 'unreliable' }));
    const evidenceVerdicts = uniqueUnlockedEntries(verdictInput, unlocked)
      .map((v) => ({ evidenceId: v.evidenceId, verdict: v.verdict === 'reliable' ? 'reliable' : 'unreliable' }));
    const reconstructedTimeline = uniqueUnlockedEntries(req.body.reconstructedTimeline, unlocked)
      .map((t) => ({ evidenceId: t.evidenceId, timeLabel: String(t.timeLabel || ''), eventDescription: String(t.eventDescription || '') }));
    const confidenceLevel = clamp(req.body.confidenceLevel, 0, 100, 50);

    const evidenceList = await EvidenceNode.find({ caseId: progress.caseId });
    const evidenceMap = new Map(evidenceList.map((e) => [String(e._id), e]));

    const missionPoints = progress.totalScore;
    const connectionPoints = await scoreConnections(progress.caseId, progress.connectionsMade);
    const timelinePoints = scoreTimeline(reconstructedTimeline, evidenceMap);
    const verdictPoints = scoreVerdicts(evidenceVerdicts, evidenceMap);

    // Theory-accuracy admin manually grade karega (text-based theory automated judge nahi ho sakti)
    const total = missionPoints + connectionPoints + timelinePoints + verdictPoints;

    await FinalSubmission.create({
      teamId: team._id,
      caseId: progress.caseId,
      reconstructedTimeline,
      evidenceVerdicts,
      identityTheory,
      fullExplanation,
      confidenceLevel,
      scoreBreakdown: { missionPoints, connectionPoints, timelinePoints, verdictPoints, theoryPoints: 0, confidenceBonus: 0, total },
    });

    progress.status = PROGRESS_STATUS.FINISHED;
    progress.finishedAt = new Date();
    progress.totalScore = total;
    await progress.save();

    const state = await buildPlayerState(team, req.mysteryEvent, progress);
    return res.status(201).json(state);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Is team ne already submit kar diya hai' });
    return res.status(500).json({ error: 'Failed to submit final case', detail: err.message });
  }
};

// Admin: theory ko manually grade karta hai (sahi/galat + quality-based points)
const gradeTheory = async (req, res) => {
  try {
    const { teamId } = req.params;
    if (!mongoose.isValidObjectId(teamId)) return res.status(400).json({ error: 'Invalid team id' });

    const submission = await FinalSubmission.findOne({ teamId });
    if (!submission) return res.status(404).json({ error: 'Submission not found' });

    const theoryCorrect = !!req.body.theoryCorrect;
    const theoryPoints = clamp(req.body.theoryPoints, 0, 100, 0);
    const confidenceBonus = scoreConfidenceBonus(theoryCorrect, submission.confidenceLevel);

    submission.scoreBreakdown.theoryPoints = theoryPoints;
    submission.scoreBreakdown.confidenceBonus = confidenceBonus;
    submission.scoreBreakdown.total = submission.scoreBreakdown.missionPoints
      + submission.scoreBreakdown.connectionPoints
      + submission.scoreBreakdown.timelinePoints
      + submission.scoreBreakdown.verdictPoints
      + theoryPoints
      + confidenceBonus;

    const graderId = req.user?.userId || req.user?.id || req.user?._id;
    submission.graded = true;
    submission.gradedBy = mongoose.isValidObjectId(graderId) ? graderId : null;
    submission.gradedAt = new Date();
    await submission.save();

    await TeamInvestigationProgress.updateOne({ teamId }, { $set: { totalScore: submission.scoreBreakdown.total } });

    return res.status(200).json(submission);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to grade theory', detail: err.message });
  }
};

module.exports = { submitFinalCase, gradeTheory };
