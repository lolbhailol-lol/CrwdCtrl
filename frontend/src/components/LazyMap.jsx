import { useEffect, useRef, useState } from 'react';

/**
 * Google Maps embed — mounts iframe only when near viewport for faster scroll/load.
 */
export default function LazyMap({ query, isDark, title = 'location-map' }) {
    const ref = useRef(null);
    const [show, setShow] = useState(false);

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

    if (!query) return null;

    return (
        <div ref={ref} className="absolute inset-0 w-full h-full overflow-hidden">
            <div className={`absolute inset-0 ${show ? '' : 'animate-pulse'} ${isDark ? 'bg-[#1D1E20]' : 'bg-gray-200'}`} />
            {show && (
                <iframe
                    title={title}
                    src={`https://www.google.com/maps?q=${encodeURIComponent(query)}&z=12&output=embed`}
                    width="100%"
                    height="100%"
                    className="absolute inset-0 w-full h-full"
                    style={{ border: 0 }}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                />
            )}
            <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute inset-0 z-10"
                aria-label={`Open ${query} in Google Maps`}
            />
        </div>
    );
}
