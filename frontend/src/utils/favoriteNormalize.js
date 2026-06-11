/**
 * Normalize favorite payloads so names, images, and locations display consistently
 * regardless of which page added the favorite (home carousel, fest list, view-details, etc.).
 */

function pickString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function inferType(data = {}) {
  const explicit = pickString(data._type, data.type);
  if (explicit) return explicit.toLowerCase();

  if (data.festName || data.festDate) return 'fest';
  if (data.trekName || data.trekPageSection) return 'trek';
  if (data.runClubId || data.sportType) return 'sport';
  if (data.trekCategories) return 'community';
  if (data.basedIn && data.coverImage && !data.festName) return 'runclub';
  return 'fest';
}

export function favoriteDetailPath(id, type) {
  if (!id) return '/';
  const t = (type || 'fest').toLowerCase();
  if (t === 'trek') return `/trek/${id}`;
  if (t === 'community') return `/treks/community/${id}`;
  if (t === 'runclub' || t === 'run club') return `/sports/run-club/${id}`;
  if (t === 'sport' || t === 'sports' || t === 'run') return `/sports/run/${id}`;
  if (t === 'competition') return `/competitions-view-details/${id}`;
  return `/view-details/${id}`;
}

export function normalizeFavoriteEntry(eventId, eventData = {}) {
  const id = String(eventId || eventData.id || eventData._id || '').trim();
  const type = inferType(eventData);

  const title = pickString(
    eventData.title,
    eventData.name,
    eventData.festName,
    eventData.trekName,
    eventData.eventName,
    eventData._title,
  ) || 'Unnamed Event';

  const subtitle = pickString(
    eventData.subtitle,
    eventData.collegeName,
    eventData.college,
    eventData.basedIn,
    eventData.organizing_body,
    eventData.city,
    eventData.sportType,
    eventData._subtitle,
  );

  const image = pickString(
    eventData.heroImage,
    eventData.image,
    eventData.coverImage,
    eventData.festImages?.[0],
    eventData.galleryImages?.[0],
    eventData.images?.[0],
    eventData._image,
  );

  const venue = pickString(eventData.venue, eventData.location);

  const dateTime = pickString(
    eventData.dateTime,
    eventData.date,
    eventData.festDate,
    eventData.eventDate,
  );

  return {
    id,
    _id: id,
    type,
    _type: type,
    title,
    name: title,
    festName: type === 'fest' ? title : undefined,
    subtitle,
    college: subtitle,
    collegeName: subtitle,
    basedIn: subtitle,
    heroImage: image,
    image,
    coverImage: image,
    venue,
    location: venue,
    dateTime,
    ticketPrice: eventData.ticketPrice ?? eventData.feeAmount ?? null,
    detailPath: favoriteDetailPath(id, type),
    addedAt: eventData.addedAt || new Date().toISOString(),
  };
}

export function favoriteBasedInLabel(favorite) {
  const location = pickString(
    favorite?.subtitle,
    favorite?.collegeName,
    favorite?.college,
    favorite?.basedIn,
    favorite?.venue,
    favorite?.location,
  );
  if (!location) return 'Based in India';
  if (/^based in/i.test(location)) return location;
  return `Based in ${location}`;
}
