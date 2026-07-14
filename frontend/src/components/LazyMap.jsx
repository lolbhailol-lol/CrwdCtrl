import { useEffect, useRef, useState } from 'react';

function isHttpUrl(value) {
    return /^https?:\/\//i.test(String(value || '').trim());
}

/** Build Google Maps embed src from a place name or maps share URL. */
function mapsEmbedSrc(query, mapUrl) {
    const link = String(mapUrl || '').trim();
    if (link) {
        if (/output=embed/i.test(link)) return link;
        if (isHttpUrl(link)) {
            return `https://www.google.com/maps?q=${encodeURIComponent(link)}&z=14&output=embed`;
        }
        return `https://www.google.com/maps?q=${encodeURIComponent(link)}&z=14&output=embed`;
    }
    const q = String(query || '').trim();
    if (!q) return '';
    if (isHttpUrl(q)) {
        return `https://www.google.com/maps?q=${encodeURIComponent(q)}&z=14&output=embed`;
    }
    return `https://www.google.com/maps?q=${encodeURIComponent(q)}&z=12&output=embed`;
}

function mapsOpenHref(query, mapUrl) {
    const link = String(mapUrl || '').trim();
    if (link && isHttpUrl(link)) return link;
    const q = String(query || '').trim();
    if (!q) return '';
    if (isHttpUrl(q)) return q;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

/**
 * Google Maps embed — mounts iframe only when near viewport for faster scroll/load.
 * @param {string} [query] Place / address text (or maps URL)
 * @param {string} [mapUrl] Optional Google Maps / location link (preferred for open + embed)
 */
export default function LazyMap({ query, mapUrl, isDark, title = 'location-map' }) {
    const ref = useRef(null);
    const [show, setShow] = useState(false);

    const embedSrc = mapsEmbedSrc(query, mapUrl);
    const openHref = mapsOpenHref(query, mapUrl);
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

    if (!embedSrc) return null;

    return (
        <div ref={ref} className="absolute inset-0 w-full h-full overflow-hidden">
            <div className={`absolute inset-0 ${show ? '' : 'animate-pulse'} ${isDark ? 'bg-[#1D1E20]' : 'bg-gray-200'}`} />
            {show && (
                <iframe
                    title={title}
                    src={embedSrc}
                    width="100%"
                    height="100%"
                    className="absolute inset-0 w-full h-full"
                    style={{ border: 0 }}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                />
            )}
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
