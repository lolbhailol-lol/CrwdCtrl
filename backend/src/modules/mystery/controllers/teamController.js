const MysteryTeam = require('../models/MysteryTeam');
const MysteryEvent = require('../models/MysteryEvent');
const MysteryCase = require('../models/MysteryCase');
const User = require('../../../model/usermodel');
const { generateRandomCode } = require('../utils/generateCode');
const { generateMysteryToken } = require('../utils/mysteryAuth');

/** Reuse an existing platform User by email/phoneNumber, else create a lightweight guest one. */
async function findOrCreateGuestUser({ name, email, phoneNumberNumber }) {
  let user = null;
  if (email) user = await User.findOne({ email: String(email).toLowerCase().trim() });
  if (!user && phoneNumber) user = await User.findOne({ phoneNumber: String(phoneNumber).trim() });
  if (user) return user;

  user = await User.create({
    name: name || 'Mystery Player',
    email: email ? String(email).toLowerCase().trim() : undefined,
    phoneNumber: phoneNumber ? String(phoneNumber).trim() : undefined,
    password: generateRandomCode(16), // never used to log into CrwdCtrl directly
    role: 'student',
  });
  return user;
}

async function uniqueTeamCode() {
  for (let i = 0; i < 8; i += 1) {
    const code = generateRandomCode(6);
    // eslint-disable-next-line no-await-in-loop
    const exists = await MysteryTeam.findOne({ teamCode: code });
    if (!exists) return code;
  }
  throw new Error('Could not generate a unique team code — try again');
}

/** Public — register a competitive team for a live event, auto-login as leader. */
const registerTeam = async (req, res) => {
  try {
    const {
      eventId, teamName, password,
      captainName, captainEmail, captainphoneNumber,
      members,
    } = req.body;

    if (!eventId || !teamName || !password) {
      return res.status(400).json({ error: 'eventId, teamName aur password required hain' });
    }
    if (String(password).length < 4) {
      return res.status(400).json({ error: 'Password kam se kam 4 characters ka ho' });
    }

    const event = await MysteryEvent.findById(eventId);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    if (event.status !== 'registration_open') {
      return res.status(400).json({ error: 'Registration abhi open nahi hai' });
    }

    const parsedMembers = typeof members === 'string' ? JSON.parse(members) : (members || []);

    const captainUser = await findOrCreateGuestUser({
      name: captainName || teamName,
      email: captainEmail,
      phoneNumber: captainphoneNumber,
    });

    const teamCode = await uniqueTeamCode();

    const team = new MysteryTeam({
      eventId,
      caseId: event.caseId,
      teamName,
      captainUserId: captainUser._id,
      members: [
        {
          userId: captainUser._id,
          name: captainName || teamName,
          email: captainEmail || '',
          contactNo: captainphoneNumber || '',
          isCaptain: true,
        },
        ...parsedMembers,
      ],
      mode: 'competitive',
      teamCode,
      paymentStatus: event.entryFeePerTeam > 0 ? 'pending' : 'not_required',
      gamePassCode: generateRandomCode(10),
    });
    await team.setPassword(password);
    await team.save();

    const token = generateMysteryToken({
      userId: captainUser._id,
      mysteryTeamId: team._id,
      mysteryEventId: team.eventId,
      mysteryRole: 'leader',
    });

    res.status(201).json({ team, token });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Is event me ek hi captain se ek hi team ban sakti hai, ya team code clash hua — retry karo' });
    }
    res.status(500).json({ error: 'Failed to register team', detail: err.message });
  }
};

/** Public — team-code + password login (leader re-entry / another device). */
const enterTeam = async (req, res) => {
  try {
    const { teamCode, password } = req.body;
    if (!teamCode || !password) {
      return res.status(400).json({ error: 'teamCode aur password required hain' });
    }
    const team = await MysteryTeam.findOne({ teamCode: String(teamCode).toUpperCase().trim() }).select('+passwordHash');
    if (!team) return res.status(404).json({ error: 'Team not found' });

    const ok = await team.comparePassword(password);
    if (!ok) return res.status(401).json({ error: 'Galat password' });

    const token = generateMysteryToken({
      userId: team.captainUserId,
      mysteryTeamId: team._id,
      mysteryEventId: team.eventId,
      mysteryRole: 'leader',
    });

    const safeTeam = team.toObject();
    delete safeTeam.passwordHash;
    res.status(200).json({ team: safeTeam, token });
  } catch (err) {
    res.status(500).json({ error: 'Login failed', detail: err.message });
  }
};

/** Public — instant practice session, no password, replayable anytime. */
const startPracticeTeam = async (req, res) => {
  try {
    const { caseId, teamName, playerName, playerEmail } = req.body;
    const mysteryCase = await MysteryCase.findById(caseId);
    if (!mysteryCase || mysteryCase.status !== 'published') {
      return res.status(400).json({ error: 'Valid published case chahiye' });
    }

    const guestUser = await findOrCreateGuestUser({
      name: playerName || teamName || 'Solo Investigator',
      email: playerEmail,
    });

    const team = await MysteryTeam.create({
      eventId: null,
      caseId,
      teamName: teamName || 'Solo Investigator',
      captainUserId: guestUser._id,
      members: [{ userId: guestUser._id, name: playerName || 'Player', email: playerEmail || '', isCaptain: true }],
      mode: 'practice',
      paymentStatus: 'not_required',
    });

    const token = generateMysteryToken({
      userId: guestUser._id,
      mysteryTeamId: team._id,
      mysteryEventId: null,
      mysteryRole: 'leader',
    });

    res.status(201).json({ team, token });
  } catch (err) {
    res.status(500).json({ error: 'Failed to start practice session', detail: err.message });
  }
};

/** Protected (Mystery token) — current session's team. */
const getMyTeam = async (req, res) => {
  try {
    const teamId = req.user.mysteryTeamId;
    if (!teamId) return res.status(401).json({ error: 'Mystery session required' });

    const team = await MysteryTeam.findById(teamId).populate('caseId').populate('eventId');
    if (!team) return res.status(404).json({ error: 'Team not found' });
    res.status(200).json({ team });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch team' });
  }
};

/** Volunteer/admin check-in desk — scans gamePassCode (separate from login teamCode). */
const checkInTeam = async (req, res) => {
  try {
    const { gamePassCode } = req.body;
    const team = await MysteryTeam.findOneAndUpdate(
      { gamePassCode },
      { checkedInAt: new Date() },
      { new: true },
    );
    if (!team) return res.status(404).json({ error: 'Invalid game pass code' });
    res.status(200).json({ message: 'Checked in', team });
  } catch (err) {
    res.status(500).json({ error: 'Check-in failed' });
  }
};

module.exports = {
  registerTeam,
  enterTeam,
  startPracticeTeam,
  getMyTeam,
  checkInTeam,
};