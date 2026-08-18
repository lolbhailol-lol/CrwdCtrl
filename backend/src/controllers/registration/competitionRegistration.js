const Registration = require('../../model/registration_model');
const User = require('../../model/usermodel');
const { uploadToCloudinary } = require('../../services/cloudinaryService');
const { sendRegistrationThankYouEmail, sendRegistrationConfirmationEmail, sendOrganizerNotificationEmail } = require('../../services/emailService');
const { consumeCouponUsageForOrder } = require('../../utils/couponPricing');
const { buildPriceBreakdown, parseTicketPrice } = require('../../utils/platformFee');
const { resolveTrekPlatformFeePercent } = require('../../utils/trekRegistrationFee');
const { competitionRequiresPayment, resolvePaidOrderTotal } = require('../../utils/competitionFeeTiers');
const { logger } = require('../../utils/logger');
const {
  parseResponsesBody,
  maybeEnrichExistingResponses,
  scheduleRegistrationNotification,
} = require('./helpers');

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
        logger.error('❌ Failed to parse responses JSON:', parseErr);
        return res.status(400).json({ error: 'Invalid responses format' });
      }
    }
    
    // Ensure responses is an object
    if (!responses || typeof responses !== 'object') {
      responses = {};
    }
    
    // ✅ NEW: Handle file uploads from FormData
    const files = req.files || [];
    logger.debug('📁 Received files:', files.length, files.map(f => ({ fieldname: f.fieldname, size: f.size })));

    const { userInfo } = req.body;

    logger.debug('🏆 Custom competition registration request:', { 
      competitionId, 
      userId, 
      responsesKeys: Object.keys(responses),
      hasFiles: files.length > 0,
      hasTransactionId: !!transactionId,
      hasPaymentReceiptUrl: !!paymentReceiptUrl,
      userInfo 
    });

    // Check if competition exists and has custom internal form registration
    const Competition = require('../../model/competition_model');
    const competition = await Competition.findById(competitionId).populate('fest');
    
    if (!competition) {
      logger.debug('❌ Competition not found:', competitionId);
      return res.status(404).json({ error: 'Competition not found' });
    }

    logger.debug('🔍 Competition found:', {
      name: competition.name,
      registrationType: competition.registrationType,
      registrationStatus: competition.registration?.status
    });

    if (competition.registrationType !== 'custom') {
      logger.debug('❌ Not a custom registration competition');
      return res.status(400).json({ error: 'This competition does not have custom registration' });
    }

    if (competition.registration?.status !== 'internal_form') {
      logger.debug('❌ Not internal form registration');
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
      logger.debug('❌ No form fields configured:', { competitionId, formType, fieldsCount });
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

    logger.debug('📝 Competition form:', { formType, fields: formSchemaToValidate.length, responseKeys: Object.keys(responses).length });

    // ✅ NEW: Handle file uploads - store file info in responses
    if (files.length > 0) {
      const { uploadToCloudinary } = require('../../services/cloudinaryService');
      
      for (const file of files) {
        try {
          logger.debug('📤 Uploading file to Cloudinary:', { fieldname: file.fieldname, size: file.size, mimetype: file.mimetype });
          
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
            logger.debug('✅ File uploaded successfully:', { fieldname: file.fieldname, url: result.cloudinaryLink });
          } else {
            logger.error('❌ File upload failed:', result.error);
            return res.status(400).json({ error: `File upload failed for ${file.fieldname}` });
          }
        } catch (uploadErr) {
          logger.error('❌ Upload error:', uploadErr);
          return res.status(500).json({ error: 'File upload failed' });
        }
      }
    }

    // ✅ NEW: Add transaction ID and payment receipt to responses if provided
    // Use proper case names for Google Sheets compatibility
    if (transactionId) {
      responses['Transaction ID'] = transactionId;
      logger.debug('💳 Added transaction ID to responses:', transactionId);
    }
    if (paymentReceiptUrl) {
      responses['Payment Receipt'] = paymentReceiptUrl;
      logger.debug('💳 Added payment receipt URL to responses:', paymentReceiptUrl);
    }

    // Verify Cashfree payment BEFORE field validation — after redirect checkout
    // file inputs are often missing from the resumed form; payment must still succeed.
    let paymentOrderId = null;
    let paymentId = null;
    let paymentStatus = 'free';
    const competitionTicketPrice = parseTicketPrice(competition.feeAmount) || parseTicketPrice(competition.registrationFee);
    const festPlatformFeePercent = resolveTrekPlatformFeePercent(competition.fest?.platformFeePercent, 3);
    let competitionTotalAmount = buildPriceBreakdown(competitionTicketPrice, festPlatformFeePercent).totalAmount;

    if (competitionRequiresPayment(competition)) {
      const { verifyPaymentForRegistration } = require('../../utils/paymentVerification');
      const paymentCheck = await verifyPaymentForRegistration(req.body);
      if (!paymentCheck.ok) {
        return res.status(400).json({ error: paymentCheck.error || 'Payment is required for this competition.' });
      }

      paymentOrderId = paymentCheck.orderId;
      paymentId = paymentCheck.paymentId;
      paymentStatus = 'paid';
      competitionTotalAmount = await resolvePaidOrderTotal(paymentOrderId, competitionTotalAmount);
      logger.debug('✅ Cashfree payment verified:', paymentId);

      const existingRegistration = await Registration.findOne({
        payment_order_id: paymentOrderId,
        fest: competition.fest._id,
        competitionId: competition._id,
        user: userId,
      });
      if (existingRegistration) {
        logger.debug('ℹ️ Existing competition registration found:', existingRegistration._id);
        await maybeEnrichExistingResponses(existingRegistration, responses);
        return res.status(200).json({
          success: true,
          alreadyRegistered: true,
          message: 'Registration already completed',
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
    }

    // Validate required fields — skip file requirements when payment is verified.
    const requiredFields = formSchemaToValidate.filter(field => field.required);
    for (const field of requiredFields) {
      if (paymentStatus === 'paid' && (field.type === 'file' || field.type === 'image')) {
        continue;
      }

      // Try multiple field ID formats for compatibility
      let fieldId = null;
      let fieldValue = null;

      if (field.fieldName && responses[field.fieldName]) {
        fieldId = field.fieldName;
        fieldValue = responses[field.fieldName];
      } else if (field.id && responses[field.id]) {
        fieldId = field.id;
        fieldValue = responses[field.id];
      } else if (field.id && responses[`field_${field.id}`]) {
        fieldId = `field_${field.id}`;
        fieldValue = responses[fieldId];
      } else if (field.label) {
        const generatedId = `field_${field.label.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')}`;
        if (responses[generatedId]) {
          fieldId = generatedId;
          fieldValue = responses[generatedId];
        }
      }

      if (field.type === 'file' || field.type === 'image') {
        const hasFile =
          (typeof fieldValue === 'string' && fieldValue.trim() !== '') ||
          (typeof fieldValue === 'object' &&
            fieldValue !== null &&
            !!(fieldValue.url || fieldValue.cloudinaryLink || fieldValue.uploaded));
        if (!hasFile) {
          logger.debug('❌ Required file field missing:', field.label);
          return res.status(400).json({
            error: `${field.label} is required`,
            details: { missingField: field.label, fieldType: 'file' },
          });
        }
      } else if (!fieldValue ||
          (Array.isArray(fieldValue) && fieldValue.length === 0) ||
          (typeof fieldValue === 'string' && fieldValue.trim() === '')) {
        logger.debug('❌ Required field missing:', field.label);
        return res.status(400).json({
          error: `${field.label} is required`,
          details: {
            missingField: field.label,
            triedFieldIds: [field.fieldName, field.id, `field_${field.id}`],
            receivedFields: Object.keys(responses),
          },
        });
      }
    }

    const registrationId = `COMP_REG_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    logger.debug('🆔 Generated registration ID:', registrationId);

    const User = require('../../model/usermodel');
    const user = await User.findById(userId).select('name email phoneNumber');
    if (!user) {
      logger.debug('❌ User not found:', userId);
      return res.status(404).json({ error: 'User not found' });
    }

    // Create registration record
    const festIdForReg = competition.fest?._id || competition.fest;
    const { isMindSparkFestId } = require('../../utils/personFields');
    const autoConfirm = isMindSparkFestId(festIdForReg)
      || paymentStatus === 'paid'
      || paymentStatus === 'free';
    const registration = new Registration({
      fest: competition.fest._id,
      user: userId,
      competitionId: competition._id,
      responses: responses,
      status: autoConfirm ? 'approved' : 'pending',
      payment_order_id: paymentOrderId,
      payment_id: paymentId,
      payment_gateway: paymentStatus === 'paid' ? 'cashfree' : null,
      paymentStatus,
      amountPaid: paymentStatus === 'paid' ? competitionTotalAmount : 0,
      submittedAt: new Date()
    });

    await registration.save();
    logger.debug('✅ Registration saved to database');
    if (paymentOrderId) {
      consumeCouponUsageForOrder({ paymentOrderId, userId }).catch(() => {});
    }

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
          logger.debug('📧 Sending thank you email (async)...');
          await sendRegistrationThankYouEmail(
            user.email,
            user.name,
            competition.fest?.festName || competition.name,
            {
              type: 'competition',
              ticketLink: `/registration-details/${registration._id}`,
            },
          );
          logger.debug('✅ Thank you email sent successfully');
        } catch (emailError) {
          logger.error('❌ Thank you email error:', emailError);
        }

        // STEP 2: Send confirmation email (queued automatically for rate limiting)
        try {
          logger.debug('📧 Sending confirmation email (async)...');
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
            competition.fest?.festName || competition.name,
            competition.name,
            registrationId,
            submissionDate,
            {
              status: paymentStatus,
              method: paymentStatus === 'paid' ? 'cashfree' : 'free',
              type: 'competition',
              ticketLink: `/registration-details/${registration._id}`,
              groupLink:
                String(competition.registration?.whatsappGroupLink || '').trim()
                || String(competition.fest?.registration?.whatsappCommunityLink || '').trim(),
              communityName: competition.name || competition.fest?.festName || '',
            },
          );
          logger.debug('✅ Confirmation email sent successfully');
        } catch (emailError) {
          logger.error('❌ Confirmation email error:', emailError);
        }

        // STEP 3: Send organizer notification email if configured (queued automatically)
        // Check both confirmationEmail (competition model) and organizerEmail (fest model) for flexibility
        const organizerEmail = competition.registration.confirmationEmail || 
                               competition.registration.organizerEmail ||
                               competition.fest?.registration?.organizerEmail;
        
        logger.debug('📧 Organizer email check:', {
          confirmationEmail: competition.registration.confirmationEmail,
          organizerEmail: competition.registration.organizerEmail,
          festOrganizerEmail: competition.fest?.registration?.organizerEmail,
          finalEmail: organizerEmail
        });
        
        if (organizerEmail) {
          try {
            logger.debug('📧 Sending organizer notification email to:', organizerEmail);
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
            logger.debug('✅ Organizer notification email sent successfully');
          } catch (orgEmailError) {
            logger.error('❌ Organizer notification email error:', orgEmailError);
          }
        } else {
          logger.debug('⚠️ No organizer email configured - skipping organizer notification');
        }

        // STEP 4: Add to Google Sheets (async, non-blocking)
        if (competition.registration.googleSheetsUrl) {
          try {
            logger.debug('📊 Adding registration to Google Sheets (async)...');
            const { appendToCompetitionGoogleSheets } = require('../../services/googleSheetsService');

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
                festName: competition.fest?.festName || competition.name,
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
            logger.debug('✅ Data sent to Google Sheets successfully (async)');
          } catch (sheetsError) {
            logger.error('❌ Google Sheets error (async):', sheetsError);
          }
        }

      } catch (backgroundError) {
        logger.error('❌ Background task error:', backgroundError);
      }
    });

  } catch (error) {
    logger.error('❌ Competition registration error:', error);
    logger.error('❌ Error stack:', error.stack);
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

    logger.debug('🏆 Competition registration request:', { competitionId, userId });

    // Check if competition exists and has started registration
    const Competition = require('../../model/competition_model');
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

    logger.debug('📝 Form schema:', formSchema?.length || 0, 'fields');
    logger.debug('📁 Files received:', req.files?.length || 0);

    // Parse form data and files (same as fest registration)
    const responses = {};
    const uploadedFiles = {};

    // Process text fields from request body
    if (req.body.responses) {
      const parsedResponses = typeof req.body.responses === 'string' 
        ? JSON.parse(req.body.responses) 
        : req.body.responses;
      Object.assign(responses, parsedResponses);
      logger.debug('📝 Text responses parsed:', Object.keys(responses));
    }

    // ✅ CRITICAL: Capture payment receipt URL and transaction ID separately (sent as form fields, not in responses JSON)
    if (req.body.paymentReceiptUrl) {
      responses['Payment Receipt'] = req.body.paymentReceiptUrl;
      logger.debug('💳 Captured payment receipt URL from form field:', req.body.paymentReceiptUrl);
    }
    if (req.body.transactionId) {
      responses['Transaction ID'] = req.body.transactionId;
      logger.debug('💳 Captured transaction ID from form field:', req.body.transactionId);
    }

    logger.debug('📝 All responses after payment capture:', {
      hasPaymentReceipt: !!responses['Payment Receipt'],
      hasTransactionId: !!responses['Transaction ID'],
      totalFields: Object.keys(responses).length
    });

    // CRITICAL: Create registration ID for folder structure
    const registrationId = `REG_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    logger.debug('🆔 Generated registration ID:', registrationId);

    // Process uploaded files with proper field matching (same as fest registration)
    if (req.files && req.files.length > 0) {
      logger.debug('📁 Processing uploaded files:', req.files.length);
      
      for (const file of req.files) {
        logger.debug('📤 Processing file:', {
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

          logger.debug('☁️ Cloudinary upload successful:', {
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
            logger.error('❌ Cloudinary upload failed:', uploadResult.error);
            return res.status(500).json({ 
              error: `Failed to upload ${file.originalname}`,
              details: uploadResult.error 
            });
          }

        } catch (uploadError) {
          logger.error('❌ Cloudinary upload failed:', uploadError);
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
      logger.debug('💳 Added Payment Receipt to processed responses:', responses['Payment Receipt']);
    }
    if (responses['Transaction ID']) {
      processedResponses['Transaction ID'] = responses['Transaction ID'];
      logger.debug('💳 Added Transaction ID to processed responses:', responses['Transaction ID']);
    }

    logger.debug('🔄 Processed responses:', Object.keys(processedResponses));

    // Verify Cashfree payment BEFORE field validation so a verified payment can
    // never be blocked by missing file uploads after redirect checkout.
    let paymentOrderId = null;
    let paymentId = null;
    let paymentStatusRoute = 'free';
    const competitionTicketPrice = parseTicketPrice(competition.feeAmount) || parseTicketPrice(competition.registrationFee);
    const festPlatformFeePercent = resolveTrekPlatformFeePercent(fest?.platformFeePercent, 3);
    let competitionTotalAmount = buildPriceBreakdown(competitionTicketPrice, festPlatformFeePercent).totalAmount;
    const paymentVerified = competitionRequiresPayment(competition);

    if (paymentVerified) {
      const { verifyPaymentForRegistration } = require('../../utils/paymentVerification');
      const paymentCheck = await verifyPaymentForRegistration(req.body);
      if (!paymentCheck.ok) {
        return res.status(400).json({ error: paymentCheck.error || 'Payment is required for this competition.' });
      }

      paymentOrderId = paymentCheck.orderId;
      paymentId = paymentCheck.paymentId;
      paymentStatusRoute = 'paid';
      competitionTotalAmount = await resolvePaidOrderTotal(paymentOrderId, competitionTotalAmount);
      logger.debug('✅ Cashfree payment verified (competition route):', paymentId);

      const existingPaid = await Registration.findOne({
        payment_order_id: paymentOrderId,
        fest: competition.fest._id,
        competitionId: competition._id,
        user: userId,
      });
      if (existingPaid) {
        await maybeEnrichExistingResponses(existingPaid, parseResponsesBody(req.body));
        return res.status(200).json({
          success: true,
          message: 'Registration already completed',
          _id: existingPaid._id,
          registrationId: existingPaid._id,
          festName: fest.festName,
          competitionName: competition.name,
        });
      }
    }

    // Validate required fields — skip file requirements when payment is verified
    // (file inputs are lost after Cashfree redirect; payment must still succeed).
    const requiredFields = formSchema.filter(field => field.required);
    logger.debug('🔍 Validating', requiredFields.length, 'required fields...');

    for (const field of requiredFields) {
      if (paymentStatusRoute === 'paid' && (field.type === 'file' || field.type === 'image')) {
        continue;
      }

      const value = processedResponses[field.fieldName];

      if (field.type === 'file' || field.type === 'image') {
        if (!value || !value.uploaded || !value.cloudinaryLink) {
          logger.error('❌ Required file field missing:', field.label);
          return res.status(400).json({ error: `${field.label} is required - please upload a file` });
        }
      } else {
        if (!value || (Array.isArray(value) && value.length === 0) || value.toString().trim() === '') {
          logger.error('❌ Required field missing:', field.label);
          return res.status(400).json({ error: `${field.label} is required` });
        }
      }
    }

    // Create registration with competition reference
    const festIdForReg = competition.fest?._id || competition.fest;
    const { isMindSparkFestId } = require('../../utils/personFields');
    const autoConfirm = isMindSparkFestId(festIdForReg)
      || paymentStatusRoute === 'paid'
      || paymentStatusRoute === 'free';
    const registration = new Registration({
      fest: competition.fest._id,
      user: userId,
      responses: processedResponses,
      status: autoConfirm ? 'approved' : 'pending',
      competitionId: competitionId,
      payment_order_id: paymentOrderId,
      payment_id: paymentId,
      payment_gateway: paymentStatusRoute === 'paid' ? 'cashfree' : null,
      paymentStatus: paymentStatusRoute,
      amountPaid: paymentStatusRoute === 'paid' ? competitionTotalAmount : 0,
    });

    logger.debug('💾 Saving registration with competitionId:', competitionId);
    await registration.save();
    logger.debug('💾 Registration saved to database with ID:', registration._id);
    logger.debug('💾 Saved competitionId field:', registration.competitionId);
    if (paymentOrderId) {
      consumeCouponUsageForOrder({ paymentOrderId, userId }).catch(() => {});
    }

    // Get user details for emails and Google Sheets
    const user = await User.findById(userId).select('name email phoneNumber');

    const competitionRegistrationLink = `/registration-details/${registration._id}`;

    // ✅ CRITICAL: Send success response immediately to user (don't wait for emails)
    res.status(201).json({
      success: true,
      message: 'Registration successful',
      _id: registration._id,
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
          logger.debug('📧 Sending thank you email for competition (async)...');
          await sendRegistrationThankYouEmail(user.email, user.name, fest.festName, {
            type: 'fest',
            ticketLink: `/registration-details/${registration._id}`,
          });
          logger.debug('✅ Thank you email sent successfully');
        } catch (emailError) {
          logger.error('⚠️ Thank you email failed:', emailError.message);
        }

        // STEP 2: Send confirmation email with competition name (async, non-blocking)
        try {
          logger.debug('📧 Sending confirmation email for competition (async)...');
          
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
            {
              status: paymentStatusRoute,
              method: paymentStatusRoute === 'paid' ? 'cashfree' : 'free',
              type: 'competition',
              ticketLink: `/registration-details/${registration._id}`,
              groupLink:
                String(competition.registration?.whatsappGroupLink || '').trim()
                || String(fest.registration?.whatsappCommunityLink || '').trim(),
              communityName: competition.name || fest.festName || '',
            },
          );
          logger.debug('✅ Confirmation email sent successfully');

          // STEP 2.5: Send organizer notification email
          if (fest.registration?.organizerEmail) {
            try {
              logger.debug('📧 Sending organizer notification email (async)...');
              await sendOrganizerNotificationEmail(
                fest.registration.organizerEmail,
                user.name,
                user.email,
                fest.festName,
                competition.name,
                registration._id.toString(),
                submissionDate
              );
              logger.debug('✅ Organizer notification email sent successfully');
            } catch (orgEmailError) {
              logger.error('⚠️ Organizer notification email failed:', orgEmailError.message);
            }
          } else {
            logger.debug('ℹ️ No organizer email configured for this fest');
          }
        } catch (emailError) {
          logger.error('⚠️ Confirmation email failed:', emailError.message);
        }

        // STEP 3: Add to Google Sheets (async, non-blocking)
        // Check both the fest's URL and the competition's own URL as fallback
        const compSheetsUrl = fest.registration?.googleSheetsUrl || competition.registration?.googleSheetsUrl;
        if (compSheetsUrl) {
          try {
            const { appendToCompetitionGoogleSheets } = require('../../services/googleSheetsService');

            // Inject Payment ID so it appears as a column
            if (paymentId) processedResponses['Payment ID'] = paymentId;

            logger.debug('📊 Saving to Google Sheets:', compSheetsUrl);
            logger.debug('📊 Responses keys:', Object.keys(processedResponses));

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
              logger.debug('✅ Competition registration saved to Google Sheets');
            } else {
              logger.warn('⚠️ Google Sheets sync failed:', sheetsResult.error);
            }
          } catch (sheetsError) {
            logger.error('⚠️ Google Sheets update failed:', sheetsError.message);
          }
        } else {
          logger.debug('ℹ️ No Google Sheets URL configured for this fest/competition — skipping');
        }

        logger.debug('🎉 All async operations completed for competition registration');
      } catch (asyncError) {
        logger.error('⚠️ Background async operations error:', asyncError);
      }
    }); // <- Close the setImmediate callback

  } catch (error) {
    logger.error('❌ Competition registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
};

module.exports = {
  submitCustomCompetitionRegistration,
  submitCompetitionRegistration,
};
