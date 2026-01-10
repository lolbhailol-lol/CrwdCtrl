const mongoose = require('mongoose');
const FestOrganizer = require('../model/fest_organizer_model');
const Competition = require('../model/competition_model');

// Admin-specific fest controllers (no organizer requirement)

/* =========================
   CREATE FEST (ADMIN)
========================= */
exports.createFest = async (req, res) => {
  console.log('🎪 Admin createFest endpoint hit');
  console.log('📦 Request body:', req.body);
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
      artistsHeading: artistsHeading && artistsHeading.trim() ? artistsHeading.trim() : "Artists You'll Love",
      contacts: contacts || [],
      sponsors: sponsors || [],
      competitionsHeading: competitionsHeading && competitionsHeading.trim() ? competitionsHeading.trim() : "Competitions",
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
    await fest.save();
    console.log('✅ Fest saved successfully:', fest._id);

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
    const fests = await FestOrganizer.find()
      .sort({ createdAt: -1 });

    res.status(200).json({ fests });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch fests' });
  }
};

/* =========================
   UPDATE FEST
========================= */
exports.updateFest = async (req, res) => {
  console.log('🔄 Admin updateFest endpoint hit');
  console.log('📦 Request body:', req.body);
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
    const fest = await FestOrganizer.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    );

    console.log('✅ Fest updated successfully:', fest._id);

    res.json({
      message: 'Fest updated successfully',
      fest
    });

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
