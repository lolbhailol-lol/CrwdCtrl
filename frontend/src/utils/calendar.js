/**
 * Helpers for "Add to Calendar" actions.
 * Builds a Google Calendar event-template URL that works in-app (via openExternalUrl) and on web.
 */

/** Format a Date into the Google Calendar UTC basic format: YYYYMMDDTHHMMSSZ */
function toGoogleDate(date) {
    const d = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/**
 * Build a Google Calendar URL.
 * @param {Object} opts
 * @param {string} opts.title
 * @param {Date|string|number} opts.start - event start
 * @param {Date|string|number} [opts.end] - event end (defaults to start + 2h)
 * @param {string} [opts.location]
 * @param {string} [opts.details]
 * @returns {string|null} the URL, or null if start is invalid
 */
export function buildGoogleCalendarUrl({ title, start, end, location, details }) {
    const startDate = start instanceof Date ? start : new Date(start);
    if (Number.isNaN(startDate.getTime())) return null;

    const endDate = end
        ? (end instanceof Date ? end : new Date(end))
        : new Date(startDate.getTime() + 2 * 60 * 60 * 1000);

    const gStart = toGoogleDate(startDate);
    const gEnd = toGoogleDate(endDate) || toGoogleDate(new Date(startDate.getTime() + 2 * 60 * 60 * 1000));

    const params = new URLSearchParams({
        action: 'TEMPLATE',
        text: title || 'Event',
        dates: `${gStart}/${gEnd}`,
    });
    if (location) params.set('location', location);
    if (details) params.set('details', details);

    return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
