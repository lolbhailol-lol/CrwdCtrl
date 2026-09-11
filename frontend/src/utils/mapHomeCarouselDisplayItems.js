import { pickBestCardImage } from './coverImages';

/** Map raw carousel items from buildHomeCarouselItems into Dashboard display shapes. */
export function mapHomeCarouselDisplayItems(raw, transformedFests = []) {
    const byPriority = (a, b) => (a._priority || 999) - (b._priority || 999);
    const list = Array.isArray(raw) ? raw.filter(Boolean) : [];

    return list.map((item) => {
        if (!item || typeof item !== 'object') return null;
        if (item._type === 'fest') {
            const f = transformedFests.find((t) => t.id === item._id);
            const merged = {
                ...item,
                ...(f || {}),
                coverImages: item.coverImages || f?.coverImages,
                coverImage: item.coverImage || f?.coverImage || f?.image,
                galleryImages: item.galleryImages || item.festImages || f?.galleryImages || f?.festImages,
            };
            const rawImage = pickBestCardImage(merged, 'tall');
            if (f) {
                return {
                    ...f,
                    coverImages: merged.coverImages,
                    coverImage: merged.coverImage,
                    galleryImages: merged.galleryImages,
                    festImages: merged.galleryImages,
                    image: rawImage,
                    _type: 'fest',
                    _priority: item._priority,
                };
            }
            return {
                id: item._id,
                title: item.festName || item._title || 'Fest',
                subtitle: item.collegeName || item._subtitle,
                coverImages: merged.coverImages,
                coverImage: merged.coverImage,
                galleryImages: merged.galleryImages,
                image: rawImage,
                _type: 'fest',
                _priority: item._priority,
            };
        }
        if (item._type === 'sport') {
            return {
                id: item._id,
                title: item.title || item._title || 'Sport',
                subtitle: item.city || item.sportType || item._subtitle,
                coverImages: item.coverImages,
                coverImage: item.coverImage,
                galleryImages: item.galleryImages || item.images,
                image: pickBestCardImage(item, 'wide') || item.images?.[0] || item._image,
                registrationLink: item.registrationLink,
                runClubId: item.runClubId,
                listingHub: item.listingHub,
                slug: item.slug,
                _type: 'sport',
                _priority: item._priority,
            };
        }
        if (item._type === 'runclub') {
            return {
                _id: item._id,
                id: item._id,
                name: item.name || item._title,
                title: item.name || item._title || 'Run club',
                basedIn: item.basedIn || item._subtitle,
                subtitle: item.basedIn || item._subtitle,
                coverImage: item.coverImage || item._image,
                coverImages: item.coverImages,
                galleryImages: item.galleryImages,
                image: pickBestCardImage(item, 'portrait') || item.coverImage || item._image,
                listingHub: item.listingHub,
                slug: item.slug,
                _type: 'runclub',
                _priority: item._priority,
            };
        }
        if (item._type === 'events') {
            return {
                id: item._id,
                title: item.title || item._title || 'Event',
                subtitle: item.city || item.organizer || item._subtitle,
                coverImages: item.coverImages,
                coverImage: item.coverImage || item.poster || item.banner,
                galleryImages: item.galleryImages || item.images,
                image: pickBestCardImage(item, 'wide') || item.poster || item.banner || item._image,
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
                title: item.trekName || item._title || item.title || 'Trek',
                subtitle: communityName || item.city || '',
                coverImages: item.coverImages,
                coverImage: item.coverImage,
                galleryImages: item.galleryImages || item.images,
                image: pickBestCardImage(item, 'tall') || item.coverImage || item.images?.[0] || item._image,
                _type: 'trek',
                _priority: item._priority,
            };
        }
        if (item._type === 'community') {
            return {
                ...item,
                id: item._id || item.id,
                title: item.name || item._title || item.title || 'Community',
                subtitle: item.basedIn || item._subtitle,
                coverImages: item.coverImages,
                coverImage: item.coverImage,
                galleryImages: item.galleryImages,
                image: pickBestCardImage(item, 'portrait') || item.coverImage || item._image,
                _type: 'community',
                _priority: item._priority,
            };
        }
        return {
            ...item,
            id: item._id || item.id,
            title: item.title || item._title || item.name || 'Featured',
            coverImages: item.coverImages,
            coverImage: item.coverImage,
            galleryImages: item.galleryImages || item.images,
            _type: item._type,
            _priority: item._priority,
        };
    }).filter(Boolean).sort(byPriority);
}
