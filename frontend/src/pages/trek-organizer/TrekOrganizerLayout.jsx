import { useState } from 'react';
import { Outlet, useNavigate, useParams, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, QrCode, LogOut, Mountain, Bell, Menu, Home, ContactRound } from 'lucide-react';
import { markTrekOrganizerLoggedOut, getTrekOrganizerSession } from '../../utils/trekOrganizerSession';
import { navActiveClass, navIdleClass } from './organizerTheme';

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
        setSidebarOpen(false);
        markTrekOrganizerLoggedOut();
        navigate('/trek-organizer/login', { replace: true });
    };

    const nav = trekId ? navForTrek(trekId) : [];
    const activeTrek = trekId
        ? session?.treks?.find((t) => String(t._id) === String(trekId))
        : null;
    const onCustomers = pathname.includes('/customers');
    const onDashboard = Boolean(trekId) && pathIsActive(pathname, `/trek-organizer/treks/${trekId}`, true);

    return (
        <div className="min-h-dvh bg-[#0c0d0e] text-white flex">
            <aside
                className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#121314]/95 backdrop-blur border-r border-white/10 transform transition-transform lg:translate-x-0 pt-[var(--safe-top)] pb-[var(--safe-bottom)] flex flex-col ${
                    sidebarOpen ? 'translate-x-0' : '-translate-x-full'
                }`}
            >
                <div className="relative px-5 py-5 border-b border-white/10 overflow-hidden shrink-0">
                    <div className="absolute inset-0 bg-linear-to-br from-[#0ECCEE]/12 via-transparent to-[#053780]/25 pointer-events-none" />
                    <div className="relative flex items-center gap-3">
                        <div className="size-11 rounded-2xl bg-linear-to-br from-[#0ECCEE]/30 to-[#053780]/50 border border-[#0ECCEE]/30 flex items-center justify-center shadow-[0_0_24px_rgba(14,204,238,0.12)]">
                            <Mountain className="text-[#0ECCEE]" size={18} />
                        </div>
                        <div className="min-w-0">
                            <p className="font-semibold text-sm tracking-tight">Ops Console</p>
                            <p className="text-[11px] text-gray-400 truncate">
                                {session?.community?.name || session?.organizer?.name || 'Trek Organizer'}
                            </p>
                        </div>
                    </div>
                    {activeTrek ? (
                        <div className="relative mt-3 rounded-xl border border-[#0ECCEE]/20 bg-[#0ECCEE]/8 px-3 py-2">
                            <div className="flex items-center gap-2">
                                {onDashboard ? (
                                    <span className="relative flex size-2 shrink-0">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#0ECCEE] opacity-60" />
                                        <span className="relative inline-flex rounded-full size-2 bg-[#0ECCEE]" />
                                    </span>
                                ) : (
                                    <span className="size-2 rounded-full bg-[#0ECCEE]/60 shrink-0" />
                                )}
                                <p className="text-[11px] font-medium text-[#9BE8F7] truncate">{activeTrek.trekName}</p>
                            </div>
                        </div>
                    ) : null}
                </div>

                <nav className="flex-1 min-h-0 overflow-y-auto p-3 space-y-1">
                    <p className="px-3 pt-1 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-600">
                        Community
                    </p>
                    <OrgNavButton
                        to="/trek-organizer"
                        end
                        onNavigate={() => setSidebarOpen(false)}
                        className={({ isActive }) =>
                            `flex w-full items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-left ${
                                isActive ? navActiveClass : navIdleClass
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
                                    isActive ? navActiveClass : navIdleClass
                                }`
                            }
                        >
                            <item.icon size={16} />
                            {item.label}
                        </OrgNavButton>
                    ))}

                    {nav.length > 0 ? (
                        <>
                            <p className="px-3 pt-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-600">
                                This trek
                            </p>
                            {nav.map((item) => (
                                <OrgNavButton
                                    key={item.path}
                                    to={item.path}
                                    end={item.end}
                                    onNavigate={() => setSidebarOpen(false)}
                                    className={({ isActive }) =>
                                        `flex w-full items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-left ${
                                            isActive ? navActiveClass : navIdleClass
                                        }`
                                    }
                                >
                                    <item.icon size={16} />
                                    {item.label}
                                </OrgNavButton>
                            ))}
                        </>
                    ) : null}
                </nav>

                <div className="shrink-0 p-3 border-t border-white/10 bg-[#121314]">
                    <button
                        type="button"
                        onClick={logout}
                        className="flex items-center gap-2 w-full px-3 py-3 min-h-11 rounded-xl text-sm font-medium text-gray-300 border border-white/10 hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/10"
                    >
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
                                || 'Ops Console'}
                        </p>
                        <p className="text-[11px] text-gray-500 truncate hidden sm:block">
                            {activeTrek
                                ? (onDashboard ? 'Live trek dashboard' : 'Trek tools')
                                : onCustomers
                                    ? 'Community guests'
                                    : 'Track all treks'}
                        </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                        {trekId ? (
                            <button
                                type="button"
                                onClick={() => navigate('/trek-organizer')}
                                className="text-xs text-[#0ECCEE] min-h-11 px-2 font-medium"
                            >
                                All treks
                            </button>
                        ) : !onCustomers ? (
                            <button
                                type="button"
                                onClick={() => navigate('/trek-organizer/customers')}
                                className="text-xs text-[#0ECCEE] min-h-11 px-2 font-medium"
                            >
                                Customers
                            </button>
                        ) : null}
                        <button
                            type="button"
                            onClick={logout}
                            className="inline-flex items-center justify-center gap-1.5 min-h-11 min-w-11 px-2.5 rounded-xl text-gray-400 border border-white/10 hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/10"
                            aria-label="Log out"
                            title="Log out"
                        >
                            <LogOut size={16} />
                            <span className="text-xs font-medium hidden sm:inline">Log out</span>
                        </button>
                    </div>
                </header>
                <main className={`flex-1 w-full min-w-0 p-4 sm:p-5 lg:p-6 xl:p-8 ${trekId ? 'pb-[calc(5.5rem+var(--safe-bottom))] lg:pb-6' : ''}`}>
                    <Outlet />
                </main>
            </div>

            {trekId && !sidebarOpen ? (
                <nav
                    className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-white/10 bg-[#121314]/95 backdrop-blur pb-[var(--safe-bottom)]"
                    aria-label="Trek tools"
                >
                    <div className="grid grid-cols-5">
                        {nav.map((item) => {
                            const isActive = pathIsActive(pathname, item.path, item.end);
                            return (
                                <OrgNavButton
                                    key={item.path}
                                    to={item.path}
                                    end={item.end}
                                    className={`relative flex flex-col items-center justify-center gap-0.5 py-2.5 min-h-[56px] text-[10px] font-medium transition-colors ${
                                        isActive ? 'text-[#0ECCEE]' : 'text-gray-500'
                                    }`}
                                >
                                    <item.icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                                    <span>{item.short}</span>
                                    {isActive ? (
                                        <span className="absolute bottom-1 left-1/2 -translate-x-1/2 h-0.5 w-6 rounded-full bg-[#0ECCEE]" />
                                    ) : null}
                                </OrgNavButton>
                            );
                        })}
                    </div>
                </nav>
            ) : null}

            {sidebarOpen ? (
                <button type="button" className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} aria-label="Close menu" />
            ) : null}
        </div>
    );
}
