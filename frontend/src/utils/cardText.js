/** Display card labels in title case instead of ALL CAPS. */
export function toCardText(text) {
    if (!text || typeof text !== 'string') return '';
    const value = text.trim();
    if (!value) return '';

    return value
        .toLowerCase()
        .replace(/(^|[\s\-/&(])([a-z])/g, (_, sep, ch) => sep + ch.toUpperCase());
}
