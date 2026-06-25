/** Map raw carousel items from buildHomeCarouselItems into Dashboard display shapes. */
export function mapHomeCarouselDisplayItems(raw, transformedFests = []) {
    const byPriority = (a, b) => (a._priority || 999) - (b._priority || 999);

    return raw.map((item) => {
        if (item._type === 'fest') {
            const f = transformedFests.find((t) => t.id === item._id);
            if (f) return { ...f, _type: 'fest', _priority: item._priority };
            return {
                id: item._id,
                title: item.festName || item._title,
                subtitle: item.collegeName || item._subtitle,
                image: item.coverImage || item._image,
                _type: 'fest',
                _priority: item._priority,
            };
        }
        if (item._type === 'sport') {
            return {
                id: item._id,
                title: item.title || item._title,
                subtitle: item.city || item.sportType || item._subtitle,
                image: item.images?.[0] || item._image,
                registrationLink: item.registrationLink,
                runClubId: item.runClubId,
                _type: 'sport',
                _priority: item._priority,
            };
        }
        if (item._type === 'runclub') {
            return {
                _id: item._id,
                name: item.name || item._title,
                basedIn: item.basedIn || item._subtitle,
                coverImage: item.coverImage || item._image,
                _type: 'runclub',
                _priority: item._priority,
            };
        }
        if (item._type === 'events') {
            return {
                id: item._id,
                title: item.title || item._title,
                subtitle: item.city || item.organizer || item._subtitle,
                image: item.poster || item.banner || item._image,
                _type: 'events',
                _priority: item._priority,
            };
        }
        return { ...item, _type: item._type, _priority: item._priority };
    }).filter(Boolean).sort(byPriority);
}
