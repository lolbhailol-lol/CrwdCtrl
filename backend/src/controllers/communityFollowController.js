const CommunityFollow = require('../model/community_follow_model');
const TrekCommunity = require('../model/trek_community_model');
const RunClub = require('../model/run_club_model');
const { findByIdOrSlug } = require('../utils/slug');

const { ENTITY_TYPES } = CommunityFollow;

function normalizeEntityType(raw) {
    const t = String(raw || '').trim().toLowerCase().replace(/-/g, '_');
    if (t === 'community' || t === 'trekcommunity') return 'trek_community';
    if (t === 'runclub' || t === 'club') return 'run_club';
    return t;
}

async function resolveEntity(entityType, idOrSlug) {
    const type = normalizeEntityType(entityType);
    if (!ENTITY_TYPES.includes(type)) {
        return { error: 'Invalid entity type', status: 400 };
    }

    const Model = type === 'trek_community' ? TrekCommunity : RunClub;
    const entity = await findByIdOrSlug(Model, idOrSlug, {
        baseFilter: { status: 'published' },
        pickName: (row) => row.name,
        lean: true,
    });
    if (!entity) {
        return { error: type === 'trek_community' ? 'Community not found' : 'Run club not found', status: 404 };
    }
    return { type, entity, entityId: entity._id };
}

exports.follow = async (req, res) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Authentication required' });
        }

        const resolved = await resolveEntity(req.params.entityType, req.params.entityId);
        if (resolved.error) {
            return res.status(resolved.status).json({ success: false, message: resolved.error });
        }

        await CommunityFollow.updateOne(
            { userId, entityType: resolved.type, entityId: resolved.entityId },
            { $setOnInsert: { userId, entityType: resolved.type, entityId: resolved.entityId } },
            { upsert: true },
        );

        const followerCount = await CommunityFollow.countDocuments({
            entityType: resolved.type,
            entityId: resolved.entityId,
        });

        return res.json({
            success: true,
            following: true,
            followerCount,
        });
    } catch (error) {
        console.error('[communityFollow.follow]', error);
        return res.status(500).json({ success: false, message: 'Failed to follow' });
    }
};

exports.unfollow = async (req, res) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Authentication required' });
        }

        const resolved = await resolveEntity(req.params.entityType, req.params.entityId);
        if (resolved.error) {
            return res.status(resolved.status).json({ success: false, message: resolved.error });
        }

        await CommunityFollow.deleteOne({
            userId,
            entityType: resolved.type,
            entityId: resolved.entityId,
        });

        const followerCount = await CommunityFollow.countDocuments({
            entityType: resolved.type,
            entityId: resolved.entityId,
        });

        return res.json({
            success: true,
            following: false,
            followerCount,
        });
    } catch (error) {
        console.error('[communityFollow.unfollow]', error);
        return res.status(500).json({ success: false, message: 'Failed to unfollow' });
    }
};

exports.getStatus = async (req, res) => {
    try {
        const resolved = await resolveEntity(req.params.entityType, req.params.entityId);
        if (resolved.error) {
            return res.status(resolved.status).json({ success: false, message: resolved.error });
        }

        const followerCount = await CommunityFollow.countDocuments({
            entityType: resolved.type,
            entityId: resolved.entityId,
        });

        let following = false;
        if (req.user?.userId) {
            const existing = await CommunityFollow.exists({
                userId: req.user.userId,
                entityType: resolved.type,
                entityId: resolved.entityId,
            });
            following = Boolean(existing);
        }

        return res.json({
            success: true,
            following,
            followerCount,
        });
    } catch (error) {
        console.error('[communityFollow.getStatus]', error);
        return res.status(500).json({ success: false, message: 'Failed to load follow status' });
    }
};

exports.listMembers = async (req, res) => {
    try {
        const resolved = await resolveEntity(req.params.entityType, req.params.entityId);
        if (resolved.error) {
            return res.status(resolved.status).json({ success: false, message: resolved.error });
        }

        const page = Math.max(1, Number.parseInt(String(req.query.page || '1'), 10) || 1);
        const limit = Math.min(50, Math.max(1, Number.parseInt(String(req.query.limit || '30'), 10) || 30));
        const skip = (page - 1) * limit;

        const [total, rows] = await Promise.all([
            CommunityFollow.countDocuments({
                entityType: resolved.type,
                entityId: resolved.entityId,
            }),
            CommunityFollow.find({
                entityType: resolved.type,
                entityId: resolved.entityId,
            })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate({ path: 'userId', select: 'name profilePic' })
                .lean(),
        ]);

        const members = rows
            .map((row) => {
                const user = row.userId;
                if (!user || !user._id) return null;
                return {
                    id: String(user._id),
                    name: String(user.name || 'Member').trim() || 'Member',
                    profilePic: user.profilePic || '',
                };
            })
            .filter(Boolean);

        return res.json({
            success: true,
            members,
            followerCount: total,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.max(1, Math.ceil(total / limit)),
            },
        });
    } catch (error) {
        console.error('[communityFollow.listMembers]', error);
        return res.status(500).json({ success: false, message: 'Failed to load members' });
    }
};
