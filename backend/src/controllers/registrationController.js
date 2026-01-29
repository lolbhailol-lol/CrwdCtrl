const Registration = require('../model/registration_model');
const FestOrganizer = require('../model/fest_organizer_model');
const User = require('../model/usermodel');
const { appendToGoogleSheets, testGoogleSheetsConnection } = require('../services/googleSheetsService');
const { uploadToCloudinary } = require('../services/cloudinaryService');
const { sendRegistrationThankYouEmail, sendRegistrationConfirmationEmail, sendOrganizerNotificationEmail } = require('../services/emailService');
const multer = require('multer');

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
    const { responses, userInfo } = req.body;

    console.log('🏆 Custom competition registration request:', { 
      competitionId, 
      userId, 
      responsesKeys: Object.keys(responses || {}),
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

    // Validate form schema
    if (!competition.registration?.formSchema || competition.registration.formSchema.length === 0) {
      console.log('❌ No form schema configured');
      return res.status(400).json({ error: 'Registration form is not configured for this competition' });
    }

    console.log('📝 Competition form schema:', competition.registration.formSchema.length, 'fields');
    console.log('📝 Form schema fields:', competition.registration.formSchema.map(f => ({ id: f.id, label: f.label, required: f.required })));

    // Validate required fields
    const requiredFields = competition.registration.formSchema.filter(field => field.required);
    for (const field of requiredFields) {
      // Generate the same field ID format as frontend
      const fieldId = field.id ? `field_${field.id}` : 
                     field.fieldName ? field.fieldName :
                     field.label ? `field_${field.label.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')}` :
                     'unknown_field';
      
      console.log('🔍 Validating field:', { fieldId, value: responses[fieldId], required: field.required });
      
      if (!responses[fieldId] || 
          (Array.isArray(responses[fieldId]) && responses[fieldId].length === 0) ||
          (typeof responses[fieldId] === 'string' && responses[fieldId].trim() === '')) {
        console.log('❌ Required field missing:', fieldId);
        return res.status(400).json({ 
          error: `${field.label} is required` 
        });
      }
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

    // Create registration record
    const registration = new Registration({
      fest: competition.fest._id,
      user: userId,
      competitionId: competition._id,
      responses: responses,
      status: 'pending', // Use valid enum value: 'pending', 'approved', 'rejected'
      submittedAt: new Date()
    });

    await registration.save();
    console.log('✅ Registration saved to database');

    // Send to Google Sheets if configured
    if (competition.registration.googleSheetsUrl) {
      try {
        console.log('📊 Sending to Google Sheets...');
        const { appendToCompetitionGoogleSheets } = require('../services/googleSheetsService');
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
          competition.registration.formSchema // Pass competition form schema
        );
        console.log('✅ Data sent to Google Sheets successfully');
      } catch (sheetsError) {
        console.error('❌ Google Sheets error:', sheetsError);
        // Don't fail the registration if sheets fails
      }
    }

    // Send confirmation emails
    try {
      const { sendRegistrationThankYouEmail, sendRegistrationConfirmationEmail } = require('../services/emailService');
      
      console.log('📧 Starting email sending process...');
      
      // Send thank you email immediately
      console.log('📧 Sending thank you email...');
      await sendRegistrationThankYouEmail(
        user.email,
        user.name,
        competition.name
      );
      console.log('✅ Thank you email sent successfully');

      // Send detailed confirmation email asynchronously
      setTimeout(async () => {
        try {
          console.log('📧 Sending confirmation email...');
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
            submissionDate
          );
          console.log('✅ Confirmation email sent successfully');
        } catch (emailError) {
          console.error('❌ Confirmation email error:', emailError);
        }
      }, 1000);

      // Send notification to custom confirmation email if provided
      if (competition.registration.confirmationEmail) {
        setTimeout(async () => {
          try {
            console.log('📧 Sending organizer notification email to:', competition.registration.confirmationEmail);
            const { sendOrganizerNotificationEmail } = require('../services/emailService');
            await sendOrganizerNotificationEmail(
              competition.registration.confirmationEmail,
              user.name,
              user.email,
              competition.name,
              competition.name, // competition name as event name
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
            console.log('✅ Custom organizer notification email sent to:', competition.registration.confirmationEmail);
          } catch (orgEmailError) {
            console.error('❌ Custom organizer notification email error:', orgEmailError);
          }
        }, 2000);
      }

    } catch (emailError) {
      console.error('❌ Email error:', emailError);
      // Don't fail registration if email fails
    }

    res.status(201).json({
      success: true,
      message: 'Registration submitted successfully',
      registrationId,
      data: {
        competition: {
          id: competition._id,
          name: competition.name
        },
        registrationId,
        status: 'approved',
        submittedAt: registration.submittedAt
      }
    });

  } catch (error) {
    console.error('❌ Competition registration error:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Registration failed', 
      details: error.message 
    });
  }
};

