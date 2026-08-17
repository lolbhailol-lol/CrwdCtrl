import { useState } from 'react';
import { Outlet, useNavigate, useParams, useLocation } from 'react-router-dom';
import { CalendarDays, LayoutDashboard, Users, QrCode, LogOut, Bell, Menu, Home, ArrowLeft, ExternalLink } from 'lucide-react';
import { clearRunClubOrganizerSession, getRunClubOrganizerSession } from '../../utils/runClubOrganizerSession';
import { organizerHubCopy } from '../../utils/listingHubCopy';

const navForEvent = (eventId) => [
    { label: 'Home', path: `/run-club-organizer/events/${eventId}`, icon: LayoutDashboard, end: true, short: 'Dash' },
    { label: 'Guests', path: `/run-club-organizer/events/${eventId}/participants`, icon: Users, short: 'Guests' },
    { label: 'Scan', path: `/run-club-organizer/events/${eventId}/scan`, icon: QrCode, short: 'Scan' },
    { label: 'Notify', path: `/run-club-organizer/events/${eventId}/notifications`, icon: Bell, short: 'Notify' },
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
    const isEventHub = true;
    const copy = organizerHubCopy(true);
    const BrandIcon = CalendarDays;

    const logout = () => {
        clearRunClubOrganizerSession();
        navigate('/run-club-organizer/login', { replace: true });
    };

    const hasEventContext = Boolean(eventId && eventId !== 'new');
    const nav = hasEventContext ? navForEvent(eventId) : [];
    const activeEvent = hasEventContext
        ? session?.events?.find((e) => String(e._id) === String(eventId))
        : null;

    return (
        <div className="min-h-dvh bg-[#0f1011] text-white flex">
            <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-[#161718] border-r border-gray-800 transform transition-transform lg:translate-x-0 pt-[var(--safe-top)] pb-[var(--safe-bottom)] ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="px-5 py-5 border-b border-gray-800">
                    <div className="flex items-center gap-2">
                        <BrandIcon className="text-[#0ECCEE]" size={22} />
                        <div>
                            <p className="font-bold text-sm">{copy.portalName}</p>
                            <p className="text-[11px] text-gray-500 truncate">
                                {session?.runClub?.name || session?.organizer?.name || 'Portal'}
                            </p>
                        </div>
                    </div>
                </div>
                <nav className="p-3 space-y-1">
                    <OrgNavButton
                        to="/run-club-organizer"
                        end
                        onNavigate={() => setSidebarOpen(false)}
                        className={({ isActive }) =>
                            `flex w-full items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                                isActive ? 'bg-[#0ECCEE]/15 text-[#0ECCEE]' : 'text-gray-400 hover:text-white hover:bg-white/5'
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
                                    isActive ? 'bg-[#0ECCEE]/15 text-[#0ECCEE]' : 'text-gray-400 hover:text-white hover:bg-white/5'
                                }`
                            }
                        >
                            <item.icon size={16} />
                            {item.label === 'Home' ? 'Dashboard' : item.label === 'Guests' ? 'Participants' : item.label}
                        </OrgNavButton>
                    ))}
                </nav>
                <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-gray-800 space-y-1">
                    <button
                        type="button"
                        onClick={() => {
                            setSidebarOpen(false);
                            navigate('/');
                        }}
                        className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg text-sm text-gray-300 hover:text-[#0ECCEE] hover:bg-white/5"
                    >
                        <ExternalLink size={16} /> Back to CrwdCtrl
                    </button>
                    <button type="button" onClick={logout} className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:text-red-400 hover:bg-red-500/10">
                        <LogOut size={16} /> Log out
                    </button>
                </div>
            </aside>

            <div className="flex-1 lg:ml-64 min-w-0 flex flex-col">
                <header className="sticky top-0 z-30 bg-[#0f1011]/95 backdrop-blur border-b border-gray-800 px-3 sm:px-4 py-3 flex items-center gap-2 pt-[max(0.75rem,var(--safe-top))]">
                    <button
                        type="button"
                        className="lg:hidden inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg text-gray-300 border border-gray-800 hover:bg-white/5"
                        onClick={() => setSidebarOpen((v) => !v)}
                        aria-label="Open menu"
                    >
                        <Menu size={20} />
                    </button>
                    <button
                        type="button"
                        onClick={() => navigate('/')}
                        className="lg:hidden inline-flex items-center gap-1 min-h-[44px] px-2.5 rounded-lg text-[#0ECCEE] text-xs font-semibold border border-[#0ECCEE]/25 hover:bg-[#0ECCEE]/10"
                        aria-label="Back to CrwdCtrl website"
                    >
                        <ArrowLeft size={14} />
                        Website
                    </button>
                    <div className="min-w-0 flex-1">
                        <p className="text-sm text-gray-300 truncate font-medium">
                            {activeEvent?.title || session?.runClub?.name || copy.portalName}
                        </p>
                        <p className="text-[11px] text-gray-500 truncate hidden sm:block">
                            {activeEvent ? copy.portalSubtitle : 'CrwdCtrl'}
                        </p>
                    </div>
                    {hasEventContext ? (
                        <button
                            type="button"
                            onClick={() => navigate('/run-club-organizer')}
                            className="text-xs text-[#0ECCEE] shrink-0 min-h-[44px] px-2 font-medium"
                        >
                            {copy.allEvents}
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={() => navigate('/')}
                            className="hidden lg:inline-flex items-center gap-1 text-xs text-[#0ECCEE] shrink-0 min-h-[44px] px-2 font-medium"
                        >
                            <ArrowLeft size={14} /> Website
                        </button>
                    )}
                </header>
                <main className={`flex-1 p-4 sm:p-6 max-w-7xl mx-auto w-full ${hasEventContext ? 'pb-[calc(5.5rem+var(--safe-bottom))] lg:pb-6' : ''}`}>
                    <Outlet />
                </main>
            </div>

            {hasEventContext ? (
                <nav
                    className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-gray-800 bg-[#161718]/95 backdrop-blur pb-[var(--safe-bottom)]"
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
                                    `relative flex flex-col items-center justify-center gap-0.5 py-2.5 min-h-[56px] text-[10px] font-medium transition-colors ${
                                        isActive ? 'text-[#0ECCEE]' : 'text-gray-500'
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

            {sidebarOpen ? <button type="button" className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} aria-label="Close menu" /> : null}
        </div>
    );
}
