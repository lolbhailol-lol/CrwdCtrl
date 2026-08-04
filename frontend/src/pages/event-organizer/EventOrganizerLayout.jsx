import { useState } from 'react';
import { Outlet, useNavigate, useParams, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, QrCode, LogOut, CalendarDays, Bell, Menu, Home, ExternalLink } from 'lucide-react';
import { clearEventOrganizerSession, getEventOrganizerSession } from '../../utils/eventShowOrganizerSession';

const navForEvent = (eventId) => [
    { label: 'Dashboard', path: `/event-organizer/events/${eventId}`, icon: LayoutDashboard, end: true },
    { label: 'Guests', path: `/event-organizer/events/${eventId}/participants`, icon: Users },
    { label: 'Scan', path: `/event-organizer/events/${eventId}/scan`, icon: QrCode },
    { label: 'Notify', path: `/event-organizer/events/${eventId}/notifications`, icon: Bell },
];

function pathIsActive(pathname, to, end = false) {
    if (end) return pathname === to;
    return pathname === to || pathname.startsWith(`${to}/`) || pathname.startsWith(`${to}?`);
}

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

export default function EventOrganizerLayout() {
    const navigate = useNavigate();
    const { eventId } = useParams();
    const session = getEventOrganizerSession();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const logout = () => {
        clearEventOrganizerSession();
        navigate('/event-organizer/login', { replace: true });
    };

    const hasEventContext = Boolean(eventId);
    const nav = hasEventContext ? navForEvent(eventId) : [];
    const activeEvent = hasEventContext
        ? session?.events?.find((e) => String(e._id) === String(eventId) || String(e.id) === String(eventId))
        : null;

    return (
        <div className="min-h-dvh bg-[#0f1011] text-white flex">
            <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-[#161718] border-r border-gray-800 transform transition-transform lg:translate-x-0 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="px-5 py-5 border-b border-gray-800">
                    <div className="flex items-center gap-2">
                        <CalendarDays className="text-[#0ECCEE]" size={22} />
                        <div>
                            <p className="font-bold text-sm">Event Organizer</p>
                            <p className="text-[11px] text-gray-500 truncate">
                                {session?.organizer?.name || 'Portal'}
                            </p>
                        </div>
                    </div>
                </div>
                <nav className="p-3 space-y-1">
                    <OrgNavButton
                        to="/event-organizer"
                        end
                        onNavigate={() => setSidebarOpen(false)}
                        className={({ isActive }) =>
                            `flex w-full items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                                isActive ? 'bg-[#0ECCEE]/15 text-[#0ECCEE]' : 'text-gray-400 hover:text-white hover:bg-white/5'
                            }`
                        }
                    >
                        <Home size={16} />
                        My events
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
                            {item.label}
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

            {sidebarOpen ? (
                <button
                    type="button"
                    className="fixed inset-0 z-30 bg-black/50 lg:hidden"
                    aria-label="Close menu"
                    onClick={() => setSidebarOpen(false)}
                />
            ) : null}

            <div className="flex-1 lg:ml-64 min-w-0 flex flex-col">
                <header className="sticky top-0 z-30 bg-[#0f1011]/95 backdrop-blur border-b border-gray-800 px-3 sm:px-4 py-3 flex items-center gap-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
                    <button
                        type="button"
                        className="lg:hidden p-2 rounded-lg border border-gray-800 text-gray-300"
                        onClick={() => setSidebarOpen(true)}
                        aria-label="Open menu"
                    >
                        <Menu size={18} />
                    </button>
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold truncate">
                            {activeEvent?.title || activeEvent?.displayName || (hasEventContext ? 'Event' : 'Events')}
                        </p>
                        {hasEventContext ? (
                            <p className="text-[11px] text-gray-500 truncate">
                                {activeEvent?.venue || activeEvent?.city || 'Organizer panel'}
                            </p>
                        ) : null}
                    </div>
                </header>
                <main className="flex-1 p-4 sm:p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
