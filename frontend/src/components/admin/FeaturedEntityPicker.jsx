import { useMemo } from 'react';

export const ENTITY_TYPE_LABELS = {
    fest: 'Fest',
    events: 'Event',
    trek: 'Trek',
    community: 'Community',
    sport: 'Sport',
    runclub: 'Run Club',
};

/** Build grouped <option> list for featured-item pickers. */
export function buildFeaturedEntityOptions({
    fests = [],
    eventShows = [],
    treks = [],
    communities = [],
    sports = [],
    runClubs = [],
    allowedTypes = ['fest', 'events', 'trek', 'community', 'sport', 'runclub'],
}) {
    const groups = [];

    if (allowedTypes.includes('fest') && fests.length) {
        groups.push({
            label: 'Fests',
            options: fests.map((f) => ({
                value: `fest:${f._id || f.id}`,
                label: f.festName || 'Untitled fest',
            })),
        });
    }
    if (allowedTypes.includes('events') && eventShows.length) {
        groups.push({
            label: 'Events & Shows',
            options: eventShows.map((e) => ({
                value: `events:${e._id}`,
                label: e.title || 'Untitled event',
            })),
        });
    }
    if (allowedTypes.includes('trek') && treks.length) {
        const communityName = (t) => {
            if (t?.communityId && typeof t.communityId === 'object') {
                return t.communityId.name || t.communityId.title || '';
            }
            const cid = t?.communityId;
            if (!cid) return '';
            const c = communities.find((x) => String(x._id) === String(cid));
            return c?.name || '';
        };
        groups.push({
            label: 'Treks',
            options: treks.map((t) => {
                const community = communityName(t);
                return {
                    value: `trek:${t._id}`,
                    label: community
                        ? `${t.trekName || 'Untitled trek'} · ${community}`
                        : (t.trekName || 'Untitled trek'),
                };
            }),
        });
    }
    if (allowedTypes.includes('community') && communities.length) {
        groups.push({
            label: 'Communities',
            options: communities.map((c) => ({
                value: `community:${c._id}`,
                label: c.name || 'Untitled community',
            })),
        });
    }
    if (allowedTypes.includes('sport') && sports.length) {
        groups.push({
            label: 'Sports runs',
            options: sports.map((s) => ({
                value: `sport:${s._id}`,
                label: s.title || 'Untitled run',
            })),
        });
    }
    if (allowedTypes.includes('runclub') && runClubs.length) {
        groups.push({
            label: 'Run clubs',
            options: runClubs.map((c) => ({
                value: `runclub:${c._id}`,
                label: c.name || 'Untitled club',
            })),
        });
    }

    return groups;
}

export function parseFeaturedEntityValue(value) {
    if (!value || !value.includes(':')) return null;
    const [entityType, ...rest] = value.split(':');
    const entityId = rest.join(':');
    if (!entityType || !entityId) return null;
    return { entityType, entityId };
}

export function formatFeaturedEntityValue(item) {
    if (!item?.entityType || !item?.entityId) return '';
    return `${item.entityType}:${item.entityId}`;
}

export function resolveFeaturedEntityLabel(item, catalogs) {
    if (!item?.entityType || !item?.entityId) return '';
    const id = item.entityId;
    const { fests = [], eventShows = [], treks = [], communities = [], sports = [], runClubs = [] } = catalogs || {};

    if (item.entityType === 'fest') {
        const f = fests.find((x) => (x._id || x.id) === id);
        return f?.festName || 'Fest';
    }
    if (item.entityType === 'events') {
        const e = eventShows.find((x) => x._id === id);
        return e?.title || 'Event';
    }
    if (item.entityType === 'trek') {
        const t = treks.find((x) => String(x._id) === String(id));
        if (!t) return 'Trek';
        let community = '';
        if (t.communityId && typeof t.communityId === 'object') {
            community = t.communityId.name || t.communityId.title || '';
        } else if (t.communityId) {
            community = communities.find((c) => String(c._id) === String(t.communityId))?.name || '';
        }
        return community ? `${t.trekName || 'Trek'} · ${community}` : (t.trekName || 'Trek');
    }
    if (item.entityType === 'community') {
        const c = communities.find((x) => x._id === id);
        return c?.name || 'Community';
    }
    if (item.entityType === 'sport') {
        const s = sports.find((x) => x._id === id);
        return s?.title || 'Sport';
    }
    if (item.entityType === 'runclub') {
        const c = runClubs.find((x) => x._id === id);
        return c?.name || 'Run club';
    }
    return ENTITY_TYPE_LABELS[item.entityType] || 'Item';
}

export default function FeaturedEntityPicker({
    value,
    onChange,
    groups,
    placeholder = '— None —',
    className = '',
    disabled = false,
}) {
    const selected = formatFeaturedEntityValue(value);

    const flatCount = useMemo(
        () => groups.reduce((sum, g) => sum + g.options.length, 0),
        [groups],
    );

    return (
        <select
            value={selected}
            onChange={(e) => {
                const parsed = parseFeaturedEntityValue(e.target.value);
                onChange(parsed);
            }}
            disabled={disabled || flatCount === 0}
            className={className || 'w-full bg-[#0D0E10] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#0ECCEE] disabled:opacity-50'}
        >
            <option value="" className="bg-[#0D0E10]">{placeholder}</option>
            {groups.map((group) => (
                <optgroup key={group.label} label={group.label} className="bg-[#0D0E10]">
                    {group.options.map((opt) => (
                        <option key={opt.value} value={opt.value} className="bg-[#0D0E10]">
                            {opt.label}
                        </option>
                    ))}
                </optgroup>
            ))}
        </select>
    );
}
