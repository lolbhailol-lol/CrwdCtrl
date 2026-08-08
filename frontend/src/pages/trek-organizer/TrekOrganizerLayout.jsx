import { useState } from 'react';
import { Outlet, useNavigate, useParams, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, QrCode, LogOut, Mountain, Bell, Menu, Home, ContactRound } from 'lucide-react';
import { clearTrekOrganizerSession, getTrekOrganizerSession } from '../../utils/trekOrganizerSession';

const navForTrek = (trekId) => [
    { label: 'Dashboard', path: `/trek-organizer/treks/${trekId}`, icon: LayoutDashboard, end: true, short: 'Dash' },
    { label: 'Participants', path: `/trek-organizer/treks/${trekId}/participants`, icon: Users, short: 'Guests' },
    { label: 'Customers', path: `/trek-organizer/treks/${trekId}/customers`, icon: ContactRound, short: 'CRM' },
    { label: 'Scan QR', path: `/trek-organizer/treks/${trekId}/scan`, icon: QrCode, short: 'Scan' },
    { label: 'Notify', path: `/trek-organizer/treks/${trekId}/notifications`, icon: Bell, short: 'Notify' },
];

const communityNav = [
    { label: 'Customers', path: '/trek-organizer/customers', icon: ContactRound, end: true, short: 'CRM' },
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

export default function TrekOrganizerLayout() {
    const navigate = useNavigate();
    const { trekId } = useParams();
    const { pathname } = useLocation();
    const session = getTrekOrganizerSession();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const logout = () => {
        clearTrekOrganizerSession();
        navigate('/trek-organizer/login', { replace: true });
    };

    const nav = trekId ? navForTrek(trekId) : [];
    const activeTrek = trekId
        ? session?.treks?.find((t) => String(t._id) === String(trekId))
        : null;
    const onCustomers = pathname.includes('/customers');

    return (
        <div className="min-h-dvh bg-[#0c0d0e] text-white flex">
            <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-[#121314]/95 backdrop-blur border-r border-white/10 transform transition-transform lg:translate-x-0 pt-[var(--safe-top)] pb-[var(--safe-bottom)] ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="px-5 py-5 border-b border-white/10">
                    <div className="flex items-center gap-3">
                        <div className="size-10 rounded-2xl bg-linear-to-br from-[#0ECCEE]/25 to-[#053780]/40 border border-[#0ECCEE]/20 flex items-center justify-center">
                            <Mountain className="text-[#0ECCEE]" size={18} />
                        </div>
                        <div className="min-w-0">
                            <p className="font-semibold text-sm tracking-tight">Community Organizer</p>
                            <p className="text-[11px] text-gray-500 truncate">
                                {session?.community?.name || session?.organizer?.name || 'Portal'}
                            </p>
                        </div>
                    </div>
                </div>
                <nav className="p-3 space-y-1">
                    <OrgNavButton
                        to="/trek-organizer"
                        end
                        onNavigate={() => setSidebarOpen(false)}
                        className={({ isActive }) =>
                            `flex w-full items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-left ${
                                isActive ? 'bg-[#0ECCEE]/15 text-[#0ECCEE] border border-[#0ECCEE]/20' : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                            }`
                        }
                    >
                        <Home size={16} />
                        Community home
                    </OrgNavButton>
                    {communityNav.map((item) => (
                        <OrgNavButton
                            key={item.path}
                            to={item.path}
                            end={item.end}
                            onNavigate={() => setSidebarOpen(false)}
                            className={({ isActive }) =>
                                `flex w-full items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-left ${
                                    isActive ? 'bg-[#0ECCEE]/15 text-[#0ECCEE] border border-[#0ECCEE]/20' : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                                }`
                            }
                        >
                            <item.icon size={16} />
                            {item.label}
                        </OrgNavButton>
                    ))}
                    {nav.map((item) => (
                        <OrgNavButton
                            key={item.path}
                            to={item.path}
                            end={item.end}
                            onNavigate={() => setSidebarOpen(false)}
                            className={({ isActive }) =>
                                `flex w-full items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-left ${
                                    isActive ? 'bg-[#0ECCEE]/15 text-[#0ECCEE] border border-[#0ECCEE]/20' : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                                }`
                            }
                        >
                            <item.icon size={16} />
                            {item.label}
                        </OrgNavButton>
                    ))}
                </nav>
                <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-white/10">
                    <button type="button" onClick={logout} className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl text-sm text-gray-400 hover:text-red-400 hover:bg-red-500/10">
                        <LogOut size={16} /> Log out
                    </button>
                </div>
            </aside>

            <div className="flex-1 lg:ml-64 min-w-0 flex flex-col">
                <header className="sticky top-0 z-30 bg-[#0c0d0e]/90 backdrop-blur border-b border-white/10 px-4 py-3 flex items-center justify-between gap-3 pt-[max(0.75rem,var(--safe-top))]">
                    <button
                        type="button"
                        className="lg:hidden inline-flex items-center justify-center gap-2 min-h-[44px] min-w-[44px] px-3 rounded-xl text-gray-300 border border-white/10 hover:bg-white/5"
                        onClick={() => setSidebarOpen((v) => !v)}
                        aria-label="Open menu"
                    >
                        <Menu size={20} />
                        <span className="text-sm font-medium">Menu</span>
                    </button>
                    <div className="min-w-0 flex-1 text-right sm:text-left">
                        <p className="text-sm text-gray-200 truncate font-medium">
                            {activeTrek?.trekName
                                || (onCustomers ? 'Customers' : null)
                                || session?.community?.name
                                || 'Community Organizer'}
                        </p>
                        <p className="text-[11px] text-gray-500 truncate hidden sm:block">
                            {activeTrek ? 'Trek dashboard' : onCustomers ? 'Community guests' : 'Community home'}
                        </p>
                    </div>
                    {trekId ? (
                        <button
                            type="button"
                            onClick={() => navigate('/trek-organizer')}
                            className="text-xs text-[#0ECCEE] shrink-0 min-h-[44px] px-2 font-medium"
                        >
                            All treks
                        </button>
                    ) : !onCustomers ? (
                        <button
                            type="button"
                            onClick={() => navigate('/trek-organizer/customers')}
                            className="text-xs text-[#0ECCEE] shrink-0 min-h-[44px] px-2 font-medium"
                        >
                            Customers
                        </button>
                    ) : null}
                </header>
                <main className={`flex-1 p-4 sm:p-6 max-w-7xl mx-auto w-full ${trekId ? 'pb-[calc(5.5rem+var(--safe-bottom))] lg:pb-6' : ''}`}>
                    <Outlet />
                </main>
            </div>

            {trekId ? (
                <nav
                    className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-white/10 bg-[#121314]/95 backdrop-blur pb-[var(--safe-bottom)]"
                    aria-label="Trek tools"
                >
                    <div className="grid grid-cols-5">
                        {nav.map((item) => (
                            <OrgNavButton
                                key={item.path}
                                to={item.path}
                                end={item.end}
                                className={({ isActive }) =>
                                    `flex flex-col items-center justify-center gap-0.5 py-2.5 min-h-[56px] text-[10px] font-medium ${
                                        isActive ? 'text-[#0ECCEE]' : 'text-gray-500'
                                    }`
                                }
                            >
                                <item.icon size={18} />
                                {item.short}
                            </OrgNavButton>
                        ))}
                    </div>
                </nav>
            ) : null}

            {sidebarOpen ? (
                <button type="button" className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} aria-label="Close menu" />
            ) : null}
        </div>
    );
}
