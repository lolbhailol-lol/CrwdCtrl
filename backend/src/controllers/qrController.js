const crypto = require('crypto');
const Registration = require('../model/registration_model');
const TrekBooking = require('../model/trek_booking_model');
const { extractHashFromQrPayload, parseQrPayload, resolveCheckinRecord } = require('../utils/qrCheckin');

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

    // Generate unique QR hash if not already present
    if (!registration.qrCodeData) {
      registration.qrCodeData = crypto.randomBytes(16).toString('hex');
      await registration.save();
    }

    // Generate QR code as SVG (no external library needed — use a simple API or inline SVG)
    const qrData = JSON.stringify({
      hash: registration.qrCodeData,
      registrationId: registration._id,
      type: 'crwdctrl-checkin',
    });

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
      .populate('trekId', 'trekName trekDate city')
      .populate('userId', 'name');

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Trek booking not found' });
    }

    if (!booking.qrCodeData) {
      booking.qrCodeData = crypto.randomBytes(16).toString('hex');
      await booking.save();
    }

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
        checkedIn: booking.checkedIn || false,
        checkedInAt: booking.checkedInAt || null,
      },
    });
  } catch (error) {
    console.error('❌ Trek QR generation error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate trek QR code' });
  }
};

const performCheckinFromRaw = async (raw) => {
  const payload = parseQrPayload(raw);
  if (!payload || (!payload.hash && !payload.registrationId && !payload.bookingId)) {
    return {
      status: 400,
      body: {
        success: false,
        status: 'invalid',
        message: 'Invalid QR code format — could not read ticket data',
      },
    };
  }

  const resolved = await resolveCheckinRecord({ Registration, TrekBooking, payload });
  if (!resolved) {
    return {
      status: 404,
      body: {
        success: false,
        status: 'invalid',
        message: 'Ticket not found. Ask the attendee to open My Bookings → Download ticket first, then scan again.',
      },
    };
  }

  if (resolved.kind === 'trek') {
    const trekBooking = await TrekBooking.findById(resolved.record._id)
      .populate('userId', 'name email profilePic')
      .populate('trekId', 'trekName trekDate city');

    if (trekBooking.checkedIn) {
      return {
        status: 200,
        body: {
          success: true,
          status: 'already_checked_in',
          message: 'Already checked in',
          data: {
            userName: trekBooking.userId?.name || trekBooking.userName,
            festName: trekBooking.trekId?.trekName,
            trekName: trekBooking.trekId?.trekName,
            ticketType: 'trek',
            checkedInAt: trekBooking.checkedInAt,
          },
        },
      };
    }

    trekBooking.checkedIn = true;
    trekBooking.checkedInAt = new Date();
    await trekBooking.save();

    const { createNotification } = require('./notificationController');
    const trekUserId = trekBooking.userId?._id || trekBooking.userId;
    if (trekUserId) {
      setImmediate(async () => {
        try {
          await createNotification({
            userId: trekUserId,
            title: 'Checked In!',
            message: `You've been checked in for ${trekBooking.trekId?.trekName || 'your trek'}.`,
            type: 'event',
            metadata: {
              trekId: trekBooking.trekId?._id,
              bookingId: trekBooking._id,
            },
          });
        } catch (err) {
          console.error('❌ Failed to create trek check-in notification:', err.message);
        }
      });
    }

    return {
      status: 200,
      body: {
        success: true,
        status: 'checked_in',
        message: 'Check-in successful!',
        data: {
          userName: trekBooking.userId?.name || trekBooking.userName,
          userEmail: trekBooking.userId?.email || trekBooking.userEmail,
          userProfilePic: trekBooking.userId?.profilePic,
          festName: trekBooking.trekId?.trekName,
          trekName: trekBooking.trekId?.trekName,
          ticketType: 'trek',
          checkedInAt: trekBooking.checkedInAt,
        },
      },
    };
  }

  const registration = await Registration.findById(resolved.record._id)
    .populate('user', 'name email profilePic')
    .populate('fest', 'festName festDate')
    .populate('competitionId', 'name');

  if (registration.checkedIn) {
    return {
      status: 200,
      body: {
        success: true,
        status: 'already_checked_in',
        message: 'Already checked in',
        data: {
          userName: registration.user?.name,
          festName: registration.fest?.festName,
          competitionName: registration.competitionId?.name,
          ticketType: registration.competitionId ? 'competition' : 'fest',
          checkedInAt: registration.checkedInAt,
        },
      },
    };
  }

  registration.checkedIn = true;
  registration.checkedInAt = new Date();
  await registration.save();

  const { createNotification } = require('./notificationController');
  setImmediate(async () => {
    try {
      await createNotification({
        userId: registration.user._id,
        title: 'Checked In!',
        message: `You've been checked in to ${registration.fest?.festName || 'the event'}${registration.competitionId ? ` — ${registration.competitionId.name}` : ''}.`,
        type: 'event',
        metadata: {
          festId: registration.fest?._id,
          competitionId: registration.competitionId?._id,
          registrationId: registration._id,
        },
      });
    } catch (err) {
      console.error('❌ Failed to create check-in notification:', err.message);
    }
  });

  return {
    status: 200,
    body: {
      success: true,
      status: 'checked_in',
      message: 'Check-in successful!',
      data: {
        userName: registration.user?.name,
        userEmail: registration.user?.email,
        userProfilePic: registration.user?.profilePic,
        festName: registration.fest?.festName,
        competitionName: registration.competitionId?.name,
        ticketType: registration.competitionId ? 'competition' : 'fest',
        checkedInAt: registration.checkedInAt,
      },
    },
  };
};

const verifyQR = async (req, res) => {
  try {
    const raw = req.params.hash || '';
    const result = await performCheckinFromRaw(raw);
    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error('❌ QR verify error:', error);
    res.status(500).json({ success: false, status: 'error', message: 'Failed to verify QR code' });
  }
};

const verifyQRFromPayload = async (req, res) => {
  try {
    const raw = req.body.qrData || req.body.payload || req.body.hash;
    const result = await performCheckinFromRaw(raw);
    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error('❌ QR verify payload error:', error);
    res.status(500).json({ success: false, status: 'error', message: 'Failed to verify QR code' });
  }
};

// ===== GET: Check-in stats for a fest =====
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
  verifyQR,
  verifyQRFromPayload,
  getCheckinStats,
};
