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
    type: String, // display label e.g. "₹300"
  },

  feeAmount: {
    type: Number,
    default: 0, // numeric INR amount for online payment; 0 = free
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
      enum: ['EXTERNAL_LINK', 'INTERNAL_FORM', 'NOT_STARTED', 'CLOSED'],
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
    whatsappCommunityLink: {
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
            'tel',
            'phone',
            'textarea',
            'select',
            'radio',
            'checkbox',
            'date',
            'file',
            'image',
            'url',
            'password',
            'group', // ✅ NEW: Field group type for multiple sub-fields
            'category_competition_selector' // ✅ NEW: Cascading category → competition selector
          ]
        },
        required: Boolean,
        options: [String], // for select, radio, checkbox
        placeholder: String,
        // ✅ NEW: Category options for category_competition_selector type
        categoryOptions: [
          {
            categoryName: String,
            competitions: [String]
          }
        ],
        // ✅ NEW: Sub-fields for group type
        subFields: [
          {
            id: String,
            label: String,
            fieldName: String,
            type: {
              type: String,
              enum: ['text', 'email', 'number', 'tel', 'phone', 'select', 'competition_dropdown']
            },
            required: Boolean,
            placeholder: String,
            options: [String]
          }
        ]
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
                'tel',
                'phone',
                'textarea',
                'select',
                'radio',
                'checkbox',
                'date',
                'file',
                'image',
                'url',
                'password',
                'group', // ✅ NEW: Field group type for multiple sub-fields
                'category_competition_selector' // ✅ NEW: Cascading category → competition selector
              ]
            },
            required: Boolean,
            options: [String], // for select, radio, checkbox
            placeholder: String,
            // ✅ NEW: Category options for category_competition_selector type
            categoryOptions: [
              {
                categoryName: String,
                competitions: [String]
              }
            ],
            // ✅ NEW: Sub-fields for group type
            subFields: [
              {
                id: String,
                label: String,
                fieldName: String,
                type: {
                  type: String,
                  enum: ['text', 'email', 'number', 'tel', 'phone', 'select', 'competition_dropdown']
                },
                required: Boolean,
                placeholder: String,
                options: [String]
              }
            ]
          }
        ]
      }
    ]
  },

  showOnHomeSlide: { type: Boolean, default: false },
  homeSection:     { type: String, enum: ['trending', 'happening', 'slide'], default: null },
  homePriority:    { type: Number, default: 999, min: 1, max: 999 },

  status: {
    type: String,
    enum: ['ongoing', 'upcoming', 'completed', 'beyondcampus', 'lastyearhit'],
    default: 'upcoming',
  },

  priority: {
    type: Number,
    default: 999, // New fests appear last until admin sets priority
    min: 1,
    max: 999
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

  /** Volunteer / university scanner login — fest code + password → scan-only access */
  scannerAccess: {
    enabled: { type: Boolean, default: false },
    code: { type: String, trim: true, uppercase: true },
    passwordHash: { type: String, default: '' },
    // Admin-retrievable copy so the credential can be re-shared with volunteers
    password: { type: String, default: '' },
    label: { type: String, default: '', trim: true },
  },
},
{ timestamps: true }
);

festOrganizerSchema.index({ 'scannerAccess.code': 1 }, { unique: true, sparse: true });

festOrganizerSchema.index({ status: 1 });
festOrganizerSchema.index({ isApproved: 1, status: 1 });
festOrganizerSchema.index({ festType: 1, status: 1 });
festOrganizerSchema.index({ priority: 1 });

module.exports = mongoose.model('FestOrganizer', festOrganizerSchema);
