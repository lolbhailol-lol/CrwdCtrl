const mongoose = require('mongoose');

const competitionSchema = new mongoose.Schema(
{
  fest: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FestOrganizer',
    required: true,
  },

  name: {
    type: String,
    required: true,
    trim: true,
  },

  subtitle: {
    type: String,
    trim: true,
  },

  competitionType: {
    type: String,
    enum: [
      'hackathon',
      'coding',
      'quiz',
      'debate',
      'design',
      'dance',
      'music',
      'sports',
      'art',
      'theater',
      'cultural',
      'informals',
      'business',
      'esports',
      'management',
      'media',
      'literary',
      'fashion',
      'finance',
      'marketing',
      'marathon',
      'technical',
      'photography',
      'girls',
      'boys',
      'mixed',
      'other',
    ],
    required: true,
  },

  category: {
    type: String,
    enum: [
      'DANCE',
      'MUSIC',
      'THEATRE',
      'ART',
      'SPORTS',
      'ACADEMIC',
      'GAMING',
      'QUIZ',
      'CULTURAL',
      'TECHNICAL',
      'PHOTOGRAPHY',
      'GIRLS',
      'BOYS',
      'MIXED',
      'OTHER',
    ],
    default: 'OTHER',
  },

  description: {
    type: String,
    required: true,
  },

  prizePool: {
    type: String, // keep string to allow "Worth ₹50,000"
  },

  dateTime: {
    type: String,
    required: true,
    // examples:
    // "12 Feb 2025, 10 AM"
    // "To Be Announced"
  },

  venue: {
    type: String,
  },

  coverImage: {
    type: String,
  },

  gallery: [String],

  commonRules: [String],
  
  commonRulesMessage: {
    type: String,
    trim: true,
  },

  rounds: [
    {
      roundNumber: Number,
      title: String,
      description: String,
      rules: [String],
      roundRulesMessage: {
        type: String,
        trim: true,
      },
      dateTime: String, // TBA allowed
      venue: String,
    },
  ],

  registrationFee: {
    type: String, // "Free" or "₹200" — display label
  },

  feeAmount: {
    type: Number,
    default: 0, // numeric INR amount for Razorpay; 0 means free
  },

  registrationLink: {
    type: String, // Google Form or external registration link
  },

  // New Registration System
  registrationType: {
    type: String,
    enum: ['fest', 'custom'],
    default: 'fest'
  },

  registration: {
    status: {
      type: String,
      enum: ['not_started', 'external_link', 'internal_form', 'registration_closed'],
      default: 'not_started'
    },
    externalUrl: {
      type: String,
      required: function() {
        return this.registrationType === 'custom' && this.registration?.status === 'external_link';
      }
    },
    whatsappGroupLink: {
      type: String,
      default: ''
    },
    formType: {
      type: String,
      enum: ['SINGLE_STEP', 'MULTI_STEP'],
      default: 'SINGLE_STEP'
    },
    formSchema: [{
      id: String,
      type: {
        type: String,
        enum: ['text', 'email', 'tel', 'textarea', 'select', 'radio', 'checkbox', 'file', 'date', 'time', 'number']
      },
      label: String,
      fieldName: String,
      placeholder: String,
      required: Boolean,
      options: [String], // For select, radio, checkbox
      validation: {
        min: Number,
        max: Number,
        pattern: String,
        message: String
      }
    }],
    steps: [{
      stepNumber: Number,
      stepTitle: String,
      stepDescription: String,
      fields: [{
        id: String,
        type: {
          type: String,
          enum: ['text', 'email', 'tel', 'textarea', 'select', 'radio', 'checkbox', 'file', 'date', 'time', 'number']
        },
        label: String,
        fieldName: String,
        placeholder: String,
        required: Boolean,
        options: [String], // For select, radio, checkbox
        validation: {
          min: Number,
          max: Number,
          pattern: String,
          message: String
        }
      }]
    }],
    googleSheetsUrl: {
      type: String,
      required: function() {
        return this.registrationType === 'custom' && this.registration?.status === 'internal_form';
      }
    },
    qrCode: {
      type: String, // URL to QR code image
    },
    qrCodeMessage: {
      type: String, // Message to display with QR code
      trim: true,
    },
    confirmationEmail: {
      type: String, // Email address for sending confirmation emails
      trim: true,
    },
    settings: {
      allowMultipleRegistrations: { type: Boolean, default: true },
      requireEmailVerification: { type: Boolean, default: false },
      autoConfirmation: { type: Boolean, default: true },
      maxRegistrations: { type: Number, default: null },
      registrationDeadline: { type: Date, default: null }
    }
  },

  // Legacy fields for backward compatibility
  legacyRegistration: {
    status: {
      type: String,
      enum: ['NOT_STARTED', 'STARTED', 'CLOSED'],
      default: 'NOT_STARTED'
    }
  },

  registrationFields: [
    {
      fieldName: String,
      fieldType: {
        type: String,
        enum: ['text', 'email', 'tel', 'number', 'textarea', 'select'],
      },
      label: String,
      placeholder: String,
      required: Boolean,
      options: [String],
    },
  ],

  contact: {
    name: String,
    email: String,
    phone: String,
    instagram: String,
  },

  isApproved: {
    type: Boolean,
    default: true,
  },
},
{ timestamps: true }
);

competitionSchema.index({ fest: 1 });
competitionSchema.index({ status: 1 });

module.exports = mongoose.model('Competition', competitionSchema);
