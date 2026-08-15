const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const FestOrganizerAccount = require('../model/fest_organizer_account_model');
const FestOrganizer = require('../model/fest_organizer_model');
const FestOrganizerProfileInvite = require('../model/fest_organizer_profile_invite_model');
const Registration = require('../model/registration_model');
const { getJwtSecret } = require('../config/jwtSecret');
const { performCheckinFromRaw } = require('../services/checkinService');
const { notifyFestParticipants, notifyFestParticipant, parseNotifyChannels } = require('../utils/festParticipantOutreach');
const { participantsToCsv, participantsToXlsx } = require('../utils/festOrganizerExport');
const {
    normalizeUsername,
    getOrganizerFests,
} = require('../utils/festOrganizerAccess');
const FestOrganizerLoginLog = require('../model/fest_organizer_login_log_model');

const TOKEN_TTL = '7d';

function normalizeDisplayName(raw) {
    return String(raw || '').trim().replace(/\s+/g, ' ').slice(0, 80);
}

function serializeLoginLog(row, selfId, selfDisplayName) {
    const name = row.displayName || row.username || 'Organizer';
    const isYou = String(row.organizer) === String(selfId)
        && String(row.displayNameKey || '') === String(selfDisplayName || '').trim().toLowerCase();
    return {
        id: String(row._id),
        organizerId: String(row.organizer),
        name,
        username: row.username || '',
        firstLoginAt: row.firstLoginAt || row.createdAt || null,
        lastLoginAt: row.lastLoginAt || null,
        loginCount: Number(row.loginCount) || 1,
        isYou,
    };
}

async function listPortalLoggedInUsers(selfId, selfDisplayName = '') {
    const rows = await FestOrganizerLoginLog.find({})
        .sort({ lastLoginAt: -1, displayName: 1 })
        .limit(200)
        .lean();
    return rows.map((r) => serializeLoginLog(r, selfId, selfDisplayName));
}

/** Save the name typed on the login page */
async function recordLoginDisplayName({ organizer, displayName }) {
    const name = normalizeDisplayName(displayName);
    if (!name || !organizer?._id) return null;
    const key = name.toLowerCase();
    const now = new Date();
    return FestOrganizerLoginLog.findOneAndUpdate(
        { organizer: organizer._id, displayNameKey: key },
        {
            $set: {
                displayName: name,
                username: organizer.username || '',
                lastLoginAt: now,
            },
            $inc: { loginCount: 1 },
            $setOnInsert: {
                organizer: organizer._id,
                displayNameKey: key,
                firstLoginAt: now,
            },
        },
        { upsert: true, new: true },
    );
}

function startOfToday() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
}

function responsesToObject(responses) {
    if (!responses) return {};
    if (responses instanceof Map) return Object.fromEntries(responses);
    if (typeof responses.toObject === 'function') return responses.toObject();
    return { ...responses };
}

function pickResponse(responses, keys) {
    for (const key of keys) {
        const v = responses[key];
        if (v == null) continue;
        const s = String(Array.isArray(v) ? v.join(', ') : v).trim();
        if (s) return s;
    }
    return '';
}

const HIDDEN_RESPONSE_KEYS = new Set([
    'manual_entry', 'added_by_organizer', 'organizer_note',
    'password', 'token', 'qr',
]);

function buildHighlights(responses = {}) {
    const out = [];
    for (const [key, value] of Object.entries(responses)) {
        if (!key || key.startsWith('_')) continue;
        // Skip identity fields already shown as name/email/phone/team/college
        const nk = String(key).trim().toLowerCase().replace(/[\s-]+/g, '_');
        if (HIDDEN_RESPONSE_KEYS.has(nk) || HIDDEN_RESPONSE_KEYS.has(key)) continue;
        if (/^(full_?name|name|fullname|leader_name|participant_name|user_name|username)$/.test(nk)) continue;
        if (/^(email|email_id|e_mail|mail|user_email)/.test(nk)) continue;
        if (/^(phone|mobile|whatsapp|contact)/.test(nk) && !/(emergency|parent|alt|guardian)/.test(nk)) continue;
        if (/^(team|group|band)_?name$|^team$/.test(nk)) continue;
        if (/^(college|institution|university)/.test(nk)) continue;
        if (/^(city|location|hometown|year|course|branch|department|stream|class)$/.test(nk)) continue;
        if (/^(team_members|members|member_names|teammates|team_size|person_fields)$/.test(nk)) continue;
        if (value == null || value === '') continue;
        const label = key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
        const display = Array.isArray(value)
            ? value.map((v) => (typeof v === 'object' ? JSON.stringify(v) : String(v))).join(', ')
            : typeof value === 'object'
                ? JSON.stringify(value)
                : String(value);
        if (!display.trim()) continue;
        out.push({ key, label, value: display.trim().slice(0, 200) });
        if (out.length >= 8) break;
    }
    return out;
}

function formatTeamMember(raw, index = 0) {
    if (typeof raw === 'string') {
        const name = String(raw || '').trim();
        return name ? { index: index + 1, name, email: '', phone: '', college: '', fields: { name } } : null;
    }
    if (!raw || typeof raw !== 'object') return null;
    const fields = {};
    for (const [k, v] of Object.entries(raw)) {
        const key = String(k || '').trim();
        if (!key || key.startsWith('_')) continue;
        const val = v == null ? '' : String(v).trim();
        if (!val) continue;
        fields[key] = val;
    }
    const name = String(raw.name || raw.full_name || raw.fullName || '').trim();
    const email = String(raw.email || '').trim();
    const phone = String(raw.phone || raw.mobile || '').trim();
    const college = String(raw.college || raw.college_name || '').trim();
    if (!name && !email && !phone && !Object.keys(fields).length) return null;
    return {
        index: index + 1,
        name: name || `Person ${index + 1}`,
        email,
        phone,
        college,
        fields,
    };
}

function formatParticipant(reg) {
    const responses = responsesToObject(reg.responses);
    const user = reg.user && typeof reg.user === 'object' ? reg.user : null;
    const teamName = pickResponse(responses, ['team_name', 'teamName', 'team', 'group_name', 'band_name']);
    const college = pickResponse(responses, ['college', 'college_name', 'collegeName', 'institution']);
    const city = pickResponse(responses, ['city', 'location', 'hometown']);
    const year = pickResponse(responses, ['year', 'year_of_study', 'academic_year', 'class']);
    const course = pickResponse(responses, ['course', 'branch', 'department', 'stream']);
    const membersRaw = responses.team_members
        || responses.members
        || responses.member_names
        || responses.teammates
        || '';
    let teamMembers = [];
    if (Array.isArray(membersRaw)) {
        teamMembers = membersRaw.map((m, i) => formatTeamMember(m, i)).filter(Boolean);
    } else if (typeof membersRaw === 'string' && membersRaw.trim()) {
        teamMembers = membersRaw.split(/[,;\n]+/)
            .map((s) => s.trim())
            .filter(Boolean)
            .map((s, i) => formatTeamMember(s, i))
            .filter(Boolean);
    }

    const teamSizeRaw = Number(responses.team_size);
    let teamSize = Number.isFinite(teamSizeRaw) && teamSizeRaw > 0
        ? Math.floor(teamSizeRaw)
        : (teamMembers.length || 0);

    const personFields = Array.isArray(responses.person_fields)
        ? responses.person_fields
            .map((f) => ({
                key: String(f?.key || '').trim(),
                label: String(f?.label || f?.key || '').trim(),
            }))
            .filter((f) => f.key)
        : [];

    const userName = user?.name || pickResponse(responses, ['full_name', 'name', 'leader_name']) || teamMembers[0]?.name || '';
    const userPhone = user?.phone || user?.phoneNumber
        || pickResponse(responses, ['contact_no', 'phone', 'mobile']) || teamMembers[0]?.phone || '';
    const userEmail = user?.email || pickResponse(responses, ['email']) || teamMembers[0]?.email || '';
    const collegeResolved = college || teamMembers[0]?.college || '';

    // Solo / legacy regs: still show a clear person card on the organizer dashboard
    if (!teamMembers.length && (userName || userEmail || userPhone || collegeResolved)) {
        const synthesized = formatTeamMember({
            name: userName || 'Participant',
            email: userEmail,
            phone: userPhone,
            college: collegeResolved,
        }, 0);
        if (synthesized) teamMembers = [synthesized];
    }

    const members = teamMembers.map((m) => {
        const bits = [m.name, m.email, m.phone, m.college].filter(Boolean);
        return bits.join(' · ');
    }).filter(Boolean);
    if (!teamSize) teamSize = teamMembers.length || (userName ? 1 : 0);

    return {
        id: reg._id,
        status: reg.status,
        paymentStatus: reg.paymentStatus || 'free',
        amountPaid: Number(reg.amountPaid) || 0,
        checkedIn: Boolean(reg.checkedIn),
        checkedInAt: reg.checkedInAt || null,
        competitionId: reg.competitionId?._id || reg.competitionId || null,
        competitionName: reg.competitionId?.competitionName || reg.competitionId?.name || '',
        userName,
        userEmail,
        userPhone,
        teamName,
        college: collegeResolved,
        city,
        year,
        course,
        members,
        teamMembers,
        teamSize,
        personFields,
        memberCount: teamSize,
        entryType: (teamSize > 1 || teamMembers.length > 1) ? 'team' : 'solo',
        highlights: buildHighlights(responses),
        note: pickResponse(responses, ['organizer_note', 'note', 'remarks']),
        isManual: /^(yes|true|1)$/i.test(String(responses.manual_entry || responses.added_by_organizer || '')),
        submittedAt: reg.submittedAt || reg.createdAt,
        createdAt: reg.createdAt,
        updatedAt: reg.updatedAt,
        qrCodeData: reg.qrCodeData || null,
        payment_id: reg.payment_id || null,
        payment_order_id: reg.payment_order_id || null,
        payment_gateway: reg.payment_gateway || null,
        responses,
    };
}

/** True when the saved form is a multi-person / team registration */
function registrationIsTeamEntry(p = {}) {
    const members = Array.isArray(p.teamMembers) ? p.teamMembers.filter(Boolean) : [];
    const size = Math.max(
        Number(p.teamSize) || 0,
        Number(p.memberCount) || 0,
        members.length,
    );
    return size > 1 || members.length > 1;
}

