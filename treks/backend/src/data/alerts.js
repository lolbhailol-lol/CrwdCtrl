/**
 * Regional advisories are not seeded — an advisory a user sees must come from a
 * real report. Trail-level warnings are derived from live status + community
 * updates instead. Kept as a module so /api/alerts stays a valid endpoint.
 */

export const alerts = []

export default alerts
