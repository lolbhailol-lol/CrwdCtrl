import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { normalizeFavoriteEntry } from '../utils/favoriteNormalize';

const FavoritesContext = createContext();
const STORAGE_KEY = 'crwdctrl-favorites';

function readFavoritesFromStorage() {
    if (typeof window === 'undefined') return {};
    try {
        const savedFavorites = localStorage.getItem(STORAGE_KEY);
        if (!savedFavorites) return {};
        return JSON.parse(savedFavorites);
    } catch {
        // SecurityError (private Safari / restricted iframe) or bad JSON
        return {};
    }
}

function writeFavoritesToStorage(favorites) {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
    } catch {
        // QuotaExceeded / SecurityError — ignore; in-memory still works
    }
}

export const useFavorites = () => {
    const context = useContext(FavoritesContext);
    if (!context) {
        throw new Error('useFavorites must be used within a FavoritesProvider');
    }
    return context;
};

export const FavoritesProvider = ({ children }) => {
    const [favorites, setFavorites] = useState(() => readFavoritesFromStorage());

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
        writeFavoritesToStorage(favorites);
    }, [favorites]);

    const toggleFavorite = useCallback((eventId, eventData = null) => {
        setFavorites((prev) => {
            const newFavorites = { ...prev };

            if (newFavorites[eventId]) {
                delete newFavorites[eventId];
            } else {
                newFavorites[eventId] = normalizeFavoriteEntry(eventId, eventData);
            }

            return newFavorites;
        });
    }, []);

    const isFavorite = useCallback((eventId) => Boolean(favorites[eventId]), [favorites]);

    const getFavoriteEvents = useCallback(() => {
        return Object.entries(favorites).map(([id, data]) => ({
            ...data,
            id: data.id || id,
        }));
    }, [favorites]);

    const getFavoriteCount = useCallback(() => Object.keys(favorites).length, [favorites]);

    const removeFavorite = useCallback((eventId) => {
        setFavorites((prev) => {
            const next = { ...prev };
            delete next[eventId];
            return next;
        });
    }, []);

    const clearAllFavorites = useCallback(() => setFavorites({}), []);

    const value = useMemo(() => ({
        favorites,
        toggleFavorite,
        isFavorite,
        getFavoriteEvents,
        getFavoriteCount,
        removeFavorite,
        clearAllFavorites,
    }), [
        favorites,
        toggleFavorite,
        isFavorite,
        getFavoriteEvents,
        getFavoriteCount,
        removeFavorite,
        clearAllFavorites,
    ]);

    return (
        <FavoritesContext.Provider value={value}>
            {children}
        </FavoritesContext.Provider>
    );
};
