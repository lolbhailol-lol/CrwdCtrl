const mongoose = require('mongoose');
const { EXCHANGE_STATUS } = require('../constants');

// "Teams may exchange information" — final-stage strategic layer
const interTeamExchangeSchema = new mongoose.Schema(
  {
    caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'MysteryCase', required: true },
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'MysteryEvent', required: true },

    fromTeamId: { type: mongoose.Schema.Types.ObjectId, ref: 'MysteryTeam', required: true },
    toTeamId: { type: mongoose.Schema.Types.ObjectId, ref: 'MysteryTeam', required: true },

    evidenceId: { type: mongoose.Schema.Types.ObjectId, ref: 'EvidenceNode', required: true },
    note: { type: String, default: '' },

    status: { type: String, enum: Object.values(EXCHANGE_STATUS), default: EXCHANGE_STATUS.OFFERED },
  },
  { timestamps: true },
);

module.exports = mongoose.models.InterTeamExchange || mongoose.model('InterTeamExchange', interTeamExchangeSchema);