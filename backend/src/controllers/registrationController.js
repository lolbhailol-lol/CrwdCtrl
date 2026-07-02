const Registration = require('../model/registration_model');
const TrekBooking = require('../model/trek_booking_model');
const FestOrganizer = require('../model/fest_organizer_model');
const User = require('../model/usermodel');
const { testGoogleSheetsConnection, appendPaymentOnlyToSheets } = require('../services/googleSheetsService');
const { uploadToCloudinary } = require('../services/cloudinaryService');
const { sendRegistrationThankYouEmail, sendRegistrationConfirmationEmail, sendOrganizerNotificationEmail } = require('../services/emailService');
const { createNotification } = require('./notificationController');
const { sendPushNotification } = require('../services/pushService');
const { buildPriceBreakdown, parseTicketPrice } = require('../utils/platformFee');
const multer = require('multer');

/** Create in-app notification + push (call after HTTP response is sent). */
async function notifyRegistrationSuccess(userId, { title, message, body, link, metadata }) {
  await createNotification({
    userId,
    title,
    message,
    type: 'registration',
    link,
    metadata,
  });
  sendPushNotification(userId, {
    title,
    body: body || message,
    link,
    type: 'registration',
  }).catch(() => {});
}

function scheduleRegistrationNotification(userId, payload) {
  setImmediate(async () => {
    try {
      await notifyRegistrationSuccess(userId, payload);
    } catch (notifErr) {
      console.error('❌ Notification creation error:', notifErr.message);
    }
  });
}

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow common file types for registration forms
    const allowedTypes = [
      'image/jpeg',
      'image/png', 
      'image/jpg',
      'image/gif',
      'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed'), false);
    }
  },
});

// Submit registration for a competition with custom form
const submitCustomCompetitionRegistration = async (req, res) => {
  try {
    const { competitionId } = req.params;
    const userId = req.user.userId;
    
    // ✅ CRITICAL FIX: Handle both JSON and FormData payloads
    let responses = req.body.responses;
    let transactionId = req.body.transactionId;
    let paymentReceiptUrl = req.body.paymentReceiptUrl;
    
    // If responses is a string (from FormData), parse it
    if (typeof responses === 'string') {
      try {
        responses = JSON.parse(responses);
      } catch (parseErr) {
        console.error('❌ Failed to parse responses JSON:', parseErr);
        return res.status(400).json({ error: 'Invalid responses format' });
      }
    }
    
    // Ensure responses is an object
    if (!responses || typeof responses !== 'object') {
      responses = {};
    }
    
    // ✅ NEW: Handle file uploads from FormData
    const files = req.files || [];
    console.log('📁 Received files:', files.length, files.map(f => ({ fieldname: f.fieldname, size: f.size })));

    const { userInfo } = req.body;

    console.log('🏆 Custom competition registration request:', { 
      competitionId, 
      userId, 
      responsesKeys: Object.keys(responses),
      hasFiles: files.length > 0,
      hasTransactionId: !!transactionId,
      hasPaymentReceiptUrl: !!paymentReceiptUrl,
      userInfo 
    });

    // Check if competition exists and has custom internal form registration
    const Competition = require('../model/competition_model');
    const competition = await Competition.findById(competitionId).populate('fest');
    
    if (!competition) {
      console.log('❌ Competition not found:', competitionId);
      return res.status(404).json({ error: 'Competition not found' });
    }

    console.log('🔍 Competition found:', {
      name: competition.name,
      registrationType: competition.registrationType,
      registrationStatus: competition.registration?.status
    });

    if (competition.registrationType !== 'custom') {
      console.log('❌ Not a custom registration competition');
      return res.status(400).json({ error: 'This competition does not have custom registration' });
    }

    if (competition.registration?.status !== 'internal_form') {
      console.log('❌ Not internal form registration');
      return res.status(400).json({ error: 'Internal form registration is not available for this competition' });
    }

    // Validate form schema - check both SINGLE_STEP and MULTI_STEP forms
    const formType = competition.registration?.formType || 'SINGLE_STEP';
    let hasFormFields = false;
    let fieldsCount = 0;

    if (formType === 'SINGLE_STEP') {
      // For SINGLE_STEP: check formSchema
      hasFormFields = competition.registration?.formSchema && competition.registration.formSchema.length > 0;
      fieldsCount = competition.registration?.formSchema?.length || 0;
    } else if (formType === 'MULTI_STEP') {
      // For MULTI_STEP: check steps and their fields
      const steps = competition.registration?.steps || [];
      hasFormFields = steps.length > 0 && steps.some(step => step.fields && step.fields.length > 0);
      fieldsCount = steps.reduce((total, step) => total + (step.fields?.length || 0), 0);
    }

    if (!hasFormFields) {
      console.log('❌ No form fields configured:', { competitionId, formType, fieldsCount });
      return res.status(400).json({
        error: 'Registration form is not configured for this competition. Please add at least one form field in the admin panel.',
      });
    }

    // ✅ Get form schema based on form type
    let formSchemaToValidate = [];
    if (formType === 'SINGLE_STEP') {
      formSchemaToValidate = competition.registration?.formSchema || [];
    } else if (formType === 'MULTI_STEP') {
      // For MULTI_STEP, combine all fields from all steps
      formSchemaToValidate = (competition.registration?.steps || []).reduce((allFields, step) => {
        return allFields.concat(step.fields || []);
      }, []);
    }

    console.log('📝 Competition form:', { formType, fields: formSchemaToValidate.length, responseKeys: Object.keys(responses).length });

    // ✅ NEW: Handle file uploads - store file info in responses
    if (files.length > 0) {
      const { uploadToCloudinary } = require('../services/cloudinaryService');
      
      for (const file of files) {
        try {
          console.log('📤 Uploading file to Cloudinary:', { fieldname: file.fieldname, size: file.size, mimetype: file.mimetype });
          
          const result = await uploadToCloudinary(
            file.buffer,
            file.originalname,
            'competition-registration',
            `comp_${competitionId}_${Date.now()}`,
            userId,
            file.fieldname
          );
          
          if (result.success) {
            // Store the uploaded file URL in responses
            responses[file.fieldname] = {
              fileName: file.originalname,
              url: result.cloudinaryLink,
              size: file.size,
              uploaded: true
            };
            console.log('✅ File uploaded successfully:', { fieldname: file.fieldname, url: result.cloudinaryLink });
          } else {
            console.error('❌ File upload failed:', result.error);
            return res.status(400).json({ error: `File upload failed for ${file.fieldname}` });
          }
        } catch (uploadErr) {
          console.error('❌ Upload error:', uploadErr);
          return res.status(500).json({ error: 'File upload failed' });
        }
      }
    }

    // ✅ NEW: Add transaction ID and payment receipt to responses if provided
    // Use proper case names for Google Sheets compatibility
    if (transactionId) {
      responses['Transaction ID'] = transactionId;
      console.log('💳 Added transaction ID to responses:', transactionId);
    }
    if (paymentReceiptUrl) {
      responses['Payment Receipt'] = paymentReceiptUrl;
      console.log('💳 Added payment receipt URL to responses:', paymentReceiptUrl);
    }

    // Validate required fields
    const requiredFields = formSchemaToValidate.filter(field => field.required);
    for (const field of requiredFields) {
      // Try multiple field ID formats for compatibility
      let fieldId = null;
      let fieldValue = null;

      // Try exact field name first
      if (field.fieldName && responses[field.fieldName]) {
        fieldId = field.fieldName;
        fieldValue = responses[field.fieldName];
      }
      // Try field.id
      else if (field.id && responses[field.id]) {
        fieldId = field.id;
        fieldValue = responses[field.id];
      }
      // Try with field_ prefix
      else if (field.id && responses[`field_${field.id}`]) {
        fieldId = `field_${field.id}`;
        fieldValue = responses[fieldId];
      }
      // Try generated ID from label
      else if (field.label) {
        const generatedId = `field_${field.label.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')}`;
        if (responses[generatedId]) {
          fieldId = generatedId;
          fieldValue = responses[fieldId];
        }
      }
      
      console.log('🔍 Validating field:', { 
        fieldLabel: field.label,
        fieldId: fieldId || 'NOT_FOUND',
        value: typeof fieldValue === 'object' ? JSON.stringify(fieldValue).substring(0, 100) : fieldValue,
        required: field.required,
        availableKeys: Object.keys(responses)
      });
      
      // For file uploads, check if it's an object with url property
      if (field.type === 'file' || field.type === 'image') {
        if (!fieldValue || (typeof fieldValue === 'object' && !fieldValue.url && !fieldValue.uploaded)) {
          if (!fieldValue || (typeof fieldValue === 'string' && fieldValue.trim() === '')) {
            console.log('❌ Required file field missing:', field.label);
            return res.status(400).json({ 
              error: `${field.label} is required`,
              details: {
                missingField: field.label,
                fieldType: 'file'
              }
            });
          }
        }
      } else if (!fieldValue || 
          (Array.isArray(fieldValue) && fieldValue.length === 0) ||
          (typeof fieldValue === 'string' && fieldValue.trim() === '')) {
        console.log('❌ Required field missing:', field.label);
        return res.status(400).json({ 
          error: `${field.label} is required`,
          details: {
            missingField: field.label,
            triedFieldIds: [field.fieldName, field.id, `field_${field.id}`],
            receivedFields: Object.keys(responses)
          }
        });
      }
    }

    // Verify Cashfree payment if competition has a fee
    let paymentOrderId = null;
    let paymentId = null;
    let paymentStatus = 'free';
    const competitionTicketPrice = parseTicketPrice(competition.feeAmount) || parseTicketPrice(competition.registrationFee);
    const competitionTotalAmount = buildPriceBreakdown(competitionTicketPrice).totalAmount;

    if (competitionTicketPrice > 0) {
      const { verifyPaymentForRegistration } = require('../utils/paymentVerification');
      const paymentCheck = await verifyPaymentForRegistration(req.body);
      if (!paymentCheck.ok) {
        return res.status(400).json({ error: paymentCheck.error || 'Payment is required for this competition.' });
      }

      paymentOrderId = paymentCheck.orderId;
      paymentId = paymentCheck.paymentId;
      paymentStatus = 'paid';
      console.log('✅ Cashfree payment verified:', paymentId);
    }

    // Create registration ID
    const registrationId = `COMP_REG_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log('🆔 Generated registration ID:', registrationId);

    // Get user details
    const User = require('../model/usermodel');
    const user = await User.findById(userId);
    if (!user) {
      console.log('❌ User not found:', userId);
      return res.status(404).json({ error: 'User not found' });
    }

    console.log('👤 User found:', { name: user.name, email: user.email });

    // ✅ IDEMPOTENT PAYMENT RETRY ONLY
    // If this exact payment already produced a registration (double submit /
    // page revisit after a redirect payment), return it as SUCCESS so the user
    // lands on the success screen instead of bouncing back to the form.
    // A brand-new attempt (different/no payment order) always creates a NEW
    // registration — users are allowed to register again.
    const existingRegistration = paymentOrderId
      ? await Registration.findOne({
          payment_order_id: paymentOrderId,
          fest: competition.fest._id,
          competitionId: competition._id,
          user: userId,
        })
      : null;

    if (existingRegistration) {
      console.log('ℹ️ Existing competition registration found:', existingRegistration._id);
      return res.status(200).json({
        success: true,
        alreadyRegistered: true,
        message: 'You are already registered for this competition',
        _id: existingRegistration._id,
        registrationId: existingRegistration._id,
        data: {
          competition: { id: competition._id, name: competition.name },
          registrationId: existingRegistration._id,
          status: existingRegistration.status,
          submittedAt: existingRegistration.submittedAt,
        },
      });
    }

    // Create registration record
    const registration = new Registration({
      fest: competition.fest._id,
      user: userId,
      competitionId: competition._id,
      responses: responses,
      status: 'pending',
      payment_order_id: paymentOrderId,
      payment_id: paymentId,
      payment_gateway: paymentStatus === 'paid' ? 'cashfree' : null,
      paymentStatus,
      amountPaid: paymentStatus === 'paid' ? competitionTotalAmount : 0,
      submittedAt: new Date()
    });

    await registration.save();
    console.log('✅ Registration saved to database');

    const customCompRegistrationLink = `/registration-details/${registration._id}`;

    // ✅ PERFORMANCE: Return success IMMEDIATELY to frontend - don't wait for emails/sheets
    res.status(201).json({
      success: true,
      message: 'Registration submitted successfully',
      _id: registration._id,
      registrationId: registration._id,
      referenceId: registrationId,
      data: {
        competition: {
          id: competition._id,
          name: competition.name
        },
        registrationId: registration._id,
        referenceId: registrationId,
        status: registration.status,
        submittedAt: registration.submittedAt
      }
    });

    scheduleRegistrationNotification(userId, {
      title: 'Registration Confirmed!',
      message: `You've successfully registered for ${competition.name}.`,
      body: `You've registered for ${competition.name}`,
      link: customCompRegistrationLink,
      metadata: {
        competitionId: competition._id,
        festId: competition.fest?._id,
        registrationId: registration._id,
      },
    });

    // ✅ PERFORMANCE: Run all async operations in background (don't wait for them)
    // Email queue in emailService.js handles rate limiting automatically
    setImmediate(async () => {
      try {
        // STEP 1: Send thank you email (queued automatically for rate limiting)
        try {
          console.log('📧 Sending thank you email (async)...');
          await sendRegistrationThankYouEmail(
            user.email,
            user.name,
            competition.name
          );
          console.log('✅ Thank you email sent successfully');
        } catch (emailError) {
          console.error('❌ Thank you email error:', emailError);
        }

        // STEP 2: Send confirmation email (queued automatically for rate limiting)
        try {
          console.log('📧 Sending confirmation email (async)...');
          const submissionDate = new Date().toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
          
          await sendRegistrationConfirmationEmail(
            user.email,
            user.name,
            competition.fest.festName || competition.name,
            competition.name,
            registrationId,
            submissionDate,
            { status: paymentStatus, method: paymentStatus === 'paid' ? 'cashfree' : 'free' }
          );
          console.log('✅ Confirmation email sent successfully');
        } catch (emailError) {
          console.error('❌ Confirmation email error:', emailError);
        }

        // STEP 3: Send organizer notification email if configured (queued automatically)
        // Check both confirmationEmail (competition model) and organizerEmail (fest model) for flexibility
        const organizerEmail = competition.registration.confirmationEmail || 
                               competition.registration.organizerEmail ||
                               competition.fest?.registration?.organizerEmail;
        
        console.log('📧 Organizer email check:', {
          confirmationEmail: competition.registration.confirmationEmail,
          organizerEmail: competition.registration.organizerEmail,
          festOrganizerEmail: competition.fest?.registration?.organizerEmail,
          finalEmail: organizerEmail
        });
        
        if (organizerEmail) {
          try {
            console.log('📧 Sending organizer notification email to:', organizerEmail);
            await sendOrganizerNotificationEmail(
              organizerEmail,
              user.name,
              user.email,
              competition.name,
              competition.name,
              registrationId,
              new Date().toLocaleString('en-IN', {
                timeZone: 'Asia/Kolkata',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })
            );
            console.log('✅ Organizer notification email sent successfully');
          } catch (orgEmailError) {
            console.error('❌ Organizer notification email error:', orgEmailError);
          }
        } else {
          console.log('⚠️ No organizer email configured - skipping organizer notification');
        }

        // STEP 4: Add to Google Sheets (async, non-blocking)
        if (competition.registration.googleSheetsUrl) {
          try {
            console.log('📊 Adding registration to Google Sheets (async)...');
            const { appendToCompetitionGoogleSheets } = require('../services/googleSheetsService');

            // Inject Payment ID so it appears as a column
            if (paymentId) responses['Payment ID'] = paymentId;

            // Get form schema based on form type
            let formSchema = [];
            const formType = competition.registration?.formType || 'SINGLE_STEP';
            if (formType === 'SINGLE_STEP') {
              formSchema = competition.registration?.formSchema || [];
            } else if (formType === 'MULTI_STEP') {
              formSchema = (competition.registration?.steps || []).reduce((allFields, step) => {
                return allFields.concat(step.fields || []);
              }, []);
            }

            await appendToCompetitionGoogleSheets(
              competition.registration.googleSheetsUrl,
              responses,
              {
                festName: competition.fest.festName,
                competitionName: competition.name,
                registrationId,
                submittedAt: new Date().toISOString()
              },
              {
                name: user.name,
                email: user.email,
                phone: user.phoneNumber
              },
              formSchema
            );
            console.log('✅ Data sent to Google Sheets successfully (async)');
          } catch (sheetsError) {
            console.error('❌ Google Sheets error (async):', sheetsError);
          }
        }

      } catch (backgroundError) {
        console.error('❌ Background task error:', backgroundError);
      }
    });

  } catch (error) {
    console.error('❌ Competition registration error:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({
      error: 'Registration failed',
    });
  }
};

