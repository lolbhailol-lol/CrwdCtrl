import { useDarkMode } from '../context/DarkModeContext';
import { DetailLoader3DIcon } from './DetailPageLoader';

/** Full-screen route transition — 3D icon only (no skeleton blocks / footer flash). */
export default function PageTransitionSkeleton() {
    const { isDark } = useDarkMode();

    return (
        <div
            className={`fixed inset-0 z-100010 flex items-center justify-center overscroll-none ${
                isDark ? 'bg-[#161718]' : 'bg-white'
            }`}
            aria-hidden
            role="presentation"
        >
            <DetailLoader3DIcon variant="brand" size="md" tone={isDark ? 'dark' : 'light'} />
        </div>
    );
}
