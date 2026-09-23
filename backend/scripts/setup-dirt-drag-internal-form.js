/**
 * Switch Dirt Drag to CrwdCtrl internal multi-step form + Cashfree tiers
 * (₹10,000 per competition class — mirrors the organiser Google Form).
 * Run: node scripts/setup-dirt-drag-internal-form.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const EventShow = require('../src/model/event_show_model');

const EVENT_ID = '6a722ada2a151369a4a2ff03';
const INDEMNITY_URL =
  'https://drive.google.com/file/d/1mcArBOluOgVt43UZxBZEIfFGtUscGxZ3/view?usp=drivesdk';

const CLASSES = [
  { id: 'class_stock_suv_petrol_1600', name: '1. Stock SUV Petrol - Up to 1600 cc' },
  { id: 'class_stock_suv_petrol_3000', name: '2. Stock SUV Petrol - 1601-3000 cc' },
  { id: 'class_stock_suv_petrol_above', name: '3. Stock SUV Petrol - Above 3000 cc' },
  { id: 'class_stock_suv_diesel_2700', name: '4. Stock SUV Diesel - Up to 2700 cc' },
  { id: 'class_stock_suv_diesel_above', name: '5. Stock SUV Diesel - 2701 cc & Above' },
  { id: 'class_mod_suv_petrol_1600', name: '6. Modified SUV Petrol - Up to 1600 cc' },
  { id: 'class_mod_suv_petrol_3000', name: '7. Modified SUV Petrol - 1601-3000 cc' },
  { id: 'class_mod_suv_diesel_2700', name: '8. Modified SUV Diesel - Up to 2700 cc' },
  { id: 'class_mod_suv_diesel_above', name: '9. Modified SUV Diesel - 2701 cc & Above' },
  { id: 'class_suv_open', name: '10. SUV Open' },
  { id: 'class_lwb_suv_open', name: '11. LWB SUV - Open' },
  { id: 'class_ladies_open', name: '12. Ladies - Open' },
  { id: 'class_2w_open_2400', name: '13. 2W Open - Up to 2400 cc' },
];

const f = (id, label, fieldName, type, required = true, options = [], placeholder = '') => ({
  id,
  label,
  fieldName,
  type,
  required,
  placeholder,
  options,
});

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);

  const tiers = [
    {
      id: 'tier_spectator',
      name: 'Spectators',
      description: 'Spectate Dirt Drag — free entry. No competition class.',
      fee: 0,
      participantCount: 1,
      inclusions: ['Spectator access', 'Viewing area access'],
      order: -1,
    },
    ...CLASSES.map((c, i) => ({
      id: c.id,
      name: c.name,
      description: 'Rs 10,000 per class. Select multiple classes — total adds up.',
      fee: 10000,
      participantCount: 1,
      inclusions: [
        'Competitor entry for selected class',
        'Timed & categorised dirt-drag run',
        'Staging, recovery & first-aid access',
      ],
      order: i,
    })),
  ];

  const steps = [
    {
      stepNumber: 1,
      stepTitle: 'Personal details',
      stepDescription: 'Your contact and emergency information.',
      fields: [
        f('f_full_name', 'Full Name', 'full_name', 'text', true, [], 'Full name'),
        f('f_mobile', 'Mobile Number', 'mobile', 'tel', true, [], '10-digit mobile'),
        f('f_email', 'Email', 'email', 'email', true, [], 'you@email.com'),
        f(
          'f_city',
          'City',
          'city',
          'select',
          true,
          [
            'Pune',
            'Mumbai',
            'Nashik',
            'Nagpur',
            'Kolhapur',
            'Satara',
            'Sangli',
            'Ahmednagar',
            'Chhatrapati Sambhajinagar',
            'Other Maharashtra',
            'Other State',
          ],
        ),
        f('f_emergency_name', 'Emergency Contact Name', 'emergency_contact_name', 'text'),
        f('f_emergency_phone', 'Emergency Contact Number', 'emergency_contact_number', 'tel', true, [], '10-digit mobile'),
      ],
    },
    {
      stepNumber: 2,
      stepTitle: 'Driver details',
      stepDescription: '',
      fields: [
        f('f_driver_name', 'Driver Name', 'driver_name', 'text'),
        f('f_age_group', 'Age Group', 'age_group', 'select', true, [
          '18-21',
          '22-30',
          '31-40',
          '41-50',
          '51-60',
          '61+',
        ]),
        f('f_gender', 'Gender', 'gender', 'select', true, ['Male', 'Female']),
        f('f_dl', 'Driving Licence Number', 'driving_licence_number', 'text'),
      ],
    },
    {
      stepNumber: 3,
      stepTitle: 'Vehicle details',
      stepDescription: 'All vehicles are subject to technical and safety scrutiny.',
      fields: [
        f('f_make', 'Vehicle Make', 'vehicle_make', 'select', true, [
          'Maruti Suzuki',
          'Mahindra',
          'Tata',
          'Toyota',
          'Ford',
          'Jeep',
          'Hyundai',
          'Kia',
          'Isuzu',
          'Mitsubishi',
          'Nissan',
          'Renault',
          'Volkswagen',
          'Skoda',
          'Honda',
          'Other',
        ]),
        f('f_model', 'Vehicle Model', 'vehicle_model', 'text'),
        f('f_reg', 'Vehicle Registration Number', 'vehicle_registration_number', 'text'),
        f('f_fuel', 'Fuel Type', 'fuel_type', 'select', true, ['Petrol', 'Diesel']),
        f('f_cc', 'Engine Capacity', 'engine_capacity', 'select', true, [
          'Up to 1600 cc',
          '1601-2000 cc',
          '2001-2400 cc',
          '2401-2700 cc',
          '2701-3000 cc',
          'Above 3000 cc',
        ]),
        f('f_drive', 'Drive Configuration', 'drive_configuration', 'select', true, [
          '2WD - FWD',
          '2WD - RWD',
          '4WD',
          'AWD',
        ]),
        f('f_wheelbase', 'Wheelbase Classification', 'wheelbase_classification', 'select', true, [
          'SWB',
          'LWB',
          'Not Sure',
        ]),
      ],
    },
    {
      stepNumber: 4,
      stepTitle: 'Insurance details',
      stepDescription: 'Provide current vehicle insurance and personal accident insurance details.',
      fields: [
        f('f_car_insured', 'Is the vehicle currently insured?', 'car_insured', 'select', true, ['Yes', 'No']),
        f('f_car_ins_co', 'Car Insurance Company', 'car_insurance_company', 'text', false),
        f('f_car_ins_policy', 'Car Insurance Policy Number', 'car_insurance_policy_number', 'text', false),
        f('f_car_ins_until', 'Car Insurance Policy Valid Until', 'car_insurance_valid_until', 'date', false),
        f('f_pa_insured', 'Do you have Personal Accident Insurance?', 'pa_insured', 'select', true, [
          'Yes',
          'No',
        ]),
        f('f_pa_ins_co', 'Personal Accident Insurance Company', 'pa_insurance_company', 'text', false),
        f('f_pa_ins_policy', 'Personal Accident Insurance Policy Number', 'pa_insurance_policy_number', 'text', false),
        f('f_pa_ins_until', 'Personal Accident Insurance Policy Valid Until', 'pa_insurance_valid_until', 'date', false),
      ],
    },
    {
      stepNumber: 5,
      stepTitle: 'Safety declaration',
      stepDescription: 'Please read each statement carefully and confirm your acceptance.',
      fields: [
        f(
          'f_decl_vehicle_fit',
          'Vehicle fitness',
          'decl_vehicle_fit',
          'checkbox',
          true,
          ['I confirm that the vehicle entered by me is mechanically fit and safe for participation.'],
        ),
        f(
          'f_decl_risk',
          'Motorsport risk',
          'decl_motorsport_risk',
          'checkbox',
          true,
          [
            'I understand that motorsport involves inherent risks, including serious injury, death and damage to property.',
          ],
        ),
        f(
          'f_decl_follow',
          'Follow instructions',
          'decl_follow_instructions',
          'checkbox',
          true,
          [
            'I agree to follow all instructions issued by the Organiser, Officials, Marshals and Safety Personnel.',
          ],
        ),
        f(
          'f_decl_reclass',
          'Organiser rights',
          'decl_organiser_rights',
          'checkbox',
          true,
          [
            'I understand that the Organiser may refuse participation or disqualify a vehicle that does not comply with the technical or safety regulations.',
          ],
        ),
        f(
          'f_decl_truth',
          'Information accuracy',
          'decl_info_true',
          'checkbox',
          true,
          ['I confirm that all information submitted in this registration form is true and correct.'],
        ),
        f(
          'f_decl_misleading',
          'Misleading info',
          'decl_no_misleading',
          'checkbox',
          true,
          [
            'I understand that providing incorrect or misleading information may result in disqualification.',
          ],
        ),
      ],
    },
    {
      stepNumber: 6,
      stepTitle: 'Indemnity bond',
      stepDescription: `Download, read and sign the Elite Octane Dirt Drag 2026 Indemnity Bond. Keep the signed copy ready for submission as instructed by the Organiser.\n\n${INDEMNITY_URL}`,
      fields: [
        f(
          'f_decl_indemnity',
          'Indemnity bond',
          'decl_indemnity',
          'checkbox',
          true,
          [
            'I confirm that I have read and understood the Indemnity Bond and agree to sign and submit the completed document as required by the Organiser.',
          ],
        ),
      ],
    },
    {
      stepNumber: 7,
      stepTitle: 'Risk & liability',
      stepDescription:
        "Motorsport is inherently dangerous and involves risks including serious injury, death and damage to property. Participation is entirely at the competitor's own risk. The Organiser and associated personnel shall not be responsible or liable for any injury, death, loss or damage arising from participation or attendance.",
      fields: [
        f(
          'f_decl_liability',
          'Risk & liability',
          'decl_liability',
          'checkbox',
          true,
          [
            'I HAVE READ AND UNDERSTOOD THE ABOVE RISK AND LIABILITY DECLARATION AND AGREE TO PARTICIPATE IN ELITE OCTANE DIRT DRAG 2026 AT MY OWN RISK.',
          ],
        ),
      ],
    },
  ];

  const registration = {
    status: 'open',
    mode: 'internal_form',
    formType: 'MULTI_STEP',
    formSchema: [],
    steps,
    googleSheetsUrl: '',
    allowCoupons: false,
    paymentQR: '',
    paymentQRMessage: '',
    paymentUpiId: '',
    qrAutoConfirm: false,
  };

  const updated = await EventShow.findByIdAndUpdate(
    EVENT_ID,
    {
      $set: {
        pricingMode: 'tiers',
        tiersMultiSelect: true,
        tiers,
        ticketPrice: 10000,
        platformFeePercent: 0,
        priceLabel: 'Rs 10,000 / class · Spectators free',
        registrationLink: '',
        bookingLink: '',
        registration,
        registrationProcess: [
          'Tap Register and enter your personal details.',
          'Choose Participant or Spectator.',
          'Participants complete vehicle & insurance details, then select one or more classes (Rs 10,000 each — total adds up).',
          'Spectators register free with no class selection.',
          'Pay online via Cashfree when a fee applies. Download and sign the Indemnity Bond as instructed by the Organiser.',
        ].join('\n'),
      },
    },
    { new: true },
  ).lean();

  if (!updated) throw new Error('Event not found: ' + EVENT_ID);

  console.log(
    JSON.stringify(
      {
        ok: true,
        id: String(updated._id),
        title: updated.title,
        pricingMode: updated.pricingMode,
        tiers: (updated.tiers || []).length,
        reg: {
          status: updated.registration?.status,
          mode: updated.registration?.mode,
          formType: updated.registration?.formType,
          steps: (updated.registration?.steps || []).map((s) => `${s.stepNumber}. ${s.stepTitle} (${(s.fields || []).length} fields)`),
        },
        registrationLink: updated.registrationLink || '(empty - internal)',
        priceLabel: updated.priceLabel,
      },
      null,
      2,
    ),
  );

  await mongoose.disconnect();
})().catch(async (e) => {
  console.error(e);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