/** MindSpark: payment gateway confirms entry — no organizer approve queue */
async function clearMindSparkReviewQueue(festId, competitionId = null) {
    const { isMindSparkFestId } = require('../utils/personFields');
    if (!isMindSparkFestId(festId)) return 0;
    const filter = {
        fest: festId,
        status: 'pending',
        isProShow: { $ne: true },
    };
    if (competitionId && mongoose.Types.ObjectId.isValid(competitionId)) {
        filter.competitionId = competitionId;
    }
    const result = await Registration.updateMany(filter, { $set: { status: 'approved' } });
    return Number(result?.modifiedCount || 0);
}

function buildSingleRegTeamCard(p) {
    const members = Array.isArray(p.teamMembers) ? p.teamMembers.filter(Boolean) : [];
    const size = Math.max(Number(p.teamSize) || 0, Number(p.memberCount) || 0, members.length, 1);
    const teamName = String(p.teamName || '').trim()
        || `${p.userName || 'Team'} · ${size} ${size === 1 ? 'person' : 'people'}`;
    return {
        id: `reg-${p.id}`,
        teamName,
        college: p.college || members[0]?.college || '',
        city: p.city || '',
        year: p.year || '',
        course: p.course || '',
        memberNames: members.map((m) => m.name).filter(Boolean),
        teamMembers: members,
        teamSize: size,
        personFields: p.personFields || [],
        registrations: [p],
        registrationIds: [p.id],
        status: p.status,
        paymentStatus: p.paymentStatus,
        amountPaid: Number(p.amountPaid) || 0,
        checkedInCount: p.checkedIn ? 1 : 0,
        pendingCount: p.status === 'pending' ? 1 : 0,
        approvedCount: p.status === 'approved' ? 1 : 0,
        captainName: p.userName || members[0]?.name || '',
        captainPhone: p.userPhone || members[0]?.phone || '',
        captainEmail: p.userEmail || members[0]?.email || '',
        captainId: p.id,
        submittedAt: p.submittedAt || p.createdAt,
        highlights: p.highlights || [],
        isManual: Boolean(p.isManual),
        memberCount: size,
        checkedIn: Boolean(p.checkedIn),
        members: p.members || members.map((m) => m.name).filter(Boolean),
        singleRegistrationRoster: true,
        entryType: 'team',
    };
}

function groupParticipantsIntoTeams(participants) {
    const teams = [];
    const solo = [];
    const byKey = new Map();

    for (const p of participants) {
        const entry = { ...p, entryType: registrationIsTeamEntry(p) ? 'team' : 'solo' };

        // Solo form saves (1 person) — even if they typed a team name
        if (entry.entryType === 'solo') {
            solo.push(entry);
            continue;
        }

        const key = String(p.teamName || '').trim().toLowerCase();

        // Multi-person with no shared team name → one team card per registration
        if (!key) {
            teams.push(buildSingleRegTeamCard(entry));
            continue;
        }

        if (!byKey.has(key)) {
            byKey.set(key, {
                id: key,
                teamName: p.teamName,
                college: p.college || '',
                city: p.city || '',
                year: p.year || '',
                course: p.course || '',
                memberNames: [],
                teamMembers: [],
                personFields: p.personFields || [],
                registrations: [],
                registrationIds: [],
                status: p.status,
                paymentStatus: p.paymentStatus,
                amountPaid: 0,
                checkedInCount: 0,
                pendingCount: 0,
                approvedCount: 0,
                captainName: p.userName,
                captainPhone: p.userPhone,
                captainEmail: p.userEmail,
                captainId: p.id,
                submittedAt: p.submittedAt || p.createdAt,
                highlights: p.highlights || [],
                isManual: Boolean(p.isManual),
                entryType: 'team',
            });
        }
        const t = byKey.get(key);
        t.registrations.push(entry);
        t.registrationIds.push(p.id);
        t.amountPaid += Number(p.amountPaid) || 0;
        if (!t.college && p.college) t.college = p.college;
        if (!t.city && p.city) t.city = p.city;
        if (!t.year && p.year) t.year = p.year;
        if (!t.course && p.course) t.course = p.course;
        if (p.status === 'pending') {
            t.status = 'pending';
            t.pendingCount += 1;
        } else if (p.status === 'approved') {
            t.approvedCount += 1;
            if (t.status !== 'pending') t.status = 'approved';
        } else if (p.status === 'rejected' && t.status !== 'pending' && t.status !== 'approved') {
            t.status = 'rejected';
        }
        if (p.paymentStatus === 'paid') t.paymentStatus = 'paid';
        else if (p.paymentStatus === 'pending' && t.paymentStatus !== 'paid') t.paymentStatus = 'pending';
        if (p.checkedIn) t.checkedInCount += 1;
        if (p.userName && !t.memberNames.includes(p.userName)) t.memberNames.push(p.userName);
        if (Array.isArray(p.teamMembers) && p.teamMembers.length) {
            // Prefer embedded roster from the richest registration (don't double-count same names)
            if (!t.teamMembers.length || p.teamMembers.length >= t.teamMembers.length) {
                t.teamMembers = [...p.teamMembers];
                t.personFields = p.personFields || t.personFields;
            }
        }
        if (Array.isArray(p.members)) {
            for (const m of p.members) {
                if (m && !t.memberNames.includes(m)) t.memberNames.push(m);
            }
        }
        if (p.highlights?.length && (!t.highlights || t.highlights.length < p.highlights.length)) {
            t.highlights = p.highlights;
        }
        if (p.isManual) t.isManual = true;
        const submitted = p.submittedAt || p.createdAt;
        if (submitted && (!t.submittedAt || new Date(submitted) < new Date(t.submittedAt))) {
            t.submittedAt = submitted;
        }
        if (p.userPhone && !t.captainPhone) {
            t.captainName = p.userName;
            t.captainPhone = p.userPhone;
            t.captainEmail = p.userEmail;
            t.captainId = p.id;
        }
    }

    for (const t of byKey.values()) {
        const embedded = Array.isArray(t.teamMembers) ? t.teamMembers.length : 0;
        t.memberCount = embedded || t.memberNames.length || t.registrations.length;
        t.teamSize = Math.max(
            t.memberCount,
            ...t.registrations.map((r) => Number(r.teamSize) || 0),
            1,
        );
        t.checkedIn = t.checkedInCount > 0 && t.checkedInCount >= t.registrations.length;
        t.members = t.memberNames;
        // If somehow only 1 person after merge, still keep as team entry when form said team
        teams.push(t);
    }
    teams.sort((a, b) => {
        const pd = (b.pendingCount || 0) - (a.pendingCount || 0);
        if (pd !== 0) return pd;
        return String(a.teamName || '').localeCompare(String(b.teamName || ''));
    });
    solo.sort((a, b) => {
        if (a.status === 'pending' && b.status !== 'pending') return -1;
        if (b.status === 'pending' && a.status !== 'pending') return 1;
        return String(a.userName || '').localeCompare(String(b.userName || ''));
    });
    return { teams, solo };
}

async function buildOrganizerAuthResponse(organizer, { displayName } = {}) {
    organizer.lastLoginAt = new Date();
    if (!organizer.status) organizer.status = 'approved';
    await organizer.save();

    const typedName = normalizeDisplayName(displayName) || organizer.name || organizer.username || '';

    const token = jwt.sign(
        {
            organizerId: organizer._id,
            role: 'fest_organizer',
            username: organizer.username,
            displayName: typedName,
        },
        getJwtSecret(),
        { expiresIn: TOKEN_TTL },
    );

    const fests = await getOrganizerFests(organizer);

    try {
        await recordLoginDisplayName({ organizer, displayName: typedName });
    } catch (err) {
        console.warn('[festOrganizerPortal.login] login log', err.message);
    }

    let loggedInUsers = [];
    try {
        loggedInUsers = await listPortalLoggedInUsers(organizer._id, typedName);
    } catch (err) {
        console.warn('[festOrganizerPortal.login] list logins', err.message);
    }

    return {
        success: true,
        token,
        organizer: {
            id: organizer._id,
            name: typedName,
            accountName: organizer.name || '',
            username: organizer.username,
            email: organizer.email || '',
            phone: organizer.phone,
            status: FestOrganizerAccount.effectiveStatus(organizer),
            assignedFestIds: organizer.assignedFestIds || [],
            displayName: typedName,
        },
        fests,
        loggedInCount: loggedInUsers.length,
        loggedInUsers,
    };
}

exports.login = async (req, res) => {
    try {
        const username = normalizeUsername(req.body.username || req.body.email);
        const password = String(req.body.password || '');
        // Optional legacy field — fall back to account name/username in buildOrganizerAuthResponse
        const displayName = normalizeDisplayName(req.body.displayName || req.body.name);

        if (!username || !password) {
            return res.status(400).json({ success: false, message: 'Username and password are required' });
        }

        const organizer = await FestOrganizerAccount.findOne({
            $or: [{ username }, { email: username }],
        });
        if (!organizer) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        const valid = await organizer.comparePassword(password);
        if (!valid) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        const status = FestOrganizerAccount.effectiveStatus(organizer);
        if (status === 'pending') {
            return res.status(403).json({
                success: false,
                code: 'pending_approval',
                message: 'Account awaiting CrwdCtrl approval. You can sign in after an admin approves your access.',
            });
        }
        if (status === 'rejected') {
            return res.status(403).json({
                success: false,
                code: 'rejected',
                message: organizer.rejectedReason
                    ? `Access was not approved: ${organizer.rejectedReason}`
                    : 'Access was not approved. Contact CrwdCtrl if you think this is a mistake.',
            });
        }
        if (!organizer.isActive) {
            return res.status(403).json({
                success: false,
                code: 'inactive',
                message: 'This organizer account is deactivated. Contact CrwdCtrl support.',
            });
        }

        res.json(await buildOrganizerAuthResponse(organizer, { displayName }));
    } catch (error) {
        console.error('[festOrganizerPortal.login]', error);
        res.status(500).json({ success: false, message: 'Login failed' });
    }
};