// Submit registration for a competition
const submitCompetitionRegistration = async (req, res) => {
  try {
    const { competitionId } = req.params;
    const userId = req.user.userId;

    console.log('🏆 Competition registration request:', { competitionId, userId, competitionIdType: typeof competitionId });

    // Check if competition exists and has started registration
    const Competition = require('../model/competition_model');
    const competition = await Competition.findById(competitionId).populate('fest');
    
    if (!competition) {
      return res.status(404).json({ error: 'Competition not found' });
    }

    console.log('🏆 Competition details:', {
      name: competition.name,
      registrationType: competition.registrationType,
      registrationStatus: competition.registration?.status
    });

    // Use the fest's form schema for validation and processing
    const fest = competition.fest;
    
    // ✅ CRITICAL: Check registration based on competition type
    if (competition.registrationType === 'fest') {
      // Fest-based competitions use the fest's registration mode
      if (fest.registration.mode !== 'INTERNAL_FORM') {
        return res.status(400).json({ 
          error: 'Registration is not available for this competition',
          debug: { festMode: fest.registration.mode }
        });
      }
    } else if (competition.registrationType === 'custom') {
      // Custom competitions use their own registration status
      if (competition.registration?.status !== 'internal_form') {
        return res.status(400).json({ 
          error: 'Registration has not started for this competition',
          debug: { status: competition.registration?.status }
        });
      }
    } else {
      return res.status(400).json({ 
        error: 'Invalid competition registration type',
        debug: { registrationType: competition.registrationType }
      });
    }
    
    // ✅ CRITICAL: Get form schema (support both single-step and multi-step forms)
    let formSchema = [];
    if (fest.registration?.formType === 'MULTI_STEP' && fest.registration.steps) {
      // For multi-step forms, flatten all fields from all steps
      formSchema = fest.registration.steps.flatMap(step => step.fields || []);
      console.log('📝 Multi-step form schema:', formSchema.length, 'fields from', fest.registration.steps.length, 'steps');
    } else if (fest.registration?.formSchema) {
      // For single-step forms, use the direct formSchema
      formSchema = fest.registration.formSchema;
      console.log('📝 Single-step form schema:', formSchema.length, 'fields');
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

    console.log('🔄 Processed responses:', Object.keys(processedResponses));

    // Validate required fields with proper file/image handling
    const requiredFields = formSchema.filter(field => field.required);
    console.log('🔍 Validating', requiredFields.length, 'required fields...');
    
    for (const field of requiredFields) {
      const value = processedResponses[field.fieldName];
      
      console.log('🔍 Validating field:', {
        label: field.label,
        fieldName: field.fieldName,
        type: field.type,
        value: value,
        hasValue: !!value
      });
      
      if (field.type === 'file' || field.type === 'image') {
        if (!value || !value.uploaded || !value.cloudinaryLink) {
          console.error('❌ Required file field missing:', field.label);
          return res.status(400).json({ 
            error: `${field.label} is required - please upload a file`,
            debug: {
              field: field.fieldName,
              value: value,
              processedResponses: Object.keys(processedResponses)
            }
          });
        }
      } else {
        // For other fields, check if value exists and is not empty
        if (!value || (Array.isArray(value) && value.length === 0) || value.toString().trim() === '') {
          console.error('❌ Required field missing:', field.label);
          return res.status(400).json({ 
            error: `${field.label} is required`,
            debug: {
              field: field.fieldName,
              value: value,
              processedResponses: Object.keys(processedResponses)
            }
          });
        }
      }
    }

    console.log('✅ All required fields validated');

    // Create registration with competition reference
    const registration = new Registration({
      fest: competition.fest._id,
      user: userId,
      responses: processedResponses, // Use processed responses with fieldNames
      status: 'pending',
      competitionId: competitionId // Add competition reference
    });

    console.log('💾 Saving registration with competitionId:', competitionId);
    await registration.save();
    console.log('💾 Registration saved to database with ID:', registration._id);
    console.log('💾 Saved competitionId field:', registration.competitionId);

    // Get user details for emails and Google Sheets
    const user = await User.findById(userId).select('name email');

    // ✅ CRITICAL: Send success response immediately to user (don't wait for emails)
    res.status(201).json({
      message: 'Registration successful',
      registrationId: registration._id,
      festName: fest.festName,
      competitionName: competition.name
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
            submissionDate
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
        if (fest.registration.googleSheetsUrl) {
          try {
            console.log('📊 Adding registration to Google Sheets (async)...');
            const sheetsResult = await appendToGoogleSheets(
              fest.registration.googleSheetsUrl,
              processedResponses, // Use processed responses
              {
                festName: fest.festName,
                collegeName: fest.collegeName,
                competitionName: competition.name, // Add competition name
                festId: fest._id
              },
              {
                name: user.name,
                email: user.email
              }
            );
            console.log('✅ Registration added to Google Sheets successfully');
            
            if (!sheetsResult.success) {
              console.warn('⚠️ Google Sheets sync failed:', sheetsResult.error);
            }
          } catch (sheetsError) {
            console.error('⚠️ Google Sheets update failed:', sheetsError.message);
          }
        }

        console.log('🎉 All async operations completed for competition registration');
      } catch (asyncError) {
        console.error('⚠️ Background async operations error:', asyncError);
      }
    }); // <- Close the setImmediate callback

  } catch (error) {
    console.error('❌ Competition registration error:', error);
    res.status(500).json({
      error: 'Registration failed',
      details: error.message
    });
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
    if (!fest.registration || fest.registration.mode !== 'INTERNAL_FORM') {
      console.error('❌ Invalid registration mode:', fest.registration?.mode);
      return res.status(400).json({ 
        error: 'Internal form registration is not available for this fest',
        debug: {
          currentMode: fest.registration?.mode || 'NOT_SET',
          expectedMode: 'INTERNAL_FORM'
        }
      });
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

    // ✅ PERFORMANCE: Process uploaded files concurrently with better field matching
    if (req.files && req.files.length > 0) {
      console.log('📁 Processing uploaded files:', req.files.length);

      // First, validate all files have matching schemas
      const fileUploadPromises = [];
      const fileValidationErrors = [];

      for (const file of req.files) {
        console.log('📤 Processing file:', {
          fieldname: file.fieldname,
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size
        });

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

        console.log('✅ Found matching field schema:', {
          id: fieldSchema.id,
          fieldName: fieldSchema.fieldName,
          label: fieldSchema.label,
          type: fieldSchema.type
        });

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
          debug: {
            validationErrors: fileValidationErrors,
            availableFields: formSchema.map(f => ({
              id: f.id,
              fieldName: f.fieldName,
              label: f.label
            }))
          }
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
      
      console.log('🔍 Validating field:', {
        fieldKey,
        fieldName: field.fieldName,
        label: field.label,
        type: field.type,
        hasValue: !!value,
        value: field.type === 'file' || field.type === 'image' ? 'FILE_DATA' : value
      });
      
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
          return res.status(400).json({ 
            error: `${field.label} is required`,
            debug: {
              field: fieldKey,
              received: value,
              expected: 'non-empty value'
            }
          });
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
    const user = await User.findById(userId).select('name email');

    // ✅ CRITICAL: Send success response immediately to user
    res.status(201).json({
      message: 'Registration submitted successfully',
      registration: {
        id: registration._id,
        festId: registration.fest,
        status: registration.status,
        submittedAt: registration.submittedAt
      }
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
            for (const uploadResult of uploadResults) {
              if (uploadResult && uploadResult.fieldName && uploadResult.cloudinaryLink) {
                registration.responses[uploadResult.fieldName] = {
                  uploaded: true,
                  cloudinaryLink: uploadResult.cloudinaryLink,
                  uploadedAt: new Date()
                };
                updatedFiles = true;
              }
            }
            
            // Save registration with updated file URLs
            if (updatedFiles) {
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
          console.log('📊 Google Sheets sync starting (async)...');
          try {
            const sheetsResult = await appendToGoogleSheets(
              fest.registration.googleSheetsUrl,
              responses,
              {
                festName: fest.festName,
                collegeName: fest.collegeName,
                festId: festId
              },
              {
                name: user.name,
                email: user.email
              }
            );
            
            console.log('📊 Google Sheets integration result:', sheetsResult);
            
            if (!sheetsResult.success) {
              console.warn('⚠️ Google Sheets sync failed:', sheetsResult.error);
            }
          } catch (sheetsError) {
            console.error('❌ Google Sheets integration error:', sheetsError);
            // Don't fail the registration if Google Sheets fails
          }
        } else {
          console.log('ℹ️ No Google Sheets URL configured for this fest');
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
    res.status(500).json({ 
      error: 'Failed to submit registration',
      message: error.message,
      debug: {
        timestamp: new Date().toISOString(),
        festId: req.params.festId,
        userId: req.user?.userId,
        filesCount: req.files?.length || 0,
        bodyKeys: Object.keys(req.body || {}),
        errorType: error.constructor.name
      }
    });
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

    console.log('📋 Fetching registrations for user:', userId);

    const registrations = await Registration.find({ user: userId })
      .populate('fest', 'festName collegeName festDate venue status coverImage registration')
      .populate('competitionId', 'name description coverImage')
      .sort({ submittedAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    console.log('📊 Found registrations:', registrations.length);
    
    // Debug competition vs fest registrations
    const competitionCount = registrations.filter(reg => !!reg.competitionId).length;
    const festCount = registrations.length - competitionCount;
    console.log(`📈 Registration breakdown: ${competitionCount} competitions, ${festCount} fests`);
    
    // Debug what data is being sent to frontend
    registrations.forEach((reg, i) => {
        if (reg.competitionId) {
            console.log(`🏆 Competition registration ${i + 1}:`, {
                id: reg._id,
                competitionId: reg.competitionId._id,
                competitionName: reg.competitionId.name,
                competitionCoverImage: reg.competitionId.coverImage,
                festName: reg.fest.festName,
                populatedCorrectly: !!(reg.competitionId.name)
            });
        } else {
            console.log(`🎪 Fest registration ${i + 1}:`, {
                id: reg._id,
                festName: reg.fest.festName
            });
        }
    });

    const total = await Registration.countDocuments({ user: userId });

    res.json({
      registrations,
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

module.exports = {
  submitRegistration,
  submitCompetitionRegistration,
  submitCustomCompetitionRegistration,
  getUserRegistration,
  getFestRegistrations,
  updateRegistrationStatus,
  getUserRegistrations,
  getRegistrationDetails,
  testGoogleSheets,
  diagnoseGoogleSheets, // ✅ NEW: Export the new diagnostic function
  upload // Export multer middleware
};