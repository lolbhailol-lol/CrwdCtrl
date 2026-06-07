const mongoose = require('mongoose');

const trekSchema = new mongoose.Schema(
    {
        communityId: { type: mongoose.Schema.Types.ObjectId, ref: 'TrekCommunity', default: null },
        trekName: { type: String, required: true, trim: true },
        description: { type: String },
        difficultyLevel: {
            type: String,
            enum: ['easy', 'moderate', 'difficult', 'extreme'],
            required: true,
        },
        trekDuration: { type: String, trim: true },
        startingPoint: { type: String, trim: true },
        destination: { type: String, trim: true },
        meetingLocation: { type: String, trim: true },
        departureTime: { type: String, trim: true },
        returnTime: { type: String, trim: true },
        inclusions: { type: [String], default: [] },
        exclusions: { type: [String], default: [] },
        fitnessRequirements: { type: String, trim: true },
        ageRestrictions: { type: String, trim: true },
        trekLeader: { type: String, trim: true },
        emergencyContact: { type: String, trim: true },
        contactInstagram: { type: String, trim: true },
        termsAndConditions: { type: [String], default: [] },
        thingsToCarry: { type: [String], default: [] },
        itinerary: [
            {
                day: { type: Number },
                title: { type: String },
                description: { type: String },
            },
        ],
        coverImage: { type: String, default: null },
        images: { type: [String], default: [] },
        registrationFee: { type: Number, default: 0 },
        registrationLink: { type: String, trim: true },
        maxParticipants: { type: Number, default: 0 },
        trekDate: { type: Date },
        city: { type: String, trim: true },
        trekCategory: {
            type: String,
            enum: ['hiking', 'trail', 'backpacking', 'camping', 'adventure', 'nature'],
            default: null,
        },
        trekFilters: {
            duration: { type: [String], default: [] },
            difficulty: { type: [String], default: [] },
            budget: { type: [String], default: [] },
            experience: { type: [String], default: [] },
            timing: { type: [String], default: [] },
            terrain: { type: [String], default: [] },
            style: { type: [String], default: [] },
        },
        featuredSection: {
            type: String,
            enum: ['hero', 'weekend', 'both', 'beginner'],
            default: null,
        },
        homeSection:      { type: String, enum: ['trending', 'happening', 'slide'], default: null },

        registration: {
            googleSheetsUrl:   { type: String, default: '' },
            organizerEmail:    { type: String, default: '' },
            formInstructions:  { type: String, default: '' },
            availableDates:    { type: [String], default: [] },   // ["19 May 2025", "26 May 2025", …]
            timeSlots:         { type: [String], default: [] },   // ["6:00 AM", "8:30 AM", …]
            locationOptions:   { type: [String], default: [] },   // ["Rishikesh", "Manali", …] or leave empty for single location
            maxPeoplePerBooking: { type: Number, default: 10 },
            formSchema: [{
                id:          String,
                label:       String,
                fieldName:   String,
                type:        { type: String, enum: ['text','email','tel','number','textarea','select','file','date'], default: 'text' },
                required:    { type: Boolean, default: false },
                options:     [String],
                placeholder: String,
            }],
        },
        priority:         { type: Number, default: 999, min: 1, max: 999 },
        trekPagePriority: { type: Number, default: 999, min: 1, max: 999 },
        status: {
            type: String,
            enum: ['draft', 'published', 'completed', 'cancelled'],
            default: 'published',
        },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },
    { timestamps: true }
);

trekSchema.index({ difficultyLevel: 1 });
trekSchema.index({ status: 1 });
trekSchema.index({ trekDate: 1 });
trekSchema.index({ city: 1 });

module.exports = mongoose.models.Trek || mongoose.model('Trek', trekSchema);