exports.signup = async (req, res) => {
    try {
        await FestOrganizerAccount.ensureSparseEmailIndex();

        const name = String(req.body.name || '').trim();
        const username = normalizeUsername(req.body.username);
        const password = String(req.body.password || '');
        const phone = String(req.body.phone || '').trim();
        const email = String(req.body.email || '').trim().toLowerCase();

        if (!name || !username || !password) {
            return res.status(400).json({ success: false, message: 'Name, username and password are required' });
        }
        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required — use the email CrwdCtrl approved for fest organizer access',
            });
        }
        if (username.length < 3) {
            return res.status(400).json({
                success: false,
                message: 'Username must be at least 3 characters (letters, numbers, underscore)',
            });
        }
        if (password.length < 8) {
            return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
        }

        const invite = await FestOrganizerProfileInvite.findOne({ email, isActive: true }).select('_id').lean();
        if (!invite) {
            return res.status(403).json({
                success: false,
                code: 'invite_required',
                message:
                    'This email is not approved for fest organizer signup. Ask CrwdCtrl to add your email under Admin → Fest Organizers → Profile emails first.',
            });
        }

        const existing = await FestOrganizerAccount.findOne({ username });
        if (existing) {
            return res.status(409).json({ success: false, message: 'Username already taken' });
        }

        const emailTaken = await FestOrganizerAccount.findOne({ email });
        if (emailTaken) {
            return res.status(409).json({
                success: false,
                message: 'An organizer account already exists for this email. Sign in or wait for approval.',
            });
        }

        const organizer = await FestOrganizerAccount.create({
            name,
            username,
            email,
            passwordHash: await FestOrganizerAccount.hashPassword(password),
            phone,
            assignedFestIds: [],
            status: 'pending',
            isActive: false,
            createdBy: null,
        });

        res.status(201).json({
            success: true,
            message: 'Account created. CrwdCtrl will review and approve your login shortly.',
            organizer: {
                id: organizer._id,
                name: organizer.name,
                username: organizer.username,
                status: organizer.status,
            },
        });
    } catch (error) {
        console.error('[festOrganizerPortal.signup]', error);
        if (error.code === 11000) {
            return res.status(409).json({ success: false, message: 'Username or email already taken' });
        }
        res.status(500).json({ success: false, message: 'Failed to create account' });
    }
};

exports.getMe = async (req, res) => {
    try {
        const fests = await getOrganizerFests(req.organizer);
        const displayName = normalizeDisplayName(req.displayName) || req.organizer.name || '';
        let loggedInUsers = [];
        try {
            loggedInUsers = await listPortalLoggedInUsers(req.organizerId, displayName);
        } catch (err) {
            console.warn('[festOrganizerPortal.getMe] login log', err.message);
        }
        res.json({
            success: true,
            organizer: {
                id: req.organizer._id,
                name: displayName || req.organizer.name,
                accountName: req.organizer.name || '',
                username: req.organizer.username,
                email: req.organizer.email || '',
                phone: req.organizer.phone,
                status: FestOrganizerAccount.effectiveStatus(req.organizer),
                displayName: displayName || req.organizer.name || '',
            },
            fests,
            loggedInCount: loggedInUsers.length,
            loggedInUsers,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to load profile' });
    }
};

exports.getDashboard = async (req, res) => {
    try {
        const festId = req.festId;
        await clearMindSparkReviewQueue(festId);
        const festOid = new mongoose.Types.ObjectId(String(festId));
        const fest = await FestOrganizer.findById(festId)
            .select('festName collegeName city festDate festDates festType venue category status coverImage slug registration description subtitle ticketPrice feeAmount')
            .lean();
        if (!fest) return res.status(404).json({ success: false, message: 'Fest not found' });

        const Competition = mongoose.model('Competition');
        const today = startOfToday();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const baseApproved = { fest: festId, status: 'approved', isProShow: { $ne: true } };
        const notProShow = { fest: festId, isProShow: { $ne: true } };

        const [
            totalRegistrations,
            pendingRegistrations,
            rejectedRegistrations,
            checkedIn,
            paidRegs,
            todayRegistrations,
            allActiveCount,
            competitions,
            byCompetition,
            paymentBreakdown,
            recentRegs,
        ] = await Promise.all([
            Registration.countDocuments(baseApproved),
            Registration.countDocuments({ ...notProShow, status: 'pending' }),
            Registration.countDocuments({ ...notProShow, status: 'rejected' }),
            Registration.countDocuments({ ...baseApproved, checkedIn: true }),
            Registration.find(baseApproved).select('amountPaid paymentStatus').lean(),
            Registration.countDocuments({
                ...notProShow,
                createdAt: { $gte: today, $lt: tomorrow },
            }),
            Registration.countDocuments({ ...notProShow, status: { $in: ['pending', 'approved'] } }),
            Competition.find({ fest: festId })
                .select('name competitionType category coverImage subtitle feeAmount registrationFee slotsAllotted')
                .sort({ name: 1 })
                .lean(),
            Registration.aggregate([
                { $match: { fest: festOid, isProShow: { $ne: true } } },
                {
                    $group: {
                        _id: '$competitionId',
                        total: { $sum: 1 },
                        approved: {
                            $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] },
                        },
                        pending: {
                            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] },
                        },
                        rejected: {
                            $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] },
                        },
                        checkedIn: {
                            $sum: {
                                $cond: [
                                    {
                                        $and: [
                                            { $eq: ['$status', 'approved'] },
                                            { $eq: ['$checkedIn', true] },
                                        ],
                                    },
                                    1,
                                    0,
                                ],
                            },
                        },
                        revenue: {
                            $sum: {
                                $cond: [
                                    { $eq: ['$status', 'approved'] },
                                    { $ifNull: ['$amountPaid', 0] },
                                    0,
                                ],
                            },
                        },
                    },
                },
            ]),
            Registration.aggregate([
                { $match: { fest: festOid, status: { $in: ['pending', 'approved'] }, isProShow: { $ne: true } } },
                {
                    $group: {
                        _id: { $ifNull: ['$paymentStatus', 'unknown'] },
                        count: { $sum: 1 },
                        amount: { $sum: { $ifNull: ['$amountPaid', 0] } },
                    },
                },
            ]),
            Registration.find({ fest: festId, status: { $in: ['pending', 'approved'] }, isProShow: { $ne: true } })
                .populate('user', 'name email')
                .populate('competitionId', 'name')
                .sort({ createdAt: -1 })
                .limit(8)
                .select('status paymentStatus amountPaid checkedIn createdAt competitionId user responses')
                .lean(),
        ]);

        const revenue = paidRegs.reduce((sum, r) => sum + (Number(r.amountPaid) || 0), 0);
        const statsById = new Map(
            byCompetition.map((row) => [row._id ? String(row._id) : 'none', row]),
        );

        const competitionStats = competitions.map((c) => {
            const row = statsById.get(String(c._id)) || {};
            const approved = Number(row.approved) || 0;
            const checked = Number(row.checkedIn) || 0;
            const feeAmount = Number(c.feeAmount ?? c.registrationFee) || 0;
            const slotsAllotted = Math.max(0, Number(c.slotsAllotted) || 0);
            const slotsFilled = approved;
            const slotsLeft = slotsAllotted > 0 ? Math.max(0, slotsAllotted - slotsFilled) : null;
            return {
                id: c._id,
                name: c.name || 'Competition',
                competitionType: c.competitionType || '',
                category: c.category || 'OTHER',
                subtitle: c.subtitle || '',
                coverImage: c.coverImage || '',
                feeAmount,
                slotsAllotted,
                slotsFilled,
                slotsLeft,
                total: Number(row.total) || 0,
                approved,
                pending: Number(row.pending) || 0,
                rejected: Number(row.rejected) || 0,
                checkedIn: checked,
                pendingCheckIn: Math.max(0, approved - checked),
                checkInRate: approved > 0 ? Math.round((checked / approved) * 100) : 0,
                revenue: Number(row.revenue) || 0,
            };
        });

        const knownIds = new Set(competitions.map((c) => String(c._id)));
        let other = null;
        for (const [key, row] of statsById.entries()) {
            if (key !== 'none' && knownIds.has(key)) continue;
            const approved = Number(row.approved) || 0;
            const checked = Number(row.checkedIn) || 0;
            const chunk = {
                total: Number(row.total) || 0,
                approved,
                pending: Number(row.pending) || 0,
                rejected: Number(row.rejected) || 0,
                checkedIn: checked,
                revenue: Number(row.revenue) || 0,
            };
            if (!other) {
                other = { ...chunk };
            } else {
                other.total += chunk.total;
                other.approved += chunk.approved;
                other.pending += chunk.pending;
                other.rejected += chunk.rejected;
                other.checkedIn += chunk.checkedIn;
                other.revenue += chunk.revenue;
            }
        }
        if (other && other.total > 0) {
            other.pendingCheckIn = Math.max(0, other.approved - other.checkedIn);
            other.checkInRate = other.approved > 0
                ? Math.round((other.checkedIn / other.approved) * 100)
                : 0;
            competitionStats.push({
                id: null,
                name: 'Other / unassigned',
                competitionType: '',
                category: 'OTHER',
                subtitle: '',
                coverImage: '',
                feeAmount: 0,
                slotsAllotted: 0,
                slotsFilled: 0,
                slotsLeft: null,
                ...other,
            });
        }

        competitionStats.sort((a, b) => (b.total - a.total) || a.name.localeCompare(b.name));

        const payments = { free: 0, pending: 0, paid: 0, failed: 0, unknown: 0, paidAmount: 0 };
        for (const row of paymentBreakdown) {
            const key = String(row._id || 'unknown');
            if (Object.prototype.hasOwnProperty.call(payments, key)) {
                payments[key] = Number(row.count) || 0;
            } else {
                payments.unknown += Number(row.count) || 0;
            }
            if (key === 'paid') payments.paidAmount = Number(row.amount) || 0;
        }

        const recent = recentRegs.map((reg) => {
            const formatted = formatParticipant(reg);
            return {
                id: formatted.id,
                status: formatted.status,
                paymentStatus: formatted.paymentStatus,
                amountPaid: formatted.amountPaid,
                checkedIn: formatted.checkedIn,
                competitionName: formatted.competitionName,
                userName: formatted.userName,
                userEmail: formatted.userEmail,
                userPhone: formatted.userPhone,
                teamName: formatted.teamName,
                college: formatted.college,
                highlights: (formatted.highlights || []).slice(0, 3),
                createdAt: formatted.createdAt,
            };
        });

        res.json({
            success: true,
            fest: {
                id: fest._id,
                festName: fest.festName,
                subtitle: fest.subtitle || '',
                collegeName: fest.collegeName || '',
                city: fest.city || '',
                festDate: fest.festDate || '',
                festDates: fest.festDates || null,
                festType: fest.festType || '',
                venue: fest.venue || '',
                category: fest.category || '',
                status: fest.status || '',
                coverImage: fest.coverImage || '',
                slug: fest.slug || '',
                ticketPrice: fest.ticketPrice || '',
                feeAmount: Number(fest.feeAmount) || 0,
                description: fest.description || '',
                registrationMode: fest.registration?.mode || '',
                registrationStatus: fest.registration?.status || 'open',
            },
            stats: {
                totalRegistrations,
                pendingRegistrations,
                rejectedRegistrations,
                allActive: allActiveCount,
                checkedIn,
                pendingCheckIn: Math.max(0, totalRegistrations - checkedIn),
                checkInRate: totalRegistrations > 0
                    ? Math.round((checkedIn / totalRegistrations) * 100)
                    : 0,
                revenue,
                todayRegistrations,
                competitionCount: competitions.length,
                payments,
            },
            competitions: competitionStats,
            recent,
        });
    } catch (error) {
        console.error('[festOrganizerPortal.getDashboard]', error);
        res.status(500).json({ success: false, message: 'Failed to load dashboard' });
    }
};

