import React, { createContext, useContext, useState, useEffect } from 'react';
import { normalizeFavoriteEntry } from '../utils/favoriteNormalize';

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

    // Migrate legacy favorites to normalized shape
    useEffect(() => {
        setFavorites((prev) => {
            const next = {};
            let changed = false;
            for (const [key, value] of Object.entries(prev)) {
                const normalized = normalizeFavoriteEntry(key, value);
                next[key] = normalized;
                if (JSON.stringify(normalized) !== JSON.stringify(value)) {
                    changed = true;
                }
            }
            return changed ? next : prev;
        });
    }, []);

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
                delete newFavorites[eventId];
            } else {
                newFavorites[eventId] = normalizeFavoriteEntry(eventId, eventData);
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
        return Object.entries(favorites).map(([id, data]) => normalizeFavoriteEntry(id, data));
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