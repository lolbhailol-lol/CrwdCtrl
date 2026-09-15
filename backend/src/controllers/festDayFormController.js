const Competition = require('../model/competition_model');
const FestDayFormSession = require('../model/fest_day_form_session_model');
const { isMindSparkFestId } = require('../modules/fest/plugins/mindspark');

exports.startFestDayForm = async (req, res) => {
  try {
    const festId = String(req.params.festId || '');
    const competitionId = String(req.body.competitionId || '');
    if (!isMindSparkFestId(festId)) return res.status(404).json({ success: false });
    const competition = await Competition.findOne({ _id: competitionId, fest: festId }).select('_id').lean();
    if (!competition) return res.status(404).json({ success: false, message: 'Competition not found' });
    await FestDayFormSession.findOneAndUpdate(
      { fest: festId, competition: competitionId, user: req.user.userId },
      { $set: { expiresAt: new Date(Date.now() + (2 * 60 * 60 * 1000)) } },
      { upsert: true, new: true },
    );
    return res.json({ success: true });
  } catch (error) {
    console.error('[festDayForm.start]', error);
    return res.status(500).json({ success: false });
  }
};
