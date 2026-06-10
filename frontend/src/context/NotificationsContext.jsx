import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { requestNotificationPermission, getFcmTokenIfGranted, onForegroundMessage } from '../firebase';
import { registerNativePushToken, getPushDeviceType } from '../utils/nativePush';
import { isNativeApp } from '../utils/capacitorPlatform';
import { shouldPromptForNotifications, markNotificationPromptAttempted } from '../utils/notificationPrompt';

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
    const seenNotificationIdsRef = useRef(new Set());
    const hasInitializedRef = useRef(false);

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

    const showBrowserNotification = useCallback((title, body) => {
        if (typeof Notification === 'undefined') return;
        if (Notification.permission === 'granted' && title) {
            new Notification(title, { body: body || '', icon: '/icon-192x192.png' });
        }
    }, []);

    // Fetch notifications from backend
     
    const fetchNotifications = useCallback(async () => {
        try {
            const data = await authFetchJSON('/notifications?limit=20');
            if (data && data.success) {
                const nextNotifications = data.notifications || [];
                setNotifications(nextNotifications);

                const seenIds = seenNotificationIdsRef.current;
                const now = Date.now();
                const isFresh = (notification) => {
                    if (!notification?.timestamp) return false;
                    const createdAt = new Date(notification.timestamp).getTime();
                    return Number.isFinite(createdAt) && (now - createdAt) < 2 * 60 * 1000;
                };

                if (!hasInitializedRef.current) {
                    nextNotifications.forEach(notification => {
                        if (notification?.id) seenIds.add(notification.id);
                    });

                    nextNotifications
                        .filter(isFresh)
                        .forEach(notification => showBrowserNotification(notification.title, notification.message));

                    hasInitializedRef.current = true;
                    return;
                }

                nextNotifications
                    .filter(notification => notification?.id && !seenIds.has(notification.id))
                    .forEach(notification => {
                        showBrowserNotification(notification.title, notification.message);
                        seenIds.add(notification.id);
                    });
            }
        } catch (error) {
            console.error('Failed to fetch notifications:', error);
        }
    }, [showBrowserNotification]);

    const registerPushToken = useCallback(async () => {
        try {
            if (!getToken()) return;

            if (!isNativeApp() && (!('serviceWorker' in navigator) || (location.protocol !== 'https:' && location.hostname !== 'localhost'))) {
                return;
            }

            const allowPrompt = shouldPromptForNotifications();
            let fcmToken = null;

            if (isNativeApp()) {
                fcmToken = await registerNativePushToken({ allowPrompt });
                if (allowPrompt) {
                    markNotificationPromptAttempted();
                }
            } else if ('serviceWorker' in navigator) {
                if (Notification.permission === 'granted') {
                    fcmToken = await getFcmTokenIfGranted();
                } else if (allowPrompt) {
                    fcmToken = await requestNotificationPermission();
                    markNotificationPromptAttempted();
                }
            }

            if (fcmToken) {
                await authFetchJSON('/notifications/register-push', {
                    method: 'POST',
                    body: JSON.stringify({ token: fcmToken, device: getPushDeviceType() }),
                });
            }
        } catch (err) {
            console.warn('Push registration skipped:', err.message);
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
            seenNotificationIdsRef.current = new Set();
            hasInitializedRef.current = false;
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

        // Delay push registration to avoid blocking initial load
        const pushTimer = setTimeout(registerPushToken, 5000);

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
    }, [fetchNotifications, fetchUnreadCount, registerPushToken]);

    // Re-run push registration after an active login in the same tab
    useEffect(() => {
        const onUserLogin = () => {
            fetchNotifications();
            fetchUnreadCount();
            setTimeout(registerPushToken, 2000);
        };

        window.addEventListener('crwdctrl:user-login', onUserLogin);
        return () => window.removeEventListener('crwdctrl:user-login', onUserLogin);
    }, [fetchNotifications, fetchUnreadCount, registerPushToken]);

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
                    seenNotificationIdsRef.current = new Set();
                    hasInitializedRef.current = false;
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
        seenNotificationIdsRef.current.add(newNotification.id);
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