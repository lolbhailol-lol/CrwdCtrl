const mongoose = require('mongoose');
const FestOrganizer = require('../model/fest_organizer_model');
const Competition = require('../model/competition_model');
const { parseTicketPrice } = require('../utils/platformFee');
const User = require('../model/usermodel'); // Check if your file is userModel.js or user.js
const { sendEventBroadcast } = require('../services/emailService');

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

const getCompetitionBaseFee = (registrationFee, feeAmount) => {
  const numericFeeAmount = parseTicketPrice(feeAmount);
  return numericFeeAmount || parseTicketPrice(registrationFee);
};

// In adminFestController.js
exports.triggerEventAnnouncement = async (req, res) => {
    try {
        const { eventName, eventDate, eventLocation, eventId } = req.body;

        // Respect the user's settings: 
        // 1. Must be verified
        // 2. Must have emailReminders enabled in their model
        const users = await User.find({ 
            isVerified: true, 
            'notificationPreferences.emailReminders': true 
        }, 'name email');

        if (!users.length) {
            return res.status(404).json({ message: "No eligible users found." });
        }

        sendEventBroadcast(users, {
            name: eventName,
            date: eventDate,
            location: eventLocation,
            id: eventId
        });

        res.status(200).json({ success: true, count: users.length });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
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

    // 1. Validation
    if (!festName || !collegeName || !festType || !venue || !description) {
      console.error('❌ Required fields missing');
      return res.status(400).json({ message: 'Required fields missing' });
    }

    // 2. Auto-set coverImage logic
    let finalCoverImage = coverImage;
    if (!finalCoverImage && galleryImages && galleryImages.length > 0) {
      finalCoverImage = galleryImages[0];
    }

    // 3. Initialize Model
    const fest = new FestOrganizer({
      organizer: null,
      festName,
      subtitle,
      collegeName,
      festType,
      festDate,
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
      isApproved: true
    });

    // 4. Save to Database
    await fest.save();
    console.log('✅ Fest saved successfully:', fest._id);

    // 5. Cache Management
    clearFestsCache();
    try {
      const { clearAllCaches } = require('./festOrganizerController');
      clearAllCaches();
    } catch (cacheError) {
      console.warn('⚠️ Cache clear failed:', cacheError.message);
    }

    // 6. Return Success Response Immediately
    res.status(201).json({
      message: 'Fest created successfully',
      fest
    });

    // 7. BACKGROUND TASK: Send Broadcast Emails to all users
    setImmediate(async () => {
      try {
        console.log('📢 Starting auto-broadcast for new fest...');
        
        // Fetch all verified users who have opted into email reminders
        const users = await User.find({ 
          isVerified: true, 
          'notificationPreferences.emailReminders': true 
        }, 'name email');

        if (users.length > 0) {
          // sendEventBroadcast is imported from emailService at the top of your file
          await sendEventBroadcast(users, {
            name: fest.festName,
            date: fest.festDate,
            location: fest.venue,
            id: fest._id
          });
          console.log(`✅ Auto-broadcast completed for ${users.length} users.`);
        } else {
          console.log('ℹ️ No eligible users found for broadcast.');
        }
      } catch (broadcastErr) {
        console.error('❌ Auto-broadcast background error:', broadcastErr.message);
      }
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

    // 1. Get the current fest to compare changes (for broadcast logic)
    const existingFest = await FestOrganizer.findById(id);
    if (!existingFest) {
      console.error('❌ Fest not found:', id);
      return res.status(404).json({ message: 'Fest not found' });
    }

    // 2. Prepare update data
    const updateData = { ...req.body };

    // 3. Auto-set coverImage logic
    const { coverImage, galleryImages } = req.body;
    if (!coverImage && galleryImages && galleryImages.length > 0) {
      updateData.coverImage = galleryImages[0];
    } else if (coverImage === '' && galleryImages && galleryImages.length > 0) {
      updateData.coverImage = galleryImages[0];
    } else if (galleryImages && galleryImages.length > 0 && existingFest.coverImage && !galleryImages.includes(existingFest.coverImage)) {
      updateData.coverImage = galleryImages[0];
    }

    // 4. Update the database
    const fest = await FestOrganizer.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    );

    console.log('✅ Fest updated successfully:', fest._id);

    // 5. CACHE MANAGEMENT
    clearFestsCache();
    try {
      const festController = require('./festOrganizerController');
      if (typeof festController.clearAllCaches === 'function') {
        festController.clearAllCaches();
        console.log('✅ Cleared public fest cache');
      }
    } catch (cacheError) {
      console.warn('⚠️ Cache clearing warning:', cacheError.message);
    }

    // 6. Return response immediately to Admin
    res.json({
      message: 'Fest updated successfully',
      fest,
      timestamp: Date.now(),
      cacheCleared: true
    });

    // 7. BACKGROUND TASK: Notify users if Date or Venue changed
    // We check existingFest (before update) vs updateData (from request)
    const dateChanged = existingFest.festDate !== updateData.festDate;
    const venueChanged = existingFest.venue !== updateData.venue;

    if (dateChanged || venueChanged) {
      setImmediate(async () => {
        try {
          console.log('📢 Critical update detected (Date/Venue). Triggering broadcast...');
          
          const users = await User.find({ 
            isVerified: true, 
            'notificationPreferences.emailReminders': true 
          }, 'name email');

          if (users.length > 0) {
            // sendEventBroadcast imported from emailService
            await sendEventBroadcast(users, {
              name: `UPDATED: ${fest.festName}`,
              date: fest.festDate,
              location: fest.venue,
              id: fest._id
            });
            console.log(`✅ Update notification sent to ${users.length} users.`);
          }
        } catch (broadcastErr) {
          console.error('❌ Update broadcast error:', broadcastErr.message);
        }
      });
    }

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
      category,
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
      feeAmount,
      registrationLink,
      registrationFields,
      contact,
      registration,
      registrationType,  // NEW: 'fest' or 'custom'
      legacyRegistration, // NEW: for backward compatibility
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
      category: category || 'OTHER',
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
      feeAmount: getCompetitionBaseFee(registrationFee, feeAmount),
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
