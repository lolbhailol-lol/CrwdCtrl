const mongoose = require('mongoose');
const FestOrganizer = require('../model/fest_organizer_model');
const Competition = require('../model/competition_model');

// ✅ In-memory cache for fests (same as in festOrganizerController)
const festsCache = {
    data: null,
    timestamp: 0,
    duration: 5 * 60 * 1000 // 5 minutes cache duration
};

// Helper function to clear cache (call when fests are modified)
const clearFestsCache = () => {
    festsCache.data = null;
    festsCache.timestamp = 0;
    console.log('🗑️ Admin: Fests cache cleared');
};

// Admin-specific fest controllers (no organizer requirement)

/* =========================
   CREATE FEST (ADMIN)
========================= */
exports.createFest = async (req, res) => {
  console.log('🎪 Admin createFest endpoint hit');
  console.log('📦 Request body:', req.body);
  console.log('🔍 DEBUG - Key fields in request:');
  console.log('  - artistsHeading:', req.body.artistsHeading, '(type:', typeof req.body.artistsHeading, ')');
  console.log('  - competitionsHeading:', req.body.competitionsHeading, '(type:', typeof req.body.competitionsHeading, ')');
  console.log('  - contacts:', req.body.contacts, '(type:', typeof req.body.contacts, ', length:', req.body.contacts?.length, ')');
  console.log('🔑 Admin user:', req.admin);
  
  try {
    const {
      festName,
      subtitle,
      collegeName,
      festType,
      festDate,
      venue,
      ticketPrice,
      description,
      coverImage,
      galleryImages,
      registrationLink,
      status,
      artists,
      artistsHeading,
      contacts,
      sponsors,
      competitionsHeading,
      registration
    } = req.body;

    console.log('📋 Extracted fields:', {
      festName,
      collegeName,
      festType,
      venue,
      description,
      registrationMode: registration?.mode,
      coverImage,
      galleryImagesCount: galleryImages?.length || 0
    });

    if (
      !festName ||
      !collegeName ||
      !festType ||
      !venue ||
      !description
    ) {
      console.error('❌ Required fields missing');
      return res.status(400).json({
        message: 'Required fields missing'
      });
    }

    // Auto-set coverImage to first gallery image if not provided
    let finalCoverImage = coverImage;
    if (!finalCoverImage && galleryImages && galleryImages.length > 0) {
      finalCoverImage = galleryImages[0];
      console.log('🖼️ Auto-setting coverImage to first gallery image:', finalCoverImage);
    }

    console.log('✅ Creating new fest...');
    console.log('🔍 DEBUG - Multi-step form validation (create):');
    if (registration?.formType === 'MULTI_STEP') {
      console.log('  - Creating multi-step form: YES');
      console.log('  - Steps count:', registration.steps?.length || 0);
      if (registration.steps?.length > 0) {
        registration.steps.forEach((step, index) => {
          console.log(`    Create Step ${index + 1}:`, {
            stepNumber: step.stepNumber,
            stepTitle: step.stepTitle,
            fieldsCount: step.fields?.length || 0
          });
        });
      }
    } else {
      console.log('  - Creating multi-step form: NO (formType:', registration?.formType, ')');
    }

    const fest = new FestOrganizer({
      organizer: null,
      festName,
      subtitle,
      collegeName,
      festType,
      festDate,              // ✅ single date field
      venue,
      ticketPrice,
      description,
      coverImage: finalCoverImage,
      galleryImages,
      registrationLink,
      status: status || 'upcoming',
      artists: artists || [],
      artistsHeading: artistsHeading !== undefined ? artistsHeading : "Artists You'll Love",
      contacts: contacts || [],
      sponsors: sponsors || [],
      competitionsHeading: competitionsHeading !== undefined ? competitionsHeading : "Competitions",
      registration: registration || {
        mode: 'NOT_STARTED',
        externalLink: '',
        paymentQR: '',
        paymentQRMessage: '',
        googleSheetsUrl: '',
        formInstructions: '',
        formSchema: []
      },
      isApproved: true       // ✅ IMPORTANT
    });

    console.log('💾 Saving fest to database...');
    console.log('🔍 DEBUG - Fest object before save:');
    console.log('  - artistsHeading:', fest.artistsHeading);
    console.log('  - competitionsHeading:', fest.competitionsHeading);
    console.log('  - contacts:', fest.contacts);
    await fest.save();
    console.log('✅ Fest saved successfully:', fest._id);
    console.log('🔍 DEBUG - Fest object after save:');
    console.log('  - artistsHeading:', fest.artistsHeading);
    console.log('  - competitionsHeading:', fest.competitionsHeading);
    console.log('  - contacts:', fest.contacts);

    // Clear cache when new fest is created
    clearFestsCache();
    
    // ✅ Also clear public cache for consistency
    try {
      const { clearAllCaches } = require('./festOrganizerController');
      clearAllCaches();
      console.log('✅ Cleared both admin and public caches after fest creation');
    } catch (cacheError) {
      console.warn('⚠️ Could not clear public cache:', cacheError.message);
    }

    res.status(201).json({
      message: 'Fest created successfully',
      fest
    });

  } catch (error) {
    console.error('💥 Admin create fest error:', error);
    res.status(500).json({
      message: 'Failed to create fest',
      error: error.message
    });
  }
};

