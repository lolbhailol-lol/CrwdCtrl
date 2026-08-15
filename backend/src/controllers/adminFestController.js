const mongoose = require('mongoose');
const { logger } = require('../utils/logger');
const FestOrganizer = require('../model/fest_organizer_model');
const Competition = require('../model/competition_model');
const { parseTicketPrice } = require('../utils/platformFee');
const User = require('../model/usermodel'); // Check if your file is userModel.js or user.js
const { sendEventBroadcast } = require('../services/emailService');
const {
  parseRulebookZip,
  buildCompetitionFromImportRow,
} = require('../services/rulebookImportService');

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
    logger.debug('🗑️ Admin: Fests cache cleared');
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

        const results = await sendEventBroadcast(users, {
            name: eventName,
            date: eventDate,
            location: eventLocation,
            id: eventId
        });

        res.status(200).json({ success: true, count: users.length, sent: results.success, failed: results.failed });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// Admin-specific fest controllers (no organizer requirement)

/* =========================
   CREATE FEST (ADMIN)
========================= */
exports.createFest = async (req, res) => {
  logger.debug('🎪 Admin createFest endpoint hit');
  logger.debug('📦 Request body:', req.body);
  logger.debug('🔍 DEBUG - Key fields in request:');
  logger.debug('  - artistsHeading:', req.body.artistsHeading, '(type:', typeof req.body.artistsHeading, ')');
  logger.debug('  - competitionsHeading:', req.body.competitionsHeading, '(type:', typeof req.body.competitionsHeading, ')');
  logger.debug('  - contacts:', req.body.contacts, '(type:', typeof req.body.contacts, ', length:', req.body.contacts?.length, ')');
  logger.debug('🔑 Admin user:', req.admin);
  
  try {
    const {
      festName,
      subtitle,
      collegeName,
      festType,
      festDate,
      venue,
      ticketPrice,
      feeAmount,
      platformFeePercent,
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
      logger.error('❌ Required fields missing');
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
      feeAmount: Number(feeAmount) || 0,
      platformFeePercent: platformFeePercent ?? 3,
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
    logger.debug('✅ Fest saved successfully:', fest._id);

    // 5. Cache Management
    clearFestsCache();
    try {
      const { clearAllCaches } = require('./festOrganizerController');
      clearAllCaches();
    } catch (cacheError) {
      logger.warn('⚠️ Cache clear failed:', cacheError.message);
    }

    // 6. Return Success Response Immediately
    res.status(201).json({
      message: 'Fest created successfully',
      fest
    });

  } catch (error) {
    logger.error('💥 Admin create fest error:', error);
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
      .select('festName collegeName festType festDate venue description coverImage galleryImages status artists sponsors registration createdAt artistsHeading competitionsHeading contacts priority homeSection homePriority showOnHomeSlide feeAmount platformFeePercent ticketPrice')
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
    logger.error('Error fetching fests:', error);
    res.status(500).json({ message: 'Failed to fetch fests' });
  }
};

/* =========================
   UPDATE FEST
========================= */
exports.updateFest = async (req, res) => {
  logger.debug('🔄 Admin updateFest endpoint hit');
  logger.debug('📦 Request body:', req.body);
  logger.debug('🔍 DEBUG - Key fields in request:');
  logger.debug('  - artistsHeading:', req.body.artistsHeading, '(type:', typeof req.body.artistsHeading, ')');
  logger.debug('  - competitionsHeading:', req.body.competitionsHeading, '(type:', typeof req.body.competitionsHeading, ')');
  logger.debug('  - contacts:', req.body.contacts, '(type:', typeof req.body.contacts, ', length:', req.body.contacts?.length, ')');
  logger.debug('🆔 Fest ID:', req.params.id);
  logger.debug('🔑 Admin user:', req.admin);
  
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      logger.error('❌ Invalid fest ID:', id);
      return res.status(400).json({ message: 'Invalid fest ID' });
    }

    // 1. Get the current fest (cover image fallback logic)
    const existingFest = await FestOrganizer.findById(id);
    if (!existingFest) {
      logger.error('❌ Fest not found:', id);
      return res.status(404).json({ message: 'Fest not found' });
    }

    // 2. Prepare update data
    const updateData = { ...req.body };

    if (updateData.showOnHomeSlide === true) {
      updateData.showOnHomeSlide = true;
      if (updateData.homeSection === 'slide') updateData.homeSection = null;
    } else if (updateData.showOnHomeSlide === false) {
      updateData.showOnHomeSlide = false;
    }

    // 3. Cover vs gallery: respect explicit clear (coverImage: '').
    // Only backfill from gallery when the client omitted coverImage entirely and fest has no cover yet.
    const { coverImage, galleryImages } = req.body;
    const coverInBody = Object.prototype.hasOwnProperty.call(req.body, 'coverImage');
    if (coverInBody) {
      updateData.coverImage = coverImage || '';
    } else if (
      !existingFest.coverImage
      && Array.isArray(galleryImages)
      && galleryImages.length > 0
    ) {
      updateData.coverImage = galleryImages[0];
    }

    // 4. Update the database
    const fest = await FestOrganizer.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    );

    logger.debug('✅ Fest updated successfully:', fest._id);

    // 5. CACHE MANAGEMENT
    clearFestsCache();
    try {
      const festController = require('./festOrganizerController');
      if (typeof festController.clearAllCaches === 'function') {
        festController.clearAllCaches();
        logger.debug('✅ Cleared public fest cache');
      }
    } catch (cacheError) {
      logger.warn('⚠️ Cache clearing warning:', cacheError.message);
    }

    // 6. Return response immediately to Admin
    res.json({
      message: 'Fest updated successfully',
      fest,
      timestamp: Date.now(),
      cacheCleared: true
    });

  } catch (error) {
    logger.error('💥 Admin update fest error:', error);
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
      logger.debug('✅ Cleared both admin and public caches after fest deletion');
    } catch (cacheError) {
      logger.warn('⚠️ Could not clear public cache:', cacheError.message);
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

    logger.debug('Backend - Create competition request:', {
      festId,
      bodyKeys: Object.keys(req.body),
      competitionType: req.body.competitionType,
      dateTime: req.body.dateTime,
      registrationFee: req.body.registrationFee,
      name: req.body.name,
      description: req.body.description?.substring(0, 50)
    });

    if (!mongoose.Types.ObjectId.isValid(festId)) {
      logger.error('❌ Invalid fest ID format:', festId);
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
      logger.error('❌ Missing required fields:', { name, description, prizePool, registrationFee });
      return res.status(400).json({
        message: 'Please fill Competition Name, Description, Prize Pool and Registration Fee'
      });
    }

    // ✅ NEW: Validate dateTime is not empty (required by model)
    if (!dateTime || dateTime.trim() === '') {
      logger.error('❌ Missing required field: dateTime');
      return res.status(400).json({
        message: 'Please fill the Date and Time field'
      });
    }

    // ✅ NEW: Validate competitionType
    if (!competitionType) {
      logger.error('❌ Missing required field: competitionType');
      return res.status(400).json({
        message: 'Please select a Competition Type'
      });
    }

    // ✅ NEW: Validate competitionType
    if (!competitionType) {
      logger.error('❌ Missing required field: competitionType');
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

    logger.debug('Backend - Creating competition with:', {
      name: competition.name,
      competitionType: competition.competitionType,
      dateTime: competition.dateTime,
      hasRegistration: !!competition.registration,
      hasFest: !!competition.fest
    });

    const savedCompetition = await competition.save();
    logger.debug('✅ Competition created successfully:', savedCompetition._id);

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
      logger.debug('✅ Cleared all caches after competition creation');
    } catch (cacheError) {
      logger.warn('⚠️ Could not clear public cache:', cacheError.message);
    }

    res.status(201).json({
      message: 'Competition created successfully',
      competition: savedCompetition
    });

  } catch (error) {
    logger.error('❌ Create competition error:', error);
    
    // ✅ Better error handling for validation errors
    if (error.name === 'ValidationError') {
      logger.error('Backend - Mongoose validation error details:', error.errors);
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
   BULK IMPORT COMPETITIONS (RULEBOOK ZIP)
========================= */
exports.previewCompetitionImport = async (req, res) => {
  try {
    const { festId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(festId)) {
      return res.status(400).json({ message: 'Invalid fest ID' });
    }

    if (!req.file?.buffer) {
      return res.status(400).json({ message: 'Please upload a rulebook zip file' });
    }

    const fest = await FestOrganizer.findById(festId).select('_id festName').lean();
    if (!fest) {
      return res.status(404).json({ message: 'Fest not found' });
    }

    const parsed = await parseRulebookZip(req.file.buffer);
    const existing = await Competition.find({ fest: festId }).select('name').lean();
    const existingNames = new Set(existing.map((c) => c.name.trim().toLowerCase()));

    const items = parsed.items.map((item) => {
      const duplicate =
        item.parsed?.name &&
        existingNames.has(item.parsed.name.trim().toLowerCase());
      return {
        ...item,
        duplicate,
      };
    });

    res.json({
      fest,
      summary: {
        total: parsed.total,
        ok: parsed.ok,
        skipped: parsed.skipped,
        errors: parsed.errors,
        duplicates: items.filter((item) => item.duplicate).length,
      },
      items,
    });
  } catch (error) {
    logger.error('Preview competition import error:', error);
    res.status(500).json({
      message: 'Failed to preview rulebook import',
      error: error.message,
    });
  }
};

exports.confirmCompetitionImport = async (req, res) => {
  try {
    const { festId } = req.params;
    const { competitions } = req.body;

    if (!mongoose.Types.ObjectId.isValid(festId)) {
      return res.status(400).json({ message: 'Invalid fest ID' });
    }

    if (!Array.isArray(competitions) || competitions.length === 0) {
      return res.status(400).json({ message: 'No competitions provided for import' });
    }

    const fest = await FestOrganizer.findById(festId);
    if (!fest) {
      return res.status(404).json({ message: 'Fest not found' });
    }

    const existing = await Competition.find({ fest: festId }).select('name').lean();
    const existingNames = new Set(existing.map((c) => c.name.trim().toLowerCase()));

    const created = [];
    const skipped = [];
    const errors = [];

    for (const row of competitions) {
      const nameKey = row.name?.trim().toLowerCase();
      if (!nameKey) {
        errors.push({ name: row.name || 'Unknown', error: 'Missing competition name' });
        continue;
      }

      if (existingNames.has(nameKey)) {
        skipped.push({ name: row.name, reason: 'Already exists' });
        continue;
      }

      try {
        const doc = buildCompetitionFromImportRow(row, festId, getCompetitionBaseFee);
        const competition = new Competition(doc);
        const saved = await competition.save();
        fest.competitions.push(saved._id);
        existingNames.add(nameKey);
        created.push({ id: saved._id, name: saved.name });
      } catch (rowError) {
        errors.push({
          name: row.name || 'Unknown',
          error: rowError.message || 'Failed to create competition',
        });
      }
    }

    if (created.length) {
      await fest.save();
      clearFestsCache();
      try {
        const { clearAllCaches } = require('./festOrganizerController');
        clearAllCaches();
      } catch (cacheError) {
        logger.warn('Could not clear public cache after bulk import:', cacheError.message);
      }
    }

    res.status(201).json({
      message: `Imported ${created.length} competition(s)`,
      created: created.length,
      skipped: skipped.length,
      errors: errors.length,
      createdItems: created,
      skippedItems: skipped,
      errorItems: errors,
    });
  } catch (error) {
    logger.error('Confirm competition import error:', error);
    res.status(500).json({
      message: 'Failed to import competitions',
      error: error.message,
    });
  }
};

/* =========================
   UPDATE FEST PRIORITY
========================= */
exports.updateFestPriority = async (req, res) => {
  logger.debug('🎯 updateFestPriority called');
  logger.debug('📍 Params:', req.params);
  logger.debug('📦 Body:', req.body);
  
  try {
    const { id } = req.params;
    const { priority } = req.body;

    logger.debug(`🔍 Processing priority update for fest ID: ${id}, priority: ${priority}`);

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      logger.debug('❌ Invalid ObjectId format');
      return res.status(400).json({
        message: 'Invalid fest ID format'
      });
    }

    // Validate priority
    if (priority === undefined || priority === null) {
      logger.debug('❌ Priority is missing');
      return res.status(400).json({
        message: 'Priority is required'
      });
    }

    const priorityNum = parseInt(priority);
    logger.debug(`🔢 Parsed priority: ${priorityNum}`);
    
    if (isNaN(priorityNum) || priorityNum < 1 || priorityNum > 999) {
      logger.debug('❌ Priority out of range');
      return res.status(400).json({
        message: 'Priority must be a number between 1 and 999'
      });
    }

    // Find the fest
    logger.debug('🔍 Looking up fest in database...');
    const fest = await FestOrganizer.findById(id);
    if (!fest) {
      logger.debug('❌ Fest not found');
      return res.status(404).json({ message: 'Fest not found' });
    }
    logger.debug(`✅ Found fest: ${fest.festName}`);

    // Update priority
    logger.debug(`📝 Updating priority from ${fest.priority} to ${priorityNum}`);
    fest.priority = priorityNum;
    
    try {
      await fest.save();
      logger.debug('✅ Fest saved successfully');
    } catch (saveError) {
      logger.error('❌ Error saving fest:', saveError);
      return res.status(500).json({ message: 'Failed to save fest: ' + saveError.message });
    }

    // Clear cache when priority is updated
    clearFestsCache();
    
    // Also clear public cache for consistency
    try {
      const { clearAllCaches } = require('./festOrganizerController');
      clearAllCaches();
      logger.debug('✅ Cleared both admin and public caches after priority update');
    } catch (cacheError) {
      logger.warn('⚠️ Could not clear public cache:', cacheError.message);
    }

    logger.debug('✅ Priority update complete, sending response');
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
    logger.error('❌ Error updating fest priority:', error.message);
    logger.error('❌ Full error:', error);
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
      logger.debug('✅ Cleared both admin and public caches after bulk reorder');
    } catch (cacheError) {
      logger.warn('⚠️ Could not clear public cache:', cacheError.message);
    }

    res.status(200).json({
      message: 'Fests reordered successfully',
      updated: result.modifiedCount,
      total: festUpdates.length
    });
  } catch (error) {
    logger.error('Error reordering fests:', error);
    res.status(500).json({ message: 'Failed to reorder fests' });
  }
};
