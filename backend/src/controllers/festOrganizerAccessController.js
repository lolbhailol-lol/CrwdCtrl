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

function tempPassword() {
    return `Cc${crypto.randomBytes(4).toString('hex')}!${crypto.randomInt(10, 99)}`;
}

function serializeMember(row) {
    const portalRole = normalizePortalRole(row.portalRole);
    return {
        id: String(row._id),
        name: row.name || '',
        username: row.username || '',
        email: row.email || '',
        phone: row.phone || '',
        portalRole,
        allowedPages: portalRole === 'cohead'
            ? sanitizeAllowedPages(row.allowedPages)
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
    invitedBy,
}) {
    if (!to) return { sent: false, reason: 'no_email' };
    if (!process.env.RESEND_API_KEY) return { sent: false, reason: 'email_not_configured' };

    const pageLabels = PAGE_CATALOG
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
              <p>Pages granted: ${pageLabels.length ? pageLabels.join(', ') : 'none yet'}.</p>
              <p>Login: <a href="${loginUrl}">${loginUrl}</a></p>
              <p>Username: <code>${safe(username)}</code><br/>
              Temporary password: <code>${safe(password)}</code></p>
            `,
            text: [
                `Hi ${name || 'there'},`,
                `${invitedBy || 'A fest organizer'} invited you as a co-head on ${festName || 'the fest'}.`,
                `Pages: ${pageLabels.join(', ') || 'none'}`,
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
        const members = await FestOrganizerAccount.find({
            assignedFestIds: festId,
            portalRole: { $in: ['cohead', 'desk'] },
        })
            .select('name username email phone portalRole allowedPages isActive status lastLoginAt createdAt')
            .sort({ createdAt: -1 })
            .lean();

        res.json({
            success: true,
            pages: PAGE_CATALOG.filter((p) => p.key !== 'access'),
            members: members.map(serializeMember),
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
        const allowedPages = sanitizeAllowedPages(req.body.allowedPages || req.body.pages || []);
        const passwordPlain = String(req.body.password || '').trim() || tempPassword();

        if (!name || !username) {
            return res.status(400).json({ success: false, message: 'Name and username are required' });
        }
        if (!allowedPages.length) {
            return res.status(400).json({ success: false, message: 'Select at least one page for the co-head' });
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
            invitedBy: req.organizer?.name || req.displayName,
        });

        res.status(201).json({
            success: true,
            member: serializeMember(created.toObject ? created.toObject() : created),
            credentials: {
                username,
                password: passwordPlain,
                loginUrl: frontendLoginUrl(),
            },
            email: emailResult,
        });
    } catch (error) {
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

        if (req.body.allowedPages !== undefined || req.body.pages !== undefined) {
            if (normalizePortalRole(member.portalRole) !== 'cohead') {
                return res.status(400).json({ success: false, message: 'Page grants only apply to co-heads' });
            }
            const pages = sanitizeAllowedPages(req.body.allowedPages || req.body.pages || []);
            if (!pages.length) {
                return res.status(400).json({ success: false, message: 'Select at least one page' });
            }
            member.allowedPages = pages;
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
        res.json({ success: true, member: serializeMember(member.toObject()) });
    } catch (error) {
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
            member: serializeMember(member.toObject()),
        });
    } catch (error) {
        console.error('[festOrganizerAccess.revoke]', error);
        res.status(500).json({ success: false, message: 'Failed to revoke access' });
    }
};
