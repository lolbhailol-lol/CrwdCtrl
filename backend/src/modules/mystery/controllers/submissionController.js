const FinalSubmission = require('../models/FinalSubmission');
const TeamInvestigationProgress = require('../models/TeamInvestigationProgress');
const EvidenceNode = require('../models/EvidenceNode');
const MysteryCase = require('../models/MysteryCase');
const { scoreConnections, scoreTimeline, scoreVerdicts, scoreConfidenceBonus } = require('../services/scoringService');

// Final case submit karo — timeline + verdicts + theory + confidence
const submitFinalCase = async (req, res) => {
  try {
    const { teamId } = req.params;
    const { reconstructedTimeline, evidenceVerdicts, identityTheory, fullExplanation, confidenceLevel } = req.body;

    if (!identityTheory || !fullExplanation) {
      return res.status(400).json({ error: 'identityTheory aur fullExplanation required hain' });
    }

    const existing = await FinalSubmission.findOne({ teamId });
    if (existing) return res.status(400).json({ error: 'Is team ne already submit kar diya hai' });

    const progress = await TeamInvestigationProgress.findOne({ teamId });
    if (!progress) return res.status(404).json({ error: 'Investigation session not found' });

    const evidenceList = await EvidenceNode.find({ caseId: progress.caseId });
    const evidenceMap = new Map(evidenceList.map((e) => [String(e._id), e]));

    const missionPoints = progress.totalScore;
    const connectionPoints = await scoreConnections(progress.caseId, progress.connectionsMade);
    const timelinePoints = scoreTimeline(reconstructedTimeline || [], evidenceMap);
    const verdictPoints = scoreVerdicts(evidenceVerdicts || [], evidenceMap);

    // Theory-accuracy abhi admin manually grade karega (text-based theory automated judge nahi ho sakti)
    const total = missionPoints + connectionPoints + timelinePoints + verdictPoints;

    const submission = await FinalSubmission.create({
      teamId, caseId: progress.caseId,
      reconstructedTimeline: reconstructedTimeline || [],
      evidenceVerdicts: evidenceVerdicts || [],
      identityTheory, fullExplanation, confidenceLevel: confidenceLevel ?? 50,
      scoreBreakdown: { missionPoints, connectionPoints, timelinePoints, verdictPoints, theoryPoints: 0, confidenceBonus: 0, total },
    });

    progress.status = 'finished';
    progress.finishedAt = new Date();
    progress.totalScore = total;
    await progress.save();

    res.status(201).json(submission);
  } catch (err) {
    res.status(500).json({ error: 'Failed to submit final case', detail: err.message });
  }
};

// Admin: theory ko manually grade karta hai (sahi/galat + quality-based points)
const gradeTheory = async (req, res) => {
  try {
    const { teamId } = req.params;
    const { theoryCorrect, theoryPoints } = req.body; // admin decide karta hai kitne points (max suggest karo jaise 60)

    const submission = await FinalSubmission.findOne({ teamId });
    if (!submission) return res.status(404).json({ error: 'Submission not found' });

    const confidenceBonus = scoreConfidenceBonus(!!theoryCorrect, submission.confidenceLevel);

    submission.scoreBreakdown.theoryPoints = theoryPoints || 0;
    submission.scoreBreakdown.confidenceBonus = confidenceBonus;
    submission.scoreBreakdown.total = submission.scoreBreakdown.missionPoints
      + submission.scoreBreakdown.connectionPoints
      + submission.scoreBreakdown.timelinePoints
      + submission.scoreBreakdown.verdictPoints
      + submission.scoreBreakdown.theoryPoints
      + confidenceBonus;

    submission.graded = true;
    submission.gradedBy = req.user.userId;
    submission.gradedAt = new Date();
    await submission.save();

    const progress = await TeamInvestigationProgress.findOne({ teamId });
    if (progress) {
      progress.totalScore = submission.scoreBreakdown.total;
      await progress.save();
    }

    res.status(200).json(submission);
  } catch (err) {
    res.status(500).json({ error: 'Failed to grade theory', detail: err.message });
  }
};

module.exports = { submitFinalCase, gradeTheory };