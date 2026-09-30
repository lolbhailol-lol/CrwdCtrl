const crypto = require('crypto');
const { Resend } = require('resend');
const FestOrganizerAccount = require('../model/fest_organizer_account_model');
const FestOrganizer = require('../model/fest_organizer_model');
const {
    normalizeUsername,
    PAGE_CATALOG,
    PAGE_KEYS,
    sanitizeAllowedPages,
    normalizePortalRole,
} = require('../utils/festOrganizerAccess');
const {
    COMPETITION_SECTIONS,
    sanitizeCompetitionAccess,
    pagesForCompetitionAccess,
} = require('../utils/festOrganizerPages');
const Competition = require('../model/competition_model');

const SECTION_LIST = COMPETITION_SECTIONS.map(({ key, label }) => ({ key, label }));

function tempPassword() {
    return `Cc${crypto.randomBytes(4).toString('hex')}!${crypto.randomInt(10, 99)}`;
}

async function festCompetitions(festId) {
    return Competition.find({ fest: festId, 'auditorium.enabled': { $ne: true } })
        .select('name')
        .sort({ name: 1 })
        .lean();
}

/** Validate [{competitionId, sections}] against this fest; returns stored entries or throws. */
async function resolveCompetitionAccess(festId, raw) {
    const entries = sanitizeCompetitionAccess(
        (Array.isArray(raw) ? raw : []).map((item) => ({ ...item, festId })),
    );
    if (!entries.length) return [];
    const valid = new Set((await festCompetitions(festId)).map((c) => String(c._id)));
    const bad = entries.find((entry) => !valid.has(entry.competitionId));
    if (bad) {
        const error = new Error('One of the selected competitions is not part of this fest');
        error.status = 400;
        throw error;
    }
    return entries;
}

async function describeCompetitionAccess(festId, entries) {
    if (!entries.length) return [];
    const names = new Map((await festCompetitions(festId)).map((c) => [String(c._id), c.name || 'Competition']));
    const labelOf = (key) => SECTION_LIST.find((s) => s.key === key)?.label || key;
    return entries.map((entry) => `${names.get(entry.competitionId) || 'Competition'} (${entry.sections.map(labelOf).join(', ')})`);
}

function serializeMember(row, festId) {
    const portalRole = normalizePortalRole(row.portalRole);
    const allAccess = portalRole === 'cohead' ? sanitizeCompetitionAccess(row.competitionAccess) : [];
    const competitionAccess = allAccess
        .filter((entry) => !festId || entry.festId === String(festId))
        .map(({ competitionId, sections }) => ({ competitionId, sections }));
    return {
        id: String(row._id),
        name: row.name || '',
        username: row.username || '',
        email: row.email || '',
        phone: row.phone || '',
        portalRole,
        accessMode: allAccess.length ? 'competitions' : 'pages',
        competitionAccess,
        allowedPages: portalRole === 'cohead'
            ? (allAccess.length ? pagesForCompetitionAccess(allAccess) : sanitizeAllowedPages(row.allowedPages))
            : portalRole === 'desk'
                ? ['fest-day-desk']
                : [...PAGE_KEYS],
        isActive: row.isActive !== false,
        status: FestOrganizerAccount.effectiveStatus(row),
        lastLoginAt: row.lastLoginAt || null,
        createdAt: row.createdAt || null,
    };
}

function frontendLoginUrl() {
    const base = String(
        process.env.PRODUCTION_FRONTEND_URL
        || process.env.PUBLIC_FRONTEND_URL
        || process.env.FRONTEND_URL
        || 'https://www.crwdctrl.in',
    ).replace(/\/$/, '');
    return `${base}/fest-organizer/login`;
}