// Submit registration for a competition
const submitCompetitionRegistration = async (req, res) => {
  try {
    const { competitionId } = req.params;
    const userId = req.user.userId;

    console.log('🏆 Competition registration request:', { competitionId, userId });

    // Check if competition exists and has started registration
    const Competition = require('../model/competition_model');
    const competition = await Competition.findById(competitionId).populate('fest');

    if (!competition) {
      return res.status(404).json({ error: 'Competition not found' });
    }

    // Use the fest's form schema for validation and processing
    const fest = competition.fest;

    // ✅ CRITICAL: Check registration based on competition type
    if (competition.registrationType === 'fest') {
      // Fest-based competitions use the fest's registration mode
      if (!fest || fest.registration?.mode !== 'INTERNAL_FORM') {
        return res.status(400).json({ error: 'Registration is not available for this competition' });
      }
    } else if (competition.registrationType === 'custom') {
      // Custom competitions use their own registration status
      if (competition.registration?.status !== 'internal_form') {
        return res.status(400).json({ error: 'Registration has not started for this competition' });
      }
    } else {
      return res.status(400).json({ error: 'Invalid competition registration type' });
    }
    
    if (!fest?.registration) {
      return res.status(400).json({ error: 'Registration form is not configured for this competition' });
    }

    // ✅ CRITICAL: Get form schema (support both single-step and multi-step forms)
    let formSchema = [];
    if (fest.registration?.formType === 'MULTI_STEP' && fest.registration.steps) {
      // For multi-step forms, flatten all fields from all steps
      formSchema = fest.registration.steps.flatMap(step => step.fields || []);
    } else if (fest.registration?.formSchema) {
      // For single-step forms, use the direct formSchema
      formSchema = fest.registration.formSchema;
    }

    if (!formSchema || formSchema.length === 0) {
      return res.status(400).json({ error: 'Registration form is not configured for this fest' });
    }

    if (fest.registration.mode !== 'INTERNAL_FORM') {
      return res.status(400).json({ error: 'This fest does not accept internal form registrations' });
    }

    console.log('📝 Form schema:', formSchema?.length || 0, 'fields');
    console.log('📁 Files received:', req.files?.length || 0);

    // Parse form data and files (same as fest registration)
    const responses = {};
    const uploadedFiles = {};

    // Process text fields from request body
    if (req.body.responses) {
      const parsedResponses = typeof req.body.responses === 'string' 
        ? JSON.parse(req.body.responses) 
        : req.body.responses;
      Object.assign(responses, parsedResponses);
      console.log('📝 Text responses parsed:', Object.keys(responses));
    }

    // ✅ CRITICAL: Capture payment receipt URL and transaction ID separately (sent as form fields, not in responses JSON)
    if (req.body.paymentReceiptUrl) {
      responses['Payment Receipt'] = req.body.paymentReceiptUrl;
      console.log('💳 Captured payment receipt URL from form field:', req.body.paymentReceiptUrl);
    }
    if (req.body.transactionId) {
      responses['Transaction ID'] = req.body.transactionId;
      console.log('💳 Captured transaction ID from form field:', req.body.transactionId);
    }

    console.log('📝 All responses after payment capture:', {
      hasPaymentReceipt: !!responses['Payment Receipt'],
      hasTransactionId: !!responses['Transaction ID'],
      totalFields: Object.keys(responses).length
    });

    // CRITICAL: Create registration ID for folder structure
    const registrationId = `REG_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log('🆔 Generated registration ID:', registrationId);

    // Process uploaded files with proper field matching (same as fest registration)
    if (req.files && req.files.length > 0) {
      console.log('📁 Processing uploaded files:', req.files.length);
      
      for (const file of req.files) {
        console.log('📤 Processing file:', {
          fieldname: file.fieldname,
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size
        });

        try {
          // Upload to Cloudinary with organized folder structure
          const folderPath = `crwdctrl/${fest.festName}/${registrationId}_${userId}`;
          const uploadResult = await uploadToCloudinary(
            file.buffer,
            file.originalname,
            fest.festName,
            registrationId,
            userId,
            file.fieldname
          );

          console.log('☁️ Cloudinary upload successful:', {
            fieldname: file.fieldname,
            success: uploadResult.success,
            cloudinaryLink: uploadResult.cloudinaryLink
          });

          if (uploadResult.success) {
            // Store file info for this field
            uploadedFiles[file.fieldname] = {
              uploaded: true,
              cloudinaryLink: uploadResult.cloudinaryLink,
              fileName: uploadResult.fileName,
              fileId: uploadResult.fileId,
              uploadMethod: uploadResult.uploadMethod || 'cloudinary'
            };

            // Also set a simple flag for validation
            responses[file.fieldname] = {
              uploaded: true,
              cloudinaryLink: uploadResult.cloudinaryLink,
              fileName: file.originalname
            };
          } else {
            console.error('❌ Cloudinary upload failed:', uploadResult.error);
            return res.status(500).json({ 
              error: `Failed to upload ${file.originalname}`,
              details: uploadResult.error 
            });
          }

        } catch (uploadError) {
          console.error('❌ Cloudinary upload failed:', uploadError);
          return res.status(500).json({ 
            error: `Failed to upload ${file.originalname}`,
            details: uploadError.message 
          });
        }
      }
    }

    // Map field IDs to fieldNames for backend processing (same as fest registration)
    const processedResponses = {};
    
    for (const field of formSchema) {
      // Try multiple field ID strategies to find the value
      const possibleFieldIds = [
        field.id,
        field.fieldName,
        `field_${field.id}`,
        `field_${field.label?.toLowerCase().replace(/\s+/g, '_')}`,
        field.label?.toLowerCase().replace(/\s+/g, '_')
      ].filter(Boolean);
      
      let value = null;
      for (const fieldId of possibleFieldIds) {
        if (responses.hasOwnProperty(fieldId)) {
          value = responses[fieldId];
          break;
        }
      }
      
      if (value !== null) {
        processedResponses[field.fieldName] = value;
      }
    }
    
    // ✅ CRITICAL: Add payment receipt and transaction ID to processedResponses for Google Sheets
    if (responses['Payment Receipt']) {
      processedResponses['Payment Receipt'] = responses['Payment Receipt'];
      console.log('💳 Added Payment Receipt to processed responses:', responses['Payment Receipt']);
    }
    if (responses['Transaction ID']) {
      processedResponses['Transaction ID'] = responses['Transaction ID'];
      console.log('💳 Added Transaction ID to processed responses:', responses['Transaction ID']);
    }

    console.log('🔄 Processed responses:', Object.keys(processedResponses));

    // Validate required fields with proper file/image handling
    const requiredFields = formSchema.filter(field => field.required);
    console.log('🔍 Validating', requiredFields.length, 'required fields...');
    
    for (const field of requiredFields) {
      const value = processedResponses[field.fieldName];

      if (field.type === 'file' || field.type === 'image') {
        if (!value || !value.uploaded || !value.cloudinaryLink) {
          console.error('❌ Required file field missing:', field.label);
          return res.status(400).json({ error: `${field.label} is required - please upload a file` });
        }
      } else {
        // For other fields, check if value exists and is not empty
        if (!value || (Array.isArray(value) && value.length === 0) || value.toString().trim() === '') {
          console.error('❌ Required field missing:', field.label);
          return res.status(400).json({ error: `${field.label} is required` });
        }
      }
    }

    // Verify Cashfree payment if competition has a fee
    let paymentOrderId = null;
    let paymentId = null;
    let paymentStatusRoute = 'free';
    const competitionTicketPrice = parseTicketPrice(competition.feeAmount) || parseTicketPrice(competition.registrationFee);
    const competitionTotalAmount = buildPriceBreakdown(competitionTicketPrice).totalAmount;

    if (competitionTicketPrice > 0) {
      const { verifyPaymentForRegistration } = require('../utils/paymentVerification');
      const paymentCheck = await verifyPaymentForRegistration(req.body);
      if (!paymentCheck.ok) {
        return res.status(400).json({ error: paymentCheck.error || 'Payment is required for this competition.' });
      }

      paymentOrderId = paymentCheck.orderId;
      paymentId = paymentCheck.paymentId;
      paymentStatusRoute = 'paid';
      console.log('✅ Cashfree payment verified (competition route):', paymentId);
    }

    // Create registration with competition reference
    const registration = new Registration({
      fest: competition.fest._id,
      user: userId,
      responses: processedResponses,
      status: 'pending',
      competitionId: competitionId,
      payment_order_id: paymentOrderId,
      payment_id: paymentId,
      payment_gateway: paymentStatusRoute === 'paid' ? 'cashfree' : null,
      paymentStatus: paymentStatusRoute,
      amountPaid: paymentStatusRoute === 'paid' ? competitionTotalAmount : 0,
    });

    console.log('💾 Saving registration with competitionId:', competitionId);
    await registration.save();
    console.log('💾 Registration saved to database with ID:', registration._id);
    console.log('💾 Saved competitionId field:', registration.competitionId);

    // Get user details for emails and Google Sheets
    const user = await User.findById(userId).select('name email phoneNumber');

    const competitionRegistrationLink = `/registration-details/${registration._id}`;

    // ✅ CRITICAL: Send success response immediately to user (don't wait for emails)
    res.status(201).json({
      message: 'Registration successful',
      registrationId: registration._id,
      festName: fest.festName,
      competitionName: competition.name
    });

    scheduleRegistrationNotification(userId, {
      title: 'Registration Successful!',
      message: `You've registered for ${competition.name} at ${fest.festName}.`,
      body: `You've registered for ${competition.name} at ${fest.festName}`,
      link: competitionRegistrationLink,
      metadata: {
        festId: fest._id,
        competitionId: competition._id,
        registrationId: registration._id,
      },
    });

    // ✅ PERFORMANCE: Run all async operations in background (don't wait for them)
    // This allows the response to be sent immediately while emails sync in background
    setImmediate(async () => {
      try {
        // STEP 1: Send thank you email (async, non-blocking)
        try {
          console.log('📧 Sending thank you email for competition (async)...');
          await sendRegistrationThankYouEmail(user.email, user.name, fest.festName);
          console.log('✅ Thank you email sent successfully');
        } catch (emailError) {
          console.error('⚠️ Thank you email failed:', emailError.message);
        }

        // STEP 2: Send confirmation email with competition name (async, non-blocking)
        try {
          console.log('📧 Sending confirmation email for competition (async)...');
          
          // Format submission date in Asia/Kolkata timezone
          const submissionDate = new Date().toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });

          await sendRegistrationConfirmationEmail(
            user.email,
            user.name,
            fest.festName,
            competition.name, // Use competition name
            registration._id.toString(),
            submissionDate,
            { status: paymentStatusRoute, method: paymentStatusRoute === 'paid' ? 'cashfree' : 'free' }
          );
          console.log('✅ Confirmation email sent successfully');

          // STEP 2.5: Send organizer notification email
          if (fest.registration?.organizerEmail) {
            try {
              console.log('📧 Sending organizer notification email (async)...');
              await sendOrganizerNotificationEmail(
                fest.registration.organizerEmail,
                user.name,
                user.email,
                fest.festName,
                competition.name,
                registration._id.toString(),
                submissionDate
              );
              console.log('✅ Organizer notification email sent successfully');
            } catch (orgEmailError) {
              console.error('⚠️ Organizer notification email failed:', orgEmailError.message);
            }
          } else {
            console.log('ℹ️ No organizer email configured for this fest');
          }
        } catch (emailError) {
          console.error('⚠️ Confirmation email failed:', emailError.message);
        }

        // STEP 3: Add to Google Sheets (async, non-blocking)
        // Check both the fest's URL and the competition's own URL as fallback
        const compSheetsUrl = fest.registration?.googleSheetsUrl || competition.registration?.googleSheetsUrl;
        if (compSheetsUrl) {
          try {
            const { appendToCompetitionGoogleSheets } = require('../services/googleSheetsService');

            // Inject Payment ID so it appears as a column
            if (paymentId) processedResponses['Payment ID'] = paymentId;

            console.log('📊 Saving to Google Sheets:', compSheetsUrl);
            console.log('📊 Responses keys:', Object.keys(processedResponses));

            const sheetsResult = await appendToCompetitionGoogleSheets(
              compSheetsUrl,
              processedResponses,
              {
                festName: fest.festName,
                competitionName: competition.name,
                registrationId: registration._id.toString(),
              },
              {
                name: user.name,
                email: user.email,
                phone: user.phoneNumber || '',
              },
              formSchema   // already computed — no extra DB fetch needed
            );
            if (sheetsResult.success) {
              console.log('✅ Competition registration saved to Google Sheets');
            } else {
              console.warn('⚠️ Google Sheets sync failed:', sheetsResult.error);
            }
          } catch (sheetsError) {
            console.error('⚠️ Google Sheets update failed:', sheetsError.message);
          }
        } else {
          console.log('ℹ️ No Google Sheets URL configured for this fest/competition — skipping');
        }

        console.log('🎉 All async operations completed for competition registration');
      } catch (asyncError) {
        console.error('⚠️ Background async operations error:', asyncError);
      }
    }); // <- Close the setImmediate callback

  } catch (error) {
    console.error('❌ Competition registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
};

// Submit registration for a fest
// Submit registration for a fest with file uploads
const submitRegistration = async (req, res) => {
  try {
    console.log('🚀 Starting registration submission...');
    const { festId } = req.params;
    const userId = req.user.userId;

    console.log('📋 Registration details:', { festId, userId });

    // ✅ CRITICAL: Check if fest exists and validate registration mode
    const fest = await FestOrganizer.findById(festId);
    if (!fest) {
      console.error('❌ Fest not found:', festId);
      return res.status(404).json({ error: 'Fest not found' });
    }

    console.log('🔍 Fest registration check:', {
      festName: fest.festName,
      registrationMode: fest.registration?.mode,
      isApproved: fest.isApproved
    });

    // ✅ CRITICAL: Validate fest is approved
    if (!fest.isApproved) {
      console.error('❌ Fest not approved:', festId);
      return res.status(400).json({ error: 'This fest is not available for registration' });
    }

    // ✅ CRITICAL: Validate registration mode
    if (!fest.registration || fest.registration.mode === 'CLOSED') {
      console.error('❌ Registration closed for fest:', festId);
      return res.status(400).json({ error: 'Registration is closed for this fest' });
    }
    if (fest.registration.mode !== 'INTERNAL_FORM') {
      console.error('❌ Invalid registration mode:', fest.registration?.mode);
      return res.status(400).json({ error: 'Internal form registration is not available for this fest' });
    }

    // ✅ CRITICAL: Get form schema (support both single-step and multi-step forms)
    let formSchema = [];
    if (fest.registration.formType === 'MULTI_STEP' && fest.registration.steps) {
      // For multi-step forms, flatten all fields from all steps
      formSchema = fest.registration.steps.flatMap(step => step.fields || []);
      console.log('📝 Multi-step form schema:', formSchema.length, 'fields from', fest.registration.steps.length, 'steps');
    } else if (fest.registration.formSchema) {
      // For single-step forms, use the direct formSchema
      formSchema = fest.registration.formSchema;
      console.log('📝 Single-step form schema:', formSchema.length, 'fields');
    }

    if (!formSchema || formSchema.length === 0) {
      console.error('❌ No form schema configured');
      return res.status(400).json({ error: 'Registration form is not configured for this fest' });
    }
    console.log('📁 Files received:', req.files?.length || 0);
    console.log('🔍 Request body keys:', Object.keys(req.body));
    console.log('🔍 Request body paymentReceiptUrl:', req.body.paymentReceiptUrl);

    // Parse form data and files
    const responses = {};
    const uploadedFiles = {};

    // ✅ NEW: Add payment receipt URL if provided
    if (req.body.paymentReceiptUrl) {
      responses['Payment Receipt'] = req.body.paymentReceiptUrl;
      console.log('💳 Payment receipt URL added to responses:', req.body.paymentReceiptUrl);
      console.log('💳 Payment receipt key in responses:', 'Payment Receipt');
    } else {
      console.log('⚠️ No payment receipt URL found in request body');
      console.log('🔍 Request body keys:', Object.keys(req.body));
    }

    // ✅ NEW: Add transaction ID if provided
    if (req.body.transactionId) {
      responses['Transaction ID'] = req.body.transactionId;
      console.log('💳 Transaction ID added to responses:', req.body.transactionId);
    } else {
      console.log('⚠️ No transaction ID found in request body');
    }
    
    console.log('📊 Final responses object keys:', Object.keys(responses));
    console.log('💳 Payment Receipt in final responses:', responses['Payment Receipt']);
    console.log('💳 Transaction ID in final responses:', responses['Transaction ID']);

    // Process text fields from request body
    if (req.body.responses) {
      const parsedResponses = typeof req.body.responses === 'string' 
        ? JSON.parse(req.body.responses) 
        : req.body.responses;
      Object.assign(responses, parsedResponses);
      console.log('📝 Text responses parsed:', Object.keys(responses));
    }

    // CRITICAL: Create registration FIRST to get ID for folder structure
    const registrationId = `REG_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log('🆔 Generated registration ID:', registrationId);

    // Declared outside file block so setImmediate background callback can await uploads
    const fileUploadPromises = [];

    // ✅ PERFORMANCE: Process uploaded files concurrently with better field matching
    if (req.files && req.files.length > 0) {
      console.log('📁 Processing uploaded files:', req.files.length);

      const fileValidationErrors = [];

      for (const file of req.files) {
        // ✅ CRITICAL FIX: Enhanced field matching with multiple strategies
        const fieldSchema = formSchema.find(f => {
          // Strategy 1: Direct fieldName match (primary)
          if (f.fieldName === file.fieldname) return true;
          // Strategy 2: Direct id match
          if (f.id === file.fieldname) return true;
          // Strategy 3: Check if fieldname contains the field id
          if (f.id && file.fieldname.includes(f.id)) return true;
          // Strategy 4: Check if fieldname contains the fieldName
          if (f.fieldName && file.fieldname.includes(f.fieldName)) return true;
          // Strategy 5: Label-based matching (fallback)
          if (f.label) {
            const labelId = `field_${f.label.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')}`;
            if (file.fieldname === labelId) return true;
          }
          return false;
        });

        if (!fieldSchema) {
          console.error('❌ No matching field schema found for:', file.fieldname);
          fileValidationErrors.push({
            field: file.fieldname,
            error: 'No matching field schema found'
          });
          continue;
        }

        // Prepare upload promise
        const uploadPromise = uploadToCloudinary(
          file.buffer,
          file.originalname,
          fest.festName,
          registrationId,
          userId,
          fieldSchema.fieldName || fieldSchema.id
        ).then(uploadResult => ({
          file,
          fieldSchema,
          uploadResult
        }));

        fileUploadPromises.push(uploadPromise);
      }

      // Check for validation errors
      if (fileValidationErrors.length > 0) {
        console.error('Available field schemas:', formSchema.map(f => ({
          id: f.id,
          fieldName: f.fieldName,
          label: f.label,
          type: f.type
        })));
        return res.status(400).json({
          error: `Invalid form fields: ${fileValidationErrors.map(e => e.field).join(', ')}. Please refresh the form and try again.`,
        });
      }

      // ✅ PERFORMANCE: Upload all files concurrently with progress logging
      console.log('📤 Uploading files concurrently...');
      const uploadStartTime = Date.now();
      
      // ✅ CRITICAL FIX: DON'T WAIT FOR FILE UPLOADS - START IMMEDIATELY BUT PROCESS IN BACKGROUND
      // This allows the response to be sent to the user IMMEDIATELY
      // Files will be uploaded asynchronously and attached to the registration later
      
      console.log('⚡ File uploads will continue in background (not blocking response)');
      
      // Process upload results asynchronously - don't await here
      // For now, just prepare the responses with placeholder file references
      // The actual uploads will happen in setImmediate below
      
      // For now, if files need to be uploaded, we'll just store the file data
      // and upload in the background
      for (const uploadPromise of fileUploadPromises) {
        // Don't await - let these run in the background
        uploadPromise.catch(err => console.error('❌ Background file upload error:', err));
      }

      // Merge uploaded files into responses using fieldName as key (with uploaded status)
      // We'll update these in the background
      // Object.assign(responses, uploadedFiles); // Skip for now, files will be available later
    } // Close the if (req.files && req.files.length > 0) block

    console.log('📋 Final responses:', Object.keys(responses));

    // ✅ PERFORMANCE: Validate required fields with consistent field naming
    const requiredFields = formSchema.filter(field => field.required);
    console.log('🔍 Validating', requiredFields.length, 'required fields...');
    
    for (const field of requiredFields) {
      // Use fieldName as primary key, fallback to id
      const fieldKey = field.fieldName || field.id;
      const value = responses[fieldKey];

      // For file/image fields, just check that the file was received (don't check uploaded status yet)
      // Actual upload will happen in the background
      if (field.type === 'file' || field.type === 'image') {
        // Check if file exists in the request (req.files or formData)
        // Since we're skipping the upload, just mark it as "will be uploaded"
        console.log('ℹ️ File field detected (will upload in background):', field.label);
      } else {
        // For other fields, check if value exists and is not empty
        if (!value || (Array.isArray(value) && value.length === 0) || value.toString().trim() === '') {
          console.error('❌ Required field missing:', field.label);
          return res.status(400).json({ error: `${field.label} is required` });
        }
      }
    }

    console.log('✅ All required fields validated');

    // Create registration - ONLY ONCE
    const registration = new Registration({
      fest: festId,
      user: userId,
      responses: responses,
      status: 'pending'
    });

    await registration.save();
    console.log('✅ Registration saved:', registration._id);

    // Get user details for Google Sheets
    const user = await User.findById(userId).select('name email phoneNumber');

    const registrationLink = `/registration-details/${registration._id}`;

    // ✅ CRITICAL: Send success response immediately to user
    res.status(201).json({
      message: 'Registration submitted successfully',
      _id: registration._id,
      registrationId: registration._id,
      registration: {
        id: registration._id,
        _id: registration._id,
        festId: registration.fest,
        status: registration.status,
        submittedAt: registration.submittedAt
      }
    });

    scheduleRegistrationNotification(userId, {
      title: 'Registration Submitted!',
      message: `Your registration for ${fest.festName} has been submitted successfully.`,
      body: `Your registration for ${fest.festName} has been submitted`,
      link: registrationLink,
      metadata: { festId: fest._id, registrationId: registration._id },
    });

    // ✅ PERFORMANCE: Run all async operations in background (don't wait for them)
    // This allows the response to be sent immediately while emails and Google Sheets sync in background
    setImmediate(async () => {
      try {
        // FIRST: Process file uploads in background (don't block the response)
        console.log('📁 Starting background file uploads...');
        
        // Wait for all file uploads to complete
        if (fileUploadPromises.length > 0) {
          try {
            const uploadResults = await Promise.all(fileUploadPromises);
            console.log('✅ Background file uploads completed:', uploadResults.length, 'files');
            
            // Update registration with file URLs (if any)
            let updatedFiles = false;
            for (const entry of uploadResults) {
              const fieldName = entry?.fieldSchema?.fieldName || entry?.fieldSchema?.id;
              const cloudinaryLink = entry?.uploadResult?.cloudinaryLink;
              if (entry?.uploadResult?.success && fieldName && cloudinaryLink) {
                registration.responses.set(fieldName, {
                  uploaded: true,
                  cloudinaryLink,
                  fileName: entry.uploadResult.fileName,
                  fileId: entry.uploadResult.fileId,
                  uploadMethod: entry.uploadResult.uploadMethod || 'cloudinary',
                  uploadedAt: new Date(),
                });
                updatedFiles = true;
              }
            }
            
            // Save registration with updated file URLs
            if (updatedFiles) {
              registration.markModified('responses');
              await registration.save();
              console.log('✅ Registration updated with file URLs');
            }
          } catch (uploadError) {
            console.error('❌ Background file upload failed:', uploadError);
            // Registration is already saved with other data, files just won't have links
            // User can still see their registration, just file URLs won't be available
          }
        }
        
        // Append to Google Sheets if configured (async, non-blocking)
        if (fest.registration.googleSheetsUrl) {
          try {
            const { appendToCompetitionGoogleSheets } = require('../services/googleSheetsService');
            console.log('📊 Saving fest registration to Google Sheets:', fest.registration.googleSheetsUrl);
            console.log('📊 Responses keys:', Object.keys(responses));

            // Map responses to fieldName keys so they match the schema
            const mappedResponses = {};
            formSchema.forEach(field => {
              const key = field.fieldName || field.id;
              if (key && responses[key] !== undefined) mappedResponses[key] = responses[key];
            });
            // Preserve special columns
            if (responses['Payment Receipt']) mappedResponses['Payment Receipt'] = responses['Payment Receipt'];
            if (responses['Transaction ID']) mappedResponses['Transaction ID'] = responses['Transaction ID'];
            if (responses['Payment ID']) mappedResponses['Payment ID'] = responses['Payment ID'];

            const sheetsResult = await appendToCompetitionGoogleSheets(
              fest.registration.googleSheetsUrl,
              mappedResponses,
              {
                festName: fest.festName,
                competitionName: '',   // fest-level registration, no specific competition
                registrationId: registration._id.toString(),
              },
              {
                name: user.name,
                email: user.email,
                phone: user.phoneNumber || '',
              },
              formSchema
            );

            if (sheetsResult.success) {
              console.log('✅ Fest registration saved to Google Sheets');
            } else {
              console.warn('⚠️ Google Sheets sync failed:', sheetsResult.error);
            }
          } catch (sheetsError) {
            console.error('❌ Google Sheets integration error:', sheetsError.message);
          }
        } else {
          console.log('ℹ️ No Google Sheets URL configured for this fest — skipping');
        }

        // STEP 1: Send immediate thank you email (async)
        try {
          console.log('📧 Sending thank you email (async)...');
          await sendRegistrationThankYouEmail(user.email, user.name, fest.festName);
          console.log('✅ Thank you email sent successfully');
        } catch (emailError) {
          console.error('⚠️ Thank you email failed:', emailError.message);
        }

        // STEP 2: Send confirmation email (async)
        try {
          console.log('📧 Sending confirmation email (async)...');
          
          // Extract competition name from form responses
          let competitionName = null;
          const competitionField = formSchema.find(field => {
            const label = field.label.toLowerCase();
            return label.includes('competition') || 
                   label.includes('event') || 
                   label.includes('category') ||
                   field.fieldName.toLowerCase().includes('competition') ||
                   field.fieldName.toLowerCase().includes('event');
          });
          
          if (competitionField) {
            competitionName = responses[competitionField.fieldName] || null;
            console.log('🎯 Competition name extracted:', competitionName);
          }
          
          const submissionDate = new Date().toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
          
          await sendRegistrationConfirmationEmail(
            user.email,
            user.name,
            fest.festName,
            competitionName,
            registration._id.toString(),
            submissionDate
          );
          
          console.log('✅ Confirmation email sent successfully');

          // STEP 3: Send organizer notification email (async)
          if (fest.registration?.organizerEmail) {
            try {
              console.log('📧 Sending organizer notification email (async)...');
              await sendOrganizerNotificationEmail(
                fest.registration.organizerEmail,
                user.name,
                user.email,
                fest.festName,
                competitionName,
                registration._id.toString(),
                submissionDate
              );
              console.log('✅ Organizer notification email sent successfully');
            } catch (orgEmailError) {
              console.error('⚠️ Organizer notification email failed:', orgEmailError.message);
            }
          }
        } catch (emailError) {
          console.error('⚠️ Confirmation email failed:', emailError.message);
        }

        console.log('🎉 All async operations completed');
      } catch (asyncError) {
        console.error('⚠️ Background async operations error:', asyncError);
      }
    }); // <- Close the setImmediate callback

} catch (error) {  // <- Closes the outer try that opened at line 613
    console.error('❌ Error submitting registration:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to submit registration' });
  }
};

