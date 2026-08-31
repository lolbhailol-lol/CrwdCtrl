import { useState } from 'react';
import { Outlet, useNavigate, useParams, useLocation } from 'react-router-dom';
import { CalendarDays, LayoutDashboard, Users, QrCode, LogOut, Bell, Menu, Home, ExternalLink } from 'lucide-react';
import { markRunClubOrganizerLoggedOut, getRunClubOrganizerSession } from '../../utils/runClubOrganizerSession';
import { organizerHubCopy } from '../../utils/listingHubCopy';
import { EVENT_COMMUNITY_ORGANIZER_BASE, organizerEventPath, organizerHomePath } from '../../utils/organizerPortalPaths';
import Seo from '../../components/Seo';

const navForEvent = (eventId) => [
    { label: 'Home', path: organizerEventPath(eventId, true), icon: LayoutDashboard, end: true, short: 'Dash' },
    { label: 'Guests', path: organizerEventPath(eventId, true, 'participants'), icon: Users, short: 'Guests' },
    { label: 'Scan', path: organizerEventPath(eventId, true, 'scan'), icon: QrCode, short: 'Scan' },
    { label: 'Notify', path: organizerEventPath(eventId, true, 'notifications'), icon: Bell, short: 'Notify' },
];

function pathIsActive(pathname, to, end = false) {
    if (end) return pathname === to;
    return pathname === to || pathname.startsWith(`${to}/`) || pathname.startsWith(`${to}?`);
}

/** Button nav — avoids <a href> full-document loads that some WebViews treat as HTML downloads */
function OrgNavButton({ to, end = false, className, onNavigate, children, ...rest }) {
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const isActive = pathIsActive(pathname, to, end);
    const resolvedClass = typeof className === 'function' ? className({ isActive }) : className;

    return (
        <button
            type="button"
            {...rest}
            className={resolvedClass}
            onClick={() => {
                onNavigate?.();
                if (pathname !== to) navigate(to);
            }}
        >
            {children}
        </button>
    );
}