async function trySendInviteEmail({
    to,
    name,
    username,
    password,
    festName,
    pages,
    competitionLines = [],
    invitedBy,
}) {
    if (!to) return { sent: false, reason: 'no_email' };
    if (!process.env.RESEND_API_KEY) return { sent: false, reason: 'email_not_configured' };

    const pageLabels = competitionLines.length
        ? competitionLines
        : PAGE_CATALOG
            .filter((p) => pages.includes(p.key))
            .map((p) => p.label);
    const loginUrl = frontendLoginUrl();
    const safe = (v) => String(v || '').replace(/</g, '');
    try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
            from: process.env.RESEND_FROM || 'CrwdCtrl <onboarding@crwdctrl.in>',
            to: [to],
            subject: `CrwdCtrl fest access — ${festName || 'your fest'}`,
            html: `
              <p>Hi ${safe(name) || 'there'},</p>
              <p><strong>${safe(invitedBy) || 'A fest organizer'}</strong> invited you as a co-head on <strong>${safe(festName) || 'the fest'}</strong>.</p>
              <p>${competitionLines.length ? 'Access granted' : 'Pages granted'}: ${pageLabels.length ? pageLabels.map(safe).join('; ') : 'none yet'}.</p>
              <p>Login: <a href="${loginUrl}">${loginUrl}</a></p>
              <p>Username: <code>${safe(username)}</code><br/>
              Temporary password: <code>${safe(password)}</code></p>
            `,
            text: [
                `Hi ${name || 'there'},`,
                `${invitedBy || 'A fest organizer'} invited you as a co-head on ${festName || 'the fest'}.`,
                `${competitionLines.length ? 'Access' : 'Pages'}: ${pageLabels.join('; ') || 'none'}`,
                `Login: ${loginUrl}`,
                `Username: ${username}`,
                `Temporary password: ${password}`,
            ].join('\n'),
        });
        return { sent: true };
    } catch (err) {
        console.warn('[festOrganizerAccess.invite] email failed', err.message);
        return { sent: false, reason: err.message || 'email_failed' };
    }
}

exports.getAccessCatalog = async (_req, res) => {
    res.json({
        success: true,
        pages: PAGE_CATALOG.filter((p) => p.key !== 'access'),
    });
};

exports.listAccessMembers = async (req, res) => {
    try {
        const festId = req.festId;
        const [members, competitions] = await Promise.all([
            FestOrganizerAccount.find({
                assignedFestIds: festId,
                portalRole: { $in: ['cohead', 'desk'] },
            })
                .select('name username email phone portalRole allowedPages competitionAccess isActive status lastLoginAt createdAt')
                .sort({ createdAt: -1 })
                .lean(),
            festCompetitions(festId),
        ]);

        res.json({
            success: true,
            pages: PAGE_CATALOG.filter((p) => p.key !== 'access'),
            sections: SECTION_LIST,
            competitions: competitions.map((c) => ({ id: String(c._id), name: c.name || 'Competition' })),
            members: members.map((row) => serializeMember(row, festId)),
        });
    } catch (error) {
        console.error('[festOrganizerAccess.list]', error);
        res.status(500).json({ success: false, message: 'Failed to load access list' });
    }
};

exports.inviteAccessMember = async (req, res) => {
    try {
        await FestOrganizerAccount.ensureSparseEmailIndex();
        const festId = req.festId;
        const fest = await FestOrganizer.findById(festId).select('festName').lean();

        const name = String(req.body.name || '').trim();
        const username = normalizeUsername(req.body.username || req.body.email);
        const emailRaw = String(req.body.email || '').trim().toLowerCase();
        const email = FestOrganizerAccount.normalizeOptionalEmail(emailRaw);
        const phone = String(req.body.phone || '').trim();
        const competitionAccess = await resolveCompetitionAccess(festId, req.body.competitionAccess);
        const allowedPages = competitionAccess.length
            ? pagesForCompetitionAccess(competitionAccess)
            : sanitizeAllowedPages(req.body.allowedPages || req.body.pages || []);
        const passwordPlain = String(req.body.password || '').trim() || tempPassword();

        if (!name || !username) {
            return res.status(400).json({ success: false, message: 'Name and username are required' });
        }
        if (!allowedPages.length) {
            return res.status(400).json({ success: false, message: 'Select at least one page or competition section for the co-head' });
        }
        if (passwordPlain.length < 6) {
            return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
        }

        const existingUser = await FestOrganizerAccount.findOne({ username }).lean();
        if (existingUser) {
            return res.status(409).json({ success: false, message: 'Username already taken' });
        }
        if (email) {
            const existingEmail = await FestOrganizerAccount.findOne({ email }).lean();
            if (existingEmail) {
                return res.status(409).json({ success: false, message: 'Email already used by another account' });
            }
        }

        const passwordHash = await FestOrganizerAccount.hashPassword(passwordPlain);
        const created = await FestOrganizerAccount.create({
            name,
            username,
            email,
            phone,
            passwordHash,
            portalRole: 'cohead',
            allowedPages,
            competitionAccess,
            assignedFestIds: [festId],
            status: 'approved',
            isActive: true,
            approvedAt: new Date(),
            createdBy: null,
        });

        const emailResult = await trySendInviteEmail({
            to: email,
            name,
            username,
            password: passwordPlain,
            festName: fest?.festName,
            pages: allowedPages,
            competitionLines: await describeCompetitionAccess(festId, competitionAccess),
            invitedBy: req.organizer?.name || req.displayName,
        });

        res.status(201).json({
            success: true,
            member: serializeMember(created.toObject ? created.toObject() : created, festId),
            credentials: {
                username,
                password: passwordPlain,
                loginUrl: frontendLoginUrl(),
            },
            email: emailResult,
        });
    } catch (error) {
        if (error?.status === 400) return res.status(400).json({ success: false, message: error.message });
        console.error('[festOrganizerAccess.invite]', error);
        if (error?.code === 11000) {
            return res.status(409).json({ success: false, message: 'Username or email already exists' });
        }
        res.status(500).json({ success: false, message: 'Failed to invite co-head' });
    }
};