/* =========================
   GET ALL FESTS (ADMIN)
========================= */
exports.getAllFests = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20; // Default 20 fests per page
    const skip = (page - 1) * limit;

    // Get total count for pagination info
    const totalFests = await FestOrganizer.countDocuments();
    
    // Get fests with pagination, sorted by priority first, then by most recent
    const fests = await FestOrganizer.find()
      .sort({ priority: 1, createdAt: -1 }) // Priority first (1 = highest), then by creation date
      .skip(skip)
      .limit(limit)
      .select('festName collegeName festType festDate venue description coverImage galleryImages status artists sponsors registration createdAt artistsHeading competitionsHeading contacts priority') // Include priority field
      .lean(); // Use lean() for better performance

    // Calculate pagination info
    const totalPages = Math.ceil(totalFests / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    res.status(200).json({ 
      fests,
      pagination: {
        currentPage: page,
        totalPages,
        totalFests,
        hasNextPage,
        hasPrevPage,
        limit
      }
    });
  } catch (error) {
    console.error('Error fetching fests:', error);
    res.status(500).json({ message: 'Failed to fetch fests' });
  }
};

/* =========================
   UPDATE FEST
========================= */
exports.updateFest = async (req, res) => {
  console.log('🔄 Admin updateFest endpoint hit');
  console.log('📦 Request body:', req.body);
  console.log('🔍 DEBUG - Key fields in request:');
  console.log('  - artistsHeading:', req.body.artistsHeading, '(type:', typeof req.body.artistsHeading, ')');
  console.log('  - competitionsHeading:', req.body.competitionsHeading, '(type:', typeof req.body.competitionsHeading, ')');
  console.log('  - contacts:', req.body.contacts, '(type:', typeof req.body.contacts, ', length:', req.body.contacts?.length, ')');
  console.log('🆔 Fest ID:', req.params.id);
  console.log('🔑 Admin user:', req.admin);
  
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      console.error('❌ Invalid fest ID:', id);
      return res.status(400).json({ message: 'Invalid fest ID' });
    }

    // Get the current fest to check existing data
    const existingFest = await FestOrganizer.findById(id);
    if (!existingFest) {
      console.error('❌ Fest not found:', id);
      return res.status(404).json({ message: 'Fest not found' });
    }

    // Prepare update data
    const updateData = { ...req.body };

    // Auto-set coverImage logic
    const { coverImage, galleryImages } = req.body;
    
    // If no coverImage is provided but galleryImages exist, use first gallery image
    if (!coverImage && galleryImages && galleryImages.length > 0) {
      updateData.coverImage = galleryImages[0];
      console.log('🖼️ Auto-setting coverImage to first gallery image:', galleryImages[0]);
    }
    // If coverImage is empty string but galleryImages exist, use first gallery image
    else if (coverImage === '' && galleryImages && galleryImages.length > 0) {
      updateData.coverImage = galleryImages[0];
      console.log('🖼️ Replacing empty coverImage with first gallery image:', galleryImages[0]);
    }
    // If galleryImages are updated and current coverImage is not in the new gallery, update it
    else if (galleryImages && galleryImages.length > 0 && existingFest.coverImage && !galleryImages.includes(existingFest.coverImage)) {
      updateData.coverImage = galleryImages[0];
      console.log('🖼️ Current coverImage not in new gallery, updating to first gallery image:', galleryImages[0]);
    }

    console.log('💾 Updating fest in database...');
    console.log('🔍 DEBUG - Update data:');
    console.log('  - artistsHeading:', updateData.artistsHeading);
    console.log('  - competitionsHeading:', updateData.competitionsHeading);
    console.log('  - contacts:', updateData.contacts);
    console.log('  - registration:', updateData.registration);
    console.log('  - registration.formType:', updateData.registration?.formType);
    console.log('  - registration.formSchema:', updateData.registration?.formSchema);
    console.log('  - registration.steps:', updateData.registration?.steps);
    console.log('🔍 DEBUG - Multi-step form validation (backend):');
    if (updateData.registration?.formType === 'MULTI_STEP') {
      console.log('  - Backend received multi-step form: YES');
      console.log('  - Steps count:', updateData.registration.steps?.length || 0);
      if (updateData.registration.steps?.length > 0) {
        updateData.registration.steps.forEach((step, index) => {
          console.log(`    Backend Step ${index + 1}:`, {
            stepNumber: step.stepNumber,
            stepTitle: step.stepTitle,
            fieldsCount: step.fields?.length || 0
          });
        });
      }
    } else {
      console.log('  - Backend received multi-step form: NO (formType:', updateData.registration?.formType, ')');
    }
    
    const fest = await FestOrganizer.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    );

    console.log('✅ Fest updated successfully:', fest._id);
    console.log('🔍 DEBUG - Updated fest object:');
    console.log('  - artistsHeading:', fest.artistsHeading);
    console.log('  - competitionsHeading:', fest.competitionsHeading);
    console.log('  - contacts:', fest.contacts);
    console.log('  - registration:', fest.registration);
    console.log('  - registration.formType:', fest.registration?.formType);
    console.log('  - registration.formSchema:', fest.registration?.formSchema);
    console.log('  - registration.steps:', fest.registration?.steps);
    
    // ✅ CRITICAL: Verify data was actually saved AND re-fetch to confirm
    const verifyFest = await FestOrganizer.findById(id).lean();
    console.log('✅ VERIFICATION FETCH - Data persisted to database:');
    console.log('  - artistsHeading in DB:', verifyFest.artistsHeading);
    console.log('  - competitionsHeading in DB:', verifyFest.competitionsHeading);
    console.log('  - contacts in DB:', verifyFest.contacts);
    console.log('  - registration.formType in DB:', verifyFest.registration?.formType);
    console.log('  - registration in DB:', verifyFest.registration);
    
    if (!verifyFest.artistsHeading) {
      console.error('❌ ERROR: artistsHeading not persisted!');
    }
    if (!verifyFest.competitionsHeading) {
      console.error('❌ ERROR: competitionsHeading not persisted!');
    }
    
    console.log('🔍 DEBUG - Multi-step form after save:');
    if (fest.registration?.formType === 'MULTI_STEP') {
      console.log('  - Saved as multi-step form: YES');
      console.log('  - Saved steps count:', fest.registration.steps?.length || 0);
      if (fest.registration.steps?.length > 0) {
        fest.registration.steps.forEach((step, index) => {
          console.log(`    Saved Step ${index + 1}:`, {
            stepNumber: step.stepNumber,
            stepTitle: step.stepTitle,
            fieldsCount: step.fields?.length || 0
          });
        });
      }
    } else {
      console.log('  - Saved as multi-step form: NO (formType:', fest.registration?.formType, ')');
    }

    // ✅ CRITICAL: Clear ALL caches to ensure fresh data is fetched everywhere
    console.log('🧹 Starting cache cleanup for updated fest:', id);
    
    // Clear admin cache
    clearFestsCache();
    console.log('✅ Cleared admin fest cache');
    
    // Clear public cache by forcing a reload
    try {
      // Import the cache clearing function
      const festController = require('./festOrganizerController');
      if (typeof festController.clearAllCaches === 'function') {
        festController.clearAllCaches();
        console.log('✅ Cleared public fest cache');
      } else {
        console.warn('⚠️ clearAllCaches not found as function');
      }
    } catch (cacheError) {
      console.warn('⚠️ Could not clear public cache:', cacheError.message);
    }

    // ✅ NEW: Add timestamp to response to help with cache busting
    const responseData = {
      message: 'Fest updated successfully',
      fest,
      timestamp: Date.now(),
      cacheCleared: true
    };

    res.json(responseData);

  } catch (error) {
    console.error('💥 Admin update fest error:', error);
    res.status(500).json({ 
      message: 'Failed to update fest',
      error: error.message 
    });
  }
};

