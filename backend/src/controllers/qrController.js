const crypto = require('crypto');
const Registration = require('../model/registration_model');
const TrekBooking = require('../model/trek_booking_model');
const CategoryRegistration = require('../model/category_registration_model');
const SportsEvent = require('../model/sports_model');
const { performCheckinFromRaw } = require('../services/checkinService');
const { resolveTrekGroupLink } = require('../utils/resolveTrekGroupLink');

// ===== GET: Generate QR code for a registration =====
const generateQR = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { registrationId } = req.params;

    const registration = await Registration.findOne({
      _id: registrationId,
      user: userId,
    }).populate('fest', 'festName festDate venue')
      .populate('competitionId', 'name')
      .populate('user', 'name');

    if (!registration) {
      return res.status(404).json({ success: false, message: 'Registration not found' });
    }

    if (!registration.qrCodeData) {
      registration.qrCodeData = crypto.randomBytes(16).toString('hex');
      await registration.save();
    }

    res.json({
      success: true,
      data: {
        registrationId: registration._id,
        qrHash: registration.qrCodeData,
        userName: registration.user?.name || null,
        festName: registration.fest?.festName || 'Unknown',
        festDate: registration.fest?.festDate || null,
        venue: registration.fest?.venue || null,
        competitionName: registration.competitionId?.name || null,
        checkedIn: registration.checkedIn || false,
        checkedInAt: registration.checkedInAt || null,
      },
    });
  } catch (error) {
    console.error('❌ QR generation error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate QR code' });
  }
};

const generateTrekQR = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { bookingId } = req.params;

    const booking = await TrekBooking.findOne({ _id: bookingId, userId })
      .populate({
        path: 'trekId',
        select: 'trekName trekDate city groupLink communityId',
        populate: { path: 'communityId', select: 'name groupLink' },
      })
      .populate('userId', 'name');

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Trek booking not found' });
    }

    if (booking.status === 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Ticket available after the trek organizer approves your payment.',
      });
    }
    if (booking.status !== 'confirmed') {
      return res.status(400).json({
        success: false,
        message: 'This booking is not active. Ticket unavailable.',
      });
    }

    if (!booking.qrCodeData) {
      booking.qrCodeData = crypto.randomBytes(16).toString('hex');
      await booking.save();
    }

    const { groupLink } = resolveTrekGroupLink(booking.trekId);

    res.json({
      success: true,
      data: {
        registrationId: booking._id,
        bookingId: booking._id,
        ticketType: 'trek',
        qrHash: booking.qrCodeData,
        userName: booking.userId?.name || booking.userName || null,
        trekName: booking.trekId?.trekName || 'Trek',
        festName: booking.trekId?.trekName || 'Trek',
        festDate: booking.bookingDetails?.date || booking.trekId?.trekDate || null,
        trekTime: booking.bookingDetails?.time || null,
        venue: booking.trekId?.city || null,
        people: booking.bookingDetails?.people || 1,
        groupLink,
        checkedIn: booking.checkedIn || false,
        checkedInAt: booking.checkedInAt || null,
      },
    });
  } catch (error) {
    console.error('❌ Trek QR generation error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate trek QR code' });
  }
};

const generateSportsQR = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { registrationId } = req.params;

    const registration = await CategoryRegistration.findOne({
      _id: registrationId,
      user: userId,
      category: 'sports',
      status: 'confirmed',
    }).populate('user', 'name');

    if (!registration) {
      const pending = await CategoryRegistration.findOne({
        _id: registrationId,
        user: userId,
        category: 'sports',
        status: 'pending',
      }).lean();
      if (pending) {
        return res.status(400).json({
          success: false,
          message: 'Ticket available after the run club approves your payment',
        });
      }
      return res.status(404).json({ success: false, message: 'Sports registration not found' });
    }

    const event = await SportsEvent.findById(registration.eventId).select(
      'title eventDate venue city sportType images',
    );

    if (!registration.qrCodeData) {
      registration.qrCodeData = crypto.randomBytes(16).toString('hex');
      await registration.save();
    }

    res.json({
      success: true,
      data: {
        registrationId: registration._id,
        ticketType: 'sports',
        qrHash: registration.qrCodeData,
        userName: registration.user?.name || null,
        eventTitle: event?.title || 'Sports Event',
        festName: event?.title || 'Sports Event',
        festDate: event?.eventDate || null,
        venue: event?.venue || event?.city || null,
        sportType: event?.sportType || null,
        checkedIn: registration.checkedIn || false,
        checkedInAt: registration.checkedInAt || null,
      },
    });
  } catch (error) {
    console.error('❌ Sports QR generation error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate sports QR code' });
  }
};

const generateEventShowQR = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { registrationId } = req.params;
    const EventShowRegistration = require('../model/event_show_registration_model');

    const registration = await EventShowRegistration.findOne({
      _id: registrationId,
      user: userId,
    })
      .populate('eventShow', 'title displayName venue city showTimings')
      .populate('user', 'name');

    if (!registration) {
      return res.status(404).json({ success: false, message: 'Event registration not found' });
    }

    if (!registration.qrCodeData) {
      registration.qrCodeData = crypto.randomBytes(16).toString('hex');
      await registration.save();
    }

    const show = registration.eventShow || {};
    const eventDate = show.showTimings?.[0]?.date || null;

    res.json({
      success: true,
      data: {
        registrationId: registration._id,
        ticketType: 'event',
        qrHash: registration.qrCodeData,
        userName: registration.user?.name || null,
        eventTitle: show.displayName || show.title || 'Event',
        festName: show.displayName || show.title || 'Event',
        festDate: eventDate,
        venue: show.venue || show.city || null,
        checkedIn: registration.checkedIn || false,
        checkedInAt: registration.checkedInAt || null,
      },
    });
  } catch (error) {
    console.error('❌ Event QR generation error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate event QR code' });
  }
};

const verifyQR = async (req, res) => {
  try {
    const raw = req.params.hash || '';
    const result = await performCheckinFromRaw(raw, { scannedBy: 'Admin', logToSheets: true });
    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error('❌ QR verify error:', error);
    res.status(500).json({ success: false, status: 'error', message: 'Failed to verify QR code' });
  }
};

const verifyQRFromPayload = async (req, res) => {
  try {
    const raw = req.body.qrData || req.body.payload || req.body.hash;
    const result = await performCheckinFromRaw(raw, { scannedBy: 'Admin', logToSheets: true });
    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error('❌ QR verify payload error:', error);
    res.status(500).json({ success: false, status: 'error', message: 'Failed to verify QR code' });
  }
};

const getCheckinStats = async (req, res) => {
  try {
    const { festId } = req.params;

    const [totalRegistered, totalCheckedIn] = await Promise.all([
      Registration.countDocuments({ fest: festId }),
      Registration.countDocuments({ fest: festId, checkedIn: true }),
    ]);

    res.json({
      success: true,
      festId,
      totalRegistered,
      totalCheckedIn,
      checkinRate: totalRegistered > 0
        ? Math.round((totalCheckedIn / totalRegistered) * 100)
        : 0,
    });
  } catch (error) {
    console.error('❌ Check-in stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch check-in stats' });
  }
};

module.exports = {
  generateQR,
  generateTrekQR,
  generateSportsQR,
  generateEventShowQR,
  verifyQR,
  verifyQRFromPayload,
  getCheckinStats,
};