exports.updateAccessMember = async (req, res) => {
    try {
        const festId = String(req.festId);
        const accountId = String(req.params.accountId || '');
        const member = await FestOrganizerAccount.findById(accountId);
        if (!member) {
            return res.status(404).json({ success: false, message: 'Account not found' });
        }
        if (!(member.assignedFestIds || []).some((id) => String(id) === festId)) {
            return res.status(403).json({ success: false, message: 'Account is not assigned to this fest' });
        }
        if (normalizePortalRole(member.portalRole) === 'organizer') {
            return res.status(403).json({ success: false, message: 'Cannot edit main organizer accounts here' });
        }

        const touchesGrants = req.body.competitionAccess !== undefined
            || req.body.allowedPages !== undefined
            || req.body.pages !== undefined;
        if (touchesGrants && normalizePortalRole(member.portalRole) !== 'cohead') {
            return res.status(400).json({ success: false, message: 'Page grants only apply to co-heads' });
        }
        if (req.body.competitionAccess !== undefined) {
            const mine = await resolveCompetitionAccess(festId, req.body.competitionAccess);
            const others = sanitizeCompetitionAccess(member.competitionAccess)
                .filter((entry) => entry.festId !== festId);
            member.competitionAccess = [...others, ...mine];
        }
        const storedAccess = sanitizeCompetitionAccess(member.competitionAccess);
        if (storedAccess.length) {
            member.allowedPages = pagesForCompetitionAccess(storedAccess);
        } else if (req.body.allowedPages !== undefined || req.body.pages !== undefined) {
            const pages = sanitizeAllowedPages(req.body.allowedPages || req.body.pages || []);
            if (!pages.length) {
                return res.status(400).json({ success: false, message: 'Select at least one page' });
            }
            member.allowedPages = pages;
        } else if (req.body.competitionAccess !== undefined && !sanitizeAllowedPages(member.allowedPages).length) {
            return res.status(400).json({ success: false, message: 'Select at least one competition section or page' });
        }

        if (req.body.isActive !== undefined) {
            member.isActive = Boolean(req.body.isActive);
        }
        if (req.body.name !== undefined) {
            const name = String(req.body.name || '').trim();
            if (name) member.name = name;
        }
        if (req.body.phone !== undefined) {
            member.phone = String(req.body.phone || '').trim();
        }

        await member.save();
        res.json({ success: true, member: serializeMember(member.toObject(), festId) });
    } catch (error) {
        if (error?.status === 400) return res.status(400).json({ success: false, message: error.message });
        console.error('[festOrganizerAccess.update]', error);
        res.status(500).json({ success: false, message: 'Failed to update access' });
    }
};

exports.revokeAccessMember = async (req, res) => {
    try {
        const festId = String(req.festId);
        const accountId = String(req.params.accountId || '');
        const member = await FestOrganizerAccount.findById(accountId);
        if (!member) {
            return res.status(404).json({ success: false, message: 'Account not found' });
        }
        if (normalizePortalRole(member.portalRole) === 'organizer') {
            return res.status(403).json({ success: false, message: 'Cannot revoke main organizer accounts here' });
        }
        if (!(member.assignedFestIds || []).some((id) => String(id) === festId)) {
            return res.status(403).json({ success: false, message: 'Account is not assigned to this fest' });
        }

        member.assignedFestIds = (member.assignedFestIds || []).filter((id) => String(id) !== festId);
        if (!member.assignedFestIds.length) {
            member.isActive = false;
        }
        await member.save();

        res.json({
            success: true,
            message: member.isActive
                ? 'Removed from this fest'
                : 'Access revoked and account deactivated',
            member: serializeMember(member.toObject(), festId),
        });
    } catch (error) {
        console.error('[festOrganizerAccess.revoke]', error);
        res.status(500).json({ success: false, message: 'Failed to revoke access' });
    }
};