/* =========================
   DELETE FEST
========================= */
exports.deleteFest = async (req, res) => {
  try {
    const { id } = req.params;

    await Competition.deleteMany({ fest: id });
    await FestOrganizer.findByIdAndDelete(id);

    // Clear cache when fest is deleted
    clearFestsCache();
    
    // ✅ Also clear public cache for consistency
    try {
      const { clearAllCaches } = require('./festOrganizerController');
      clearAllCaches();
      console.log('✅ Cleared both admin and public caches after fest deletion');
    } catch (cacheError) {
      console.warn('⚠️ Could not clear public cache:', cacheError.message);
    }

    res.json({ message: 'Fest deleted successfully' });

  } catch (error) {
    res.status(500).json({ message: 'Failed to delete fest' });
  }
};

/* =========================
   CREATE COMPETITION
========================= */
exports.createCompetition = async (req, res) => {
  try {
    const { festId } = req.params;

    console.log('Backend - Create competition request:', {
      festId,
      bodyKeys: Object.keys(req.body),
      competitionType: req.body.competitionType,
      dateTime: req.body.dateTime,
      registrationFee: req.body.registrationFee,
      name: req.body.name,
      description: req.body.description?.substring(0, 50)
    });

    if (!mongoose.Types.ObjectId.isValid(festId)) {
      console.error('❌ Invalid fest ID format:', festId);
      return res.status(400).json({ message: 'Invalid fest ID' });
    }

    const {
      name,
      subtitle,
      competitionType,
      description,
      prizePool,
      dateTime,          // UI string
      venue,
      coverImage,
      gallery,
      commonRules,       // UI rules (existing)
      commonRulesMessage, // NEW: message field for common rules
      rounds,
      registrationFee,
      registrationLink,
      registrationFields,
      contact,
      registration,
      registrationType,  // NEW: 'fest' or 'custom'
      legacyRegistration // NEW: for backward compatibility
    } = req.body;

    // ✅ Enhanced validation with detailed error messages
    if (!name || !description || !prizePool || !registrationFee) {
      console.error('❌ Missing required fields:', { name, description, prizePool, registrationFee });
      return res.status(400).json({
        message: 'Please fill Competition Name, Description, Prize Pool and Registration Fee'
      });
    }

    // ✅ NEW: Validate dateTime is not empty (required by model)
    if (!dateTime || dateTime.trim() === '') {
      console.error('❌ Missing required field: dateTime');
      return res.status(400).json({
        message: 'Please fill the Date and Time field'
      });
    }

    // ✅ NEW: Validate competitionType
    if (!competitionType) {
      console.error('❌ Missing required field: competitionType');
      return res.status(400).json({
        message: 'Please select a Competition Type'
      });
    }

    // ✅ NEW: Validate competitionType
    if (!competitionType) {
      console.error('❌ Missing required field: competitionType');
      return res.status(400).json({
        message: 'Please select a Competition Type'
      });
    }

    const competition = new Competition({
      fest: festId,
      name,
      subtitle,
      competitionType: competitionType || 'other',
      description,
      prizePool,
      dateTime: dateTime || 'To Be Announced', // Use dateTime field from model
      venue,
      coverImage,
      gallery: gallery || [],
      commonRules: commonRules || [],     // Use commonRules field from model
      commonRulesMessage: commonRulesMessage || '', // NEW: message field for common rules
      rounds: rounds || [],
      registrationFee: registrationFee || 'Free',
      registrationLink: registrationLink || '',
      registrationFields: registrationFields || [],
      contact: contact || {},
      // NEW: Registration system
      registrationType: registrationType || 'fest',
      registration: registration || { 
        status: 'not_started',
        externalUrl: '',
        googleSheetsUrl: '',
        formSchema: [],
        settings: {
          allowMultipleRegistrations: true,
          requireEmailVerification: false,
          autoConfirmation: true,
          maxRegistrations: null,
          registrationDeadline: null
        }
      },
      // Legacy registration for backward compatibility
      legacyRegistration: legacyRegistration || { status: 'NOT_STARTED' }
    });

    console.log('Backend - Creating competition with:', {
      name: competition.name,
      competitionType: competition.competitionType,
      dateTime: competition.dateTime,
      hasRegistration: !!competition.registration,
      hasFest: !!competition.fest
    });

    const savedCompetition = await competition.save();
    console.log('✅ Competition created successfully:', savedCompetition._id);

    const updatedFest = await FestOrganizer.findByIdAndUpdate(
      festId,
      { $push: { competitions: savedCompetition._id } },
      { new: true }
    );

    // ✅ CRITICAL: Clear all caches so new competition shows on website immediately
    clearFestsCache();
    try {
      const { clearAllCaches } = require('./festOrganizerController');
      clearAllCaches();
      console.log('✅ Cleared all caches after competition creation');
    } catch (cacheError) {
      console.warn('⚠️ Could not clear public cache:', cacheError.message);
    }

    res.status(201).json({
      message: 'Competition created successfully',
      competition: savedCompetition
    });

  } catch (error) {
    console.error('❌ Create competition error:', error);
    
    // ✅ Better error handling for validation errors
    if (error.name === 'ValidationError') {
      console.error('Backend - Mongoose validation error details:', error.errors);
      const missingFields = Object.keys(error.errors).join(', ');
      return res.status(400).json({ 
        message: 'Validation failed', 
        details: `Missing or invalid fields: ${missingFields}`,
        validationErrors: Object.keys(error.errors).map(key => ({
          field: key,
          message: error.errors[key].message,
          value: error.errors[key].value
        }))
      });
    }
    
    res.status(500).json({ 
      message: 'Failed to create competition', 
      error: error.message 
    });
  }
};

