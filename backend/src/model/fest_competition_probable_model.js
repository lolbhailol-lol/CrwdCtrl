const mongoose = require('mongoose');

const STATUSES = ['probable', 'converted', 'dropped'];

const festCompetitionProbableSchema = new mongoose.Schema(
    {
        fest: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FestOrganizer',
            required: true,
            index: true,
        },
        competition: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Competition',
            required: true,
            index: true,
        },
        competitionName: {
            type: String,
            trim: true,
            default: '',
            maxlength: 160,
        },
        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 120,
        },
        phone: {
            type: String,
            required: true,
            trim: true,
            maxlength: 20,
        },
        note: {
            type: String,
            trim: true,
            default: '',
            maxlength: 500,
        },
        status: {
            type: String,
            enum: STATUSES,
            default: 'probable',
            index: true,
        },
        convertedRegistrationId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Registration',
            default: null,
        },
        contacted: {
            type: Boolean,
            default: false,
        },
        createdByOrganizer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FestOrganizerAccount',
            default: null,
        },
    },
    { timestamps: true },
);

festCompetitionProbableSchema.index({ fest: 1, competition: 1, createdAt: -1 });
festCompetitionProbableSchema.index({ fest: 1, phone: 1, competition: 1 });

module.exports = mongoose.models.FestCompetitionProbable
    || mongoose.model('FestCompetitionProbable', festCompetitionProbableSchema);
module.exports.STATUSES = STATUSES;
