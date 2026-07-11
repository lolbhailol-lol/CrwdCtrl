import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { requestNotificationPermission, getFcmTokenIfGranted, onForegroundMessage } from '../firebase';
import { registerNativePushToken, getPushDeviceType } from '../utils/nativePush';
import { isNativeApp } from '../utils/capacitorPlatform';
import { shouldPromptForNotifications, markNotificationPromptAttempted } from '../utils/notificationPrompt';
import { resolveAuthToken } from '../utils/authToken';
import { userFetchJSON } from '../services/api/client';
import NotificationPopupStack from '../components/NotificationPopupStack';
import { inferPopupTone } from '../utils/appPopup';

const NotificationsContext = createContext();
const POPUP_TTL_MS = 1000;
const VISIBLE_POLL_MS = 15000;

export const useNotifications = () => {
    const context = useContext(NotificationsContext);
    if (!context) {
        throw new Error('useNotifications must be used within a NotificationsProvider');
    }
    return context;
};

function NotificationsUI({ popupItems }) {
    return (
        <NotificationPopupStack items={popupItems} />
    );
}

export const NotificationsProvider = ({ children }) => {
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [popupItems, setPopupItems] = useState([]);
    const pollIntervalRef = useRef(null);
    const seenNotificationIdsRef = useRef(new Set());
    const hasInitializedRef = useRef(false);
    const popupTimersRef = useRef(new Map());
    const recentPopupsRef = useRef(new Map());
    const navigateRef = useRef(null);

    const getToken = () => resolveAuthToken();

    const authFetchJSON = useCallback(
        (path, options = {}) => userFetchJSON(path, { ...options, token: getToken() }),
        [],
    );

    const dismissPopup = useCallback((popupId) => {
        setPopupItems((prev) => prev.filter((item) => item.id !== popupId));
        const timer = popupTimersRef.current.get(popupId);
        if (timer) {
            window.clearTimeout(timer);
            popupTimersRef.current.delete(popupId);
        }
    }, []);

    const pushPopup = useCallback(({ title, message = '', tone = 'info', link = null, id = null, duration = POPUP_TTL_MS }) => {
        if (!title || typeof document === 'undefined') return;
        if (document.visibilityState !== 'visible') return;

        const dedupeKey = id || `${tone}:${title}:${message}`;
        const lastShown = recentPopupsRef.current.get(dedupeKey);
        if (lastShown && Date.now() - lastShown < 8000) return;
        recentPopupsRef.current.set(dedupeKey, Date.now());

        const popupId = id || `popup-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

        setPopupItems([{ id: popupId, notificationId: id, title, message, tone, link }]);

        const existingTimer = popupTimersRef.current.get(popupId);
        if (existingTimer) window.clearTimeout(existingTimer);

        const timer = window.setTimeout(() => dismissPopup(popupId), duration);
        popupTimersRef.current.set(popupId, timer);
    }, [dismissPopup]);

    const notifyUser = useCallback((notification) => {
        if (!notification?.title) return;

        const tone = inferPopupTone(notification);
        // Login popup is shown once client-side on crwdctrl:user-login — skip server duplicates.
        if (tone === 'login') return;

        pushPopup({
            title: notification.title,
            message: notification.message || '',
            tone,
            link: notification.link || '/notifications',
            id: notification.id,
        });

        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            try {
                new Notification(notification.title, {
                    body: notification.message || '',
                    icon: '/icon-192x192.png',
                });
            } catch {
                /* ignore blocked notifications */
            }
        }
    }, [pushPopup]);

    const fetchNotifications = useCallback(async ({ announceNew = true } = {}) => {
        try {
            const data = await authFetchJSON('/notifications?limit=20');
            if (data && data.success) {
                const nextNotifications = data.notifications || [];
                setNotifications(nextNotifications);

                const seenIds = seenNotificationIdsRef.current;

                // First load (or post-login hydrate): seed seen IDs only — never replay old toasts.
                if (!hasInitializedRef.current || !announceNew) {
                    nextNotifications.forEach((notification) => {
                        if (notification?.id) seenIds.add(notification.id);
                    });
                    hasInitializedRef.current = true;
                    return;
                }

                nextNotifications
                    .filter((notification) => notification?.id && !seenIds.has(notification.id))
                    .forEach((notification) => {
                        notifyUser(notification);
                        seenIds.add(notification.id);
                    });
            }
        } catch (error) {
            console.error('Failed to fetch notifications:', error);
        }
    }, [notifyUser, authFetchJSON]);

    const registerPushToken = useCallback(async (options = {}) => {
        try {
            if (!getToken()) return false;

            if (!isNativeApp() && (!('serviceWorker' in navigator) || (location.protocol !== 'https:' && location.hostname !== 'localhost'))) {
                return false;
            }

            const allowPrompt = options.forcePrompt === true || shouldPromptForNotifications();
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
                return true;
            }
            return false;
        } catch (err) {
            console.warn('Push registration skipped:', err.message);
            return false;
        }
    }, [authFetchJSON]);

    const fetchUnreadCount = useCallback(async () => {
        try {
            const data = await authFetchJSON('/notifications/unread-count');
            if (data && data.success) {
                setUnreadCount(data.unreadCount || 0);
            }
        } catch {
            /* silent */
        }
    }, [authFetchJSON]);

    useEffect(() => {
        const token = getToken();
        if (!token) {
            setNotifications([]);
            setUnreadCount(0);
            setPopupItems([]);
            seenNotificationIdsRef.current = new Set();
            hasInitializedRef.current = false;
            return;
        }

        setIsLoading(true);
        // Hydrate list quietly — do not replay history as toasts
        fetchNotifications({ announceNew: false }).finally(() => setIsLoading(false));
        fetchUnreadCount();

        const poll = () => {
            fetchUnreadCount();
            fetchNotifications({ announceNew: true });
        };

        pollIntervalRef.current = setInterval(poll, VISIBLE_POLL_MS);

        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible' && getToken()) {
                poll();
                registerPushToken();
            }
        };
        document.addEventListener('visibilitychange', onVisibilityChange);

        const onRefreshEvent = () => {
            poll();
        };
        window.addEventListener('crwdctrl:refresh-notifications', onRefreshEvent);

        const onServiceWorkerMessage = (event) => {
            if (event?.data?.type === 'crwdctrl:refresh-notifications') {
                onRefreshEvent();
            }
        };
        navigator.serviceWorker?.addEventListener('message', onServiceWorkerMessage);

        const pushTimer = setTimeout(registerPushToken, 5000);

        const unsubFCM = onForegroundMessage((payload) => {
            const { title, body } = payload.notification || {};
            const notificationId = payload.data?.notificationId || payload.messageId;
            fetchNotifications({ announceNew: true });
            fetchUnreadCount();
            if (title) {
                notifyUser({
                    id: notificationId,
                    title,
                    message: body || '',
                    type: payload.data?.type || 'system',
                    link: payload.data?.link || '/notifications',
                });
            }
        });

        return () => {
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
            }
            document.removeEventListener('visibilitychange', onVisibilityChange);
            window.removeEventListener('crwdctrl:refresh-notifications', onRefreshEvent);
            navigator.serviceWorker?.removeEventListener('message', onServiceWorkerMessage);
            clearTimeout(pushTimer);
            if (typeof unsubFCM === 'function') unsubFCM();
        };
    }, [fetchNotifications, fetchUnreadCount, registerPushToken, notifyUser]);

    useEffect(() => {
        let absorbTimer = null;
        let pushTimer = null;

        const onUserLogin = () => {
            // Re-hydrate quietly so login / old items don't flood the screen.
            // Live toasts still come from FCM, explicit app popups, and later polls for truly new IDs.
            setPopupItems([]);
            seenNotificationIdsRef.current = new Set();
            hasInitializedRef.current = false;
            fetchNotifications({ announceNew: false });
            fetchUnreadCount();
            if (absorbTimer) window.clearTimeout(absorbTimer);
            // Server may create a "Login successful" row slightly after auth — absorb it silently.
            absorbTimer = window.setTimeout(() => {
                fetchNotifications({ announceNew: false });
                fetchUnreadCount();
            }, 2500);
            if (pushTimer) window.clearTimeout(pushTimer);
            pushTimer = window.setTimeout(registerPushToken, 2000);
        };

        const onUserLogout = () => {
            if (absorbTimer) window.clearTimeout(absorbTimer);
            if (pushTimer) window.clearTimeout(pushTimer);
            setNotifications([]);
            setUnreadCount(0);
            setPopupItems([]);
            seenNotificationIdsRef.current = new Set();
            hasInitializedRef.current = false;
        };

        window.addEventListener('crwdctrl:user-login', onUserLogin);
        window.addEventListener('crwdctrl:user-logout', onUserLogout);
        return () => {
            if (absorbTimer) window.clearTimeout(absorbTimer);
            if (pushTimer) window.clearTimeout(pushTimer);
            window.removeEventListener('crwdctrl:user-login', onUserLogin);
            window.removeEventListener('crwdctrl:user-logout', onUserLogout);
        };
    }, [fetchNotifications, fetchUnreadCount, registerPushToken]);

    useEffect(() => {
        const handleStorageChange = (e) => {
            if (e.key === 'crwdctrl_token') {
                if (e.newValue) {
                    hasInitializedRef.current = false;
                    seenNotificationIdsRef.current = new Set();
                    fetchNotifications({ announceNew: false });
                    fetchUnreadCount();
                } else {
                    setNotifications([]);
                    setUnreadCount(0);
                    setPopupItems([]);
                    seenNotificationIdsRef.current = new Set();
                    hasInitializedRef.current = false;
                }
            }
        };
        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, [fetchNotifications, fetchUnreadCount]);

    useEffect(() => {
        const onAppPopup = (event) => {
            const detail = event?.detail || {};
            if (!detail.title) return;
            pushPopup({
                title: detail.title,
                message: detail.message || '',
                tone: detail.tone || 'info',
                link: detail.link || null,
                duration: detail.duration || POPUP_TTL_MS,
            });
        };

        window.addEventListener('crwdctrl:app-popup', onAppPopup);
        return () => window.removeEventListener('crwdctrl:app-popup', onAppPopup);
    }, [pushPopup]);

    const markAsRead = async (notificationId) => {
        setNotifications((prev) =>
            prev.map((n) => (n.id === notificationId ? { ...n, isRead: true, unread: false } : n)),
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));

        await authFetchJSON(`/notifications/${notificationId}/read`, { method: 'PUT' });
    };

    const markAllAsRead = async () => {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true, unread: false })));
        setUnreadCount(0);

        await authFetchJSON('/notifications/read-all', { method: 'PUT' });
    };

    const addNotificationLocal = (notification) => {
        const newNotification = {
            ...notification,
            id: notification.id || Date.now().toString(),
            timestamp: new Date(),
            unread: true,
            isRead: false,
        };
        seenNotificationIdsRef.current.add(newNotification.id);
        setNotifications((prev) => [newNotification, ...prev]);
        setUnreadCount((prev) => prev + 1);
        notifyUser(newNotification);
    };

    const addNotification = addNotificationLocal;

    const removeNotification = async (notificationId) => {
        setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
        await authFetchJSON(`/notifications/${notificationId}`, { method: 'DELETE' });
    };

    const refreshNotifications = () => {
        fetchNotifications({ announceNew: true });
        fetchUnreadCount();
    };

    const enableBrowserNotifications = async () => {
        const ok = await registerPushToken({ forcePrompt: true });
        if (ok) {
            fetchNotifications({ announceNew: false });
            fetchUnreadCount();
        }
        return ok;
    };

    useEffect(() => {
        return () => {
            popupTimersRef.current.forEach((timer) => window.clearTimeout(timer));
            popupTimersRef.current.clear();
        };
    }, []);

    const value = {
        notifications,
        unreadCount,
        isLoading,
        markAsRead,
        markAllAsRead,
        addNotification,
        removeNotification,
        refreshNotifications,
        enableBrowserNotifications,
    };

    return (
        <NotificationsContext.Provider value={value}>
            <NotificationsNavigateBridge navigateRef={navigateRef} />
            {children}
            <NotificationsUI popupItems={popupItems} />
        </NotificationsContext.Provider>
    );
};

function NotificationsNavigateBridge({ navigateRef }) {
    const navigate = useNavigate();
    useEffect(() => {
        navigateRef.current = navigate;
    }, [navigate, navigateRef]);
    return null;
}

export default NotificationsContext;
