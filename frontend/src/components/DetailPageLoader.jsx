import { useEffect } from 'react';
import { useDarkMode } from '../context/DarkModeContext';
import { usePageContentLoading } from '../hooks/usePageContentLoading';

/**
 * Full-screen detail-page loader — solid flat color (no header→page chrome gradient split).
 */
export default function DetailPageLoader() {
    const { isDark } = useDarkMode();
    usePageContentLoading(true);

    const bg = isDark ? '#000000' : '#ffffff';

    useEffect(() => {
        const html = document.documentElement;
        const body = document.body;
        const prevHtml = html.style.backgroundColor;
        const prevBody = body.style.backgroundColor;
        html.style.backgroundColor = bg;
        body.style.backgroundColor = bg;
        body.classList.add('detail-page-loading');
        return () => {
            html.style.backgroundColor = prevHtml;
            body.style.backgroundColor = prevBody;
            body.classList.remove('detail-page-loading');
        };
    }, [bg]);

    return (
        <div
            className="fixed inset-0 z-100050 flex items-center justify-center"
            style={{ backgroundColor: bg }}
            aria-busy="true"
            aria-live="polite"
        >
            <div
                className="w-8 h-8 rounded-full border-4 border-[#0ECCEE] border-t-transparent animate-spin"
                role="status"
                aria-label="Loading"
            />
        </div>
    );
}