/** People who typed their name and signed into the portal */
exports.listLoggedInUsers = async (req, res) => {
    try {
        const displayName = normalizeDisplayName(req.displayName) || req.organizer?.name || '';
        const loggedInUsers = await listPortalLoggedInUsers(req.organizerId, displayName);
        res.json({
            success: true,
            loggedInCount: loggedInUsers.length,
            loggedInUsers,
        });
    } catch (error) {
        console.error('[festOrganizerPortal.listLoggedInUsers]', error);
        res.status(500).json({ success: false, message: 'Failed to load logged-in users' });
    }
};

exports.listParticipants = async (req, res) => {
    try {
        const festId = req.festId;
        await clearMindSparkReviewQueue(festId);
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(100, Math.max(10, Number(req.query.limit) || 25));
        const skip = (page - 1) * limit;
        const search = String(req.query.search || '').trim();
        const status = String(req.query.status || '').trim();
        const checkInStatus = String(req.query.checkInStatus || '').trim();
        const paymentStatus = String(req.query.paymentStatus || '').trim();
        const competitionId = req.query.competitionId;

        const filter = { fest: festId, isProShow: { $ne: true } };

        if (['pending', 'approved', 'rejected'].includes(status)) {
            filter.status = status;
        } else if (status === 'all') {
            filter.status = { $in: ['pending', 'approved', 'rejected'] };
        } else {
            filter.status = { $in: ['pending', 'approved'] };
        }

        if (checkInStatus === 'checked_in') {
            filter.checkedIn = true;
        } else if (checkInStatus === 'not_in') {
            filter.checkedIn = { $ne: true };
            // Gate view: only people who should be inside
            if (!['pending', 'rejected'].includes(status)) {
                filter.status = 'approved';
            }
        }
        if (competitionId && mongoose.Types.ObjectId.isValid(competitionId)) {
            filter.competitionId = competitionId;
        }
        if (['paid', 'pending', 'free', 'failed', 'collected'].includes(paymentStatus)) {
            if (paymentStatus === 'collected') {
                filter.paymentStatus = { $in: ['paid', 'free'] };
            } else {
                filter.paymentStatus = paymentStatus;
            }
        }

        if (search) {
            const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            const userIds = await mongoose.model('User').find({
                $or: [
                    { name: regex },
                    { email: regex },
                    { phone: regex },
                    { phoneNumber: regex },
                ],
            }).select('_id').lean();
            const ids = userIds.map((u) => u._id);
            filter.$or = [
                { user: { $in: ids } },
                { 'responses.name': regex },
                { 'responses.full_name': regex },
                { 'responses.email': regex },
                { 'responses.phone': regex },
                { 'responses.mobile': regex },
                { 'responses.contact_no': regex },
                { 'responses.college': regex },
                { 'responses.team_name': regex },
                { 'responses.team_members': regex },
                { 'responses.team_members.name': regex },
                { 'responses.team_members.email': regex },
                { 'responses.team_members.phone': regex },
                { 'responses.team_members.college': regex },
                ...(mongoose.Types.ObjectId.isValid(search) ? [{ _id: search }] : []),
            ];
        }

        const festOid = new mongoose.Types.ObjectId(String(festId));
        const Competition = mongoose.model('Competition');
        const [total, rows, competitions, summaryRows] = await Promise.all([
            Registration.countDocuments(filter),
            Registration.find(filter)
                .populate('user', 'name email phone phoneNumber')
                .populate('competitionId', 'competitionName name')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Competition.find({ fest: festId }).select('name').sort({ name: 1 }).lean(),
            Registration.aggregate([
                { $match: { fest: festOid, isProShow: { $ne: true } } },
                {
                    $group: {
                        _id: null,
                        pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
                        approved: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } },
                        rejected: { $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] } },
                        checkedIn: {
                            $sum: {
                                $cond: [
                                    { $and: [{ $eq: ['$status', 'approved'] }, { $eq: ['$checkedIn', true] }] },
                                    1,
                                    0,
                                ],
                            },
                        },
                        unpaid: {
                            $sum: {
                                $cond: [
                                    {
                                        $and: [
                                            { $in: ['$status', ['pending', 'approved']] },
                                            { $eq: ['$paymentStatus', 'pending'] },
                                        ],
                                    },
                                    1,
                                    0,
                                ],
                            },
                        },
                        collected: {
                            $sum: {
                                $cond: [
                                    {
                                        $and: [
                                            { $in: ['$status', ['pending', 'approved']] },
                                            { $in: ['$paymentStatus', ['paid', 'free']] },
                                        ],
                                    },
                                    1,
                                    0,
                                ],
                            },
                        },
                        active: {
                            $sum: {
                                $cond: [{ $in: ['$status', ['pending', 'approved']] }, 1, 0],
                            },
                        },
                    },
                },
            ]),
        ]);

        const s = summaryRows[0] || {};
        const summary = {
            pending: s.pending || 0,
            approved: s.approved || 0,
            rejected: s.rejected || 0,
            checkedIn: s.checkedIn || 0,
            notCheckedIn: Math.max(0, (s.approved || 0) - (s.checkedIn || 0)),
            unpaid: s.unpaid || 0,
            collected: s.collected || 0,
            active: s.active || 0,
        };

        res.json({
            success: true,
            summary,
            participants: rows.map(formatParticipant),
            competitions: competitions.map((c) => ({ id: c._id, name: c.name || 'Competition' })),
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit) || 1,
            },
        });
    } catch (error) {
        console.error('[festOrganizerPortal.listParticipants]', error);
        res.status(500).json({ success: false, message: 'Failed to load participants' });
    }
};

exports.getParticipant = async (req, res) => {
    try {
        const { registrationId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(registrationId)) {
            return res.status(400).json({ success: false, message: 'Invalid registration ID' });
        }
        const reg = await Registration.findOne({ _id: registrationId, fest: req.festId })
            .populate('user', 'name email phone phoneNumber')
            .populate('competitionId', 'competitionName name')
            .lean();
        if (!reg) return res.status(404).json({ success: false, message: 'Participant not found' });
        res.json({ success: true, participant: formatParticipant(reg) });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to load participant' });
    }
};

exports.exportParticipants = async (req, res) => {
    try {
        const fest = await FestOrganizer.findById(req.festId).select('festName').lean();
        const filter = {
            fest: req.festId,
            status: { $in: ['pending', 'approved'] },
            isProShow: { $ne: true },
        };
        const competitionId = String(req.query.competitionId || '').trim();
        if (competitionId && mongoose.Types.ObjectId.isValid(competitionId)) {
            filter.competitionId = competitionId;
        }
        const rows = await Registration.find(filter)
            .populate('user', 'name email phone phoneNumber')
            .populate('competitionId', 'competitionName name')
            .sort({ createdAt: -1 })
            .lean();

        const participants = rows.map(formatParticipant);
        const safeName = (fest?.festName || 'fest').replace(/[^a-z0-9-_]+/gi, '_');
        const format = String(req.query.format || 'xlsx').toLowerCase();

        if (format === 'csv') {
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${safeName}_participants.csv"`);
            return res.send(participantsToCsv(participants));
        }

        const buffer = await participantsToXlsx(participants);
        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        );
        res.setHeader('Content-Disposition', `attachment; filename="${safeName}_participants.xlsx"`);
        return res.send(buffer);
    } catch (error) {
        console.error('[festOrganizerPortal.exportParticipants]', error);
        res.status(500).json({ success: false, message: 'Export failed' });
    }
};

