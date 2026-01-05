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

    if (competition.registration?.status !== 'STARTED') {
      return res.status(400).json({ error: 'Registration has not started for this competition' });
    }

    // Use the fest's form schema for validation and processing
    const fest = competition.fest;
    if (!fest.registration?.formSchema) {
      return res.status(400).json({ error: 'Registration form is not configured for this fest' });
    }

    if (fest.registration.mode !== 'INTERNAL_FORM') {
      return res.status(400).json({ error: 'This fest does not accept internal form registrations' });
    }

    console.log('📝 Form schema:', fest.registration.formSchema?.length || 0, 'fields');
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
    
    for (const field of fest.registration.formSchema) {
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
    const requiredFields = fest.registration.formSchema.filter(field => field.required);
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

    // STEP 1: Send immediate thank you email
    try {
      console.log('📧 Sending immediate thank you email for competition...');
      await sendRegistrationThankYouEmail(user.email, user.name, fest.festName);
      console.log('✅ Thank you email sent successfully');
    } catch (emailError) {
      console.error('⚠️ Thank you email failed (non-blocking):', emailError.message);
      // Don't fail registration if email fails
    }

    // STEP 2: Send async confirmation email with competition name
    setTimeout(async () => {
      try {
        console.log('📧 Sending async confirmation email for competition...');
        
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
        console.log('✅ Async confirmation email sent successfully');

        // STEP 2.5: Send organizer notification email
        if (fest.registration?.organizerEmail) {
          try {
            console.log('📧 Sending organizer notification email...');
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
            console.error('⚠️ Organizer notification email failed (non-blocking):', orgEmailError.message);
          }
        } else {
          console.log('ℹ️ No organizer email configured for this fest');
        }
      } catch (emailError) {
        console.error('⚠️ Async confirmation email failed (non-blocking):', emailError.message);
      }
    }, 2000);

    // STEP 3: Add to Google Sheets (same as fest registration)
    if (fest.registration.googleSheetsUrl) {
      setTimeout(async () => {
        try {
          console.log('📊 Adding registration to Google Sheets...');
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
          console.error('⚠️ Google Sheets update failed (non-blocking):', sheetsError.message);
        }
      }, 3000);
    }

    res.status(201).json({
      message: 'Registration successful',
      registrationId: registration._id,
      festName: fest.festName,
      competitionName: competition.name
    });

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

    // Check if fest exists and has internal form registration
    const fest = await FestOrganizer.findById(festId);
    if (!fest) {
      console.error('❌ Fest not found:', festId);
      return res.status(404).json({ error: 'Fest not found' });
    }

    if (fest.registration.mode !== 'INTERNAL_FORM') {
      console.error('❌ Invalid registration mode:', fest.registration.mode);
      return res.status(400).json({ error: 'This fest does not accept internal form registrations' });
    }

    console.log('📝 Form schema:', fest.registration.formSchema?.length || 0, 'fields');
    console.log('📁 Files received:', req.files?.length || 0);

    // Parse form data and files
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

    // CRITICAL: Create registration FIRST to get ID for folder structure
    const registrationId = `REG_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log('🆔 Generated registration ID:', registrationId);

    // Process uploaded files with proper field matching
    if (req.files && req.files.length > 0) {
      console.log('📁 Processing uploaded files:', req.files.length);
      
      for (const file of req.files) {
        console.log('📤 Processing file:', {
          fieldname: file.fieldname,
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size
        });

        // CRITICAL FIX: Find matching field schema using multiple strategies
        const fieldSchema = fest.registration.formSchema.find(f => {
          // Strategy 1: Direct fieldname match with id
          if (f.id === file.fieldname) return true;
          // Strategy 2: Direct fieldname match with fieldName
          if (f.fieldName === file.fieldname) return true;
          // Strategy 3: Check if fieldname contains the field id
          if (file.fieldname.includes(f.id)) return true;
          // Strategy 4: Check if fieldname contains the fieldName
          if (f.fieldName && file.fieldname.includes(f.fieldName)) return true;
          return false;
        });

        if (!fieldSchema) {
          console.error('❌ No matching field schema found for:', file.fieldname);
          console.error('Available field schemas:', fest.registration.formSchema.map(f => ({
            id: f.id,
            fieldName: f.fieldName,
            label: f.label,
            type: f.type
          })));
          return res.status(400).json({ 
            error: `Invalid form field: ${file.fieldname}. Please refresh the form and try again.`,
            debug: {
              receivedField: file.fieldname,
              availableFields: fest.registration.formSchema.map(f => ({ id: f.id, fieldName: f.fieldName, label: f.label }))
            }
          });
        }

        console.log('✅ Found matching field schema:', {
          id: fieldSchema.id,
          fieldName: fieldSchema.fieldName,
          label: fieldSchema.label,
          type: fieldSchema.type
        });

        // Upload to Cloudinary with proper error handling
        console.log('📤 Uploading to Cloudinary...');
        const uploadResult = await uploadToCloudinary(
          file.buffer,
          file.originalname,
          fest.festName,
          registrationId,
          userId,
          fieldSchema.fieldName || fieldSchema.id
        );

        console.log('📊 Upload result:', uploadResult);

        if (uploadResult.success) {
          // Successful upload to Cloudinary
          uploadedFiles[fieldSchema.fieldName] = {
            uploaded: true,
            cloudinaryLink: uploadResult.cloudinaryLink,
            fileName: uploadResult.fileName,
            fileId: uploadResult.fileId,
            uploadMethod: uploadResult.uploadMethod || 'cloudinary',
            fileType: uploadResult.fileType,
            fileSize: uploadResult.fileSize
          };
          console.log('✅ File uploaded successfully for field:', fieldSchema.fieldName);
        } else {
          console.error('❌ File upload failed for field:', fieldSchema.fieldName, uploadResult.error);
          return res.status(500).json({ 
            error: `Failed to upload ${fieldSchema.label}: ${uploadResult.error}`,
            debug: {
              field: fieldSchema.fieldName,
              fileName: file.originalname,
              uploadResult: uploadResult
            }
          });
        }
      }
    }

    // Merge uploaded files into responses using fieldName as key
    Object.assign(responses, uploadedFiles);

    console.log('📋 Final responses:', Object.keys(responses));

    // Validate required fields with proper file/image handling
    const requiredFields = fest.registration.formSchema.filter(field => field.required);
    console.log('🔍 Validating', requiredFields.length, 'required fields...');
    
    for (const field of requiredFields) {
      const value = responses[field.fieldName];
      
      console.log('🔍 Validating field:', {
        fieldName: field.fieldName,
        label: field.label,
        type: field.type,
        hasValue: !!value,
        value: field.type === 'file' || field.type === 'image' ? 'FILE_DATA' : value
      });
      
      // For file/image fields, check if file was uploaded with cloudinary link
      if (field.type === 'file' || field.type === 'image') {
        if (!value || !value.uploaded || !value.cloudinaryLink) {
          console.error('❌ Required file field missing:', field.label);
          return res.status(400).json({ 
            error: `${field.label} is required - please upload a file`,
            debug: {
              field: field.fieldName,
              received: value,
              expected: 'uploaded file with cloudinaryLink'
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

    // Append to Google Sheets if configured
    if (fest.registration.googleSheetsUrl) {
      console.log('📊 Google Sheets URL found, attempting integration...');
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

    // STEP 1: Send immediate thank you email
    try {
      console.log('📧 Sending immediate thank you email...');
      await sendRegistrationThankYouEmail(user.email, user.name, fest.festName);
      console.log('✅ Thank you email sent successfully');
    } catch (emailError) {
      console.error('⚠️ Thank you email failed (non-blocking):', emailError.message);
      // Don't fail registration if email fails
    }

    // STEP 2: Send async confirmation email with competition name extraction
    setTimeout(async () => {
      try {
        console.log('📧 Sending async confirmation email...');
        
        // Extract competition name from form responses using label-based mapping
        let competitionName = null;
        
        // Look for competition-related fields in form schema
        const competitionField = fest.registration.formSchema.find(field => {
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
        } else {
          console.log('ℹ️ No competition field found in form schema');
        }
        
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
          competitionName,
          registration._id.toString(),
          submissionDate
        );
        
        console.log('✅ Confirmation email sent successfully');

        // STEP 2.5: Send organizer notification email
        if (fest.registration?.organizerEmail) {
          try {
            console.log('📧 Sending organizer notification email...');
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
            console.error('⚠️ Organizer notification email failed (non-blocking):', orgEmailError.message);
          }
        } else {
          console.log('ℹ️ No organizer email configured for this fest');
        }
      } catch (emailError) {
        console.error('⚠️ Confirmation email failed (non-blocking):', emailError.message);
        // Don't fail registration if email fails
      }
    }, 3000); // Send after 3 seconds

    console.log('🎉 Registration completed successfully');

    res.status(201).json({
      message: 'Registration submitted successfully',
      registration: {
        id: registration._id,
        festId: registration.fest,
        status: registration.status,
        submittedAt: registration.submittedAt
      }
    });

  } catch (error) {
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
  upload // Export multer middleware
};