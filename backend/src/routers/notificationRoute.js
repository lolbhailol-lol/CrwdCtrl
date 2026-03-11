const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authmiddleware');
const {
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  registerPushToken,
} = require('../controllers/notificationController');

// All routes require authentication
router.use(authenticateToken);

// GET /api/notifications — paginated list
router.get('/', getUserNotifications);

// GET /api/notifications/unread-count — badge count
router.get('/unread-count', getUnreadCount);

// PUT /api/notifications/read-all — mark all as read
router.put('/read-all', markAllAsRead);

// PUT /api/notifications/:id/read — mark single as read
router.put('/:id/read', markAsRead);

// DELETE /api/notifications/:id — delete single
router.delete('/:id', deleteNotification);

// POST /api/notifications/register-push — save FCM token
router.post('/register-push', registerPushToken);

module.exports = router;