/* =========================
   UPDATE FEST PRIORITY
========================= */
exports.updateFestPriority = async (req, res) => {
  console.log('🎯 updateFestPriority called');
  console.log('📍 Params:', req.params);
  console.log('📦 Body:', req.body);
  
  try {
    const { id } = req.params;
    const { priority } = req.body;

    console.log(`🔍 Processing priority update for fest ID: ${id}, priority: ${priority}`);

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      console.log('❌ Invalid ObjectId format');
      return res.status(400).json({
        message: 'Invalid fest ID format'
      });
    }

    // Validate priority
    if (priority === undefined || priority === null) {
      console.log('❌ Priority is missing');
      return res.status(400).json({
        message: 'Priority is required'
      });
    }

    const priorityNum = parseInt(priority);
    console.log(`🔢 Parsed priority: ${priorityNum}`);
    
    if (isNaN(priorityNum) || priorityNum < 1 || priorityNum > 999) {
      console.log('❌ Priority out of range');
      return res.status(400).json({
        message: 'Priority must be a number between 1 and 999'
      });
    }

    // Find the fest
    console.log('🔍 Looking up fest in database...');
    const fest = await FestOrganizer.findById(id);
    if (!fest) {
      console.log('❌ Fest not found');
      return res.status(404).json({ message: 'Fest not found' });
    }
    console.log(`✅ Found fest: ${fest.festName}`);

    // Update priority
    console.log(`📝 Updating priority from ${fest.priority} to ${priorityNum}`);
    fest.priority = priorityNum;
    
    try {
      await fest.save();
      console.log('✅ Fest saved successfully');
    } catch (saveError) {
      console.error('❌ Error saving fest:', saveError);
      return res.status(500).json({ message: 'Failed to save fest: ' + saveError.message });
    }

    // Clear cache when priority is updated
    clearFestsCache();
    
    // Also clear public cache for consistency
    try {
      const { clearAllCaches } = require('./festOrganizerController');
      clearAllCaches();
      console.log('✅ Cleared both admin and public caches after priority update');
    } catch (cacheError) {
      console.warn('⚠️ Could not clear public cache:', cacheError.message);
    }

    console.log('✅ Priority update complete, sending response');
    res.status(200).json({
      message: 'Fest priority updated successfully',
      fest: {
        _id: fest._id,
        festName: fest.festName,
        status: fest.status,
        priority: fest.priority
      }
    });
  } catch (error) {
    console.error('❌ Error updating fest priority:', error.message);
    console.error('❌ Full error:', error);
    res.status(500).json({ message: 'Failed to update fest priority: ' + error.message });
  }
};

