import React, { createContext, useContext, useState, useEffect } from 'react';

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

    // Initialize notifications (removed dummy data)
    useEffect(() => {
        // Start with empty notifications - real notifications will be added via API or user actions
        setNotifications([]);
    }, []);

    // Mark notification as read
    const markAsRead = (notificationId) => {
        setNotifications(prev =>
            prev.map(notification =>
                notification.id === notificationId
                    ? { ...notification, unread: false }
                    : notification
            )
        );
    };

    // Mark all notifications as read
    const markAllAsRead = () => {
        setNotifications(prev =>
            prev.map(notification => ({ ...notification, unread: false }))
        );
    };

    // Add new notification
    const addNotification = (notification) => {
        const newNotification = {
            ...notification,
            id: Date.now(), // Simple ID generation
            timestamp: new Date(),
            unread: true
        };
        setNotifications(prev => [newNotification, ...prev]);
    };

    // Get unread count
    const unreadCount = notifications.filter(n => n.unread).length;

    // Remove notification
    const removeNotification = (notificationId) => {
        setNotifications(prev => prev.filter(n => n.id !== notificationId));
    };

    const value = {
        notifications,
        unreadCount,
        markAsRead,
        markAllAsRead,
        addNotification,
        removeNotification
    };

    return (
        <NotificationsContext.Provider value={value}>
            {children}
        </NotificationsContext.Provider>
    );
};

export default NotificationsContext;