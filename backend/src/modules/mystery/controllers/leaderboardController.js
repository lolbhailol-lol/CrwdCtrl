const TeamInvestigationProgress = require('../models/TeamInvestigationProgress');
const MysteryTeam = require('../models/MysteryTeam');

const getEventLeaderboard = async (req, res) => {
  try {
    const { eventId } = req.params;
    const teams = await MysteryTeam.find({ eventId, mode: 'competitive' }).select('_id teamName');
    const teamIds = teams.map((t) => t._id);

    const progressList = await TeamInvestigationProgress.find({ teamId: { $in: teamIds } }).sort({ totalScore: -1, finishedAt: 1 });

    const leaderboard = progressList.map((p, idx) => {
      const team = teams.find((t) => String(t._id) === String(p.teamId));
      return { rank: idx + 1, teamName: team?.teamName, totalScore: p.totalScore, status: p.status, finishedAt: p.finishedAt };
    });
    res.status(200).json(leaderboard);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
};

const getCaseLeaderboard = async (req, res) => {
  try {
    const { caseId } = req.params;
    const progressList = await TeamInvestigationProgress.find({ caseId, status: 'finished' })
      .sort({ totalScore: -1, finishedAt: 1 })
      .limit(50)
      .populate({ path: 'teamId', select: 'teamName mode' });

    const leaderboard = progressList.map((p, idx) => ({
      rank: idx + 1, teamName: p.teamId?.teamName, mode: p.teamId?.mode,
      totalScore: p.totalScore, timeTakenMs: p.finishedAt ? p.finishedAt - p.startedAt : null,
    }));
    res.status(200).json(leaderboard);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch case leaderboard' });
  }
};

module.exports = { getEventLeaderboard, getCaseLeaderboard };