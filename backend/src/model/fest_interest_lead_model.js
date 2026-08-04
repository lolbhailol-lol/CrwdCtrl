const mongoose = require('mongoose');

const INTERESTS = ['volunteer', 'participate', 'both'];
const SOURCES = ['shubharam_stall', 'organizer_kiosk', 'other'];
const VOLUNTEER_TEAMS = [
    { id: 'competition', label: 'Competitions' },
    { id: 'pr', label: 'PR' },
    { id: 'sponsorship', label: 'Sponsorship' },
    { id: 'marathon', label: 'Marathon' },
];

/** Legacy stall picks still readable in leads/export */
const LEGACY_VOLUNTEER_TEAM_LABELS = {
    team: 'Core team',
    creatives: 'Creatives',
};

const festInterestLeadSchema = new mongoose.Schema(
    {
        fest: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FestOrganizer',
            required: true,
            index: true,
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
        year: {
            type: String,
            trim: true,
            default: '',
            maxlength: 40,
        },
        branch: {
            type: String,
            trim: true,
            default: '',
            maxlength: 80,
        },
        interest: {
            type: String,
            enum: INTERESTS,
            required: true,
        },
        /** Volunteer team picks: competition | pr | sponsorship | marathon */
        volunteerTeams: {
            type: [String],
            default: [],
        },
        /** Participate competition picks */
        competitions: [
            {
                id: { type: mongoose.Schema.Types.ObjectId, ref: 'Competition' },
                name: { type: String, trim: true, maxlength: 120 },
            },
        ],
        source: {
            type: String,
            enum: SOURCES,
            default: 'shubharam_stall',
        },
        note: {
            type: String,
            trim: true,
            default: '',
            maxlength: 500,
        },
        contacted: {
            type: Boolean,
            default: false,
            index: true,
        },
        contactedAt: {
            type: Date,
            default: null,
        },
        /** IST calendar day YYYY-MM-DD — unique with fest+phone for same-day upsert */
        dayKey: {
            type: String,
            trim: true,
            default: '',
            index: true,
        },
        capturedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FestOrganizerAccount',
            default: null,
        },
    },
    { timestamps: true },
);

festInterestLeadSchema.index({ fest: 1, createdAt: -1 });
festInterestLeadSchema.index({ fest: 1, phone: 1 });
festInterestLeadSchema.index(
    { fest: 1, phone: 1, dayKey: 1 },
    { unique: true, partialFilterExpression: { dayKey: { $gt: '' } } },
);

festInterestLeadSchema.statics.INTERESTS = INTERESTS;
festInterestLeadSchema.statics.SOURCES = SOURCES;
festInterestLeadSchema.statics.VOLUNTEER_TEAMS = VOLUNTEER_TEAMS;
festInterestLeadSchema.statics.VOLUNTEER_TEAM_IDS = VOLUNTEER_TEAMS.map((t) => t.id);
festInterestLeadSchema.statics.LEGACY_VOLUNTEER_TEAM_LABELS = LEGACY_VOLUNTEER_TEAM_LABELS;
festInterestLeadSchema.statics.volunteerTeamLabel = function volunteerTeamLabel(id) {
    const key = String(id || '').toLowerCase();
    return (
        VOLUNTEER_TEAMS.find((t) => t.id === key)?.label
        || LEGACY_VOLUNTEER_TEAM_LABELS[key]
        || key
    );
};

festInterestLeadSchema.statics.normalizePhone = function normalizePhone(raw) {
    return String(raw || '').replace(/\D/g, '').slice(-12);
};

module.exports = mongoose.model('FestInterestLead', festInterestLeadSchema);
