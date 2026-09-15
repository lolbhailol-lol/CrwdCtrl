const mongoose = require('mongoose');
const { ISSUE_CATEGORIES } = require('../constants');

const campusHuntIssueReportSchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CampusHuntEvent',
      required: true,
      index: true,
    },
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CampusHuntTeam',
    },
    checkpointId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CampusHuntCheckpoint',
    },
    category: {
      type: String,
      enum: ISSUE_CATEGORIES,
      required: true,
    },
    notes: { type: String, default: '' },
    volunteerId: { type: String },
    volunteerLabel: { type: String },
    status: {
      type: String,
      enum: ['open', 'acknowledged', 'resolved'],
      default: 'open',
      index: true,
    },
    resolvedAt: { type: Date },
    resolvedBy: { type: String },
  },
  { timestamps: true },
);

campusHuntIssueReportSchema.index({ eventId: 1, createdAt: -1 });

module.exports = mongoose.models.CampusHuntIssueReport
  || mongoose.model('CampusHuntIssueReport', campusHuntIssueReportSchema);
