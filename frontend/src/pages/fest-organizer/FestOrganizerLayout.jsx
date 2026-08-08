import { useState } from 'react';
import { Outlet, useNavigate, useParams, useLocation } from 'react-router-dom';
import {
    LayoutDashboard, Users, QrCode, LogOut, PartyPopper, Bell, Menu, Home,
    Trophy, IndianRupee, Info, ClipboardList,
} from 'lucide-react';
import { clearFestOrganizerSession, getFestOrganizerSession } from '../../utils/festOrganizerSession';

const navForFest = (festId) => [
    { label: 'Overview', path: `/fest-organizer/fests/${festId}`, icon: LayoutDashboard, end: true, short: 'Home', group: 'primary' },
    { label: 'Stall / Leads', path: `/fest-organizer/fests/${festId}/leads`, icon: ClipboardList, short: 'Leads', group: 'primary' },
    { label: 'Competitions', path: `/fest-organizer/fests/${festId}/competitions`, icon: Trophy, short: 'Comps', group: 'primary' },
    { label: 'Participants', path: `/fest-organizer/fests/${festId}/participants`, icon: Users, short: 'Guests', group: 'primary' },
    { label: 'Check-in', path: `/fest-organizer/fests/${festId}/scan`, icon: QrCode, short: 'Scan', group: 'more' },
    { label: 'Revenue', path: `/fest-organizer/fests/${festId}/revenue`, icon: IndianRupee, short: '₹', group: 'more' },
    { label: 'Notify', path: `/fest-organizer/fests/${festId}/notifications`, icon: Bell, short: 'Notify', group: 'more' },
    { label: 'Fest info', path: `/fest-organizer/fests/${festId}/info`, icon: Info, short: 'Info', group: 'more' },
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

export default function FestOrganizerLayout() {
    const navigate = useNavigate();
    const location = useLocation();
    const params = useParams();
    const festId = params.festId
        || location.pathname.match(/\/fest-organizer\/fests\/([^/]+)/)?.[1]
        || null;
    const session = getFestOrganizerSession();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const logout = () => {
        clearFestOrganizerSession();
        navigate('/fest-organizer/login', { replace: true });
    };

    const nav = festId ? navForFest(festId) : [];
    const mobileNav = nav.filter((n) => n.group === 'primary');
    const activeFest = festId
        ? session?.fests?.find((f) => String(f._id) === String(festId))
        : null;

    return (
        <div className="min-h-dvh bg-[#0c0d0e] text-white flex">
            <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-[#121314]/95 backdrop-blur border-r border-white/10 transform transition-transform lg:translate-x-0 pt-[var(--safe-top)] ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="px-5 py-5 border-b border-white/10">
                    <div className="flex items-center gap-3">
                        <div className="size-10 rounded-2xl bg-linear-to-br from-[#0ECCEE]/25 to-[#053780]/40 border border-[#0ECCEE]/20 flex items-center justify-center">
                            <PartyPopper className="text-[#0ECCEE]" size={18} />
                        </div>
                        <div className="min-w-0">
                            <p className="font-semibold text-sm tracking-tight">Fest Organizer</p>
                            <p className="text-[11px] text-gray-500 truncate">
                                {session?.organizer?.displayName || session?.organizer?.name || 'Portal'}
                            </p>
                        </div>
                    </div>
                </div>
                <nav className="p-3 space-y-1 overflow-y-auto max-h-[calc(100dvh-9rem)] pb-24">
                    <OrgNavButton
                        to="/fest-organizer"
                        end
                        onNavigate={() => setSidebarOpen(false)}
                        className={({ isActive }) =>
                            `w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition ${
                                isActive ? 'bg-[#0ECCEE]/15 text-[#0ECCEE]' : 'text-gray-400 hover:bg-white/5 hover:text-white'
                            }`
                        }
                    >
                        <Home size={16} />
                        All fests
                    </OrgNavButton>

                    {activeFest ? (
                        <p className="px-3 pt-4 pb-1 text-[10px] uppercase tracking-wider text-gray-600 truncate">
                            {activeFest.festName}
                        </p>
                    ) : null}

                    {nav.map((item) => (
                        <OrgNavButton
                            key={item.path}
                            to={item.path}
                            end={item.end}
                            onNavigate={() => setSidebarOpen(false)}
                            className={({ isActive }) =>
                                `w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition ${
                                    isActive ? 'bg-[#0ECCEE]/15 text-[#0ECCEE]' : 'text-gray-400 hover:bg-white/5 hover:text-white'
                                }`
                            }
                        >
                            <item.icon size={16} />
                            {item.label}
                        </OrgNavButton>
                    ))}
                </nav>
                <div className="absolute bottom-0 inset-x-0 p-3 border-t border-white/10 bg-[#121314] pb-[max(0.75rem,var(--safe-bottom))]">
                    <button
                        type="button"
                        onClick={logout}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-400 hover:bg-white/5 hover:text-white"
                    >
                        <LogOut size={16} />
                        Sign out
                    </button>
                </div>
            </aside>

            {sidebarOpen ? (
                <button type="button" className="fixed inset-0 z-30 bg-black/50 lg:hidden" aria-label="Close menu" onClick={() => setSidebarOpen(false)} />
            ) : null}

            <div className="flex-1 lg:ml-64 min-w-0 flex flex-col min-h-dvh">
                <header className="sticky top-0 z-20 flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-[#0c0d0e]/90 backdrop-blur lg:hidden pt-[max(0.75rem,var(--safe-top))]">
                    <button type="button" onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg hover:bg-white/5">
                        <Menu size={20} />
                    </button>
                    <p className="text-sm font-medium truncate">{activeFest?.festName || 'Fest Organizer'}</p>
                </header>
                <main className="flex-1 p-4 sm:p-6 pb-[max(5rem,calc(var(--safe-bottom)+4rem))] lg:pb-6">
                    <Outlet />
                </main>
                {festId ? (
                    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-20 border-t border-white/10 bg-[#121314]/95 backdrop-blur flex pb-[var(--safe-bottom)]">
                        {mobileNav.map((item) => (
                            <OrgNavButton
                                key={item.path}
                                to={item.path}
                                end={item.end}
                                className={({ isActive }) =>
                                    `flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] ${
                                        isActive ? 'text-[#0ECCEE]' : 'text-gray-500'
                                    }`
                                }
                            >
                                <item.icon size={18} />
                                {item.short}
                            </OrgNavButton>
                        ))}
                    </nav>
                ) : null}
            </div>
        </div>
    );
}
