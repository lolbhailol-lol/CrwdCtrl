import React, { createContext, useContext, useState, useEffect } from 'react';

const FavoritesContext = createContext();

// eslint-disable-next-line react-refresh/only-export-components
export const useFavorites = () => {
    const context = useContext(FavoritesContext);
    if (!context) {
        throw new Error('useFavorites must be used within a FavoritesProvider');
    }
    return context;
};

export const FavoritesProvider = ({ children }) => {
    // Initialize favorites from localStorage
    const [favorites, setFavorites] = useState(() => {
        if (typeof window !== 'undefined') {
            const savedFavorites = localStorage.getItem('crwdctrl-favorites');
            if (savedFavorites) {
                try {
                    return JSON.parse(savedFavorites);
                } catch (error) {
                    console.error('Error parsing favorites from localStorage:', error);
                    return {};
                }
            }
        }
        return {};
    });

    // Save to localStorage whenever favorites change
    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('crwdctrl-favorites', JSON.stringify(favorites));
        }
    }, [favorites]);

    // Add or remove a favorite
    const toggleFavorite = (eventId, eventData = null) => {
        setFavorites(prev => {
            const newFavorites = { ...prev };

            if (newFavorites[eventId]) {
                // Remove from favorites
                delete newFavorites[eventId];
            } else {
                // Add to favorites - store the event data if provided
                newFavorites[eventId] = eventData || {
                    id: eventId,
                    addedAt: new Date().toISOString()
                };
            }

            return newFavorites;
        });
    };

    // Check if an event is favorited
    const isFavorite = (eventId) => {
        return Boolean(favorites[eventId]);
    };

    // Get all favorite events
    const getFavoriteEvents = () => {
        return Object.values(favorites);
    };

    // Get favorite count
    const getFavoriteCount = () => {
        return Object.keys(favorites).length;
    };

    // Remove a favorite by ID
    const removeFavorite = (eventId) => {
        setFavorites(prev => {
            const newFavorites = { ...prev };
            delete newFavorites[eventId];
            return newFavorites;
        });
    };

    // Clear all favorites
    const clearAllFavorites = () => {
        setFavorites({});
    };

    const value = {
        favorites,
        toggleFavorite,
        isFavorite,
        getFavoriteEvents,
        getFavoriteCount,
        removeFavorite,
        clearAllFavorites
    };

    return (
        <FavoritesContext.Provider value={value}>
            {children}
        </FavoritesContext.Provider>
    );
};