import { useDarkMode } from '../context/DarkModeContext';

function Shimmer({ className = '' }) {
    const { isDark } = useDarkMode();
    return (
        <div
            className={`skeleton-shimmer block ${
                isDark ? 'skeleton-shimmer-dark' : 'skeleton-shimmer-light'
            } ${className}`}
        />
    );
}

function ProfileAvatarSkeleton({ sizeClass = 'size-20', isDark = false, className = '' }) {
    return (
        <div
            className={`relative shrink-0 overflow-hidden rounded-full ${sizeClass} ${
                isDark ? 'bg-gray-700' : 'bg-gray-200'
            } ${className}`}
        >
            <Shimmer className="absolute inset-0 rounded-full" />
        </div>
    );
}

function ProfileMenuItemSkeleton({ mobile = false, isDark = false }) {
    return (
        <div
            className={`w-full flex items-center justify-between rounded-2xl border p-4 shadow-lg ${
                isDark
                    ? 'border-gray-800 bg-[#111213]'
                    : 'border-gray-100 bg-white'
            }`}
        >
            <div className={`flex items-center ${mobile ? 'gap-4' : 'gap-3'}`}>
                <div
                    className={`flex shrink-0 items-center justify-center rounded-full ${
                        mobile ? 'size-12' : 'size-10'
                    } ${isDark ? 'bg-[#0ECCEE]/15' : 'bg-[#0ECCEE]/10'}`}
                >
                    <Shimmer className={`rounded-full ${mobile ? 'size-6' : 'size-5'}`} />
                </div>
                <Shimmer className={`rounded-md ${mobile ? 'h-5 w-36' : 'h-4 w-28'}`} />
            </div>
            <Shimmer className={`shrink-0 rounded-md ${mobile ? 'size-6' : 'size-5'}`} />
        </div>
    );
}

function ProfileLogoutButtonSkeleton({ mobile = false }) {
    return (
        <div className="relative h-14 w-full overflow-hidden rounded-2xl bg-[#0ECCEE]/25">
            <Shimmer className="absolute inset-0 rounded-2xl opacity-70" />
            <div className="absolute inset-0 flex items-center justify-center">
                <Shimmer className={`rounded-md ${mobile ? 'h-5 w-24' : 'h-4 w-20'}`} />
            </div>
        </div>
    );
}

/** Profile sidebar overlay — desktop drawer or mobile full-screen */
export default function ProfileSidebarLoadingSkeleton({
    variant = 'mobile',
    menuCount = 4,
    isDark = false,
}) {
    if (variant === 'desktop') {
        return (
            <>
                <div className="px-6 pt-2 pb-6">
                    <div className="flex items-center gap-4">
                        <ProfileAvatarSkeleton isDark={isDark} />
                        <div className="min-w-0 flex-1 space-y-2.5">
                            <Shimmer className="h-6 w-36 rounded-md" />
                            <Shimmer className="h-4 w-48 max-w-full rounded-md" />
                        </div>
                    </div>
                </div>
                <div className="space-y-1.5 px-6 py-2">
                    <ProfileMenuItemSkeleton isDark={isDark} />
                    <ProfileMenuItemSkeleton isDark={isDark} />
                </div>
                <div className="space-y-1.5 px-6 pt-0 pb-2">
                    <ProfileMenuItemSkeleton isDark={isDark} />
                </div>
                <div className="px-6 pt-2 pb-6">
                    <ProfileLogoutButtonSkeleton />
                </div>
            </>
        );
    }

    return (
        <div className="px-2.5 py-6 sm:px-4">
            <div className="flex flex-col items-center pb-6">
                <ProfileAvatarSkeleton sizeClass="size-28" isDark={isDark} className="mb-3" />
                <Shimmer className="mb-2 h-6 w-32 rounded-md" />
                <Shimmer className="h-4 w-20 rounded-md" />
            </div>
            <div className="py-2">
                <div className="space-y-3">
                    {Array.from({ length: menuCount }).map((_, index) => (
                        <ProfileMenuItemSkeleton key={index} mobile isDark={isDark} />
                    ))}
                </div>
            </div>
            <div className="pt-2 pb-2">
                <ProfileLogoutButtonSkeleton mobile />
            </div>
        </div>
    );
}