// Get user's registration for a fest
const getUserRegistration = async (req, res) => {
  try {
    const { festId } = req.params;
    const userId = req.user.userId;

    const registration = await Registration.findOne({ fest: festId, user: userId })
      .populate('fest', 'festName collegeName')
      .populate('user', 'name email');

    if (!registration) {
      return res.status(404).json({ error: 'Registration not found' });
    }

    res.json(registration);

  } catch (error) {
    console.error('Error fetching registration:', error);
    res.status(500).json({ error: 'Failed to fetch registration' });
  }
};

// Get all registrations for a fest (admin only)
const getFestRegistrations = async (req, res) => {
  try {
    const { festId } = req.params;
    const { page = 1, limit = 20, status } = req.query;

    // Check if fest exists
    const fest = await FestOrganizer.findById(festId);
    if (!fest) {
      return res.status(404).json({ error: 'Fest not found' });
    }

    const query = { fest: festId };
    if (status) {
      query.status = status;
    }

    const registrations = await Registration.find(query)
      .populate('user', 'name email phone')
      .sort({ submittedAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Registration.countDocuments(query);

    res.json({
      registrations,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });

  } catch (error) {
    console.error('Error fetching fest registrations:', error);
    res.status(500).json({ error: 'Failed to fetch registrations' });
  }
};

// Update registration status (admin only)
const updateRegistrationStatus = async (req, res) => {
  try {
    const { registrationId } = req.params;
    const { status } = req.body;

    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const registration = await Registration.findByIdAndUpdate(
      registrationId,
      { status },
      { new: true }
    ).populate('user', 'name email');

    if (!registration) {
      return res.status(404).json({ error: 'Registration not found' });
    }

    res.json({
      message: 'Registration status updated successfully',
      registration
    });

  } catch (error) {
    console.error('Error updating registration status:', error);
    res.status(500).json({ error: 'Failed to update registration status' });
  }
};

// Get user's all registrations
const getUserRegistrations = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { page = 1, limit = 10 } = req.query;
    const EventShowRegistration = require('../model/event_show_registration_model');

    // Run all queries in parallel for a faster bookings page
    const [registrations, trekBookings, eventRegistrations, total] = await Promise.all([
      Registration.find({ user: userId })
        .populate('fest', 'festName collegeName festDate venue status coverImage registration ticketPrice')
        .populate('competitionId', 'name description coverImage registrationFee')
        .sort({ submittedAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .lean(),
      TrekBooking.find({ userId })
        .populate('trekId', 'trekName coverImage images registrationFee trekDate city difficultyLevel communityId')
        .sort({ createdAt: -1 })
        .lean(),
      EventShowRegistration.find({ user: userId })
        .populate('eventShow', 'title displayName eventType coverImage banner venue city showTimings ticketPrice status')
        .sort({ submittedAt: -1 })
        .lean(),
      Registration.countDocuments({ user: userId }),
    ]);

    res.json({
      registrations,
      trekBookings,
      eventRegistrations,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });

  } catch (error) {
    console.error('Error fetching user registrations:', error);
    res.status(500).json({ error: 'Failed to fetch registrations' });
  }
};

// Test Google Sheets connection
const testGoogleSheets = async (req, res) => {
  try {
    const { googleSheetsUrl } = req.body;
    
    if (!googleSheetsUrl) {
      return res.status(400).json({ error: 'Google Sheets URL is required' });
    }

    const result = await testGoogleSheetsConnection(googleSheetsUrl);
    
    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        title: result.title
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error testing Google Sheets connection:', error);
    res.status(500).json({ error: 'Failed to test Google Sheets connection' });
  }
};

// ✅ NEW: Diagnose Google Sheets integration for a specific fest
const diagnoseGoogleSheets = async (req, res) => {
  try {
    const { festId } = req.params;
    
    console.log('🔍 Diagnosing Google Sheets for fest:', festId);
    
    // Get fest details
    const fest = await FestOrganizer.findById(festId);
    if (!fest) {
      return res.status(404).json({ error: 'Fest not found' });
    }

    const diagnosis = {
      festName: fest.festName,
      festId: fest._id,
      issues: [],
      warnings: [],
      status: 'healthy'
    };

    // Check 1: Fest approval
    if (!fest.isApproved) {
      diagnosis.issues.push('Fest is not approved - registrations will be blocked');
      diagnosis.status = 'error';
    }

    // Check 2: Registration mode
    if (fest.registration?.mode !== 'INTERNAL_FORM') {
      diagnosis.issues.push(`Registration mode is "${fest.registration?.mode}" - should be "INTERNAL_FORM" for Google Sheets integration`);
      diagnosis.status = 'error';
    }

    // Check 3: Google Sheets URL
    if (!fest.registration?.googleSheetsUrl) {
      diagnosis.issues.push('No Google Sheets URL configured');
      diagnosis.status = 'error';
    } else {
      const { extractSpreadsheetId } = require('../services/googleSheetsService');
      const spreadsheetId = extractSpreadsheetId(fest.registration.googleSheetsUrl);
      
      if (!spreadsheetId) {
        diagnosis.issues.push('Invalid Google Sheets URL format');
        diagnosis.status = 'error';
      } else {
        diagnosis.spreadsheetId = spreadsheetId;
        
        // Test connection
        try {
          const connectionTest = await testGoogleSheetsConnection(fest.registration.googleSheetsUrl);
          if (connectionTest.success) {
            diagnosis.googleSheetsTitle = connectionTest.title;
            diagnosis.connectionStatus = 'success';
          } else {
            diagnosis.issues.push(`Google Sheets connection failed: ${connectionTest.error}`);
            diagnosis.connectionStatus = 'failed';
            diagnosis.status = 'error';
          }
        } catch (error) {
          diagnosis.issues.push(`Google Sheets connection error: ${error.message}`);
          diagnosis.connectionStatus = 'error';
          diagnosis.status = 'error';
        }
      }
    }

    // Check 4: Form schema
    if (!fest.registration?.formSchema || fest.registration.formSchema.length === 0) {
      diagnosis.issues.push('No form schema configured - Google Sheets headers cannot be created');
      diagnosis.status = 'error';
    } else {
      diagnosis.formFieldsCount = fest.registration.formSchema.length;
      
      const fieldsWithoutFieldName = fest.registration.formSchema.filter(f => !f.fieldName);
      if (fieldsWithoutFieldName.length > 0) {
        diagnosis.warnings.push(`${fieldsWithoutFieldName.length} form fields missing fieldName - may cause data mapping issues`);
        if (diagnosis.status === 'healthy') diagnosis.status = 'warning';
      }
    }

    // Check 5: Environment variables
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
      diagnosis.issues.push('Google service account credentials not configured in environment variables');
      diagnosis.status = 'error';
    }

    // Provide solutions
    diagnosis.solutions = [];
    if (diagnosis.issues.length > 0) {
      diagnosis.solutions.push('Fix the issues listed above to enable Google Sheets integration');
      
      if (diagnosis.issues.some(i => i.includes('not approved'))) {
        diagnosis.solutions.push('Approve the fest in the admin panel');
      }
      
      if (diagnosis.issues.some(i => i.includes('registration mode'))) {
        diagnosis.solutions.push('Set registration mode to "INTERNAL_FORM" in fest settings');
      }
      
      if (diagnosis.issues.some(i => i.includes('Google Sheets URL'))) {
        diagnosis.solutions.push('Configure a valid Google Sheets URL in fest registration settings');
      }
      
      if (diagnosis.issues.some(i => i.includes('permission') || i.includes('connection failed'))) {
        diagnosis.solutions.push(`Share the Google Sheets with service account: ${process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL}`);
      }
      
      if (diagnosis.issues.some(i => i.includes('form schema'))) {
        diagnosis.solutions.push('Configure form fields in the fest registration settings');
      }
    }

    res.json(diagnosis);

  } catch (error) {
    console.error('Error diagnosing Google Sheets:', error);
    res.status(500).json({ error: 'Failed to diagnose Google Sheets integration' });
  }
};



// Get single registration details
const getRegistrationDetails = async (req, res) => {
  try {
    const { registrationId } = req.params;
    const userId = req.user.userId;

    const registration = await Registration.findOne({
      _id: registrationId,
      user: userId
    })
      .populate('fest', 'festName collegeName festDate venue status coverImage registration')
      .populate('competitionId', 'name description coverImage');

    if (!registration) {
      return res.status(404).json({ error: 'Registration not found' });
    }

    res.json(registration);

  } catch (error) {
    console.error('Error fetching registration details:', error);
    res.status(500).json({ error: 'Failed to fetch registration details' });
  }
};

// Get single event-show registration details
const getEventShowRegistrationDetails = async (req, res) => {
  try {
    const { registrationId } = req.params;
    const userId = req.user.userId;
    const EventShowRegistration = require('../model/event_show_registration_model');

    const registration = await EventShowRegistration.findOne({
      _id: registrationId,
      user: userId,
    })
      .populate('eventShow', 'title displayName eventType venue city showTimings coverImage banner registration ticketPrice status')
      .lean();

    if (!registration) {
      return res.status(404).json({ error: 'Event registration not found' });
    }

    res.json(registration);

  } catch (error) {
    console.error('Error fetching event registration details:', error);
    res.status(500).json({ error: 'Failed to fetch event registration details' });
  }
};

const getTrekBookingDetails = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user.userId;

    const booking = await TrekBooking.findOne({ _id: bookingId, userId })
      .populate('trekId', 'trekName city coverImage images trekDate difficultyLevel registration');

    if (!booking) {
      return res.status(404).json({ error: 'Trek booking not found' });
    }

    res.json(booking);
  } catch (error) {
    console.error('Error fetching trek booking details:', error);
    res.status(500).json({ error: 'Failed to fetch trek booking details' });
  }
};

