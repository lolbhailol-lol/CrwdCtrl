/**
 * Public website origin for emails and organizer login links.
 * Always www — apex crwdctrl.in is often attached to the API and shows Railway 404.
 */
function getCanonicalSiteUrl() {
    const raw = String(
        process.env.FRONTEND_URL
        || process.env.PUBLIC_WEB_URL
        || 'https://www.crwdctrl.in',
    ).trim().replace(/\/$/, '');
    try {
        const u = new URL(raw.includes('://') ? raw : `https://${raw}`);
        if (u.hostname === 'crwdctrl.in') {
            u.hostname = 'www.crwdctrl.in';
        }
        if (u.protocol !== 'https:' && u.hostname !== 'localhost') {
            u.protocol = 'https:';
        }
        return `${u.protocol}//${u.host}`.replace(/\/$/, '');
    } catch {
        return 'https://www.crwdctrl.in';
    }
}

module.exports = { getCanonicalSiteUrl };
