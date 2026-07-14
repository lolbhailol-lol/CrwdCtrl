import { getCoverImageUrl } from './coverImages';

/** Map raw carousel items from buildHomeCarouselItems into Dashboard display shapes. */
export function mapHomeCarouselDisplayItems(raw, transformedFests = []) {
    const byPriority = (a, b) => (a._priority || 999) - (b._priority || 999);

    return raw.map((item) => {
        if (item._type === 'fest') {
            const f = transformedFests.find((t) => t.id === item._id);
            if (f) {
                return {
                    ...f,
                    image: getCoverImageUrl(item, 'cardPortrait') || f.image || item.coverImage || item._image,
                    _type: 'fest',
                    _priority: item._priority,
                };
            }
            return {
                id: item._id,
                title: item.festName || item._title,
                subtitle: item.collegeName || item._subtitle,
                image: getCoverImageUrl(item, 'cardPortrait') || item.coverImage || item._image,
                _type: 'fest',
                _priority: item._priority,
            };
        }
        if (item._type === 'sport') {
            return {
                id: item._id,
                title: item.title || item._title,
                subtitle: item.city || item.sportType || item._subtitle,
                image: getCoverImageUrl(item, 'cardWide') || item.images?.[0] || item._image,
                registrationLink: item.registrationLink,
                runClubId: item.runClubId,
                _type: 'sport',
                _priority: item._priority,
            };
        }
        if (item._type === 'runclub') {
            return {
                _id: item._id,
                id: item._id,
                name: item.name || item._title,
                title: item.name || item._title,
                basedIn: item.basedIn || item._subtitle,
                subtitle: item.basedIn || item._subtitle,
                coverImage: item.coverImage || item._image,
                image: getCoverImageUrl(item, 'cardPortrait') || item.coverImage || item._image,
                coverImages: item.coverImages,
                _type: 'runclub',
                _priority: item._priority,
            };
        }
        if (item._type === 'events') {
            return {
                id: item._id,
                title: item.title || item._title,
                subtitle: item.city || item.organizer || item._subtitle,
                image: getCoverImageUrl(item, 'cardWide') || item.poster || item.banner || item._image,
                _type: 'events',
                _priority: item._priority,
            };
        }
        if (item._type === 'trek') {
            const communityName = (
                (typeof item.communityId === 'object' && (item.communityId?.name || item.communityId?.title))
                || item.communityName
                || item._subtitle
                || ''
            );
            return {
                ...item,
                id: item._id || item.id,
                title: item.trekName || item._title || item.title,
                subtitle: communityName || item.city || '',
                image: getCoverImageUrl(item, 'cardPortrait') || item.coverImage || item.images?.[0] || item._image,
                _type: 'trek',
                _priority: item._priority,
            };
        }
        if (item._type === 'community') {
            return {
                ...item,
                id: item._id || item.id,
                title: item.name || item._title || item.title,
                subtitle: item.basedIn || item._subtitle,
                image: getCoverImageUrl(item, 'cardPortrait') || item.coverImage || item._image,
                _type: 'community',
                _priority: item._priority,
            };
        }
        return { ...item, _type: item._type, _priority: item._priority };
    }).filter(Boolean).sort(byPriority);
}
