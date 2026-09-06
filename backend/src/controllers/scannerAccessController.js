const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const FestOrganizer = require('../model/fest_organizer_model');
const Trek = require('../model/trek_model');
const SportsEvent = require('../model/sports_model');
const Registration = require('../model/registration_model');
const { getJwtSecret } = require('../config/jwtSecret');
const { performCheckinFromRaw } = require('../services/checkinService');
const { hashScannerPassword } = require('../utils/scannerPassword');

const normalizeCode = (code) =>
  String(code || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '-');

const loginScanner = async (req, res) => {
  try {
    const code = normalizeCode(req.body.code || req.body.festCode || req.body.scannerCode);
    const password = String(req.body.password || '');

    if (!code || !password) {
      return res.status(400).json({ success: false, message: 'Event code and password are required' });
    }

    const fest = await FestOrganizer.findOne({
      'scannerAccess.enabled': true,
      'scannerAccess.code': code,
    }).select('festName collegeName scannerAccess');

    if (fest?.scannerAccess?.passwordHash) {
      const ok = await bcrypt.compare(password, fest.scannerAccess.passwordHash);
      if (ok) {
        const label = fest.scannerAccess.label || fest.collegeName || fest.festName;
        const token = jwt.sign(
          {
            role: 'fest_scanner',
            festId: fest._id,
            code: fest.scannerAccess.code,
            label,
          },
          getJwtSecret(),
          { expiresIn: '14h' },
        );

        return res.json({
          success: true,
          eventType: 'fest',
          token,
          festId: fest._id,
          festName: fest.festName,
          collegeName: fest.collegeName,
          scannerCode: fest.scannerAccess.code,
          label,
          loginUrl: '/organizer/scan',
        });
      }
    }

    const trek = await Trek.findOne({
      'scannerAccess.enabled': true,
      'scannerAccess.code': code,
    }).select('trekName city scannerAccess');

    if (trek?.scannerAccess?.passwordHash) {
      const ok = await bcrypt.compare(password, trek.scannerAccess.passwordHash);
      if (ok) {
        const label = trek.scannerAccess.label || trek.trekName || trek.city;
        const token = jwt.sign(
          {
            role: 'trek_scanner',
            trekId: trek._id,
            code: trek.scannerAccess.code,
            label,
          },
          getJwtSecret(),
          { expiresIn: '14h' },
        );

        return res.json({
          success: true,
          eventType: 'trek',
          token,
          trekId: trek._id,
          trekName: trek.trekName,
          city: trek.city,
          scannerCode: trek.scannerAccess.code,
          label,
          loginUrl: '/organizer/scan',
        });
      }
    }

    const sportEvent = await SportsEvent.findOne({
      'scannerAccess.enabled': true,
      'scannerAccess.code': code,
    }).select('title city sportType scannerAccess');

    if (sportEvent?.scannerAccess?.passwordHash) {
      const ok = await bcrypt.compare(password, sportEvent.scannerAccess.passwordHash);
      if (ok) {
        const label = sportEvent.scannerAccess.label || sportEvent.title || sportEvent.city;
        const token = jwt.sign(
          {
            role: 'sport_scanner',
            sportEventId: sportEvent._id,
            code: sportEvent.scannerAccess.code,
            label,
          },
          getJwtSecret(),
          { expiresIn: '14h' },
        );

        return res.json({
          success: true,
          eventType: 'sport',
          token,
          sportEventId: sportEvent._id,
          eventTitle: sportEvent.title,
          city: sportEvent.city,
          sportType: sportEvent.sportType,
          scannerCode: sportEvent.scannerAccess.code,
          label,
          loginUrl: '/organizer/scan',
        });
      }
    }

    return res.status(401).json({ success: false, message: 'Invalid event code or password' });
  } catch (error) {
    console.error('❌ Scanner login error:', error);
    res.status(500).json({ success: false, message: 'Scanner login failed' });
  }
};

const scannerCheckin = async (req, res) => {
  try {
    const raw = req.body.qrData || req.body.payload || req.body.hash;
    if (!raw) {
      return res.status(400).json({ success: false, message: 'QR data is required' });
    }

    const result = await performCheckinFromRaw(raw, {
      festId: req.scanner.festId,
      allowTrek: false,
      allowSports: false,
      scannedBy: req.scanner.scannedBy,
      logToSheets: true,
    });

    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error('❌ Scanner check-in error:', error);
    res.status(500).json({ success: false, status: 'error', message: 'Failed to verify QR code' });
  }
};

const scannerCheckinStats = async (req, res) => {
  try {
    const festId = req.scanner.festId;
    const fest = req.scanner.fest;

    const [totalRegistered, totalCheckedIn] = await Promise.all([
      Registration.countDocuments({ fest: festId }),
      Registration.countDocuments({ fest: festId, checkedIn: true }),
    ]);

    res.json({
      success: true,
      festId,
      festName: fest?.festName,
      collegeName: fest?.collegeName,
      totalRegistered,
      totalCheckedIn,
      checkinRate: totalRegistered > 0
        ? Math.round((totalCheckedIn / totalRegistered) * 100)
        : 0,
      hasGoogleSheet: !!fest?.registration?.googleSheetsUrl,
    });
  } catch (error) {
    console.error('❌ Scanner stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch check-in stats' });
  }
};