const formatInvoiceDate = (date) =>
  new Date(date).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const getPaymentInvoice = async (req, res) => {
  try {
    const { registrationId } = req.params;
    const userId = req.user.userId;

    const registration = await Registration.findOne({ _id: registrationId, user: userId })
      .populate('fest', 'festName collegeName festDate venue')
      .populate('competitionId', 'name registrationFee')
      .populate('user', 'name email phoneNumber');

    if (!registration) {
      return res.status(404).json({ error: 'Registration not found' });
    }

    const isPaid =
      registration.paymentStatus === 'paid' ||
      (registration.amountPaid && registration.amountPaid > 0);

    if (!isPaid || !registration.payment_order_id) {
      return res.status(404).json({ error: 'No payment receipt available for this registration' });
    }

    const isCompetition = !!registration.competitionId;
    const eventName = isCompetition
      ? registration.competitionId?.name
      : registration.fest?.festName;

    res.json({
      success: true,
      data: {
        invoiceNumber: registration.payment_order_id,
        registrationId: registration._id,
        eventName: eventName || 'Event',
        eventType: isCompetition ? 'Competition' : 'Fest',
        festName: registration.fest?.festName || null,
        eventDate: registration.fest?.festDate || null,
        venue: registration.fest?.venue || registration.fest?.collegeName || null,
        customerName: registration.user?.name || 'Customer',
        customerEmail: registration.user?.email || '',
        customerPhone: registration.user?.phoneNumber || '',
        amountPaid: registration.amountPaid || 0,
        currency: 'INR',
        paymentId: registration.payment_id || '',
        orderId: registration.payment_order_id || '',
        paymentGateway: registration.payment_gateway || 'cashfree',
        paidAt: registration.submittedAt || registration.createdAt,
        paidAtFormatted: formatInvoiceDate(registration.submittedAt || registration.createdAt),
      },
    });
  } catch (error) {
    console.error('Error fetching payment invoice:', error);
    res.status(500).json({ error: 'Failed to fetch payment receipt' });
  }
};

