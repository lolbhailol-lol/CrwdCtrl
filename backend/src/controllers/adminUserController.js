const User = require('../model/usermodel');

// GET /admin/users
// Lists user accounts with their login details for the admin panel.
// Supports search (name / email / phone), role filter, pagination and sorting.
const listUsers = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const skip = (page - 1) * limit;

    const search = (req.query.search || '').trim();
    const role = (req.query.role || '').trim();
    const signup = (req.query.signup || '').trim(); // 'password' | 'google' | 'facebook' | 'twitter' | 'social'
    const includeDeleted = req.query.includeDeleted === 'true';

    // Sort by most recent login by default, falling back to creation date
    const sortKey = req.query.sort === 'createdAt' ? 'createdAt' : 'lastLoginAt';

    const query = {};
    if (!includeDeleted) {
      query.isDeleted = { $ne: true };
    }
    if (role) {
      query.role = role;
    }
    if (signup === 'password') {
      // Email/password sign-ups: no linked social provider
      query['socialAuth.provider'] = { $in: [null] };
      query.signupMethod = { $ne: 'firebase' };
    } else if (signup === 'social') {
      query['socialAuth.provider'] = { $nin: [null] };
    } else if (['google', 'facebook', 'twitter'].includes(signup)) {
      query['socialAuth.provider'] = signup;
    }
    if (search) {
      const safe = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(safe, 'i');
      query.$or = [
        { name: regex },
        { email: regex },
        { phoneNumber: regex },
      ];
    }

    const [users, total] = await Promise.all([
      User.find(query)
        .select(
          'name email phoneNumber role college profilePic gender dateOfBirth ' +
          'isVerified isDeleted deletedAt firebaseUid signupMethod ' +
          'socialAuth.provider socialAuth.providerId socialAuth.photoURL ' +
          'notificationPreferences ' +
          'lastLoginAt lastLoginIp lastLoginUserAgent ' +
          'lastLoginMethod loginCount createdAt updatedAt'
        )
        .sort({ [sortKey]: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(query),
    ]);

    // Backfill signupMethod for accounts created before the field existed:
    // a linked social provider implies a social sign-up, otherwise email/password.
    const enrichedUsers = users.map((u) => ({
      ...u,
      signupMethod: u.signupMethod || u.socialAuth?.provider || 'password',
    }));

    res.json({
      users: enrichedUsers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    console.error('Admin - list users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

module.exports = { listUsers };
