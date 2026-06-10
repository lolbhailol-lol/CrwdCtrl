const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const Trek = require('../model/trek_model');
const TrekBooking = require('../model/trek_booking_model');
const FestOrganizer = require('../model/fest_organizer_model');
const SportsEvent = require('../model/sports_model');
const { performCheckinFromRaw } = require('../services/checkinService');

const normalizeCode = (code) =>
  String(code || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '-');

const trekScannerCheckin = async (req, res) => {
  try {
    const raw = req.body.qrData || req.body.payload || req.body.hash;
    if (!raw) {
      return res.status(400).json({ success: false, message: 'QR data is required' });
    }

    const result = await performCheckinFromRaw(raw, {
      trekId: req.scanner.trekId,
      allowTrek: true,
      allowSports: false,
      scannedBy: req.scanner.scannedBy,
      logToSheets: true,
    });

    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error('❌ Trek scanner check-in error:', error);
    res.status(500).json({ success: false, status: 'error', message: 'Failed to verify QR code' });
  }
};

const trekScannerCheckinStats = async (req, res) => {
  try {
    const trekId = req.scanner.trekId;
    const trek = req.scanner.trek;

    const [totalRegistered, totalCheckedIn] = await Promise.all([
      TrekBooking.countDocuments({ trekId, status: 'confirmed' }),
      TrekBooking.countDocuments({ trekId, status: 'confirmed', checkedIn: true }),
    ]);

    res.json({
      success: true,
      trekId,
      trekName: trek?.trekName,
      city: trek?.city,
      totalRegistered,
      totalCheckedIn,
      checkinRate: totalRegistered > 0
        ? Math.round((totalCheckedIn / totalRegistered) * 100)
        : 0,
      hasGoogleSheet: !!trek?.registration?.googleSheetsUrl,
    });
  } catch (error) {
    console.error('❌ Trek scanner stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch check-in stats' });
  }
};

const exportTrekScannerCheckins = async (req, res) => {
  try {
    const trek = req.scanner.trek;
    const bookings = await TrekBooking.find({
      trekId: req.scanner.trekId,
      status: 'confirmed',
      checkedIn: true,
    })
      .populate('userId', 'name email phoneNumber')
      .sort({ checkedInAt: -1 })
      .lean();

    const header = [
      'Checked In At',
      'Name',
      'Email',
      'Phone',
      'Trek',
      'Booking ID',
      'Status',
    ];

    const rows = bookings.map((booking) => [
      booking.checkedInAt
        ? new Date(booking.checkedInAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
        : '',
      booking.userId?.name || booking.userName || '',
      booking.userId?.email || booking.userEmail || '',
      booking.userId?.phoneNumber || '',
      trek?.trekName || '',
      String(booking._id),
      'Completed',
    ]);

    const escapeCsv = (value) => {
      const str = String(value ?? '');
      if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
      return str;
    };

    const csv = [header, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n');
    const safeName = (trek?.trekName || 'trek').replace(/[^a-z0-9-_]+/gi, '_');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}_checkins.csv"`);
    res.send(`\uFEFF${csv}`);
  } catch (error) {
    console.error('❌ Trek scanner export error:', error);
    res.status(500).json({ success: false, message: 'Failed to export check-ins' });
  }
};

const getAdminTrekScannerAccess = async (req, res) => {
  try {
    const { id: trekId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(trekId)) {
      return res.status(400).json({ success: false, message: 'Invalid trek ID' });
    }

    const trek = await Trek.findById(trekId).select(
      'trekName city scannerAccess registration.googleSheetsUrl',
    );
    if (!trek) {
      return res.status(404).json({ success: false, message: 'Trek not found' });
    }

    res.json({
      success: true,
      trekId: trek._id,
      trekName: trek.trekName,
      city: trek.city,
      enabled: !!trek.scannerAccess?.enabled,
      code: trek.scannerAccess?.code || '',
      label: trek.scannerAccess?.label || '',
      hasPassword: !!trek.scannerAccess?.passwordHash,
      googleSheetsUrl: trek.registration?.googleSheetsUrl || '',
      hasGoogleSheet: !!trek.registration?.googleSheetsUrl,
      loginPath: '/organizer/login',
    });
  } catch (error) {
    console.error('❌ getAdminTrekScannerAccess error:', error);
    res.status(500).json({ success: false, message: 'Failed to load scanner access' });
  }
};

const setAdminTrekScannerAccess = async (req, res) => {
  try {
    const { id: trekId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(trekId)) {
      return res.status(400).json({ success: false, message: 'Invalid trek ID' });
    }

    const trek = await Trek.findById(trekId);
    if (!trek) {
      return res.status(404).json({ success: false, message: 'Trek not found' });
    }

    const code = normalizeCode(req.body.code || req.body.scannerCode);
    const password = String(req.body.password || '');
    const label = String(req.body.label || trek.trekName || trek.city || '').trim();
    const enabled = req.body.enabled !== false;
    const googleSheetsUrl =
      req.body.googleSheetsUrl !== undefined
        ? String(req.body.googleSheetsUrl || '').trim()
        : undefined;

    if (!code) {
      return res.status(400).json({ success: false, message: 'Trek scanner code is required (e.g. MANALI-26)' });
    }

    const festDuplicate = await FestOrganizer.findOne({
      'scannerAccess.code': code,
    }).select('_id festName');
    if (festDuplicate) {
      return res.status(400).json({
        success: false,
        message: `Code already used by fest "${festDuplicate.festName}". Pick a unique code.`,
      });
    }

    const trekDuplicate = await Trek.findOne({
      _id: { $ne: trekId },
      'scannerAccess.code': code,
    }).select('_id trekName');
    if (trekDuplicate) {
      return res.status(400).json({
        success: false,
        message: `Code already used by trek "${trekDuplicate.trekName}". Pick a unique code.`,
      });
    }

    const sportDuplicate = await SportsEvent.findOne({
      'scannerAccess.code': code,
    }).select('_id title');
    if (sportDuplicate) {
      return res.status(400).json({
        success: false,
        message: `Code already used by sports event "${sportDuplicate.title}". Pick a unique code.`,
      });
    }

    if (!trek.scannerAccess?.passwordHash && !password) {
      return res.status(400).json({ success: false, message: 'Password is required when setting up scanner login' });
    }

    trek.scannerAccess = trek.scannerAccess || {};
    trek.scannerAccess.enabled = enabled;
    trek.scannerAccess.code = code;
    trek.scannerAccess.label = label;

    if (password) {
      trek.scannerAccess.passwordHash = await bcrypt.hash(password, 10);
    }

    if (googleSheetsUrl !== undefined) {
      trek.registration = trek.registration || {};
      trek.registration.googleSheetsUrl = googleSheetsUrl;
    }

    await trek.save();

    res.json({
      success: true,
      trekId: trek._id,
      trekName: trek.trekName,
      enabled: trek.scannerAccess.enabled,
      code: trek.scannerAccess.code,
      label: trek.scannerAccess.label,
      googleSheetsUrl: trek.registration?.googleSheetsUrl || '',
      hasGoogleSheet: !!trek.registration?.googleSheetsUrl,
      message: password ? 'Trek scanner login updated' : 'Trek scanner settings saved (password unchanged)',
    });
  } catch (error) {
    console.error('❌ setAdminTrekScannerAccess error:', error);
    res.status(500).json({ success: false, message: 'Failed to save scanner access' });
  }
};

module.exports = {
  trekScannerCheckin,
  trekScannerCheckinStats,
  exportTrekScannerCheckins,
  getAdminTrekScannerAccess,
  setAdminTrekScannerAccess,
};
