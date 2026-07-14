import { useEffect, useMemo, useRef, useState } from 'react';
import { API_BASE_URL } from '../services/api/client';

function isHttpUrl(value) {
    return /^https?:\/\//i.test(String(value || '').trim());
}

function isGoogleMapsShortLink(value) {
    try {
        const u = new URL(String(value || '').trim());
        return /(^|\.)(goo\.gl|maps\.app\.goo\.gl)$/i.test(u.hostname);
    } catch {
        return false;
    }
}

function extractCoords(urlString) {
    const s = String(urlString || '');
    const at = s.match(/@(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/);
    if (at) return { lat: Number(at[1]), lng: Number(at[2]) };
    const qll = s.match(/[?&](?:q|query)=(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/);
    if (qll) return { lat: Number(qll[1]), lng: Number(qll[2]) };
    return null;
}

function extractQueryParam(urlString) {
    try {
        const u = new URL(urlString);
        return (u.searchParams.get('q') || u.searchParams.get('query') || '').trim();
    } catch {
        return '';
    }
}

function extractPlaceName(urlString) {
    try {
        const u = new URL(urlString);
        const m = u.pathname.match(/\/maps\/place\/([^/]+)/i);
        if (m?.[1]) return decodeURIComponent(m[1].replace(/\+/g, ' '));
    } catch {
        /* ignore */
    }
    return '';
}

/** Local/sync embed builder — never puts a short link into q=. */
function mapsEmbedSrcLocal(query, mapUrl) {
    const link = String(mapUrl || '').trim();
    const fallback = String(query || '').trim();

    if (link && /output=embed/i.test(link)) return link;
    if (link && /\/maps\/embed/i.test(link)) return link;

    if (link && isHttpUrl(link) && !isGoogleMapsShortLink(link)) {
        const coords = extractCoords(link);
        if (coords) return `https://www.google.com/maps?q=${coords.lat},${coords.lng}&z=15&output=embed`;
        const qParam = extractQueryParam(link);
        if (qParam) return `https://www.google.com/maps?q=${encodeURIComponent(qParam)}&z=15&output=embed`;
        const place = extractPlaceName(link);
        if (place) return `https://www.google.com/maps?q=${encodeURIComponent(place)}&z=15&output=embed`;
    }

    if (fallback && !isHttpUrl(fallback)) {
        return `https://www.google.com/maps?q=${encodeURIComponent(fallback)}&z=15&output=embed`;
    }
    return '';
}

function mapsOpenHrefLocal(query, mapUrl) {
    const link = String(mapUrl || '').trim();
    if (link && isHttpUrl(link)) return link;
    const q = String(query || '').trim();
    if (!q) return '';
    if (isHttpUrl(q)) return q;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

/**
 * Google Maps embed — mounts iframe only when near viewport.
 * Short Google share links are resolved via /api/maps/embed so the exact pin works.
 */
export default function LazyMap({ query, mapUrl, isDark, title = 'location-map' }) {
    const ref = useRef(null);
    const [show, setShow] = useState(false);
    const [resolved, setResolved] = useState(null);

    const needsResolve = useMemo(() => isGoogleMapsShortLink(mapUrl), [mapUrl]);

    const fallbackEmbed = useMemo(() => mapsEmbedSrcLocal(query, mapUrl), [query, mapUrl]);
    const fallbackOpen = useMemo(() => mapsOpenHrefLocal(query, mapUrl), [query, mapUrl]);

    const embedSrc = resolved?.embedSrc || fallbackEmbed;
    const openHref = resolved?.openHref || fallbackOpen;
    const label = String(query || mapUrl || '').trim() || 'location';

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        if (typeof IntersectionObserver === 'undefined') {
            setShow(true);
            return;
        }
        const io = new IntersectionObserver(
            (entries) => {
                if (entries.some((e) => e.isIntersecting)) {
                    setShow(true);
                    io.disconnect();
                }
            },
            { rootMargin: '300px' },
        );
        io.observe(el);
        return () => io.disconnect();
    }, []);

    useEffect(() => {
        if (!needsResolve || !mapUrl) {
            setResolved(null);
            return;
        }
        let cancelled = false;
        const params = new URLSearchParams();
        params.set('url', String(mapUrl).trim());
        if (query) params.set('q', String(query).trim());

        (async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/maps/embed?${params.toString()}`);
                const data = await res.json().catch(() => null);
                if (!cancelled && data?.success && data.embedSrc) {
                    setResolved({ embedSrc: data.embedSrc, openHref: data.openHref || mapUrl });
                }
            } catch {
                /* keep venue fallback embed */
            }
        })();

        return () => { cancelled = true; };
    }, [needsResolve, mapUrl, query]);

    if (!embedSrc && !needsResolve) return null;

    return (
        <div ref={ref} className="absolute inset-0 w-full h-full overflow-hidden">
            <div className={`absolute inset-0 ${show && embedSrc ? '' : 'animate-pulse'} ${isDark ? 'bg-[#1D1E20]' : 'bg-gray-200'}`} />
            {show && embedSrc ? (
                <iframe
                    title={title}
                    src={embedSrc}
                    width="100%"
                    height="100%"
                    className="absolute inset-0 w-full h-full"
                    style={{ border: 0 }}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    allowFullScreen
                />
            ) : null}
            {openHref ? (
                <a
                    href={openHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute inset-0 z-10"
                    aria-label={`Open ${label} in Google Maps`}
                />
            ) : null}
        </div>
    );
}
