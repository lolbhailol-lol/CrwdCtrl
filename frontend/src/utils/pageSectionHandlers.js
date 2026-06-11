import { useCallback } from 'react';

export function usePageSectionHandlers(navigate, { toggleFavorite } = {}) {
    const onItemClick = useCallback((item) => {
        const id = item.id || item._id;
        if (item._type === 'fest') {
            navigate(`/view-details/${id}`);
        } else if (item._type === 'trek') {
            navigate(`/trek/${id}`, { state: { trek: item } });
        } else if (item._type === 'community') {
            navigate(`/treks/community/${id}`, {
                state: {
                    community: {
                        id,
                        title: item.name || item._title,
                        subtitle: item.basedIn || item._subtitle,
                        image: item.coverImage || item._image,
                        trekCategories: item.trekCategories || [],
                    },
                },
            });
        } else if (item._type === 'runclub') {
            navigate(`/sports/run-club/${id}`, {
                state: {
                    club: {
                        _id: id,
                        name: item.name || item._title,
                        basedIn: item.basedIn || item._subtitle,
                        coverImage: item.coverImage || item._image,
                    },
                },
            });
        } else if (item._type === 'sport') {
            navigate(`/sports/run/${id}`, { state: { event: item } });
        }
    }, [navigate]);

    const onToggleFavorite = useCallback((item) => {
        const id = item.id || item._id;
        toggleFavorite?.(id, {
            id,
            title: item.title || item.festName || item.name || item._title,
            image: item.image || item.coverImage || item._image,
            type: item._type || 'Event',
        });
    }, [toggleFavorite]);

    const getShareUrl = useCallback((item) => {
        const id = item.id || item._id;
        if (item._type === 'fest') return `${window.location.origin}/view-details/${id}`;
        if (item._type === 'trek') return `${window.location.origin}/trek/${id}`;
        if (item._type === 'community') return `${window.location.origin}/treks/community/${id}`;
        if (item._type === 'runclub') return `${window.location.origin}/sports/run-club/${id}`;
        if (item._type === 'sport') return `${window.location.origin}/sports/run/${id}`;
        return `${window.location.origin}/view-details/${id}`;
    }, []);

    return { onItemClick, onToggleFavorite, getShareUrl };
}