/* =========================
   BULK REORDER FESTS
========================= */
exports.reorderFests = async (req, res) => {
  try {
    const { festUpdates } = req.body;

    // Validate input
    if (!Array.isArray(festUpdates) || festUpdates.length === 0) {
      return res.status(400).json({
        message: 'festUpdates must be a non-empty array'
      });
    }

    // Validate each fest update
    for (const update of festUpdates) {
      if (!update.festId || !mongoose.Types.ObjectId.isValid(update.festId)) {
        return res.status(400).json({
          message: 'Each fest update must have a valid festId'
        });
      }

      const priority = parseInt(update.priority);
      if (isNaN(priority) || priority < 1 || priority > 999) {
        return res.status(400).json({
          message: 'Each priority must be a number between 1 and 999'
        });
      }
    }

    // Update all fests in bulk
    const bulkOps = festUpdates.map(update => ({
      updateOne: {
        filter: { _id: update.festId },
        update: { priority: parseInt(update.priority) }
      }
    }));

    const result = await FestOrganizer.bulkWrite(bulkOps);

    // Clear cache after bulk update
    clearFestsCache();
    
    // Also clear public cache for consistency
    try {
      const { clearAllCaches } = require('./festOrganizerController');
      clearAllCaches();
      console.log('✅ Cleared both admin and public caches after bulk reorder');
    } catch (cacheError) {
      console.warn('⚠️ Could not clear public cache:', cacheError.message);
    }

    res.status(200).json({
      message: 'Fests reordered successfully',
      updated: result.modifiedCount,
      total: festUpdates.length
    });
  } catch (error) {
    console.error('Error reordering fests:', error);
    res.status(500).json({ message: 'Failed to reorder fests' });
  }
};
