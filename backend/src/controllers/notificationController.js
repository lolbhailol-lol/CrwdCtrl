const Notification = require('../model/notification_model');

// ===== UTILITY: Create a notification (used by other controllers) =====
const createNotification = async ({ userId, title, message, type = 'system', link = null, metadata = {} }) => {
  try {
    const notification = new Notification({
      user: userId,
      title,
      message,
      type,
      link,
      metadata,
    });
    await notification.save();
    console.log(`🔔 Notification created for user ${userId}: ${title}`);
    return notification;
  } catch (error) {
    console.error('❌ Failed to create notification:', error.message);
    return null;
  }
};

// ===== GET: User's notifications (paginated) =====
const getUserNotifications = async (req, res) => {
  try {
    const userId = req.user.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const skip = (page - 1) * limit;

    const [notifications, total] = await Promise.all([
      Notification.find({ user: userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Notification.countDocuments({ user: userId }),
    ]);

    // Format timestamps for frontend
    const formatted = notifications.map(n => ({
      id: n._id,
      title: n.title,
      message: n.message,
      type: n.type,
      link: n.link,
      isRead: n.isRead,
      unread: !n.isRead,
      time: formatTimeAgo(n.createdAt),
      timestamp: n.createdAt,
      metadata: n.metadata,
    }));

    res.json({
      success: true,
      notifications: formatted,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + limit < total,
      },
    });
  } catch (error) {
    console.error('❌ Error fetching notifications:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch notifications' });
  }
};

// ===== GET: Unread count (lightweight for badge) =====
const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.userId;
    const count = await Notification.countDocuments({ user: userId, isRead: false });
    res.json({ success: true, unreadCount: count });
  } catch (error) {
    console.error('❌ Error fetching unread count:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch unread count' });
  }
};

// ===== PUT: Mark single notification as read =====
const markAsRead = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    const notification = await Notification.findOneAndUpdate(
      { _id: id, user: userId },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    res.json({ success: true, message: 'Notification marked as read' });
  } catch (error) {
    console.error('❌ Error marking notification as read:', error);
    res.status(500).json({ success: false, message: 'Failed to mark as read' });
  }
};

// ===== PUT: Mark all notifications as read =====
const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.userId;
    const result = await Notification.updateMany(
      { user: userId, isRead: false },
      { isRead: true }
    );

    res.json({
      success: true,
      message: `${result.modifiedCount} notifications marked as read`,
    });
  } catch (error) {
    console.error('❌ Error marking all as read:', error);
    res.status(500).json({ success: false, message: 'Failed to mark all as read' });
  }
};

// ===== DELETE: Remove a notification =====
const deleteNotification = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    const notification = await Notification.findOneAndDelete({ _id: id, user: userId });
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    res.json({ success: true, message: 'Notification deleted' });
  } catch (error) {
    console.error('❌ Error deleting notification:', error);
    res.status(500).json({ success: false, message: 'Failed to delete notification' });
  }
};

// ===== POST: Register FCM push token =====
const registerPushToken = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { token, device } = req.body;

    if (!token) {
      return res.status(400).json({ success: false, message: 'FCM token is required' });
    }

    const User = require('../model/usermodel');
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Check if token already exists
    if (!user.fcmTokens) user.fcmTokens = [];
    const existingIndex = user.fcmTokens.findIndex(t => t.token === token);
    
    if (existingIndex >= 0) {
      // Update existing token
      user.fcmTokens[existingIndex].updatedAt = new Date();
    } else {
      // Add new token (max 5 devices)
      if (user.fcmTokens.length >= 5) {
        user.fcmTokens.shift(); // Remove oldest
      }
      user.fcmTokens.push({ token, device: device || 'web', createdAt: new Date() });
    }

    await user.save();
    console.log(`📱 FCM token registered for user ${userId}`);
    res.json({ success: true, message: 'Push token registered' });
  } catch (error) {
    console.error('❌ Error registering push token:', error);
    res.status(500).json({ success: false, message: 'Failed to register push token' });
  }
};

// ===== UTILITY: Format time ago =====
function formatTimeAgo(date) {
  const now = new Date();
  const diff = now - new Date(date);
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  });
}

module.exports = {
  createNotification,
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  registerPushToken,
};
