const Registration = require('../../model/registration_model');
const TrekBooking = require('../../model/trek_booking_model');
const FestOrganizer = require('../../model/fest_organizer_model');
const { testGoogleSheetsConnection } = require('../../services/googleSheetsService');
const { resolveTrekGroupLink } = require('../../utils/resolveTrekGroupLink');
const { logger } = require('../../utils/logger');

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
    logger.error('Error fetching registration:', error);
    res.status(500).json({ error: 'Failed to fetch registration' });
  }
};

// Get user's all registrations
const getUserRegistrations = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { page = 1, limit = 10 } = req.query;
    const EventShowRegistration = require('../../model/event_show_registration_model');

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
        .populate('eventShow', 'title displayName eventType coverImages poster banner venue city showTimings ticketPrice status')
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
    logger.error('Error fetching user registrations:', error);
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
    logger.error('Error testing Google Sheets connection:', error);
    res.status(500).json({ error: 'Failed to test Google Sheets connection' });
  }
};

// ✅ NEW: Diagnose Google Sheets integration for a specific fest
const diagnoseGoogleSheets = async (req, res) => {
  try {
    const { festId } = req.params;
    
    logger.debug('🔍 Diagnosing Google Sheets for fest:', festId);
    
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
      const { extractSpreadsheetId } = require('../../services/googleSheetsService');
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
    logger.error('Error diagnosing Google Sheets:', error);
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
      .populate('competitionId', 'name description coverImage registration registrationType');

    if (!registration) {
      return res.status(404).json({ error: 'Registration not found' });
    }

    const payload = registration.toObject ? registration.toObject() : registration;
    const { normalizeLeadIdentityFromRoster } = require('../../utils/rosterResponses');
    if (payload.responses) {
      payload.responses = normalizeLeadIdentityFromRoster(
        payload.responses instanceof Map
          ? Object.fromEntries(payload.responses)
          : payload.responses,
      );
    }

    res.json(payload);

  } catch (error) {
    logger.error('Error fetching registration details:', error);
    res.status(500).json({ error: 'Failed to fetch registration details' });
  }
};

// Get single event-show registration details
const getEventShowRegistrationDetails = async (req, res) => {
  try {
    const { registrationId } = req.params;
    const userId = req.user.userId;
    const EventShowRegistration = require('../../model/event_show_registration_model');

    const registration = await EventShowRegistration.findOne({
      _id: registrationId,
      user: userId,
    })
      .populate('eventShow', 'title displayName eventType venue city showTimings coverImages poster banner registration ticketPrice status')
      .lean();

    if (!registration) {
      return res.status(404).json({ error: 'Event registration not found' });
    }

    res.json(registration);

  } catch (error) {
    logger.error('Error fetching event registration details:', error);
    res.status(500).json({ error: 'Failed to fetch event registration details' });
  }
};

const getTrekBookingDetails = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user?.userId || null;
    const { getTrekBookingAccessFromRequest } = require('../../utils/bookingAccess');
    const access = getTrekBookingAccessFromRequest(req);

    let booking = null;
    if (userId) {
      booking = await TrekBooking.findOne({ _id: bookingId, userId })
        .populate({
          path: 'trekId',
          select: 'trekName city coverImage images trekDate difficultyLevel registration communityId groupLink',
          populate: { path: 'communityId', select: 'name groupLink' },
        });
    }
    if (!booking && access && String(access.bookingId) === String(bookingId)) {
      booking = await TrekBooking.findOne({ _id: bookingId })
        .populate({
          path: 'trekId',
          select: 'trekName city coverImage images trekDate difficultyLevel registration communityId groupLink',
          populate: { path: 'communityId', select: 'name groupLink' },
        });
    }

    if (!booking) {
      return res.status(404).json({ error: 'Trek booking not found' });
    }

    const payload = booking.toObject ? booking.toObject() : booking;
    const { groupLink, communityName } = resolveTrekGroupLink(payload.trekId);

    res.json({ ...payload, groupLink, communityName });
  } catch (error) {
    logger.error('Error fetching trek booking details:', error);
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
    logger.error('Error fetching payment invoice:', error);
    res.status(500).json({ error: 'Failed to fetch payment receipt' });
  }
};

const getTrekPaymentInvoice = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user?.userId || null;
    const { getTrekBookingAccessFromRequest } = require('../../utils/bookingAccess');
    const access = getTrekBookingAccessFromRequest(req);

    let booking = null;
    if (userId) {
      booking = await TrekBooking.findOne({ _id: bookingId, userId })
        .populate('trekId', 'trekName city trekDate')
        .populate('userId', 'name email phoneNumber');
    }
    if (!booking && access && String(access.bookingId) === String(bookingId)) {
      booking = await TrekBooking.findOne({ _id: bookingId })
        .populate('trekId', 'trekName city trekDate')
        .populate('userId', 'name email phoneNumber');
    }

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
    logger.error('Error fetching trek payment invoice:', error);
    res.status(500).json({ error: 'Failed to fetch payment receipt' });
  }
};

const getEventShowPaymentInvoice = async (req, res) => {
  try {
    const { registrationId } = req.params;
    const userId = req.user.userId;
    const EventShowRegistration = require('../../model/event_show_registration_model');

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
    logger.error('Error fetching event payment invoice:', error);
    res.status(500).json({ error: 'Failed to fetch payment receipt' });
  }
};

module.exports = {
  getUserRegistration,
  getUserRegistrations,
  getRegistrationDetails,
  getEventShowRegistrationDetails,
  getTrekBookingDetails,
  getPaymentInvoice,
  getTrekPaymentInvoice,
  getEventShowPaymentInvoice,
  testGoogleSheets,
  diagnoseGoogleSheets,
};
