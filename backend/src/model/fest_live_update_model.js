const mongoose = require('mongoose');

const UPDATE_TYPES = [
    'happening_now',
    'schedule',
    'venue',
    'competition',
    'pro_show',
    'delay',
    'result',
    'food',
    'lost_found',
    'emergency',
    'general',
];

const UPDATE_STATUSES = ['draft', 'published', 'archived'];

const festLiveUpdateSchema = new mongoose.Schema(
    {
        fest: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FestOrganizer',
            required: true,
            index: true,
        },
        title: {
            type: String,
            required: true,
            trim: true,
            maxlength: 160,
        },
        body: {
            type: String,
            trim: true,
            maxlength: 2000,
            default: '',
        },
        type: {
            type: String,
            enum: UPDATE_TYPES,
            default: 'general',
            index: true,
        },
        status: {
            type: String,
            enum: UPDATE_STATUSES,
            default: 'draft',
            index: true,
        },
        /** Pin to top of the live feed */
        pinned: {
            type: Boolean,
            default: false,
            index: true,
        },
        /** Highlight as urgent (delays, emergencies) */
        urgent: {
            type: Boolean,
            default: false,
        },
        /** Where on campus / stage / room */
        locationLabel: {
            type: String,
            trim: true,
            maxlength: 160,
            default: '',
        },
        /** Optional map / directions URL */
        locationMapUrl: {
            type: String,
            trim: true,
            maxlength: 500,
            default: '',
        },
        /** When this is happening (fest day clock) */
        happensAt: {
            type: Date,
            default: null,
        },
        endsAt: {
            type: Date,
            default: null,
        },
        /** Optional link to a competition */
        competition: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Competition',
            default: null,
        },
        competitionName: {
            type: String,
            trim: true,
            default: '',
        },
        imageUrl: {
            type: String,
            trim: true,
            default: '',
        },
        tags: {
            type: [String],
            default: [],
        },
        /** Push in-app notify to approved participants when published */
        notifyOnPublish: {
            type: Boolean,
            default: false,
        },
        notifiedAt: {
            type: Date,
            default: null,
        },
        publishedAt: {
            type: Date,
            default: null,
        },
        createdByOrganizer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FestOrganizerAccount',
            default: null,
        },
        /** Soft sort override (higher = earlier when not pinned) */
        sortOrder: {
            type: Number,
            default: 0,
        },
    },
    { timestamps: true },
);

festLiveUpdateSchema.index({ fest: 1, status: 1, pinned: -1, publishedAt: -1 });
festLiveUpdateSchema.index({ fest: 1, type: 1, status: 1 });

festLiveUpdateSchema.statics.UPDATE_TYPES = UPDATE_TYPES;
festLiveUpdateSchema.statics.UPDATE_STATUSES = UPDATE_STATUSES;

module.exports = mongoose.models.FestLiveUpdate
    || mongoose.model('FestLiveUpdate', festLiveUpdateSchema);
