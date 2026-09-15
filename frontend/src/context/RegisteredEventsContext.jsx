import React, { createContext, useContext, useState, useEffect } from 'react';

const RegisteredEventsContext = createContext();

export const useRegisteredEvents = () => {
    const context = useContext(RegisteredEventsContext);
    if (!context) {
        throw new Error('useRegisteredEvents must be used within a RegisteredEventsProvider');
    }
    return context;
};

export const RegisteredEventsProvider = ({ children }) => {
    const [registeredEvents, setRegisteredEvents] = useState([]);

    useEffect(() => {
        const savedEvents = localStorage.getItem('crwdctrl_registered_events');
        if (savedEvents) {
            try {
                setRegisteredEvents(JSON.parse(savedEvents));
            } catch {
                setRegisteredEvents([]);
            }
        }
    }, []);

    useEffect(() => {
        if (registeredEvents.length > 0) {
            localStorage.setItem('crwdctrl_registered_events', JSON.stringify(registeredEvents));
        } else {
            localStorage.removeItem('crwdctrl_registered_events');
        }
    }, [registeredEvents]);

    const registerForEvent = (event) => {
        const registrationData = {
            id: event.id,
            name: event.title || event.name,
            college: event.college || 'TBA',
            date: event.date || event.dateTime,
            time: event.time || '10:00 AM',
            venue: event.venue || 'TBA',
            type: event.type || 'general',
            image: event.image || event.heroImage,
            icon: event.icon || getEventIcon(event.type),
            status: 'Upcoming',
            registeredAt: new Date().toISOString()
        };

        setRegisteredEvents(prev => {
            if (prev.some(regEvent => regEvent.id === event.id)) {
                return prev;
            }
            return [...prev, registrationData];
        });
    };

    const unregisterFromEvent = (eventId) => {
        setRegisteredEvents(prev => prev.filter(event => event.id !== eventId));
    };

    const isRegistered = (eventId) => {
        return registeredEvents.some(event => event.id === eventId);
    };

    const getUpcomingRegisteredEvents = () => {
        const now = new Date();
        return registeredEvents.filter(event => {
            const eventDate = new Date(event.date);
            return eventDate >= now;
        }).sort((a, b) => new Date(a.date) - new Date(b.date));
    };

    const getPastRegisteredEvents = () => {
        const now = new Date();
        return registeredEvents.filter(event => {
            const eventDate = new Date(event.date);
            return eventDate < now;
        }).sort((a, b) => new Date(b.date) - new Date(a.date));
    };

    const getEventIcon = (type) => {
        switch (type?.toLowerCase()) {
            case 'tech':
            case 'technical':
                return '💻';
            case 'cultural':
                return '🎭';
            case 'sports':
                return '⚽';
            case 'music':
                return '🎵';
            case 'dance':
                return '💃';
            case 'art':
                return '🎨';
            default:
                return '🎉';
        }
    };

    const value = {
        registeredEvents,
        registerForEvent,
        unregisterFromEvent,
        isRegistered,
        getUpcomingRegisteredEvents,
        getPastRegisteredEvents
    };

    return (
        <RegisteredEventsContext.Provider value={value}>
            {children}
        </RegisteredEventsContext.Provider>
    );
};