const exportScannerCheckins = async (req, res) => {
  try {
    const fest = req.scanner.fest;
    const registrations = await Registration.find({
      fest: req.scanner.festId,
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
    const safeName = (fest?.festName || 'fest').replace(/[^a-z0-9-_]+/gi, '_');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}_checkins.csv"`);
    res.send(`\uFEFF${csv}`);
  } catch (error) {
    console.error('❌ Scanner export error:', error);
    res.status(500).json({ success: false, message: 'Failed to export check-ins' });
  }
};

const getAdminScannerAccess = async (req, res) => {
  try {
    const { festId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(festId)) {
      return res.status(400).json({ success: false, message: 'Invalid fest ID' });
    }

    const fest = await FestOrganizer.findById(festId).select(
      'festName collegeName scannerAccess registration.googleSheetsUrl',
    );
    if (!fest) {
      return res.status(404).json({ success: false, message: 'Fest not found' });
    }

    res.json({
      success: true,
      festId: fest._id,
      festName: fest.festName,
      enabled: !!fest.scannerAccess?.enabled,
      code: fest.scannerAccess?.code || '',
      label: fest.scannerAccess?.label || '',
      hasPassword: !!fest.scannerAccess?.passwordHash,
      googleSheetsUrl: fest.registration?.googleSheetsUrl || '',
      hasGoogleSheet: !!fest.registration?.googleSheetsUrl,
      loginPath: '/organizer/login',
    });
  } catch (error) {
    console.error('❌ getAdminScannerAccess error:', error);
    res.status(500).json({ success: false, message: 'Failed to load scanner access' });
  }
};

const setAdminScannerAccess = async (req, res) => {
  try {
    const { festId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(festId)) {
      return res.status(400).json({ success: false, message: 'Invalid fest ID' });
    }

    const fest = await FestOrganizer.findById(festId);
    if (!fest) {
      return res.status(404).json({ success: false, message: 'Fest not found' });
    }

    const code = normalizeCode(req.body.code || req.body.scannerCode);
    const password = String(req.body.password || '');
    const label = String(req.body.label || fest.collegeName || fest.festName || '').trim();
    const enabled = req.body.enabled !== false;
    const googleSheetsUrl =
      req.body.googleSheetsUrl !== undefined
        ? String(req.body.googleSheetsUrl || '').trim()
        : undefined;

    if (!code) {
      return res.status(400).json({ success: false, message: 'Scanner fest code is required (e.g. DU-FEST26)' });
    }

    const duplicate = await FestOrganizer.findOne({
      _id: { $ne: festId },
      'scannerAccess.code': code,
    }).select('_id festName');
    if (duplicate) {
      return res.status(400).json({
        success: false,
        message: `Code already used by fest "${duplicate.festName}". Pick a unique code.`,
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
      'scannerAccess.code': code,
    }).select('_id title');
    if (sportDuplicate) {
      return res.status(400).json({
        success: false,
        message: `Code already used by sports event "${sportDuplicate.title}". Pick a unique code.`,
      });
    }

    if (!fest.scannerAccess?.passwordHash && !password) {
      return res.status(400).json({ success: false, message: 'Password is required when setting up scanner login' });
    }

    fest.scannerAccess = fest.scannerAccess || {};
    fest.scannerAccess.enabled = enabled;
    fest.scannerAccess.code = code;
    fest.scannerAccess.label = label;

    let generatedPassword = '';
    if (password) {
      fest.scannerAccess.passwordHash = await hashScannerPassword(password);
      generatedPassword = password;
      fest.scannerAccess.password = undefined;
      fest.markModified('scannerAccess');
      fest.$unset('scannerAccess.password');
    }

    if (googleSheetsUrl !== undefined) {
      fest.registration = fest.registration || {};
      fest.registration.googleSheetsUrl = googleSheetsUrl;
    }

    await fest.save();

    res.json({
      success: true,
      festId: fest._id,
      festName: fest.festName,
      enabled: fest.scannerAccess.enabled,
      code: fest.scannerAccess.code,
      label: fest.scannerAccess.label,
      hasPassword: !!fest.scannerAccess.passwordHash,
      ...(generatedPassword ? { password: generatedPassword } : {}),
      googleSheetsUrl: fest.registration?.googleSheetsUrl || '',
      hasGoogleSheet: !!fest.registration?.googleSheetsUrl,
      message: password ? 'Scanner login updated' : 'Scanner settings saved (password unchanged)',
    });
  } catch (error) {
    console.error('❌ setAdminScannerAccess error:', error);
    res.status(500).json({ success: false, message: 'Failed to save scanner access' });
  }
};

module.exports = {
  loginScanner,
  scannerCheckin,
  scannerCheckinStats,
  exportScannerCheckins,
  getAdminScannerAccess,
  setAdminScannerAccess,
};