exports.deleteParticipant = async (req, res) => {
    try {
        const { registrationId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(registrationId)) {
            return res.status(400).json({ success: false, message: 'Invalid registration ID' });
        }
        const reg = await Registration.findOne({ _id: registrationId, fest: req.festId });
        if (!reg) return res.status(404).json({ success: false, message: 'Participant not found' });
        reg.status = 'rejected';
        await reg.save();
        res.json({ success: true, message: 'Registration rejected' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update registration' });
    }
};

exports.updateParticipantStatus = async (req, res) => {
    try {
        const { registrationId } = req.params;
        const status = String(req.body.status || '').trim().toLowerCase();
        if (!mongoose.Types.ObjectId.isValid(registrationId)) {
            return res.status(400).json({ success: false, message: 'Invalid registration ID' });
        }
        if (!['pending', 'approved', 'rejected'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Status must be pending, approved, or rejected' });
        }

        const reg = await Registration.findOne({ _id: registrationId, fest: req.festId });
        if (!reg) return res.status(404).json({ success: false, message: 'Participant not found' });

        reg.status = status;
        await reg.save();

        const populated = await Registration.findById(reg._id)
            .populate('user', 'name email phone phoneNumber')
            .populate('competitionId', 'competitionName name')
            .lean();

        res.json({
            success: true,
            message: status === 'approved'
                ? 'Registration approved'
                : status === 'rejected'
                    ? 'Registration rejected'
                    : 'Registration set to pending',
            participant: formatParticipant(populated),
        });
    } catch (error) {
        console.error('[festOrganizerPortal.updateParticipantStatus]', error);
        res.status(500).json({ success: false, message: 'Failed to update registration' });
    }
};

exports.checkin = async (req, res) => {
    try {
        let raw = req.body.qrData || req.body.payload || req.body.hash || req.body.registrationId;
        if (!raw) {
            return res.status(400).json({ success: false, message: 'QR data or registration ID required' });
        }
        if (mongoose.Types.ObjectId.isValid(String(raw)) && String(raw).length === 24) {
            raw = JSON.stringify({ registrationId: String(raw), type: 'fest' });
        }

        const competitionId = mongoose.Types.ObjectId.isValid(String(req.body.competitionId || ''))
            ? String(req.body.competitionId)
            : null;
        const proShowOnly = req.body.proShowOnly === true
            || req.body.proShowOnly === 'true'
            || req.body.proShow === true
            || req.body.proShow === 'true'
            || req.body.proShow === '1';

        const result = await performCheckinFromRaw(raw, {
            festId: req.festId,
            competitionId: proShowOnly ? null : competitionId,
            proShowOnly,
            allowTrek: false,
            allowSports: false,
            scannedBy: `fest_organizer:${req.organizer.username || req.organizer.name}`,
            logToSheets: false,
        });

        return res.status(result.status).json(result.body);
    } catch (error) {
        console.error('[festOrganizerPortal.checkin]', error);
        res.status(500).json({ success: false, message: 'Check-in failed' });
    }
};

exports.getCheckinStats = async (req, res) => {
    try {
        const fest = await FestOrganizer.findById(req.festId).select('festName').lean();
        const competitionId = String(req.query.competitionId || '').trim();
        const proShowOnly = req.query.proShow === '1'
            || req.query.proShow === 'true'
            || req.query.proShowOnly === '1'
            || req.query.proShowOnly === 'true';
        const filter = { fest: req.festId, status: 'approved' };
        if (proShowOnly) {
            filter.isProShow = true;
        } else {
            filter.isProShow = { $ne: true };
            if (competitionId && mongoose.Types.ObjectId.isValid(competitionId)) {
                filter.competitionId = competitionId;
            }
        }
        const [totalRegistered, totalCheckedIn] = await Promise.all([
            Registration.countDocuments(filter),
            Registration.countDocuments({ ...filter, checkedIn: true }),
        ]);
        let competitionName = '';
        if (proShowOnly) {
            competitionName = 'Pro Show';
        } else if (filter.competitionId) {
            const Competition = mongoose.model('Competition');
            const comp = await Competition.findOne({ _id: filter.competitionId, fest: req.festId })
                .select('name')
                .lean();
            competitionName = comp?.name || '';
        }
        res.json({
            success: true,
            festId: req.festId,
            festName: fest?.festName || '',
            competitionId: filter.competitionId || null,
            competitionName,
            proShowOnly,
            totalRegistered,
            totalCheckedIn,
            checkinRate: totalRegistered > 0
                ? Math.round((totalCheckedIn / totalRegistered) * 100)
                : 0,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to load check-in stats' });
    }
};

exports.sendReminder = async (req, res) => {
    try {
        const fest = await FestOrganizer.findById(req.festId).select('festName').lean();
        if (!fest) return res.status(404).json({ success: false, message: 'Fest not found' });

        const title = String(req.body.title || `Reminder: ${fest.festName}`).trim();
        const message = String(
            req.body.message || 'Your fest is coming up soon. Please arrive on time with your QR ticket.',
        ).trim();
        const competitionId = mongoose.Types.ObjectId.isValid(String(req.body.competitionId || ''))
            ? String(req.body.competitionId)
            : null;
        const audience = String(req.body.audience || 'approved').trim();
        const channels = parseNotifyChannels(req.body);

        const stats = await notifyFestParticipants({
            festId: req.festId,
            festName: fest.festName,
            title,
            message,
            type: 'reminder',
            link: `/view-details/${req.festId}`,
            statusFilter: ['approved'],
            competitionId,
            audience,
            channels,
        });

        res.json({
            success: true,
            message: `Reminder sent to ${stats.participants} participants`,
            sent: stats.inApp,
            delivery: stats,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to send reminder' });
    }
};

exports.broadcastAnnouncement = async (req, res) => {
    try {
        const title = String(req.body.title || '').trim();
        const message = String(req.body.message || '').trim();
        if (!title || !message) {
            return res.status(400).json({ success: false, message: 'Title and message are required' });
        }

        const competitionId = mongoose.Types.ObjectId.isValid(String(req.body.competitionId || ''))
            ? String(req.body.competitionId)
            : null;
        const audience = String(req.body.audience || 'approved').trim();
        const channels = parseNotifyChannels(req.body);

        const fest = await FestOrganizer.findById(req.festId).select('festName').lean();
        const stats = await notifyFestParticipants({
            festId: req.festId,
            festName: fest?.festName || 'Fest',
            title,
            message,
            type: 'announcement',
            link: `/view-details/${req.festId}`,
            statusFilter: ['approved'],
            competitionId,
            audience,
            channels,
        });

        res.json({
            success: true,
            message: `Announcement sent to ${stats.participants} participants`,
            sent: stats.inApp,
            delivery: stats,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to broadcast announcement' });
    }
};

/** Notify a single registration (competition desk / roster row) */
exports.notifyParticipant = async (req, res) => {
    try {
        const { registrationId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(registrationId)) {
            return res.status(400).json({ success: false, message: 'Invalid registration ID' });
        }

        const title = String(req.body.title || '').trim();
        const message = String(req.body.message || '').trim();
        if (!title || !message) {
            return res.status(400).json({ success: false, message: 'Title and message are required' });
        }

        const reg = await Registration.findOne({ _id: registrationId, fest: req.festId })
            .populate('user', 'name email phone phoneNumber')
            .populate('competitionId', 'name competitionName')
            .lean();
        if (!reg) {
            return res.status(404).json({ success: false, message: 'Participant not found' });
        }

        const fest = await FestOrganizer.findById(req.festId).select('festName slug').lean();
        const channels = parseNotifyChannels(req.body);
        const type = String(req.body.type || 'announcement').trim();

        const delivery = await notifyFestParticipant({
            registration: reg,
            festId: req.festId,
            festName: fest?.festName || 'Fest',
            title,
            message,
            type,
            link: `/view-details/${fest?.slug || req.festId}`,
            channels,
        });

        const parts = [];
        if (delivery.inApp) parts.push('in-app');
        if (delivery.email) parts.push('email');

        res.json({
            success: true,
            message: parts.length
                ? `Notification sent (${parts.join(' + ')})`
                : 'Could not deliver — participant may lack app account and email',
            delivery,
        });
    } catch (error) {
        console.error('[festOrganizerPortal.notifyParticipant]', error);
        res.status(500).json({ success: false, message: 'Failed to send notification' });
    }
};

/** WhatsApp / call contact sheet for organizers */
exports.listNotifyContacts = async (req, res) => {
    try {
        const { listFestContacts } = require('../utils/festParticipantOutreach');
        const competitionId = mongoose.Types.ObjectId.isValid(String(req.query.competitionId || ''))
            ? String(req.query.competitionId)
            : null;
        const audience = String(req.query.audience || 'approved').trim();
        const data = await listFestContacts({
            festId: req.festId,
            competitionId,
            audience,
            limit: Number(req.query.limit) || 250,
        });
        res.json({ success: true, ...data });
    } catch (error) {
        console.error('[festOrganizerPortal.listNotifyContacts]', error);
        res.status(500).json({ success: false, message: 'Failed to load contacts' });
    }
};

/** Competition Manager workspace — one competition desk */
exports.getCompetitionOps = async (req, res) => {
    try {
        const festId = req.festId;
        const { competitionId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(competitionId)) {
            return res.status(400).json({ success: false, message: 'Invalid competition ID' });
        }

        await clearMindSparkReviewQueue(festId, competitionId);

        const Competition = mongoose.model('Competition');
        const [fest, competition] = await Promise.all([
            FestOrganizer.findById(festId).select('festName slug').lean(),
            Competition.findOne({ _id: competitionId, fest: festId })
                .select('name subtitle competitionType category feeAmount registrationFee registration description coverImage slotsAllotted teamSizeMin teamSizeMax teamSizeLabel')
                .lean(),
        ]);
        if (!fest) return res.status(404).json({ success: false, message: 'Fest not found' });
        if (!competition) {
            return res.status(404).json({ success: false, message: 'Competition not found for this fest' });
        }

        const base = { fest: festId, competitionId };
        const [pendingRows, activeRows, rejectedCount, paidApproved] = await Promise.all([
            Registration.find({ ...base, status: 'pending' })
                .populate('user', 'name email phone phoneNumber')
                .populate('competitionId', 'name')
                .sort({ createdAt: -1 })
                .limit(100)
                .lean(),
            Registration.find({ ...base, status: { $in: ['pending', 'approved'] } })
                .populate('user', 'name email phone phoneNumber')
                .populate('competitionId', 'name')
                .sort({ createdAt: -1 })
                .limit(500)
                .lean(),
            Registration.countDocuments({ ...base, status: 'rejected' }),
            Registration.find({ ...base, status: 'approved' }).select('amountPaid checkedIn').lean(),
        ]);

        const participants = activeRows.map(formatParticipant);
        const pending = pendingRows.map(formatParticipant);
        const { teams, solo } = groupParticipantsIntoTeams(participants);

        const approved = paidApproved.length;
        const checkedIn = paidApproved.filter((r) => r.checkedIn).length;
        const revenue = paidApproved.reduce((s, r) => s + (Number(r.amountPaid) || 0), 0);
        const pendingCount = pending.length;
        const slotsAllotted = Math.max(0, Number(competition.slotsAllotted) || 0);
        const slotsFilled = approved;
        const slotsLeft = slotsAllotted > 0 ? Math.max(0, slotsAllotted - slotsFilled) : null;
        const teamSizeMin = Math.max(1, Number(competition.teamSizeMin) || 1);
        const teamSizeMax = Math.max(1, Number(competition.teamSizeMax) || teamSizeMin);

        res.json({
            success: true,
            fest: { id: fest._id, festName: fest.festName, slug: fest.slug || '' },
            competition: {
                id: competition._id,
                name: competition.name,
                subtitle: competition.subtitle || '',
                competitionType: competition.competitionType || '',
                category: competition.category || '',
                coverImage: competition.coverImage || '',
                feeAmount: Number(competition.feeAmount ?? competition.registrationFee) || 0,
                slotsAllotted,
                slotsFilled,
                slotsLeft,
                teamSizeMin,
                teamSizeMax,
                teamSizeLabel: competition.teamSizeLabel || '',
                registrationStatus: competition.registration?.status || '',
                description: competition.description || '',
            },
            stats: {
                total: participants.length,
                pending: pendingCount,
                approved,
                rejected: rejectedCount,
                checkedIn,
                pendingCheckIn: Math.max(0, approved - checkedIn),
                checkInRate: approved > 0 ? Math.round((checkedIn / approved) * 100) : 0,
                revenue,
                teamCount: teams.length,
                soloCount: solo.length,
                slotsAllotted,
                slotsFilled,
                slotsLeft,
            },
            pending,
            participants,
            teams,
            solo,
        });
    } catch (error) {
        console.error('[festOrganizerPortal.getCompetitionOps]', error);
        res.status(500).json({ success: false, message: 'Failed to load competition workspace' });
    }
};

/** Set slots remaining (+ optional max people). Updates public website capacity. */
exports.updateCompetitionSlots = async (req, res) => {
    try {
        const { competitionId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(competitionId)) {
            return res.status(400).json({ success: false, message: 'Invalid competition ID' });
        }

        const Competition = mongoose.model('Competition');
        const competition = await Competition.findOne({ _id: competitionId, fest: req.festId });
        if (!competition) {
            return res.status(404).json({ success: false, message: 'Competition not found for this fest' });
        }

        const approved = await Registration.countDocuments({
            fest: req.festId,
            competitionId,
            status: 'approved',
        });

        const body = req.body || {};
        const hasRemaining = body.slotsRemaining !== undefined || body.slotsLeft !== undefined;
        const hasAllotted = body.slotsAllotted !== undefined || body.slots !== undefined;
        let slots = Math.max(0, Number(competition.slotsAllotted) || 0);

        if (hasRemaining) {
            const remaining = Number(body.slotsRemaining ?? body.slotsLeft);
            if (!Number.isFinite(remaining) || remaining < 0) {
                return res.status(400).json({ success: false, message: 'slotsRemaining must be 0 or a positive number' });
            }
            slots = approved + Math.floor(remaining);
        } else if (hasAllotted) {
            const next = Number(body.slotsAllotted ?? body.slots);
            if (!Number.isFinite(next) || next < 0) {
                return res.status(400).json({ success: false, message: 'slotsAllotted must be 0 or a positive number' });
            }
            slots = Math.floor(next);
        }

        competition.slotsAllotted = slots;
        if (!competition.registration) competition.registration = {};
        competition.registration.maxRegistrations = slots > 0 ? slots : null;
        if (!competition.registration.settings || typeof competition.registration.settings !== 'object') {
            competition.registration.settings = {};
        }
        competition.registration.settings.maxRegistrations = slots > 0 ? slots : null;
        competition.markModified('registration');

        let teamSizeChanged = false;
        if (
            body.teamSizeMin !== undefined
            || body.teamSizeMax !== undefined
            || body.maxPeople !== undefined
            || body.teamSizeLabel !== undefined
        ) {
            const { normalizeTeamSizeFields } = require('../utils/teamSize');
            const maxPeople = body.maxPeople !== undefined ? body.maxPeople : body.teamSizeMax;
            const next = normalizeTeamSizeFields({
                teamSizeMin: body.teamSizeMin !== undefined ? body.teamSizeMin : 1,
                teamSizeMax: maxPeople !== undefined ? maxPeople : competition.teamSizeMax,
                teamSizeLabel: body.teamSizeLabel !== undefined ? body.teamSizeLabel : '',
            });
            competition.teamSizeMin = next.teamSizeMin;
            competition.teamSizeMax = next.teamSizeMax;
            competition.teamSizeLabel = next.teamSizeLabel;
            teamSizeChanged = true;
        }

        await competition.save();
        tryClearPublicCaches();

        const slotsLeft = slots > 0 ? Math.max(0, slots - approved) : null;
        const bits = [];
        if (hasRemaining || hasAllotted) {
            bits.push(slots > 0 ? `${slotsLeft} slots remaining` : 'Slots unlimited');
        }
        if (teamSizeChanged) {
            bits.push(`max ${competition.teamSizeMax} ${competition.teamSizeMax === 1 ? 'person' : 'people'}`);
        }

        res.json({
            success: true,
            message: bits.length ? bits.join(' · ') : 'Capacity updated',
            competition: {
                id: competition._id,
                slotsAllotted: slots,
                slotsFilled: approved,
                slotsLeft,
                teamSizeMin: Math.max(1, Number(competition.teamSizeMin) || 1),
                teamSizeMax: Math.max(1, Number(competition.teamSizeMax) || 1),
                teamSizeLabel: competition.teamSizeLabel || '',
            },
        });
    } catch (error) {
        console.error('[festOrganizerPortal.updateCompetitionSlots]', error);
        res.status(500).json({ success: false, message: 'Failed to update capacity' });
    }
};

const { parseTicketPrice } = require('../utils/platformFee');

function getCompetitionBaseFee(registrationFee, feeAmount) {
    const numericFeeAmount = parseTicketPrice(feeAmount);
    return numericFeeAmount || parseTicketPrice(registrationFee);
}

function sanitizeRulesList(value) {
    if (Array.isArray(value)) {
        return value.map((r) => String(r || '').trim()).filter(Boolean);
    }
    if (typeof value === 'string') {
        return value
            .split(/\n+/)
            .map((r) => r.replace(/^[-•*\d.)\s]+/, '').trim())
            .filter(Boolean);
    }
    return [];
}

function sanitizeRounds(value) {
    if (!Array.isArray(value)) return [];
    return value
        .map((round, index) => ({
            roundNumber: Number(round?.roundNumber) || index + 1,
            title: String(round?.title || '').trim() || `Round ${index + 1}`,
            description: String(round?.description || '').trim(),
            rules: sanitizeRulesList(round?.rules),
            roundRulesMessage: String(round?.roundRulesMessage || '').trim(),
            dateTime: String(round?.dateTime || '').trim(),
            venue: String(round?.venue || '').trim(),
            offline: round?.offline && typeof round.offline === 'object'
                ? { rules: sanitizeRulesList(round.offline.rules) }
                : undefined,
            online: round?.online && typeof round.online === 'object'
                ? { rules: sanitizeRulesList(round.online.rules) }
                : undefined,
        }))
        .filter((r) => r.title || r.description || (r.rules && r.rules.length));
}

function serializeCompetitionDetails(competition) {
    return {
        _id: competition._id,
        id: competition._id,
        name: competition.name || '',
        subtitle: competition.subtitle || '',
        description: competition.description || '',
        competitionType: competition.competitionType || '',
        category: competition.category || '',
        prizePool: competition.prizePool || '',
        registrationFee: competition.registrationFee || '',
        feeAmount: Number(competition.feeAmount) || 0,
        registrationLink: competition.registrationLink || '',
        registrationType: competition.registrationType || 'fest',
        registration: competition.registration || { status: 'not_started' },
        legacyRegistration: competition.legacyRegistration || { status: 'NOT_STARTED' },
        dateTime: competition.dateTime || '',
        venue: competition.venue || '',
        coverImage: competition.coverImage || '',
        gallery: Array.isArray(competition.gallery) ? competition.gallery : [],
        commonRules: Array.isArray(competition.commonRules) ? competition.commonRules : [],
        commonRulesMessage: competition.commonRulesMessage || '',
        rounds: Array.isArray(competition.rounds) ? competition.rounds : [],
        contact: {
            name: competition.contact?.name || '',
            phone: competition.contact?.phone || '',
            email: competition.contact?.email || '',
            instagram: competition.contact?.instagram || '',
        },
        slotsAllotted: Math.max(0, Number(competition.slotsAllotted) || 0),
        teamSizeMin: Math.max(1, Number(competition.teamSizeMin) || 1),
        teamSizeMax: Math.max(1, Number(competition.teamSizeMax) || Number(competition.teamSizeMin) || 1),
        teamSizeLabel: competition.teamSizeLabel || 'Solo',
    };
}

function applyCompetitionPayload(competition, body = {}) {
    if (body.name !== undefined) {
        const name = String(body.name || '').trim();
        if (!name) {
            const err = new Error('Competition name is required');
            err.status = 400;
            throw err;
        }
        competition.name = name;
    }
    if (body.subtitle !== undefined) competition.subtitle = String(body.subtitle || '').trim();
    if (body.description !== undefined) competition.description = String(body.description || '').trim();
    if (body.competitionType !== undefined) {
        competition.competitionType = String(body.competitionType || '').trim() || 'other';
    }
    if (body.category !== undefined) competition.category = String(body.category || '').trim() || 'OTHER';
    if (body.prizePool !== undefined) competition.prizePool = String(body.prizePool || '').trim();
    if (body.registrationFee !== undefined) {
        competition.registrationFee = String(body.registrationFee || '').trim();
    }
    if (body.feeAmount !== undefined || body.registrationFee !== undefined) {
        competition.feeAmount = getCompetitionBaseFee(
            body.registrationFee !== undefined ? body.registrationFee : competition.registrationFee,
            body.feeAmount !== undefined ? body.feeAmount : competition.feeAmount,
        );
    }
    if (body.registrationLink !== undefined) {
        competition.registrationLink = String(body.registrationLink || '').trim();
    }
    if (body.registrationType !== undefined) {
        competition.registrationType = String(body.registrationType || 'fest').trim() || 'fest';
    }
    if (body.dateTime !== undefined) competition.dateTime = String(body.dateTime || '').trim();
    if (body.venue !== undefined) competition.venue = String(body.venue || '').trim();
    if (body.coverImage !== undefined) competition.coverImage = String(body.coverImage || '').trim();
    if (body.gallery !== undefined) {
        competition.gallery = Array.isArray(body.gallery)
            ? body.gallery.map((u) => String(u || '').trim()).filter(Boolean)
            : [];
    }
    if (body.commonRules !== undefined) {
        competition.commonRules = sanitizeRulesList(body.commonRules);
        competition.markModified('commonRules');
    }
    if (body.commonRulesMessage !== undefined) {
        competition.commonRulesMessage = String(body.commonRulesMessage || '').trim();
    }
    if (body.rounds !== undefined) {
        competition.rounds = sanitizeRounds(body.rounds);
        competition.markModified('rounds');
    }
    if (body.contact !== undefined && body.contact && typeof body.contact === 'object') {
        competition.contact = {
            name: String(body.contact.name || '').trim(),
            phone: String(body.contact.phone || '').trim(),
            email: String(body.contact.email || '').trim(),
            instagram: String(body.contact.instagram || '').trim(),
        };
        competition.markModified('contact');
    }
    if (body.registration !== undefined && body.registration && typeof body.registration === 'object') {
        const existingRegistration = competition.registration && typeof competition.registration.toObject === 'function'
            ? competition.registration.toObject()
            : { ...(competition.registration || {}) };
        let registrationStatus = body.registration.status || existingRegistration.status;
        if (registrationStatus === 'STARTED') registrationStatus = 'internal_form';
        else if (registrationStatus === 'CLOSED') registrationStatus = 'registration_closed';
        else if (registrationStatus === 'NOT_STARTED') registrationStatus = 'not_started';

        // Drop undefined keys from JSON/React payloads — Mongoose rejects settings: undefined
        const incoming = {};
        for (const [key, value] of Object.entries(body.registration)) {
            if (value !== undefined) incoming[key] = value;
        }

        const existingSettings =
            existingRegistration.settings && typeof existingRegistration.settings === 'object'
                ? existingRegistration.settings
                : {};
        const incomingSettings =
            incoming.settings && typeof incoming.settings === 'object'
                ? incoming.settings
                : null;

        const merged = {
            ...existingRegistration,
            ...incoming,
            status: registrationStatus,
            settings: incomingSettings
                ? { ...existingSettings, ...incomingSettings }
                : { ...existingSettings },
        };
        if (!merged.settings || typeof merged.settings !== 'object') {
            merged.settings = {};
        }

        const { withNormalizedPersonFields } = require('../utils/personFields');
        competition.registration = withNormalizedPersonFields(merged, {
            festId: competition.fest,
        });
        competition.markModified('registration');
    }
    if (body.legacyRegistration !== undefined) {
        competition.legacyRegistration = body.legacyRegistration || { status: 'NOT_STARTED' };
        competition.markModified('legacyRegistration');
    }
    if (body.slotsAllotted !== undefined) {
        let slots = Number(body.slotsAllotted);
        if (!Number.isFinite(slots) || slots < 0) slots = 0;
        slots = Math.floor(slots);
        competition.slotsAllotted = slots;
        if (!competition.registration) competition.registration = {};
        competition.registration.maxRegistrations = slots > 0 ? slots : null;
        if (!competition.registration.settings || typeof competition.registration.settings !== 'object') {
            competition.registration.settings = {};
        }
        competition.registration.settings.maxRegistrations = slots > 0 ? slots : null;
        competition.markModified('registration');
    }
    if (
        body.teamSizeMin !== undefined
        || body.teamSizeMax !== undefined
        || body.teamSizeLabel !== undefined
    ) {
        const { normalizeTeamSizeFields } = require('../utils/teamSize');
        const next = normalizeTeamSizeFields({
            teamSizeMin: body.teamSizeMin !== undefined ? body.teamSizeMin : competition.teamSizeMin,
            teamSizeMax: body.teamSizeMax !== undefined ? body.teamSizeMax : competition.teamSizeMax,
            teamSizeLabel: body.teamSizeLabel !== undefined ? body.teamSizeLabel : competition.teamSizeLabel,
        });
        competition.teamSizeMin = next.teamSizeMin;
        competition.teamSizeMax = next.teamSizeMax;
        competition.teamSizeLabel = next.teamSizeLabel;
    }
}

function tryClearPublicCaches() {
    try {
        const { clearAllCaches } = require('./festOrganizerController');
        if (typeof clearAllCaches === 'function') clearAllCaches();
    } catch (_) { /* ignore */ }
}

/** List competitions for fest (full docs — same shape as admin modal) */
exports.listCompetitions = async (req, res) => {
    try {
        const Competition = mongoose.model('Competition');
        const competitions = await Competition.find({ fest: req.festId }).sort({ name: 1 }).lean();
        res.json({
            success: true,
            competitions: competitions.map(serializeCompetitionDetails),
        });
    } catch (error) {
        console.error('[festOrganizerPortal.listCompetitions]', error);
        res.status(500).json({ success: false, message: 'Failed to load competitions' });
    }
};

/** Full competition listing fields for organizer edit (admin-like) */
exports.getCompetitionDetails = async (req, res) => {
    try {
        const { competitionId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(competitionId)) {
            return res.status(400).json({ success: false, message: 'Invalid competition ID' });
        }
        const Competition = mongoose.model('Competition');
        const [fest, competition] = await Promise.all([
            FestOrganizer.findById(req.festId).select('festName slug').lean(),
            Competition.findOne({ _id: competitionId, fest: req.festId }).lean(),
        ]);
        if (!fest) return res.status(404).json({ success: false, message: 'Fest not found' });
        if (!competition) {
            return res.status(404).json({ success: false, message: 'Competition not found for this fest' });
        }
        res.json({
            success: true,
            fest: { id: fest._id, festName: fest.festName, slug: fest.slug || '' },
            competition: serializeCompetitionDetails(competition),
        });
    } catch (error) {
        console.error('[festOrganizerPortal.getCompetitionDetails]', error);
        res.status(500).json({ success: false, message: 'Failed to load competition details' });
    }
};

/** Create competition (same payload as admin Competition_Modal) */
exports.createCompetition = async (req, res) => {
    try {
        const body = req.body || {};
        if (!body.name || !body.description || !body.prizePool || !body.registrationFee) {
            return res.status(400).json({
                success: false,
                message: 'Please fill Competition Name, Description, Prize Pool and Registration Fee',
            });
        }
        if (!body.dateTime || String(body.dateTime).trim() === '') {
            return res.status(400).json({ success: false, message: 'Please fill the Date and Time field' });
        }
        if (!body.competitionType) {
            return res.status(400).json({ success: false, message: 'Please select a Competition Type' });
        }

        const Competition = mongoose.model('Competition');
        const fest = await FestOrganizer.findById(req.festId);
        if (!fest) return res.status(404).json({ success: false, message: 'Fest not found' });

        const { normalizeTeamSizeFields } = require('../utils/teamSize');
        const { withNormalizedPersonFields } = require('../utils/personFields');
        const teamSize = normalizeTeamSizeFields({
            teamSizeMin: body.teamSizeMin,
            teamSizeMax: body.teamSizeMax,
            teamSizeLabel: body.teamSizeLabel,
        });

        const competition = new Competition({
            fest: req.festId,
            name: String(body.name).trim(),
            subtitle: String(body.subtitle || '').trim(),
            competitionType: body.competitionType || 'other',
            category: body.category || 'OTHER',
            description: String(body.description || '').trim(),
            prizePool: String(body.prizePool || '').trim(),
            dateTime: String(body.dateTime || 'To Be Announced').trim(),
            venue: String(body.venue || '').trim(),
            coverImage: String(body.coverImage || '').trim(),
            gallery: Array.isArray(body.gallery) ? body.gallery : [],
            commonRules: sanitizeRulesList(body.commonRules),
            commonRulesMessage: String(body.commonRulesMessage || '').trim(),
            rounds: sanitizeRounds(body.rounds),
            registrationFee: String(body.registrationFee || 'Free').trim(),
            feeAmount: getCompetitionBaseFee(body.registrationFee, body.feeAmount),
            slotsAllotted: (() => {
                if (body.slotsAllotted === undefined || body.slotsAllotted === null || body.slotsAllotted === '') {
                    return 50;
                }
                const n = Number(body.slotsAllotted);
                return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 50;
            })(),
            teamSizeMin: teamSize.teamSizeMin,
            teamSizeMax: teamSize.teamSizeMax,
            teamSizeLabel: teamSize.teamSizeLabel,
            registrationLink: String(body.registrationLink || '').trim(),
            contact: body.contact || {},
            registrationType: body.registrationType || 'fest',
            registration: (() => {
                const slotsAllotted = (() => {
                    if (body.slotsAllotted === undefined || body.slotsAllotted === null || body.slotsAllotted === '') {
                        return 50;
                    }
                    const n = Number(body.slotsAllotted);
                    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 50;
                })();
                const base = body.registration || {
                    status: 'not_started',
                    externalUrl: '',
                    googleSheetsUrl: '',
                    formSchema: [],
                    settings: {
                        allowMultipleRegistrations: true,
                        requireEmailVerification: false,
                        autoConfirmation: true,
                        maxRegistrations: null,
                        registrationDeadline: null,
                    },
                };
                if (!base.settings) base.settings = {};
                if (base.settings.maxRegistrations == null && slotsAllotted > 0) {
                    base.settings.maxRegistrations = slotsAllotted;
                }
                return withNormalizedPersonFields(base, { festId: req.festId });
            })(),
            legacyRegistration: body.legacyRegistration || { status: 'NOT_STARTED' },
        });

        await competition.save();
        if (!Array.isArray(fest.competitions)) fest.competitions = [];
        fest.competitions.push(competition._id);
        await fest.save();
        tryClearPublicCaches();

        res.status(201).json({
            success: true,
            message: 'Competition created successfully',
            competition: serializeCompetitionDetails(competition.toObject()),
        });
    } catch (error) {
        console.error('[festOrganizerPortal.createCompetition]', error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                details: Object.keys(error.errors || {}).join(', '),
            });
        }
        res.status(500).json({ success: false, message: 'Failed to create competition' });
    }
};

/** Update public competition details (same fields as admin listing editor, scoped to fest) */
exports.updateCompetitionDetails = async (req, res) => {
    try {
        const { competitionId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(competitionId)) {
            return res.status(400).json({ success: false, message: 'Invalid competition ID' });
        }
        const Competition = mongoose.model('Competition');
        const competition = await Competition.findOne({ _id: competitionId, fest: req.festId });
        if (!competition) {
            return res.status(404).json({ success: false, message: 'Competition not found for this fest' });
        }

        applyCompetitionPayload(competition, req.body || {});
        await competition.save();
        tryClearPublicCaches();
        res.json({
            success: true,
            message: 'Competition details saved',
            competition: serializeCompetitionDetails(competition.toObject()),
        });
    } catch (error) {
        console.error('[festOrganizerPortal.updateCompetitionDetails]', error);
        if (error.status === 400) {
            return res.status(400).json({ success: false, message: error.message });
        }
        res.status(500).json({ success: false, message: 'Failed to save competition details' });
    }
};

exports.deleteCompetition = async (req, res) => {
    try {
        const { competitionId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(competitionId)) {
            return res.status(400).json({ success: false, message: 'Invalid competition ID' });
        }
        const Competition = mongoose.model('Competition');
        const competition = await Competition.findOneAndDelete({ _id: competitionId, fest: req.festId });
        if (!competition) {
            return res.status(404).json({ success: false, message: 'Competition not found for this fest' });
        }
        await FestOrganizer.updateOne(
            { _id: req.festId },
            { $pull: { competitions: competitionId } },
        );
        tryClearPublicCaches();
        res.json({ success: true, message: 'Competition deleted' });
    } catch (error) {
        console.error('[festOrganizerPortal.deleteCompetition]', error);
        res.status(500).json({ success: false, message: 'Failed to delete competition' });
    }
};

/** Full fest document for admin-style FestFormModal */
exports.getFestDetails = async (req, res) => {
    try {
        const fest = await FestOrganizer.findById(req.festId).lean();
        if (!fest) return res.status(404).json({ success: false, message: 'Fest not found' });
        res.json({
            success: true,
            fest: {
                ...fest,
                _id: fest._id,
                id: fest._id,
            },
        });
    } catch (error) {
        console.error('[festOrganizerPortal.getFestDetails]', error);
        res.status(500).json({ success: false, message: 'Failed to load fest details' });
    }
};

/** Update fest listing fields organizers may edit (admin FestFormModal payload) */
exports.updateFestDetails = async (req, res) => {
    try {
        const fest = await FestOrganizer.findById(req.festId);
        if (!fest) return res.status(404).json({ success: false, message: 'Fest not found' });

        const body = req.body || {};
        const stringFields = [
            'festName', 'subtitle', 'collegeName', 'city', 'venue', 'festDate',
            'festType', 'category', 'description', 'coverImage', 'ticketPrice',
            'registrationLink', 'artistsHeading', 'competitionsHeading',
        ];
        for (const key of stringFields) {
            if (body[key] !== undefined) {
                fest[key] = String(body[key] || '').trim();
            }
        }
        if (body.feeAmount !== undefined) {
            fest.feeAmount = Math.max(0, Number(body.feeAmount) || 0);
        }
        if (body.platformFeePercent !== undefined) {
            fest.platformFeePercent = Math.max(0, Number(body.platformFeePercent) || 0);
        }
        if (body.status !== undefined) {
            const allowed = ['ongoing', 'upcoming', 'completed', 'beyondcampus', 'lastyearhit'];
            const status = String(body.status || '').trim();
            if (allowed.includes(status)) fest.status = status;
        }
        if (body.galleryImages !== undefined) {
            fest.galleryImages = Array.isArray(body.galleryImages)
                ? body.galleryImages.map((u) => String(u || '').trim()).filter(Boolean)
                : [];
            fest.markModified('galleryImages');
        }
        if (body.artists !== undefined) {
            fest.artists = Array.isArray(body.artists) ? body.artists : [];
            fest.markModified('artists');
        }
        if (body.contacts !== undefined) {
            fest.contacts = Array.isArray(body.contacts) ? body.contacts : [];
            fest.markModified('contacts');
        }
        if (body.sponsors !== undefined) {
            fest.sponsors = Array.isArray(body.sponsors) ? body.sponsors : [];
            fest.markModified('sponsors');
        }
        if (body.registration !== undefined && body.registration && typeof body.registration === 'object') {
            const incoming = body.registration;
            const next = {
                ...(fest.registration || {}),
                ...incoming,
            };
            // Explicitly keep form builder arrays (organizer form setup)
            if (incoming.formSchema !== undefined) {
                next.formSchema = Array.isArray(incoming.formSchema) ? incoming.formSchema : [];
            }
            if (incoming.steps !== undefined) {
                next.steps = Array.isArray(incoming.steps) ? incoming.steps : [];
            }
            fest.registration = next;
            fest.markModified('registration');
        }

        await fest.save();
        tryClearPublicCaches();
        res.json({
            success: true,
            message: 'Fest details saved',
            fest: {
                ...fest.toObject(),
                _id: fest._id,
                id: fest._id,
            },
        });
    } catch (error) {
        console.error('[festOrganizerPortal.updateFestDetails]', error);
        res.status(500).json({ success: false, message: 'Failed to save fest details' });
    }
};

exports.bulkUpdateParticipantStatus = async (req, res) => {
    try {
        const status = String(req.body.status || '').trim().toLowerCase();
        const ids = Array.isArray(req.body.registrationIds) ? req.body.registrationIds : [];
        if (!['pending', 'approved', 'rejected'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Status must be pending, approved, or rejected' });
        }
        const validIds = ids
            .map((id) => String(id || '').trim())
            .filter((id) => mongoose.Types.ObjectId.isValid(id));
        if (!validIds.length) {
            return res.status(400).json({ success: false, message: 'No valid registration IDs' });
        }

        const result = await Registration.updateMany(
            { _id: { $in: validIds }, fest: req.festId },
            { $set: { status } },
        );

        res.json({
            success: true,
            message: `Updated ${result.modifiedCount || 0} registration(s) to ${status}`,
            modifiedCount: result.modifiedCount || 0,
        });
    } catch (error) {
        console.error('[festOrganizerPortal.bulkUpdateParticipantStatus]', error);
        res.status(500).json({ success: false, message: 'Failed to bulk update' });
    }
};

/**
 * Walk-in / VIP / desk entry for a competition (or general fest if no competitionId).
 */
exports.createManualParticipant = async (req, res) => {
    try {
        const crypto = require('crypto');
        const User = require('../model/usermodel');

        const competitionIdRaw = String(req.body.competitionId || '').trim();
        let competition = null;
        if (competitionIdRaw) {
            if (!mongoose.Types.ObjectId.isValid(competitionIdRaw)) {
                return res.status(400).json({ success: false, message: 'Invalid competition ID' });
            }
            const Competition = mongoose.model('Competition');
            competition = await Competition.findOne({ _id: competitionIdRaw, fest: req.festId })
                .select('name feeAmount registrationFee')
                .lean();
            if (!competition) {
                return res.status(404).json({ success: false, message: 'Competition not found for this fest' });
            }
        }

        let responses = req.body.responses;
        if (typeof responses === 'string') {
            try {
                responses = JSON.parse(responses);
            } catch {
                return res.status(400).json({ success: false, message: 'Invalid responses' });
            }
        }
        if (!responses || typeof responses !== 'object' || Array.isArray(responses)) {
            responses = {};
        }

        const cleanResponses = {};
        Object.entries(responses).forEach(([key, value]) => {
            const k = String(key || '').trim();
            if (!k || k.startsWith('_')) return;
            if (value == null) return;
            if (typeof value === 'string') {
                const trimmed = value.trim();
                if (trimmed) cleanResponses[k] = trimmed;
                return;
            }
            if (typeof value === 'number' || typeof value === 'boolean') {
                cleanResponses[k] = value;
                return;
            }
            if (Array.isArray(value)) cleanResponses[k] = value;
        });

        const name = String(
            req.body.name
            || cleanResponses.full_name
            || cleanResponses.name
            || cleanResponses.leader_name
            || '',
        ).trim();
        const email = String(req.body.email || cleanResponses.email || '').trim().toLowerCase();
        const phone = String(
            req.body.phone
            || cleanResponses.phone
            || cleanResponses.contact_no
            || cleanResponses.mobile
            || '',
        ).trim().replace(/\s+/g, '');
        const teamName = String(req.body.teamName || cleanResponses.team_name || cleanResponses.teamName || '').trim();
        const college = String(req.body.college || cleanResponses.college || cleanResponses.college_name || '').trim();
        const members = Array.isArray(req.body.members)
            ? req.body.members.map((m) => String(m || '').trim()).filter(Boolean)
            : String(req.body.membersText || '')
                .split(/[,;\n]+/)
                .map((s) => s.trim())
                .filter(Boolean);

        if (!name) {
            return res.status(400).json({ success: false, message: 'Name is required' });
        }
        if (!email && !phone) {
            return res.status(400).json({ success: false, message: 'Email or phone is required' });
        }

        if (teamName) cleanResponses.team_name = teamName;
        if (college) cleanResponses.college = college;
        if (members.length) cleanResponses.team_members = members.join(', ');
        if (!cleanResponses.full_name && !cleanResponses.name) cleanResponses.full_name = name;
        if (email && !cleanResponses.email) cleanResponses.email = email;
        if (phone && !cleanResponses.phone) cleanResponses.phone = phone;
        cleanResponses.manual_entry = 'yes';
        cleanResponses.added_by_organizer = 'yes';
        if (req.body.note) cleanResponses.organizer_note = String(req.body.note).trim().slice(0, 500);

        let user = null;
        if (email) {
            user = await User.findOne({ email });
        }
        if (!user && phone) {
            user = await User.findOne({
                $or: [{ phone }, { phoneNumber: phone }],
            });
        }
        if (!user) {
            const placeholderEmail = email
                || `fest-manual+${crypto.randomBytes(6).toString('hex')}@crwdctrl.local`;
            user = new User({
                name,
                ...(email ? { email } : { email: placeholderEmail }),
                ...(phone ? { phoneNumber: phone } : {}),
                password: crypto.randomBytes(24).toString('hex'),
                isVerified: true,
                signupMethod: 'password',
            });
            await user.save();
        } else if (name && (!user.name || user.name === 'User')) {
            user.name = name;
            if (phone && !user.phoneNumber) user.phoneNumber = phone;
            await user.save();
        }

        const paymentStatusRaw = String(req.body.paymentStatus || 'paid').trim().toLowerCase();
        const paymentStatus = ['free', 'pending', 'paid', 'failed'].includes(paymentStatusRaw)
            ? paymentStatusRaw
            : 'paid';
        const feeDefault = Number(competition?.feeAmount ?? competition?.registrationFee) || 0;
        let amountPaid = Number(req.body.amountPaid);
        if (!Number.isFinite(amountPaid)) {
            amountPaid = paymentStatus === 'paid' ? feeDefault : 0;
        }
        amountPaid = Math.max(0, amountPaid);

        const statusRaw = String(req.body.status || 'approved').trim().toLowerCase();
        const status = ['pending', 'approved', 'rejected'].includes(statusRaw) ? statusRaw : 'approved';

        const reg = await Registration.create({
            fest: req.festId,
            user: user._id,
            competitionId: competition?._id || undefined,
            responses: cleanResponses,
            status,
            paymentStatus,
            amountPaid,
            payment_gateway: 'manual_organizer',
            submittedAt: new Date(),
        });

        const populated = await Registration.findById(reg._id)
            .populate('user', 'name email phone phoneNumber')
            .populate('competitionId', 'competitionName name')
            .lean();

        res.status(201).json({
            success: true,
            message: 'Participant added',
            participant: formatParticipant(populated),
        });
    } catch (error) {
        console.error('[festOrganizerPortal.createManualParticipant]', error);
        if (error?.code === 11000) {
            return res.status(409).json({ success: false, message: 'Duplicate registration conflict' });
        }
        res.status(500).json({ success: false, message: 'Failed to add participant' });
    }
};