export default function EventCommunityOrganizerLayout() {
    const navigate = useNavigate();
    const { eventId } = useParams();
    const session = getRunClubOrganizerSession();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const copy = organizerHubCopy(true);
    const BrandIcon = CalendarDays;

    const logout = () => {
        setSidebarOpen(false);
        markRunClubOrganizerLoggedOut();
        navigate(`${EVENT_COMMUNITY_ORGANIZER_BASE}/login`, { replace: true });
    };

    const hasEventContext = Boolean(eventId && eventId !== 'new');
    const nav = hasEventContext ? navForEvent(eventId) : [];
    const activeEvent = hasEventContext
        ? session?.events?.find((e) => String(e._id) === String(eventId))
        : null;

    return (
        <div className="min-h-dvh bg-[#0f1011] text-white flex">
            <Seo
                title={hasEventContext && activeEvent?.title
                    ? `${activeEvent.title} — Community Organizer`
                    : 'Community Organizer'}
                description="Manage your event community — guests, check-ins and notifications."
                canonical={hasEventContext ? organizerEventPath(eventId, true) : organizerHomePath(true)}
                noindex
            />
            <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#161718] border-r border-white/10 transform transition-transform lg:translate-x-0 pt-[var(--safe-top)] pb-[var(--safe-bottom)] flex flex-col ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="px-5 py-5 border-b border-white/10 shrink-0">
                    <div className="flex items-center gap-2.5">
                        <BrandIcon className="text-[#0ECCEE]" size={20} />
                        <div className="min-w-0">
                            <p className="font-semibold text-sm truncate">{copy.portalName}</p>
                            <p className="text-[11px] text-gray-500 truncate">
                                {session?.runClub?.name || session?.organizer?.name || 'Portal'}
                            </p>
                        </div>
                    </div>
                </div>
                <nav className="flex-1 min-h-0 overflow-y-auto p-3 space-y-0.5">
                    <OrgNavButton
                        to={organizerHomePath(true)}
                        end
                        onNavigate={() => setSidebarOpen(false)}
                        className={({ isActive }) =>
                            `flex w-full items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                                isActive ? 'bg-[#0ECCEE]/12 text-[#0ECCEE]' : 'text-gray-400 hover:text-white hover:bg-white/5'
                            }`
                        }
                    >
                        <Home size={16} />
                        {copy.clubHome}
                    </OrgNavButton>
                    {nav.map((item) => (
                        <OrgNavButton
                            key={item.path}
                            to={item.path}
                            end={item.end}
                            onNavigate={() => setSidebarOpen(false)}
                            className={({ isActive }) =>
                                `flex w-full items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                                    isActive ? 'bg-[#0ECCEE]/12 text-[#0ECCEE]' : 'text-gray-400 hover:text-white hover:bg-white/5'
                                }`
                            }
                        >
                            <item.icon size={16} />
                            {item.label === 'Home' ? 'Dashboard' : item.label === 'Guests' ? 'Participants' : item.label}
                        </OrgNavButton>
                    ))}
                </nav>
                <div className="shrink-0 p-3 border-t border-white/10 space-y-1 bg-[#161718]">
                    <button
                        type="button"
                        onClick={() => {
                            setSidebarOpen(false);
                            navigate('/');
                        }}
                        className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5"
                    >
                        <ExternalLink size={16} /> Website
                    </button>
                    <button
                        type="button"
                        onClick={logout}
                        className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:text-red-400 hover:bg-white/5"
                    >
                        <LogOut size={16} /> Log out
                    </button>
                </div>
            </aside>

            <div className="flex-1 lg:ml-64 min-w-0 flex flex-col">
                <header className="sticky top-0 z-30 bg-[#0f1011]/95 backdrop-blur border-b border-white/10 px-3 sm:px-4 py-2.5 flex items-center gap-2 pt-[max(0.65rem,var(--safe-top))]">
                    <button
                        type="button"
                        className="lg:hidden inline-flex items-center justify-center size-10 rounded-lg text-gray-400 hover:text-white"
                        onClick={() => setSidebarOpen((v) => !v)}
                        aria-label="Open menu"
                    >
                        <Menu size={20} />
                    </button>
                    <div className="min-w-0 flex-1">
                        <p className="text-sm text-white truncate font-medium">
                            {activeEvent?.title || session?.runClub?.name || copy.portalName}
                        </p>
                    </div>
                    {hasEventContext ? (
                        <button
                            type="button"
                            onClick={() => navigate(organizerHomePath(true))}
                            className="text-xs text-[#0ECCEE]/80 hover:text-[#0ECCEE] min-h-10 px-2 shrink-0"
                        >
                            {copy.allEvents}
                        </button>
                    ) : null}
                    <button
                        type="button"
                        onClick={logout}
                        className="inline-flex items-center justify-center size-10 rounded-lg text-gray-400 hover:text-red-400"
                        aria-label="Log out"
                    >
                        <LogOut size={16} />
                    </button>
                </header>
                <main className={`flex-1 p-4 sm:p-6 max-w-7xl mx-auto w-full ${hasEventContext ? 'pb-[calc(5.5rem+var(--safe-bottom))] lg:pb-6' : ''}`}>
                    <Outlet />
                </main>
            </div>

            {hasEventContext && !sidebarOpen ? (
                <nav
                    className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-white/10 bg-[#161718]/95 backdrop-blur pb-[var(--safe-bottom)]"
                    aria-label={copy.navAria}
                >
                    <div className="grid grid-cols-4">
                        {nav.map((item) => {
                            const pendingBadge = item.short === 'Guests'
                                && Number(activeEvent?.registrationFee) > 0
                                ? Number(activeEvent?.pendingPaymentReview || 0)
                                : 0;
                            return (
                                <OrgNavButton
                                    key={item.path}
                                    to={item.path}
                                    end={item.end}
                                    className={({ isActive }) =>
                                        `relative flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] text-[10px] font-medium transition-colors border-t-2 ${
                                            isActive
                                                ? 'text-[#0ECCEE] border-[#0ECCEE]'
                                                : 'text-gray-500 border-transparent'
                                        }`
                                    }
                                >
                                    <span className="relative">
                                        <item.icon size={20} strokeWidth={2} />
                                        {pendingBadge > 0 ? (
                                            <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-amber-500 text-[9px] font-bold text-black flex items-center justify-center">
                                                {pendingBadge > 99 ? '99+' : pendingBadge}
                                            </span>
                                        ) : null}
                                    </span>
                                    {item.short}
                                </OrgNavButton>
                            );
                        })}
                    </div>
                </nav>
            ) : null}

            {sidebarOpen ? <button type="button" className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} aria-label="Close menu" /> : null}
        </div>
    );
}
