const InterTeamExchange = require('../models/InterTeamExchange');
const TeamInvestigationProgress = require('../models/TeamInvestigationProgress');
const EvidenceNode = require('../models/EvidenceNode');
const MysteryTeam = require('../models/MysteryTeam');
const { sanitizeEvidence } = require('../services/evidenceService');

// Ek team doosri team ko evidence offer karti hai
const offerExchange = async (req, res) => {
  try {
    const { fromTeamId, toTeamId, evidenceId, note } = req.body;
    const fromTeam = await MysteryTeam.findById(fromTeamId);
    if (!fromTeam || !fromTeam.eventId) return res.status(400).json({ error: 'Valid event-linked team chahiye' });

    const exchange = await InterTeamExchange.create({
      caseId: fromTeam.caseId, eventId: fromTeam.eventId,
      fromTeamId, toTeamId, evidenceId, note: note || '',
    });
    res.status(201).json(exchange);
  } catch (err) {
    res.status(500).json({ error: 'Failed to offer exchange', detail: err.message });
  }
};

// Receiving team accept/decline karti hai
const respondToExchange = async (req, res) => {
  try {
    const { exchangeId } = req.params;
    const { accept } = req.body;

    const exchange = await InterTeamExchange.findById(exchangeId);
    if (!exchange) return res.status(404).json({ error: 'Exchange not found' });

    exchange.status = accept ? 'accepted' : 'declined';
    await exchange.save();

    if (accept) {
      const evidence = await EvidenceNode.findById(exchange.evidenceId);
      const progress = await TeamInvestigationProgress.findOne({ teamId: exchange.toTeamId });
      if (progress && evidence) {
        const already = progress.unlockedEvidence.some((u) => String(u.evidenceId) === String(evidence._id));
        if (!already) {
          progress.unlockedEvidence.push({ evidenceId: evidence._id, source: 'trade' });
          await progress.save();
        }
      }
    }

    res.status(200).json(exchange);
  } catch (err) {
    res.status(500).json({ error: 'Failed to respond to exchange' });
  }
};

const listExchangesForTeam = async (req, res) => {
  try {
    const { teamId } = req.params;
    const exchanges = await InterTeamExchange.find({ $or: [{ fromTeamId: teamId }, { toTeamId: teamId }] }).sort({ createdAt: -1 });
    res.status(200).json(exchanges);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch exchanges' });
  }
};

module.exports = { offerExchange, respondToExchange, listExchangesForTeam };