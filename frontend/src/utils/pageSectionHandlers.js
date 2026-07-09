import { useCallback } from 'react';
import { communityPath, eventShowPath, festPath, runClubPath, sportRunPath, trekPath } from './slugRoutes';

export function usePageSectionHandlers(navigate, { toggleFavorite } = {}) {
    const onItemClick = useCallback((item) => {
        const id = item.id || item._id;
        if (item._type === 'fest') {
            navigate(festPath(item));
        } else if (item._type === 'trek') {
            navigate(trekPath(item), { state: { trek: item } });
        } else if (item._type === 'community') {
            navigate(communityPath(item), {
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
            navigate(runClubPath(item), {
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
            navigate(sportRunPath(item), { state: { event: item } });
        } else if (item._type === 'events') {
            navigate(eventShowPath(item));
        }
    }, [navigate]);

    const onToggleFavorite = useCallback((item) => {
        const id = item.id || item._id;
        if (!id) return;
        toggleFavorite?.(id, { ...item, id, _id: id });
    }, [toggleFavorite]);

    const getShareUrl = useCallback((item) => {
        const id = item.id || item._id;
        if (item._type === 'fest') return `${window.location.origin}${festPath(item)}`;
        if (item._type === 'trek') return `${window.location.origin}${trekPath(item)}`;
        if (item._type === 'community') return `${window.location.origin}${communityPath(item)}`;
        if (item._type === 'runclub') return `${window.location.origin}${runClubPath(item)}`;
        if (item._type === 'sport') return `${window.location.origin}${sportRunPath(item)}`;
        if (item._type === 'events') return `${window.location.origin}${eventShowPath(item)}`;
        return `${window.location.origin}${festPath(item)}`;
    }, []);

    return { onItemClick, onToggleFavorite, getShareUrl };
}
