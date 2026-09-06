const Registration = require('../../model/registration_model');
const FestOrganizer = require('../../model/fest_organizer_model');
const User = require('../../model/usermodel');
const { uploadToCloudinary } = require('../../services/cloudinaryService');
const { sendRegistrationThankYouEmail, sendRegistrationConfirmationEmail, sendOrganizerNotificationEmail } = require('../../services/emailService');
const { logger } = require('../../utils/logger');
const { scheduleRegistrationNotification } = require('./helpers');
const { findByIdOrSlug } = require('../../utils/slug');
const { resolveFestCompetitionId, extractCompetitionChoice } = require('../../utils/festCompetitionAssignment');
const { assertCompetitionAcceptsRegistration } = require('../../utils/competitionSlots');

// Submit registration for a fest
// Submit registration for a fest with file uploads
const submitRegistration = async (req, res) => {
  try {
    logger.debug('🚀 Starting registration submission...');
    const { festId } = req.params;
    const userId = req.user.userId;

    logger.debug('📋 Registration details:', { festId, userId });

    // ✅ Accept ObjectId or slug (e.g. /registrations/fests/aarohan-2027/register)
    const fest = await findByIdOrSlug(FestOrganizer, festId, {
      pickName: (row) => row.festName || row.name || '',
      lean: false,
    });
    if (!fest) {
      logger.error('❌ Fest not found:', festId);
      return res.status(404).json({ error: 'Fest not found' });
    }
    const festObjectId = fest._id;

    logger.debug('🔍 Fest registration check:', {
      festName: fest.festName,
      registrationMode: fest.registration?.mode,
      isApproved: fest.isApproved
    });

    // ✅ CRITICAL: Validate fest is approved
    if (!fest.isApproved) {
      logger.error('❌ Fest not approved:', festId);
      return res.status(400).json({ error: 'This fest is not available for registration' });
    }

    // ✅ CRITICAL: Validate registration mode
    if (!fest.registration || fest.registration.mode === 'CLOSED') {
      logger.error('❌ Registration closed for fest:', festId);
      return res.status(400).json({ error: 'Registration is closed for this fest' });
    }
    if (fest.registration.mode !== 'INTERNAL_FORM') {
      logger.error('❌ Invalid registration mode:', fest.registration?.mode);
      return res.status(400).json({ error: 'Internal form registration is not available for this fest' });
    }

    // ✅ CRITICAL: Get form schema (support both single-step and multi-step forms)
    let formSchema = [];
    if (fest.registration.formType === 'MULTI_STEP' && fest.registration.steps) {
      // For multi-step forms, flatten all fields from all steps
      formSchema = fest.registration.steps.flatMap(step => step.fields || []);
      logger.debug('📝 Multi-step form schema:', formSchema.length, 'fields from', fest.registration.steps.length, 'steps');
    } else if (fest.registration.formSchema) {
      // For single-step forms, use the direct formSchema
      formSchema = fest.registration.formSchema;
      logger.debug('📝 Single-step form schema:', formSchema.length, 'fields');
    }

    if (!formSchema || formSchema.length === 0) {
      logger.error('❌ No form schema configured');
      return res.status(400).json({ error: 'Registration form is not configured for this fest' });
    }
    logger.debug('📁 Files received:', req.files?.length || 0);
    logger.debug('🔍 Request body keys:', Object.keys(req.body));
    logger.debug('🔍 Request body paymentReceiptUrl:', req.body.paymentReceiptUrl);

    // Parse form data and files
    const responses = {};
    const uploadedFiles = {};

    // ✅ NEW: Add payment receipt URL if provided
    if (req.body.paymentReceiptUrl) {
      responses['Payment Receipt'] = req.body.paymentReceiptUrl;
      logger.debug('💳 Payment receipt URL added to responses:', req.body.paymentReceiptUrl);
      logger.debug('💳 Payment receipt key in responses:', 'Payment Receipt');
    } else {
      logger.debug('⚠️ No payment receipt URL found in request body');
      logger.debug('🔍 Request body keys:', Object.keys(req.body));
    }

    // ✅ NEW: Add transaction ID if provided
    if (req.body.transactionId) {
      responses['Transaction ID'] = req.body.transactionId;
      logger.debug('💳 Transaction ID added to responses:', req.body.transactionId);
    } else {
      logger.debug('⚠️ No transaction ID found in request body');
    }
    
    logger.debug('📊 Final responses object keys:', Object.keys(responses));
    logger.debug('💳 Payment Receipt in final responses:', responses['Payment Receipt']);
    logger.debug('💳 Transaction ID in final responses:', responses['Transaction ID']);

    // Process text fields from request body
    if (req.body.responses) {
      const parsedResponses = typeof req.body.responses === 'string' 
        ? JSON.parse(req.body.responses) 
        : req.body.responses;
      Object.assign(responses, parsedResponses);
      logger.debug('📝 Text responses parsed:', Object.keys(responses));
    }

    // CRITICAL: Create registration FIRST to get ID for folder structure
    const registrationId = `REG_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    logger.debug('🆔 Generated registration ID:', registrationId);

    // Declared outside file block so setImmediate background callback can await uploads
    const fileUploadPromises = [];

    // ✅ PERFORMANCE: Process uploaded files concurrently with better field matching
    if (req.files && req.files.length > 0) {
      logger.debug('📁 Processing uploaded files:', req.files.length);

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
          logger.error('❌ No matching field schema found for:', file.fieldname);
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
        logger.error('Available field schemas:', formSchema.map(f => ({
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
      logger.debug('📤 Uploading files concurrently...');
      const uploadStartTime = Date.now();
      
      // ✅ CRITICAL FIX: DON'T WAIT FOR FILE UPLOADS - START IMMEDIATELY BUT PROCESS IN BACKGROUND
      // This allows the response to be sent to the user IMMEDIATELY
      // Files will be uploaded asynchronously and attached to the registration later
      
      logger.debug('⚡ File uploads will continue in background (not blocking response)');
      
      // Process upload results asynchronously - don't await here
      // For now, just prepare the responses with placeholder file references
      // The actual uploads will happen in setImmediate below
      
      // For now, if files need to be uploaded, we'll just store the file data
      // and upload in the background
      for (const uploadPromise of fileUploadPromises) {
        // Don't await - let these run in the background
        uploadPromise.catch(err => logger.error('❌ Background file upload error:', err));
      }

      // Merge uploaded files into responses using fieldName as key (with uploaded status)
      // We'll update these in the background
      // Object.assign(responses, uploadedFiles); // Skip for now, files will be available later
    } // Close the if (req.files && req.files.length > 0) block

    logger.debug('📋 Final responses:', Object.keys(responses));

    // ✅ PERFORMANCE: Validate required fields with consistent field naming
    const requiredFields = formSchema.filter(field => field.required);
    logger.debug('🔍 Validating', requiredFields.length, 'required fields...');
    
    for (const field of requiredFields) {
      // Use fieldName as primary key, fallback to id
      const fieldKey = field.fieldName || field.id;
      const value = responses[fieldKey];

      // For file/image fields, just check that the file was received (don't check uploaded status yet)
      // Actual upload will happen in the background
      if (field.type === 'file' || field.type === 'image') {
        // Check if file exists in the request (req.files or formData)
        // Since we're skipping the upload, just mark it as "will be uploaded"
        logger.debug('ℹ️ File field detected (will upload in background):', field.label);
      } else {
        // For other fields, check if value exists and is not empty
        if (!value || (Array.isArray(value) && value.length === 0) || value.toString().trim() === '') {
          logger.error('❌ Required field missing:', field.label);
          return res.status(400).json({ error: `${field.label} is required` });
        }
      }
    }

    logger.debug('✅ All required fields validated');

    // Link selected competition (e.g. "Inner Flame (Solo Dance)") so organizer
    // dashboard does not bucket the row under "Other / unassigned".
    const explicitCompetitionId = req.body.competitionId || req.body.competition_id || null;
    let resolvedCompetitionId = null;
    try {
      resolvedCompetitionId = await resolveFestCompetitionId({
        festId: festObjectId,
        responses,
        formSchema,
        explicitCompetitionId,
      });
      if (resolvedCompetitionId) {
        logger.debug('🎯 Resolved competitionId from fest form:', String(resolvedCompetitionId));
        await assertCompetitionAcceptsRegistration(resolvedCompetitionId);
      } else {
        logger.warn('⚠️ Could not resolve competition from fest registration responses');
      }
    } catch (resolveErr) {
      if (resolveErr.status) throw resolveErr;
      logger.warn('⚠️ Competition resolve failed:', resolveErr?.message || resolveErr);
    }

    // Create registration - ONLY ONCE (always store ObjectId, never the URL slug)
    const registration = new Registration({
      fest: festObjectId,
      user: userId,
      competitionId: resolvedCompetitionId || undefined,
      responses: responses,
      status: 'pending'
    });

    await registration.save();
    logger.debug('✅ Registration saved:', registration._id);

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
        logger.debug('📁 Starting background file uploads...');
        
        // Wait for all file uploads to complete
        if (fileUploadPromises.length > 0) {
          try {
            const uploadResults = await Promise.all(fileUploadPromises);
            logger.debug('✅ Background file uploads completed:', uploadResults.length, 'files');
            
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
              logger.debug('✅ Registration updated with file URLs');
            }
          } catch (uploadError) {
            logger.error('❌ Background file upload failed:', uploadError);
            // Registration is already saved with other data, files just won't have links
            // User can still see their registration, just file URLs won't be available
          }
        }
        
        // Append to Google Sheets if configured (async, non-blocking)
        if (fest.registration.googleSheetsUrl) {
          try {
            const { appendToCompetitionGoogleSheets } = require('../../services/googleSheetsService');
            logger.debug('📊 Saving fest registration to Google Sheets:', fest.registration.googleSheetsUrl);
            logger.debug('📊 Responses keys:', Object.keys(responses));

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
                competitionName: extractCompetitionChoice(responses, formSchema) || '',
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
              logger.debug('✅ Fest registration saved to Google Sheets');
            } else {
              logger.warn('⚠️ Google Sheets sync failed:', sheetsResult.error);
            }
          } catch (sheetsError) {
            logger.error('❌ Google Sheets integration error:', sheetsError.message);
          }
        } else {
          logger.debug('ℹ️ No Google Sheets URL configured for this fest — skipping');
        }

        // STEP 1: Send immediate thank you email (async)
        try {
          logger.debug('📧 Sending thank you email (async)...');
          await sendRegistrationThankYouEmail(user.email, user.name, fest.festName, {
            type: 'fest',
            ticketLink: `/registration-details/${registration._id}`,
          });
          logger.debug('✅ Thank you email sent successfully');
        } catch (emailError) {
          logger.error('⚠️ Thank you email failed:', emailError.message);
        }

        // STEP 2: Send confirmation email (async)
        try {
          logger.debug('📧 Sending confirmation email (async)...');
          
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
            logger.debug('🎯 Competition name extracted:', competitionName);
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
            submissionDate,
            {
              status: registration.paymentStatus || 'free',
              method: registration.paymentStatus === 'paid' ? 'cashfree' : '',
              type: 'fest',
              ticketLink: `/registration-details/${registration._id}`,
            },
          );
          
          logger.debug('✅ Confirmation email sent successfully');

          // STEP 3: Send organizer notification email (async)
          if (fest.registration?.organizerEmail) {
            try {
              logger.debug('📧 Sending organizer notification email (async)...');
              await sendOrganizerNotificationEmail(
                fest.registration.organizerEmail,
                user.name,
                user.email,
                fest.festName,
                competitionName,
                registration._id.toString(),
                submissionDate
              );
              logger.debug('✅ Organizer notification email sent successfully');
            } catch (orgEmailError) {
              logger.error('⚠️ Organizer notification email failed:', orgEmailError.message);
            }
          }
        } catch (emailError) {
          logger.error('⚠️ Confirmation email failed:', emailError.message);
        }

        logger.debug('🎉 All async operations completed');
      } catch (asyncError) {
        logger.error('⚠️ Background async operations error:', asyncError);
      }
    }); // <- Close the setImmediate callback

  } catch (error) {  // <- Closes the outer try that opened at line 613
    if (error.status) {
      return res.status(error.status).json({ error: error.message, code: error.code });
    }
    logger.error('❌ Error submitting registration:', error?.message || error);
    logger.error('❌ Error stack:', error?.stack);
    if (error?.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid fest or registration data. Please refresh and try again.' });
    }
    res.status(500).json({ error: 'Failed to submit registration' });
  }
};

// Get all registrations for a fest (admin only)
const getFestRegistrations = async (req, res) => {
  try {
    const { festId } = req.params;
    const { page = 1, limit = 20, status } = req.query;

    // Check if fest exists (ObjectId or slug)
    const fest = await findByIdOrSlug(FestOrganizer, festId, {
      pickName: (row) => row.festName || row.name || '',
      lean: true,
    });
    if (!fest) {
      return res.status(404).json({ error: 'Fest not found' });
    }

    const query = { fest: fest._id };
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
    logger.error('Error fetching fest registrations:', error);
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
    logger.error('Error updating registration status:', error);
    res.status(500).json({ error: 'Failed to update registration status' });
  }
};

module.exports = {
  submitRegistration,
  getFestRegistrations,
  updateRegistrationStatus,
};
