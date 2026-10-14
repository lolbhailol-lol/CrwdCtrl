const mongoose = require('mongoose');
const InterTeamExchange = require('../models/InterTeamExchange');
const TeamInvestigationProgress = require('../models/TeamInvestigationProgress');
const EvidenceNode = require('../models/EvidenceNode');
const MysteryTeam = require('../models/MysteryTeam');
const { EXCHANGE_STATUS, PROGRESS_STATUS, UNLOCK_SOURCE } = require('../constants');

// The session's team offers one of its unlocked evidence to another team
const offerExchange = async (req, res) => {
  try {
    const fromTeam = req.mysteryTeam;
    const { toTeamId, evidenceId, note } = req.body;
    if (!fromTeam.eventId) return res.status(400).json({ error: 'Your team must be linked to an event' });
    if (req.mysteryEvent?.allowInterTeamExchange === false) {
      return res.status(403).json({ error: 'Trading is disabled for this event' });
    }
    if (!mongoose.isValidObjectId(toTeamId) || !mongoose.isValidObjectId(evidenceId)) {
      return res.status(400).json({ error: 'toTeamId and evidenceId are required' });
    }
    if (String(toTeamId) === String(fromTeam._id)) return res.status(400).json({ error: 'You cannot trade with your own team' });

    const toTeam = await MysteryTeam.findOne({ _id: toTeamId, eventId: fromTeam.eventId });
    if (!toTeam) return res.status(404).json({ error: 'The target team is not in this event' });

    const progress = await TeamInvestigationProgress.findOne({ teamId: fromTeam._id });
    const owns = progress?.unlockedEvidence.some((u) => String(u.evidenceId) === String(evidenceId) && !u.invalidatedAt);
    if (!owns) return res.status(400).json({ error: 'You can only offer evidence your team has unlocked' });

    const duplicate = await InterTeamExchange.exists({
      fromTeamId: fromTeam._id, toTeamId, evidenceId, status: EXCHANGE_STATUS.OFFERED,
    });
    if (duplicate) return res.status(409).json({ error: 'This offer is already pending' });

    const exchange = await InterTeamExchange.create({
      caseId: fromTeam.caseId,
      eventId: fromTeam.eventId,
      fromTeamId: fromTeam._id,
      toTeamId,
      evidenceId,
      note: String(note || '').slice(0, 300),
    });
    return res.status(201).json(exchange);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to offer exchange', detail: err.message });
  }
};

// Only the receiving team can accept/decline
const respondToExchange = async (req, res) => {
  try {
    const { exchangeId } = req.params;
    if (!mongoose.isValidObjectId(exchangeId)) return res.status(400).json({ error: 'Invalid exchange id' });

    const exchange = await InterTeamExchange.findOne({ _id: exchangeId, toTeamId: req.mysteryTeam._id });
    if (!exchange) return res.status(404).json({ error: 'Exchange not found' });
    if (exchange.status !== EXCHANGE_STATUS.OFFERED) return res.status(409).json({ error: 'Exchange already resolved' });

    const accept = !!req.body.accept;
    if (accept) {
      const [evidence, progress] = await Promise.all([
        EvidenceNode.findOne({ _id: exchange.evidenceId, caseId: req.mysteryTeam.caseId }),
        TeamInvestigationProgress.findOne({ teamId: req.mysteryTeam._id }),
      ]);
      if (!progress || progress.status !== PROGRESS_STATUS.ACTIVE) {
        return res.status(409).json({ error: 'Start the investigation first' });
      }
      const already = progress.unlockedEvidence.some((u) => String(u.evidenceId) === String(exchange.evidenceId));
      if (evidence && !already) {
        progress.unlockedEvidence.push({ evidenceId: evidence._id, source: UNLOCK_SOURCE.TRADE });
        await progress.save();
      }
    }

    exchange.status = accept ? EXCHANGE_STATUS.ACCEPTED : EXCHANGE_STATUS.DECLINED;
    await exchange.save();
    return res.status(200).json(exchange);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to respond to exchange' });
  }
};

const listExchangesForTeam = async (req, res) => {
  try {
    const teamId = req.mysteryTeam._id;
    const exchanges = await InterTeamExchange.find({ $or: [{ fromTeamId: teamId }, { toTeamId: teamId }] }).sort({ createdAt: -1 });
    return res.status(200).json(exchanges);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch exchanges' });
  }
};

module.exports = { offerExchange, respondToExchange, listExchangesForTeam };
