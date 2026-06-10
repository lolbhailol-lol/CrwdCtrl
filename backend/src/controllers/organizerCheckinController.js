const mongoose = require('mongoose');
const FestOrganizer = require('../model/fest_organizer_model');
const Registration = require('../model/registration_model');
const User = require('../model/usermodel');
const { performCheckinFromRaw } = require('../services/checkinService');

async function assertFestOwner(req, res) {
  const { festId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(festId)) {
    res.status(400).json({ success: false, message: 'Invalid fest ID' });
    return null;
  }

  const fest = await FestOrganizer.findOne({
    _id: festId,
    organizer: req.user.userId,
  }).select('festName registration.googleSheetsUrl');

  if (!fest) {
    res.status(403).json({
      success: false,
      message: 'You do not have access to scan check-ins for this fest.',
    });
    return null;
  }

  return fest;
}

const organizerCheckin = async (req, res) => {
  try {
    const fest = await assertFestOwner(req, res);
    if (!fest) return;

    const raw = req.body.qrData || req.body.payload || req.body.hash;
    if (!raw) {
      return res.status(400).json({ success: false, message: 'QR data is required' });
    }

    const scanner = await User.findById(req.user.userId).select('name email');
    const scannedBy = scanner?.name || scanner?.email || 'Organizer';

    const result = await performCheckinFromRaw(raw, {
      festId: fest._id,
      allowTrek: false,
      allowSports: false,
      scannedBy,
      logToSheets: true,
    });

    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error('❌ Organizer check-in error:', error);
    res.status(500).json({ success: false, status: 'error', message: 'Failed to verify QR code' });
  }
};

const organizerCheckinStats = async (req, res) => {
  try {
    const fest = await assertFestOwner(req, res);
    if (!fest) return;

    const festId = fest._id;
    const [totalRegistered, totalCheckedIn] = await Promise.all([
      Registration.countDocuments({ fest: festId }),
      Registration.countDocuments({ fest: festId, checkedIn: true }),
    ]);

    res.json({
      success: true,
      festId,
      festName: fest.festName,
      totalRegistered,
      totalCheckedIn,
      checkinRate: totalRegistered > 0
        ? Math.round((totalCheckedIn / totalRegistered) * 100)
        : 0,
      hasGoogleSheet: !!fest.registration?.googleSheetsUrl,
    });
  } catch (error) {
    console.error('❌ Organizer check-in stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch check-in stats' });
  }
};

const exportOrganizerCheckins = async (req, res) => {
  try {
    const fest = await assertFestOwner(req, res);
    if (!fest) return;

    const registrations = await Registration.find({
      fest: fest._id,
      checkedIn: true,
    })
      .populate('user', 'name email phoneNumber')
      .populate('competitionId', 'name')
      .sort({ checkedInAt: -1 })
      .lean();

    const header = [
      'Checked In At',
      'Name',
      'Email',
      'Phone',
      'Competition',
      'Registration ID',
      'Status',
    ];

    const rows = registrations.map((reg) => [
      reg.checkedInAt
        ? new Date(reg.checkedInAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
        : '',
      reg.user?.name || '',
      reg.user?.email || '',
      reg.user?.phoneNumber || '',
      reg.competitionId?.name || '',
      String(reg._id),
      'Completed',
    ]);

    const escapeCsv = (value) => {
      const str = String(value ?? '');
      if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
      return str;
    };

    const csv = [header, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n');
    const safeName = (fest.festName || 'fest').replace(/[^a-z0-9-_]+/gi, '_');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}_checkins.csv"`);
    res.send(`\uFEFF${csv}`);
  } catch (error) {
    console.error('❌ Organizer check-in export error:', error);
    res.status(500).json({ success: false, message: 'Failed to export check-ins' });
  }
};

module.exports = {
  organizerCheckin,
  organizerCheckinStats,
  exportOrganizerCheckins,
};
