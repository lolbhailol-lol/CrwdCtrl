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
    
    // Get fests with pagination, sorted by most recent first
    const fests = await FestOrganizer.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('festName collegeName festType festDate venue description coverImage galleryImages status artists sponsors registration createdAt artistsHeading competitionsHeading contacts') // Only select needed fields
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

    // Clear cache when fest is updated
    clearFestsCache();
    
    // ✅ CRITICAL FIX: Also clear the public fest details cache
    // The public API uses a different cache system, so we need to clear both
    try {
      const { clearAllCaches } = require('./festOrganizerController');
      clearAllCaches();
      console.log('✅ Cleared both admin and public caches');
    } catch (cacheError) {
      console.warn('⚠️ Could not clear public cache:', cacheError.message);
      // Continue execution even if public cache clearing fails
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



    if (!mongoose.Types.ObjectId.isValid(festId)) {
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

    if (!name || !description || !prizePool || !registrationFee) {
      return res.status(400).json({
        message: 'Please fill Competition Name, Description, Prize Pool and Registration Fee'
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

    const savedCompetition = await competition.save();

    const updatedFest = await FestOrganizer.findByIdAndUpdate(
      festId,
      { $push: { competitions: savedCompetition._id } },
      { new: true }
    );

    res.status(201).json({
      message: 'Competition created successfully',
      competition: savedCompetition
    });

  } catch (error) {
    console.error('Create competition error:', error);
    res.status(500).json({ message: 'Failed to create competition', error: error.message });
  }
};
