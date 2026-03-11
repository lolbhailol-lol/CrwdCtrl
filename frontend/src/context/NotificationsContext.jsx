import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { requestNotificationPermission, onForegroundMessage } from '../firebase';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

const NotificationsContext = createContext();

// eslint-disable-next-line react-refresh/only-export-components
export const useNotifications = () => {
    const context = useContext(NotificationsContext);
    if (!context) {
        throw new Error('useNotifications must be used within a NotificationsProvider');
    }
    return context;
};

export const NotificationsProvider = ({ children }) => {
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const pollIntervalRef = useRef(null);

    // Helper: get auth token
    const getToken = () => {
        return localStorage.getItem('crwdctrl_token');
    };

    // Helper: authenticated fetch
    const authFetchJSON = async (url, options = {}) => {
        const token = getToken();
        if (!token) return null;

        const res = await fetch(`${API_BASE_URL}${url}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                ...(options.headers || {}),
            },
            credentials: 'include',
        });

        if (!res.ok) return null;
        return res.json();
    };

    // Fetch notifications from backend
    const fetchNotifications = useCallback(async () => {
        try {
            const data = await authFetchJSON('/notifications?limit=20');
            if (data && data.success) {
                setNotifications(data.notifications || []);
            }
        } catch (error) {
            console.error('Failed to fetch notifications:', error);
        }
    }, []);

    // Fetch unread count (lightweight)
    const fetchUnreadCount = useCallback(async () => {
        try {
            const data = await authFetchJSON('/notifications/unread-count');
            if (data && data.success) {
                setUnreadCount(data.unreadCount || 0);
            }
        } catch (error) {
            // Silent fail for background polling
        }
    }, []);

    // Initialize: fetch notifications when user is authenticated
    useEffect(() => {
        const token = getToken();
        if (!token) {
            setNotifications([]);
            setUnreadCount(0);
            return;
        }

        // Initial fetch
        setIsLoading(true);
        fetchNotifications().finally(() => setIsLoading(false));
        fetchUnreadCount();

        // Poll unread count every 60s
        pollIntervalRef.current = setInterval(() => {
            fetchUnreadCount();
        }, 60000);

        // Register FCM push token
        const registerPush = async () => {
            try {
                const fcmToken = await requestNotificationPermission();
                if (fcmToken) {
                    await authFetchJSON('/notifications/register-push', {
                        method: 'POST',
                        body: JSON.stringify({ token: fcmToken, device: 'web' }),
                    });
                }
            } catch (err) {
                console.warn('Push registration skipped:', err.message);
            }
        };
        // Delay push registration to avoid blocking initial load
        const pushTimer = setTimeout(registerPush, 5000);

        // Listen for foreground FCM messages
        const unsubFCM = onForegroundMessage((payload) => {
            console.log('🔔 Foreground FCM message:', payload);
            const { title, body } = payload.notification || {};
            if (title) {
                addNotificationLocal({
                    title,
                    message: body || '',
                    type: payload.data?.type || 'system',
                    link: payload.data?.link || null,
                    time: 'Just now',
                });
                // Also show a browser notification toast
                if (Notification.permission === 'granted') {
                    new Notification(title, { body, icon: '/icon-192x192.png' });
                }
            }
        });

        return () => {
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
            }
            clearTimeout(pushTimer);
            if (typeof unsubFCM === 'function') unsubFCM();
        };
    }, [fetchNotifications, fetchUnreadCount]);

    // Listen for auth changes (login/logout)
    useEffect(() => {
        const handleStorageChange = (e) => {
            if (e.key === 'crwdctrl_token') {
                if (e.newValue) {
                    fetchNotifications();
                    fetchUnreadCount();
                } else {
                    setNotifications([]);
                    setUnreadCount(0);
                }
            }
        };
        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, [fetchNotifications, fetchUnreadCount]);

    // Mark notification as read
    const markAsRead = async (notificationId) => {
        // Optimistic update
        setNotifications(prev =>
            prev.map(n => n.id === notificationId ? { ...n, isRead: true, unread: false } : n)
        );
        setUnreadCount(prev => Math.max(0, prev - 1));

        await authFetchJSON(`/notifications/${notificationId}/read`, { method: 'PUT' });
    };

    // Mark all notifications as read
    const markAllAsRead = async () => {
        // Optimistic update
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true, unread: false })));
        setUnreadCount(0);

        await authFetchJSON('/notifications/read-all', { method: 'PUT' });
    };

    // Add new notification (local, from push/FCM) — used internally
    const addNotificationLocal = (notification) => {
        const newNotification = {
            ...notification,
            id: notification.id || Date.now().toString(),
            timestamp: new Date(),
            unread: true,
            isRead: false,
        };
        setNotifications(prev => [newNotification, ...prev]);
        setUnreadCount(prev => prev + 1);
    };

    // Add new notification (public API)
    const addNotification = addNotificationLocal;

    // Remove notification
    const removeNotification = async (notificationId) => {
        setNotifications(prev => prev.filter(n => n.id !== notificationId));
        await authFetchJSON(`/notifications/${notificationId}`, { method: 'DELETE' });
    };

    // Refresh: re-fetch from backend
    const refreshNotifications = () => {
        fetchNotifications();
        fetchUnreadCount();
    };

    const value = {
        notifications,
        unreadCount,
        isLoading,
        markAsRead,
        markAllAsRead,
        addNotification,
        removeNotification,
        refreshNotifications,
    };

    return (
        <NotificationsContext.Provider value={value}>
            {children}
        </NotificationsContext.Provider>
    );
};

export default NotificationsContext;