const getTrekPaymentInvoice = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user.userId;

    const booking = await TrekBooking.findOne({ _id: bookingId, userId })
      .populate('trekId', 'trekName city trekDate')
      .populate('userId', 'name email phoneNumber');

    if (!booking) {
      return res.status(404).json({ error: 'Trek booking not found' });
    }

    const amountPaid = booking.bookingDetails?.amountPaid || 0;
    const orderId =
      booking.payment_order_id ||
      booking.bookingDetails?.payment_order_id ||
      '';

    if (amountPaid <= 0 || !orderId) {
      return res.status(404).json({ error: 'No payment receipt available for this booking' });
    }

    res.json({
      success: true,
      data: {
        invoiceNumber: orderId,
        registrationId: booking._id,
        eventName: booking.trekId?.trekName || 'Trek',
        eventType: 'Trek',
        festName: null,
        eventDate: booking.bookingDetails?.date || booking.trekId?.trekDate || null,
        venue: booking.trekId?.city || null,
        customerName: booking.userId?.name || booking.userName || 'Customer',
        customerEmail: booking.userId?.email || booking.userEmail || '',
        customerPhone: booking.userId?.phoneNumber || '',
        amountPaid,
        currency: 'INR',
        paymentId: booking.bookingDetails?.paymentId || '',
        orderId,
        paymentGateway: 'cashfree',
        paidAt: booking.createdAt,
        paidAtFormatted: formatInvoiceDate(booking.createdAt),
        people: booking.bookingDetails?.people || 1,
      },
    });
  } catch (error) {
    console.error('Error fetching trek payment invoice:', error);
    res.status(500).json({ error: 'Failed to fetch payment receipt' });
  }
};

