import { useEffect, useState } from 'react';
import { Outlet, useNavigate, useParams, useLocation } from 'react-router-dom';
import {
    LayoutDashboard, Users, QrCode, LogOut, PartyPopper, Bell, Menu, Home,
    Trophy, IndianRupee, Info, ClipboardList, Mic2, Radio, Pencil,
} from 'lucide-react';
import { clearFestOrganizerSession, getFestOrganizerSession } from '../../utils/festOrganizerSession';
import { isMindSparkFest } from '../../features/fests/mindspark';

const navForFest = (festId, { hideStallLeads = false, hideProShow = false } = {}) => [
    { label: 'Overview', path: `/fest-organizer/fests/${festId}`, icon: LayoutDashboard, end: true, short: 'Home', group: 'ops' },
    { label: 'Edit fest & comps', path: `/fest-organizer/fests/${festId}/edit-listing`, icon: Pencil, short: 'Edit', group: 'edit' },
    { label: 'Live', path: `/fest-organizer/fests/${festId}/live`, icon: Radio, short: 'Live', group: 'ops' },
    ...(!hideStallLeads
        ? [{ label: 'Stall / Leads', path: `/fest-organizer/fests/${festId}/leads`, icon: ClipboardList, short: 'Leads', group: 'ops' }]
        : []),
    { label: 'Competitions', path: `/fest-organizer/fests/${festId}/competitions`, icon: Trophy, short: 'Comps', group: 'ops' },
    ...(!hideProShow
        ? [{ label: 'Pro Show', path: `/fest-organizer/fests/${festId}/pro-show`, icon: Mic2, short: 'Pro', group: 'ops' }]
        : []),
    { label: 'Participants', path: `/fest-organizer/fests/${festId}/participants`, icon: Users, short: 'Guests', group: 'ops' },
    { label: 'Check-in', path: `/fest-organizer/fests/${festId}/scan`, icon: QrCode, short: 'Scan', group: 'ops' },
    { label: 'Revenue', path: `/fest-organizer/fests/${festId}/revenue`, icon: IndianRupee, short: '₹', group: 'ops' },
    { label: 'Connect', path: `/fest-organizer/fests/${festId}/notifications`, icon: Bell, short: 'Msg', group: 'ops' },
    { label: 'Fest info', path: `/fest-organizer/fests/${festId}/info`, icon: Info, short: 'Info', group: 'ops' },
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

function NavItem({ item, onNavigate, accent = false }) {
    return (
        <OrgNavButton
            to={item.path}
            end={item.end}
            onNavigate={onNavigate}
            className={({ isActive }) =>
                `w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition ${
                    isActive
                        ? 'bg-[#0ECCEE]/15 text-[#0ECCEE] font-medium'
                        : accent
                            ? 'text-[#0ECCEE]/90 hover:bg-[#0ECCEE]/10 hover:text-[#0ECCEE]'
                            : 'text-gray-400 hover:bg-white/5 hover:text-white'
                }`
            }
        >
            <item.icon size={16} className="shrink-0" />
            <span className="truncate">{item.label}</span>
        </OrgNavButton>
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

    const activeFest = festId
        ? session?.fests?.find((f) => String(f._id) === String(festId))
        : null;
    const hideStallLeads = festId ? isMindSparkFest(festId, activeFest) : false;
    const hideProShow = hideStallLeads;
    const nav = festId ? navForFest(festId, { hideStallLeads, hideProShow }) : [];
    const overviewItem = nav.find((n) => n.label === 'Overview');
    const opsNav = nav.filter((n) => n.group === 'ops' && n.label !== 'Overview');
    const editNav = nav.filter((n) => n.group === 'edit');
    const mobilePrimary = hideProShow
        ? ['Live', 'Competitions', 'Participants', 'Check-in', 'Connect']
        : ['Live', 'Competitions', 'Pro Show'];
    // MindSpark day-of: Scan + Connect on the bar; Edit stays in sidebar / overview
    const mobileNav = hideProShow
        ? [
            ...(overviewItem ? [overviewItem] : []),
            ...opsNav.filter((n) => mobilePrimary.includes(n.label)),
        ].slice(0, 5)
        : [
            ...(overviewItem ? [overviewItem] : []),
            ...editNav.filter((n) => n.label === 'Edit fest & comps'),
            ...opsNav.filter((n) => mobilePrimary.includes(n.label)),
        ].slice(0, 5);

    // Pin Connect above Revenue for MindSpark (unpaid chase)
    const orderedOpsNav = hideProShow
        ? (() => {
            const connect = opsNav.find((n) => n.label === 'Connect');
            const rest = opsNav.filter((n) => n.label !== 'Connect');
            const revIdx = rest.findIndex((n) => n.label === 'Revenue');
            if (!connect) return opsNav;
            if (revIdx < 0) return [...rest, connect];
            const next = [...rest];
            next.splice(revIdx, 0, connect);
            return next;
        })()
        : opsNav;

    useEffect(() => {
        if (!hideStallLeads || !festId) return;
        if (location.pathname.includes(`/fests/${festId}/leads`)) {
            navigate(`/fest-organizer/fests/${festId}`, { replace: true });
        }
    }, [hideStallLeads, festId, location.pathname, navigate]);

    useEffect(() => {
        if (!hideProShow || !festId) return;
        if (location.pathname.includes(`/fests/${festId}/pro-show`)) {
            navigate(`/fest-organizer/fests/${festId}`, { replace: true });
        }
    }, [hideProShow, festId, location.pathname, navigate]);

    return (
        <div className="min-h-dvh bg-[#0c0d0e] text-white flex">
            <aside
                className={`fixed inset-y-0 left-0 z-40 w-64 bg-[#121314] border-r border-white/10 transform transition-transform duration-200 ease-out lg:translate-x-0 pt-[var(--safe-top)] flex flex-col ${
                    sidebarOpen ? 'translate-x-0' : '-translate-x-full'
                }`}
            >
                <div className="px-4 py-4 border-b border-white/10 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="size-9 rounded-xl bg-[#0ECCEE]/15 border border-[#0ECCEE]/25 flex items-center justify-center shrink-0">
                            <PartyPopper className="text-[#0ECCEE]" size={16} />
                        </div>
                        <div className="min-w-0">
                            <p className="font-semibold text-sm tracking-tight truncate">Fest Organizer</p>
                            <p className="text-[11px] text-gray-500 truncate">
                                {session?.organizer?.displayName || session?.organizer?.name || 'Portal'}
                            </p>
                        </div>
                    </div>
                </div>

                <nav className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-2.5 py-3 space-y-0.5">
                    <OrgNavButton
                        to="/fest-organizer"
                        end
                        onNavigate={() => setSidebarOpen(false)}
                        className={({ isActive }) =>
                            `w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition ${
                                isActive ? 'bg-[#0ECCEE]/15 text-[#0ECCEE]' : 'text-gray-400 hover:bg-white/5 hover:text-white'
                            }`
                        }
                    >
                        <Home size={16} className="shrink-0" />
                        All fests
                    </OrgNavButton>

                    {activeFest ? (
                        <p className="px-3 pt-3 pb-1 text-[10px] uppercase tracking-wider text-gray-600 truncate" title={activeFest.festName}>
                            {activeFest.festName}
                        </p>
                    ) : null}

                    {overviewItem ? (
                        <NavItem item={overviewItem} onNavigate={() => setSidebarOpen(false)} />
                    ) : null}

                    {editNav.length ? (
                        <div className="mt-2 mb-1 rounded-xl border border-[#0ECCEE]/20 bg-[#0ECCEE]/5 p-1.5 space-y-0.5">
                            <p className="px-2 pt-1 pb-0.5 text-[10px] uppercase tracking-wider text-[#0ECCEE]/80">
                                Content edit
                            </p>
                            {editNav.map((item) => (
                                <NavItem
                                    key={item.path}
                                    item={item}
                                    accent
                                    onNavigate={() => setSidebarOpen(false)}
                                />
                            ))}
                        </div>
                    ) : null}

                    {orderedOpsNav.length ? (
                        <p className="px-3 pt-3 pb-1 text-[10px] uppercase tracking-wider text-gray-600">
                            Ops
                        </p>
                    ) : null}

                    {orderedOpsNav.map((item) => (
                        <NavItem key={item.path} item={item} onNavigate={() => setSidebarOpen(false)} />
                    ))}
                </nav>

                <div className="shrink-0 p-2.5 border-t border-white/10 pb-[max(0.75rem,var(--safe-bottom))]">
                    <button
                        type="button"
                        onClick={logout}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-gray-400 hover:bg-white/5 hover:text-white"
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
