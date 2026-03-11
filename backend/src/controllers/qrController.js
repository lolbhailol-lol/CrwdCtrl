const crypto = require('crypto');
const Registration = require('../model/registration_model');

// ===== GET: Generate QR code for a registration =====
const generateQR = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { registrationId } = req.params;

    const registration = await Registration.findOne({
      _id: registrationId,
      user: userId,
    }).populate('fest', 'festName festDate venue')
      .populate('competitionId', 'name');

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

    // Return QR data for frontend to render (lightweight approach)
    res.json({
      success: true,
      qr: {
        data: qrData,
        hash: registration.qrCodeData,
        checkinUrl: `/checkin/${registration.qrCodeData}`,
        registration: {
          id: registration._id,
          festName: registration.fest?.festName || 'Unknown',
          festDate: registration.fest?.festDate || null,
          venue: registration.fest?.venue || null,
          competitionName: registration.competitionId?.name || null,
          status: registration.status,
          checkedIn: registration.checkedIn || false,
          checkedInAt: registration.checkedInAt || null,
        },
      },
    });
  } catch (error) {
    console.error('❌ QR generation error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate QR code' });
  }
};

// ===== POST: Verify QR code and check in =====
const verifyQR = async (req, res) => {
  try {
    const { hash } = req.params;

    const registration = await Registration.findOne({ qrCodeData: hash })
      .populate('user', 'name email profilePic')
      .populate('fest', 'festName festDate')
      .populate('competitionId', 'name');

    if (!registration) {
      return res.status(404).json({
        success: false,
        status: 'invalid',
        message: 'Invalid QR code — registration not found',
      });
    }

    if (registration.checkedIn) {
      return res.json({
        success: true,
        status: 'already_checked_in',
        message: 'Already checked in',
        data: {
          userName: registration.user?.name,
          festName: registration.fest?.festName,
          competitionName: registration.competitionId?.name,
          checkedInAt: registration.checkedInAt,
        },
      });
    }

    // Mark as checked in
    registration.checkedIn = true;
    registration.checkedInAt = new Date();
    await registration.save();

    // Create notification for the user
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

    res.json({
      success: true,
      status: 'checked_in',
      message: 'Check-in successful!',
      data: {
        userName: registration.user?.name,
        userEmail: registration.user?.email,
        userProfilePic: registration.user?.profilePic,
        festName: registration.fest?.festName,
        competitionName: registration.competitionId?.name,
        checkedInAt: registration.checkedInAt,
      },
    });
  } catch (error) {
    console.error('❌ QR verify error:', error);
    res.status(500).json({ success: false, message: 'Failed to verify QR code' });
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
  verifyQR,
  getCheckinStats,
};