const getEventShowPaymentInvoice = async (req, res) => {
  try {
    const { registrationId } = req.params;
    const userId = req.user.userId;
    const EventShowRegistration = require('../model/event_show_registration_model');

    const registration = await EventShowRegistration.findOne({ _id: registrationId, user: userId })
      .populate('eventShow', 'title displayName venue city showTimings')
      .populate('user', 'name email phoneNumber');

    if (!registration) {
      return res.status(404).json({ error: 'Event registration not found' });
    }

    const isPaid =
      registration.paymentStatus === 'paid' ||
      (registration.amountPaid && registration.amountPaid > 0);

    if (!isPaid || !registration.payment_order_id) {
      return res.status(404).json({ error: 'No payment receipt available for this registration' });
    }

    const show = registration.eventShow || {};
    const eventName = show.displayName || show.title || 'Event';

    res.json({
      success: true,
      data: {
        invoiceNumber: registration.payment_order_id,
        registrationId: registration._id,
        eventName,
        eventType: 'Event',
        festName: null,
        eventDate: show.showTimings?.[0]?.date || null,
        venue: show.venue || show.city || null,
        customerName: registration.user?.name || 'Customer',
        customerEmail: registration.user?.email || '',
        customerPhone: registration.user?.phoneNumber || '',
        amountPaid: registration.amountPaid || 0,
        currency: 'INR',
        paymentId: registration.payment_id || '',
        orderId: registration.payment_order_id || '',
        paymentGateway: registration.payment_gateway || 'cashfree',
        paidAt: registration.submittedAt || registration.createdAt,
        paidAtFormatted: formatInvoiceDate(registration.submittedAt || registration.createdAt),
      },
    });
  } catch (error) {
    console.error('Error fetching event payment invoice:', error);
    res.status(500).json({ error: 'Failed to fetch payment receipt' });
  }
};

