const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const SportsEvent = require('../model/sports_model');
const CategoryRegistration = require('../model/category_registration_model');
const FestOrganizer = require('../model/fest_organizer_model');
const Trek = require('../model/trek_model');
const { performCheckinFromRaw } = require('../services/checkinService');

const normalizeCode = (code) =>
  String(code || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '-');

const sportScannerCheckin = async (req, res) => {
  try {
    const raw = req.body.qrData || req.body.payload || req.body.hash;
    if (!raw) {
      return res.status(400).json({ success: false, message: 'QR data is required' });
    }

    const result = await performCheckinFromRaw(raw, {
      sportEventId: req.scanner.sportEventId,
      allowTrek: false,
      allowSports: true,
      scannedBy: req.scanner.scannedBy,
      logToSheets: true,
    });

    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error('❌ Sport scanner check-in error:', error);
    res.status(500).json({ success: false, status: 'error', message: 'Failed to verify QR code' });
  }
};

const sportScannerCheckinStats = async (req, res) => {
  try {
    const sportEventId = req.scanner.sportEventId;
    const event = req.scanner.sportEvent;

    const [totalRegistered, totalCheckedIn] = await Promise.all([
      CategoryRegistration.countDocuments({
        category: 'sports',
        eventId: sportEventId,
        status: 'confirmed',
      }),
      CategoryRegistration.countDocuments({
        category: 'sports',
        eventId: sportEventId,
        status: 'confirmed',
        checkedIn: true,
      }),
    ]);

    res.json({
      success: true,
      sportEventId,
      eventTitle: event?.title,
      city: event?.city,
      sportType: event?.sportType,
      totalRegistered,
      totalCheckedIn,
      checkinRate: totalRegistered > 0
        ? Math.round((totalCheckedIn / totalRegistered) * 100)
        : 0,
      hasGoogleSheet: !!event?.registration?.googleSheetsUrl,
    });
  } catch (error) {
    console.error('❌ Sport scanner stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch check-in stats' });
  }
};

const exportSportScannerCheckins = async (req, res) => {
  try {
    const event = req.scanner.sportEvent;
    const registrations = await CategoryRegistration.find({
      category: 'sports',
      eventId: req.scanner.sportEventId,
      status: 'confirmed',
      checkedIn: true,
    })
      .populate('user', 'name email phoneNumber')
      .sort({ checkedInAt: -1 })
      .lean();

    const header = [
      'Checked In At',
      'Name',
      'Email',
      'Phone',
      'Event',
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
      event?.title || '',
      String(reg._id),
      'Completed',
    ]);

    const escapeCsv = (value) => {
      const str = String(value ?? '');
      if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
      return str;
    };

    const csv = [header, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n');
    const safeName = (event?.title || 'sports_event').replace(/[^a-z0-9-_]+/gi, '_');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}_checkins.csv"`);
    res.send(`\uFEFF${csv}`);
  } catch (error) {
    console.error('❌ Sport scanner export error:', error);
    res.status(500).json({ success: false, message: 'Failed to export check-ins' });
  }
};

const getAdminSportScannerAccess = async (req, res) => {
  try {
    const { id: sportEventId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(sportEventId)) {
      return res.status(400).json({ success: false, message: 'Invalid sports event ID' });
    }

    const event = await SportsEvent.findById(sportEventId).select(
      'title city sportType scannerAccess registration.googleSheetsUrl',
    );
    if (!event) {
      return res.status(404).json({ success: false, message: 'Sports event not found' });
    }

    res.json({
      success: true,
      sportEventId: event._id,
      eventTitle: event.title,
      city: event.city,
      sportType: event.sportType,
      enabled: !!event.scannerAccess?.enabled,
      code: event.scannerAccess?.code || '',
      label: event.scannerAccess?.label || '',
      hasPassword: !!event.scannerAccess?.passwordHash,
      password: event.scannerAccess?.password || '',
      googleSheetsUrl: event.registration?.googleSheetsUrl || '',
      hasGoogleSheet: !!event.registration?.googleSheetsUrl,
      loginPath: '/organizer/login',
    });
  } catch (error) {
    console.error('❌ getAdminSportScannerAccess error:', error);
    res.status(500).json({ success: false, message: 'Failed to load scanner access' });
  }
};

const setAdminSportScannerAccess = async (req, res) => {
  try {
    const { id: sportEventId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(sportEventId)) {
      return res.status(400).json({ success: false, message: 'Invalid sports event ID' });
    }

    const event = await SportsEvent.findById(sportEventId);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Sports event not found' });
    }

    const code = normalizeCode(req.body.code || req.body.scannerCode);
    const password = String(req.body.password || '');
    const label = String(req.body.label || event.title || event.city || '').trim();
    const enabled = req.body.enabled !== false;
    const googleSheetsUrl =
      req.body.googleSheetsUrl !== undefined
        ? String(req.body.googleSheetsUrl || '').trim()
        : undefined;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Sports scanner code is required (e.g. RUN-CLUB-26)',
      });
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
      'scannerAccess.code': code,
    }).select('_id trekName');
    if (trekDuplicate) {
      return res.status(400).json({
        success: false,
        message: `Code already used by trek "${trekDuplicate.trekName}". Pick a unique code.`,
      });
    }

    const sportDuplicate = await SportsEvent.findOne({
      _id: { $ne: sportEventId },
      'scannerAccess.code': code,
    }).select('_id title');
    if (sportDuplicate) {
      return res.status(400).json({
        success: false,
        message: `Code already used by sports event "${sportDuplicate.title}". Pick a unique code.`,
      });
    }

    if (!event.scannerAccess?.passwordHash && !password) {
      return res.status(400).json({
        success: false,
        message: 'Password is required when setting up scanner login',
      });
    }

    event.scannerAccess = event.scannerAccess || {};
    event.scannerAccess.enabled = enabled;
    event.scannerAccess.code = code;
    event.scannerAccess.label = label;

    if (password) {
      event.scannerAccess.passwordHash = await bcrypt.hash(password, 10);
      event.scannerAccess.password = password;
    }

    if (googleSheetsUrl !== undefined) {
      event.registration = event.registration || {};
      event.registration.googleSheetsUrl = googleSheetsUrl;
    }

    await event.save();

    res.json({
      success: true,
      sportEventId: event._id,
      eventTitle: event.title,
      enabled: event.scannerAccess.enabled,
      code: event.scannerAccess.code,
      label: event.scannerAccess.label,
      password: event.scannerAccess.password || '',
      googleSheetsUrl: event.registration?.googleSheetsUrl || '',
      hasGoogleSheet: !!event.registration?.googleSheetsUrl,
      message: password ? 'Sports scanner login updated' : 'Sports scanner settings saved (password unchanged)',
    });
  } catch (error) {
    console.error('❌ setAdminSportScannerAccess error:', error);
    res.status(500).json({ success: false, message: 'Failed to save scanner access' });
  }
};

module.exports = {
  sportScannerCheckin,
  sportScannerCheckinStats,
  exportSportScannerCheckins,
  getAdminSportScannerAccess,
  setAdminSportScannerAccess,
};
