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

    // Load registered events from localStorage on mount
    useEffect(() => {
        const savedEvents = localStorage.getItem('crwdctrl_registered_events');
        if (savedEvents) {
            setRegisteredEvents(JSON.parse(savedEvents));
        } else {
            // Set some sample registered events for demonstration
            const sampleEvents = [
                {
                    id: 1,
                    name: 'Tech Summit 2024',
                    college: 'MIT College',
                    date: '2025-12-15',
                    time: '10:00 AM',
                    venue: 'Main Auditorium',
                    type: 'tech',
                    icon: '💻',
                    status: 'Upcoming',
                    registeredAt: new Date().toISOString()
                },
                {
                    id: 2,
                    name: 'Cultural Extravaganza',
                    college: 'ABC University',
                    date: '2025-12-20',
                    time: '6:00 PM',
                    venue: 'Open Ground',
                    type: 'cultural',
                    icon: '🎭',
                    status: 'Upcoming',
                    registeredAt: new Date().toISOString()
                },
                {
                    id: 3,
                    name: 'Sports Championship',
                    college: 'XYZ Institute',
                    date: '2025-12-25',
                    time: '8:00 AM',
                    venue: 'Sports Complex',
                    type: 'sports',
                    icon: '⚽',
                    status: 'Upcoming',
                    registeredAt: new Date().toISOString()
                }
            ];
            setRegisteredEvents(sampleEvents);
        }
    }, []);

    // Save to localStorage whenever registeredEvents changes
    useEffect(() => {
        localStorage.setItem('crwdctrl_registered_events', JSON.stringify(registeredEvents));
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
            // Check if already registered
            if (prev.some(regEvent => regEvent.id === event.id)) {
                return prev; // Already registered
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