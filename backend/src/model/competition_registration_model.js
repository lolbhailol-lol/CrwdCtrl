const mongoose = require('mongoose');

const competitionRegistrationSchema = new mongoose.Schema(
    {
        // Personal Information
        name: {
            type: String,
            required: true,
            trim: true,
        },
        instagramId: {
            type: String,
            required: true,
            trim: true,
        },
        contactNumber: {
            type: String,
            required: true,
            trim: true,
        },
        email: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
        },
        dateOfBirth: {
            type: Date,
            required: true,
        },
        city: {
            type: String,
            required: true,
            trim: true,
        },
        collegeName: {
            type: String,
            required: true,
            trim: true,
        },

        // Competition Information
        competitionName: {
            type: String,
            required: true,
            trim: true,
        },
        numberOfParticipants: {
            type: Number,
            min: 1,
            // This field is optional for solo competitions
        },

        // Payment Information
        paymentMode: {
            type: String,
            required: true,
            enum: ['PhonePe', 'GPay', 'Paytm'],
        },
        transactionId: {
            type: String,
            required: true,
            trim: true,
        },
        paymentScreenshot: {
            filename: {
                type: String,
                required: true,
            },
            originalName: {
                type: String,
                required: true,
            },
            mimetype: {
                type: String,
                required: true,
            },
            size: {
                type: Number,
                required: true,
            },
            // Store file path or cloud URL
            filePath: {
                type: String,
                required: true,
            }
        },

        // Registration Status and Metadata
        registrationId: {
            type: String,
            unique: true,
            required: true,
        },
        status: {
            type: String,
            enum: ['submitted', 'under_review', 'payment_verified', 'approved', 'rejected', 'waitlisted'],
            default: 'submitted',
        },
        submittedAt: {
            type: Date,
            default: Date.now,
        },
        reviewedAt: {
            type: Date,
        },
        reviewedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        reviewNotes: {
            type: String,
        },

        // Additional Information
        isEmailSent: {
            type: Boolean,
            default: false,
        },
        isConfirmationSent: {
            type: Boolean,
            default: false,
        },
        isPaymentVerified: {
            type: Boolean,
            default: false,
        },
        verificationNotes: {
            type: String,
        },

        // Linked authenticated user (security: trace submissions to accounts)
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },

        // Competition Reference (if you want to link to actual competition)
        competition: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Competition',
        },
    },
    {
        timestamps: true,
    }
);

// Indexes for query hot paths.
// The `indexes: [...]` schema option Mongoose historically had here is silently
// ignored — indexes must be declared via `schema.index(...)` calls.
competitionRegistrationSchema.index({ email: 1 });
competitionRegistrationSchema.index({ competitionName: 1 });
competitionRegistrationSchema.index({ status: 1 });
competitionRegistrationSchema.index({ submittedAt: -1 });
competitionRegistrationSchema.index({ competition: 1, status: 1 });
competitionRegistrationSchema.index({ user: 1, submittedAt: -1 });

// Pre-save middleware to generate registration ID if not provided
competitionRegistrationSchema.pre('save', function (next) {
    if (!this.registrationId) {
        // Generate unique registration ID
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        this.registrationId = `REG_${timestamp}_${random}`;
    }
    next();
});

// Instance method to update status
competitionRegistrationSchema.methods.updateStatus = function (newStatus, reviewNotes, reviewedBy) {
    this.status = newStatus;
    this.reviewedAt = new Date();
    this.reviewedBy = reviewedBy;
    if (reviewNotes) {
        this.reviewNotes = reviewNotes;
    }
    return this.save();
};

// Static method to get registrations by competition
competitionRegistrationSchema.statics.getByCompetition = function (competitionName, status = null) {
    const query = { competitionName };
    if (status) {
        query.status = status;
    }
    return this.find(query).sort({ submittedAt: -1 });
};

// Static method to get registration statistics
competitionRegistrationSchema.statics.getStats = function (competitionName = null) {
    const matchStage = competitionName ? { competitionName } : {};

    return this.aggregate([
        { $match: matchStage },
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 }
            }
        },
        {
            $group: {
                _id: null,
                total: { $sum: '$count' },
                statusCounts: {
                    $push: {
                        status: '$_id',
                        count: '$count'
                    }
                }
            }
        }
    ]);
};

module.exports = mongoose.model('CompetitionRegistration', competitionRegistrationSchema);