// Pay-and-register for FESTS: Cashfree payment flow, uses user profile data
// POST /api/registrations/fests/:festId/pay-and-register
const payAndRegisterFest = async (req, res) => {
  try {
    const { festId } = req.params;
    const userId = req.user.userId;

    const fest = await FestOrganizer.findById(festId);
    if (!fest) return res.status(404).json({ error: 'Fest not found' });

    if (!fest.feeAmount || fest.feeAmount <= 0) {
      return res.status(400).json({ error: 'This fest does not require payment' });
    }

    const { verifyPaymentForRegistration } = require('../utils/paymentVerification');
    const paymentCheck = await verifyPaymentForRegistration(req.body);
    if (!paymentCheck.ok) {
      return res.status(400).json({ error: paymentCheck.error || 'Payment verification failed' });
    }

    const payment_order_id = paymentCheck.orderId;
    const payment_id = paymentCheck.paymentId;
    const festTotalAmount = buildPriceBreakdown(fest.feeAmount).totalAmount;

    // Idempotent: if this exact payment already produced a registration, return it
    // so a re-fired resume (double submit / page revisit) succeeds instead of erroring.
    // Scoped to this fest + user so an unrelated order id can never falsely match.
    const alreadyPaid = payment_order_id
      ? await Registration.findOne({
          payment_order_id,
          fest: festId,
          user: userId,
          competitionId: null,
        })
      : null;
    if (alreadyPaid) {
      return res.status(200).json({
        success: true,
        message: 'Registration already completed',
        _id: alreadyPaid._id,
        registrationId: alreadyPaid._id,
        festName: fest.festName,
        amountPaid: alreadyPaid.amountPaid,
      });
    }

    // Repeat registrations are allowed: each verified payment gets its own
    // registration. Retries of the SAME payment are caught by the order-scoped
    // idempotency check above, so no duplicate can come from a resume/double-submit.
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const registration = new Registration({
      fest: festId,
      user: userId,
      responses: {
        name: user.name || '',
        email: user.email || '',
        phone: user.phoneNumber || '',
      },
      status: 'approved',
      payment_order_id,
      payment_id,
      payment_gateway: 'cashfree',
      paymentStatus: 'paid',
      amountPaid: festTotalAmount,
      submittedAt: new Date(),
    });

    await registration.save();
    console.log('✅ Fest pay-and-register saved:', registration._id);

    const festRegistrationLink = `/registration-details/${registration._id}`;

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      _id: registration._id,
      registrationId: registration._id,
      festName: fest.festName,
      amountPaid: festTotalAmount,
    });

    scheduleRegistrationNotification(userId, {
      title: 'Fest Registration Confirmed!',
      message: `You've successfully registered for ${fest.festName}.`,
      body: `You've registered for ${fest.festName}`,
      link: festRegistrationLink,
      metadata: { festId: fest._id, registrationId: registration._id },
    });

    setImmediate(async () => {
      try {
        await sendRegistrationThankYouEmail(user.email, user.name, fest.festName).catch(() => {});
        await sendRegistrationConfirmationEmail(
          user.email, user.name,
          fest.festName, null,
          registration._id.toString(),
          new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
          { status: 'paid', method: 'cashfree' }
        ).catch(() => {});

        // Google Sheets
        if (fest.registration?.googleSheetsUrl) {
          await appendPaymentOnlyToSheets(fest.registration.googleSheetsUrl, {
            name: user.name,
            email: user.email,
            phone: user.phoneNumber || '',
            amountPaid: festTotalAmount,
            paymentId: payment_id,
            entityName: fest.festName,
            entityType: 'Fest',
          }).catch(e => console.error('❌ Sheets error (payAndRegisterFest):', e.message));
        }
      } catch (bgErr) {
        console.error('❌ fest pay-and-register background error:', bgErr);
      }
    });
  } catch (err) {
    console.error('❌ payAndRegisterFest error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
};

// Pay-and-register for COMPETITIONS: Cashfree payment flow with no form
// POST /api/registrations/competitions/:competitionId/pay-and-register
const payAndRegister = async (req, res) => {
  try {
    const { competitionId } = req.params;
    const userId = req.user.userId;

    const Competition = require('../model/competition_model');
    const competition = await Competition.findById(competitionId).populate('fest');
    if (!competition) return res.status(404).json({ error: 'Competition not found' });
    const competitionTicketPrice = parseTicketPrice(competition.feeAmount) || parseTicketPrice(competition.registrationFee);
    const competitionTotalAmount = buildPriceBreakdown(competitionTicketPrice).totalAmount;

    if (competitionTicketPrice <= 0) {
      return res.status(400).json({ error: 'This competition does not require payment' });
    }

    const { verifyPaymentForRegistration } = require('../utils/paymentVerification');
    const paymentCheck = await verifyPaymentForRegistration(req.body);
    if (!paymentCheck.ok) {
      return res.status(400).json({ error: paymentCheck.error || 'Payment verification failed' });
    }

    const payment_order_id = paymentCheck.orderId;
    const payment_id = paymentCheck.paymentId;

    // Idempotent: if this exact payment already produced a registration, return it
    // so a re-fired resume (double submit / page revisit) succeeds instead of erroring.
    // Scoped to this fest + competition + user so an unrelated order id can't match.
    const alreadyPaid = payment_order_id
      ? await Registration.findOne({
          payment_order_id,
          fest: competition.fest._id,
          competitionId: competition._id,
          user: userId,
        })
      : null;
    if (alreadyPaid) {
      return res.status(200).json({
        success: true,
        message: 'Registration already completed',
        _id: alreadyPaid._id,
        registrationId: alreadyPaid._id,
        competitionName: competition.name,
        amountPaid: alreadyPaid.amountPaid,
      });
    }

    // Repeat registrations are allowed: each verified payment gets its own
    // registration. Retries of the SAME payment are caught by the order-scoped
    // idempotency check above, so no duplicate can come from a resume/double-submit.
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const registration = new Registration({
      fest: competition.fest._id,
      user: userId,
      competitionId: competition._id,
      responses: {
        name: user.name || '',
        email: user.email || '',
        phone: user.phoneNumber || '',
      },
      status: 'approved',
      payment_order_id,
      payment_id,
      payment_gateway: 'cashfree',
      paymentStatus: 'paid',
      amountPaid: competitionTotalAmount,
      submittedAt: new Date(),
    });

    await registration.save();
    console.log('✅ Pay-and-register saved:', registration._id);

    const payCompRegistrationLink = `/registration-details/${registration._id}`;

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      _id: registration._id,
      registrationId: registration._id,
      competitionName: competition.name,
      amountPaid: competitionTotalAmount,
    });

    scheduleRegistrationNotification(userId, {
      title: 'Registration Confirmed!',
      message: `You've successfully registered for ${competition.name}.`,
      body: `You've registered for ${competition.name}`,
      link: payCompRegistrationLink,
      metadata: {
        competitionId: competition._id,
        festId: competition.fest?._id,
        registrationId: registration._id,
      },
    });

    // Background: emails + sheets
    setImmediate(async () => {
      try {
        await sendRegistrationThankYouEmail(user.email, user.name, competition.name).catch(() => {});
        await sendRegistrationConfirmationEmail(
          user.email, user.name,
          competition.fest?.festName || competition.name,
          competition.name,
          registration._id.toString(),
          new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
          { status: 'paid', method: 'cashfree' }
        ).catch(() => {});

        // Google Sheets — use the fest's Google Sheets URL if configured
        const sheetsUrl = competition.fest?.registration?.googleSheetsUrl;
        if (sheetsUrl) {
          await appendPaymentOnlyToSheets(sheetsUrl, {
            name: user.name,
            email: user.email,
            phone: user.phoneNumber || '',
            amountPaid: competitionTotalAmount,
            paymentId: payment_id,
            entityName: competition.name,
            entityType: 'Competition',
          }).catch(e => console.error('❌ Sheets error (payAndRegister):', e.message));
        }
      } catch (bgErr) {
        console.error('❌ pay-and-register background error:', bgErr);
      }
    });
  } catch (err) {
    console.error('❌ payAndRegister error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
};

/**
 * Submit an internal EventShow registration (authed, paid via Cashfree).
 * Mirrors the competition custom flow: multipart responses + files + payment verify.
 */
const submitEventShowRegistration = async (req, res) => {
  try {
    const { eventShowId } = req.params;
    const userId = req.user.userId;

    const EventShow = require('../model/event_show_model');
    const EventShowRegistration = require('../model/event_show_registration_model');
    const { buildEventPriceBreakdown } = require('../utils/platformFee');

    const eventShow = await EventShow.findById(eventShowId);
    if (!eventShow) return res.status(404).json({ error: 'Event not found' });

    const reg = eventShow.registration || {};
    if (reg.status !== 'open' || reg.mode !== 'internal_form') {
      return res.status(400).json({ error: 'Registration is not open for this event.' });
    }

    // Parse responses (JSON or FormData string)
    let responses = req.body.responses;
    if (typeof responses === 'string') {
      try {
        responses = JSON.parse(responses);
      } catch {
        return res.status(400).json({ error: 'Invalid responses format' });
      }
    }
    if (!responses || typeof responses !== 'object') responses = {};

    // Handle file uploads (store Cloudinary URLs back into responses)
    const files = req.files || [];
    if (files.length > 0) {
      for (const file of files) {
        try {
          const result = await uploadToCloudinary(
            file.buffer,
            file.originalname,
            'event-registration',
            `event_${eventShowId}_${Date.now()}`,
            userId,
            file.fieldname
          );
          if (result.success) {
            const entry = {
              fileName: file.originalname,
              url: result.cloudinaryLink,
              size: file.size,
              uploaded: true,
            };
            const existing = responses[file.fieldname];
            if (existing === undefined) {
              responses[file.fieldname] = entry;
            } else if (Array.isArray(existing)) {
              existing.push(entry);
            } else {
              responses[file.fieldname] = [existing, entry];
            }
          }
        } catch (uploadErr) {
          console.error('❌ Event registration file upload error:', uploadErr.message);
        }
      }
    }

    // Verify payment when the event has a fee
    const ticketPrice = Number(eventShow.ticketPrice) || 0;
    const totalAmount = buildEventPriceBreakdown(ticketPrice).totalAmount;
    let payment_order_id = null;
    let payment_id = null;
    let paymentStatus = 'free';

    if (ticketPrice > 0) {
      const { verifyPaymentForRegistration } = require('../utils/paymentVerification');
      const paymentCheck = await verifyPaymentForRegistration(req.body);
      if (!paymentCheck.ok) {
        return res.status(400).json({ error: paymentCheck.error || 'Payment is required for this event.' });
      }
      payment_order_id = paymentCheck.orderId;
      payment_id = paymentCheck.paymentId;
      paymentStatus = 'paid';
    }

    // Idempotent: a paid order must not create duplicate event registrations.
    // Scoped to this event + user so an unrelated order id can never falsely match.
    if (payment_order_id) {
      const alreadyPaid = await EventShowRegistration.findOne({
        payment_order_id,
        eventShow: eventShow._id,
        user: userId,
      });
      if (alreadyPaid) {
        return res.status(200).json({
          success: true,
          message: 'Registration already completed',
          _id: alreadyPaid._id,
          registrationId: alreadyPaid._id,
          eventName: eventShow.title,
          amountPaid: alreadyPaid.amountPaid,
        });
      }
    }

    const user = await User.findById(userId);

    const registration = new EventShowRegistration({
      eventShow: eventShow._id,
      user: userId,
      responses,
      status: 'pending',
      payment_order_id,
      payment_id,
      payment_gateway: paymentStatus === 'paid' ? 'cashfree' : null,
      paymentStatus,
      amountPaid: paymentStatus === 'paid' ? totalAmount : 0,
      submittedAt: new Date(),
    });

    await registration.save();

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      _id: registration._id,
      registrationId: registration._id,
      eventName: eventShow.title,
      amountPaid: registration.amountPaid,
    });

    scheduleRegistrationNotification(userId, {
      title: 'Registration Confirmed!',
      message: `You've successfully registered for ${eventShow.title}.`,
      body: `You've registered for ${eventShow.title}`,
      link: `/registration-details/${registration._id}?type=event`,
      metadata: { eventShowId: eventShow._id, registrationId: registration._id },
    });

    setImmediate(async () => {
      try {
        if (user?.email) {
          await sendRegistrationThankYouEmail(user.email, user.name, eventShow.title).catch(() => {});
        }

        // Auto-append the registration to the organiser's Google Sheet (incl. payment id)
        const sheetsUrl = eventShow.registration?.googleSheetsUrl;
        if (sheetsUrl) {
          try {
            const { appendToEventGoogleSheets } = require('../services/googleSheetsService');

            // Flatten the form schema (single or multi-step) for column mapping
            let formSchema = [];
            const formType = eventShow.registration?.formType || 'SINGLE_STEP';
            if (formType === 'MULTI_STEP') {
              formSchema = (eventShow.registration?.steps || []).reduce(
                (all, step) => all.concat(step.fields || []),
                [],
              );
            } else {
              formSchema = eventShow.registration?.formSchema || [];
            }

            await appendToEventGoogleSheets(
              sheetsUrl,
              responses,
              {
                eventName: eventShow.title,
                registrationId: registration._id,
                amountPaid: registration.amountPaid,
                paymentId: registration.payment_id || '',
                paymentStatus: registration.paymentStatus,
              },
              {
                name: user?.name,
                email: user?.email,
                phone: user?.phoneNumber || user?.phone || '',
              },
              formSchema,
            );
          } catch (sheetsErr) {
            console.error('❌ Event Google Sheets sync error:', sheetsErr.message);
          }
        }
      } catch (bgErr) {
        console.error('❌ event registration background error:', bgErr.message);
      }
    });
  } catch (err) {
    console.error('❌ submitEventShowRegistration error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
};

module.exports = {
  submitRegistration,
  submitCompetitionRegistration,
  submitCustomCompetitionRegistration,
  submitEventShowRegistration,
  payAndRegisterFest,
  payAndRegister,
  getUserRegistration,
  getFestRegistrations,
  updateRegistrationStatus,
  getUserRegistrations,
  getRegistrationDetails,
  getEventShowRegistrationDetails,
  getTrekBookingDetails,
  getPaymentInvoice,
  getTrekPaymentInvoice,
  getEventShowPaymentInvoice,
  testGoogleSheets,
  diagnoseGoogleSheets,
  upload
};
