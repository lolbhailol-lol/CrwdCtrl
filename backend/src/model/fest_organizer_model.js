const mongoose = require('mongoose');
const festOrganizerSchema = new mongoose.Schema(
{
  organizer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false,
  },

  festName: {
    type: String,
    required: true,
    trim: true,
  },

  subtitle: {
    type: String,
    trim: true,
  },

  collegeName: {
    type: String,
    required: true,
    trim: true,
  },

  festType: {
    type: String,
    enum: ['cultural', 'technical', 'sports'],
    required: true,
  },

  festDate: {
    type: String,
    required: true, 
    // examples:
    // "12-14 Feb 2025"
    // "To Be Announced"
  },

  venue: {
    type: String,
    required: true,
  },

  ticketPrice: {
    type: String,
  },

  description: {
    type: String,
    required: true,
  },

  coverImage: {
    type: String,
  },

  galleryImages: [String],

  registrationLink: {
    type: String,
  },

  registration: {
    mode: {
      type: String,
      enum: ['EXTERNAL_LINK', 'INTERNAL_FORM', 'NOT_STARTED'],
      default: 'NOT_STARTED'
    },
    externalLink: {
      type: String,
      default: ''
    },
    paymentQR: {
      type: String,
      default: ''
    },
    paymentQRMessage: {
      type: String,
      default: ''
    },
    googleSheetsUrl: {
      type: String,
      default: ''
    },
    formInstructions: {
      type: String,
      default: ''
    },
    organizerEmail: {
      type: String,
      default: ''
    },
    // ✅ NEW: Form type configuration
    formType: {
      type: String,
      enum: ['SINGLE_STEP', 'MULTI_STEP'],
      default: 'SINGLE_STEP'
    },
    // ✅ EXISTING: Single step form schema (backward compatible)
    formSchema: [
      {
        id: String, // Unique field ID
        label: String,
        fieldName: String,
        type: {
          type: String,
          enum: [
            'text',
            'email',
            'number',
            'textarea',
            'select',
            'radio',
            'checkbox',
            'date',
            'file',
            'image'
          ]
        },
        required: Boolean,
        options: [String], // for select, radio, checkbox
        placeholder: String
      }
    ],
    // ✅ NEW: Multi-step form configuration
    steps: [
      {
        stepNumber: {
          type: Number,
          required: true
        },
        stepTitle: {
          type: String,
          required: true,
          trim: true
        },
        stepDescription: {
          type: String,
          trim: true,
          default: ''
        },
        fields: [
          {
            id: String, // Unique field ID
            label: String,
            fieldName: String,
            type: {
              type: String,
              enum: [
                'text',
                'email',
                'number',
                'textarea',
                'select',
                'radio',
                'checkbox',
                'date',
                'file',
                'image'
              ]
            },
            required: Boolean,
            options: [String], // for select, radio, checkbox
            placeholder: String
          }
        ]
      }
    ]
  },

  status: {
    type: String,
    enum: ['ongoing', 'upcoming', 'completed', 'beyondcampus'],
    default: 'upcoming',
  },

  artists: [
    {
      name: String,
      genre: String,
      image: String,
      collegeName: String,
      message: String,
    },
  ],

  artistsHeading: {
    type: String,
    default: "Artists You'll Love",
    trim: true,
  },

  contacts: [
    {
      name: String,
      phone: String,
      email: String,
      instagramId: String,
      role: String,
    },
  ],

  sponsors: [
    {
      name: String,
      logo: String,
    },
  ],

  competitions: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Competition',
    },
  ],

  competitionsHeading: {
    type: String,
    default: "Competitions",
    trim: true,
  },

  isApproved: {
    type: Boolean,
    default: true,
  },
},
{ timestamps: true }
);

module.exports = mongoose.model('FestOrganizer', festOrganizerSchema);
