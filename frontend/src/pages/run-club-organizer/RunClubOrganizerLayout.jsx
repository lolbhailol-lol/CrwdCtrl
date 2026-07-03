import { useState } from 'react';
import { NavLink, Outlet, useNavigate, useParams } from 'react-router-dom';
import { LayoutDashboard, Users, QrCode, LogOut, Footprints, Bell, Menu } from 'lucide-react';
import { clearRunClubOrganizerSession, getRunClubOrganizerSession } from '../../utils/runClubOrganizerSession';

const navForEvent = (eventId) => [
    { label: 'Dashboard', path: `/run-club-organizer/events/${eventId}`, icon: LayoutDashboard, end: true },
    { label: 'Participants', path: `/run-club-organizer/events/${eventId}/participants`, icon: Users },
    { label: 'Scan QR', path: `/run-club-organizer/events/${eventId}/scan`, icon: QrCode },
    { label: 'Notify', path: `/run-club-organizer/events/${eventId}/notifications`, icon: Bell },
];

export default function RunClubOrganizerLayout() {
    const navigate = useNavigate();
    const { eventId } = useParams();
    const session = getRunClubOrganizerSession();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const logout = () => {
        clearRunClubOrganizerSession();
        navigate('/run-club-organizer/login', { replace: true });
    };

    const nav = eventId ? navForEvent(eventId) : [];
    const activeEvent = eventId
        ? session?.events?.find((e) => String(e._id) === String(eventId))
        : null;

    return (
        <div className="min-h-dvh bg-[#0f1011] text-white flex">
            <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-[#161718] border-r border-gray-800 transform transition-transform lg:translate-x-0 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="px-5 py-5 border-b border-gray-800">
                    <div className="flex items-center gap-2">
                        <Footprints className="text-[#0ECCEE]" size={22} />
                        <div>
                            <p className="font-bold text-sm">Run Club Organizer</p>
                            <p className="text-[11px] text-gray-500 truncate">
                                {session?.runClub?.name || session?.organizer?.name || 'Portal'}
                            </p>
                        </div>
                    </div>
                </div>
                <nav className="p-3 space-y-1">
                    <NavLink
                        to="/run-club-organizer"
                        end
                        onClick={() => setSidebarOpen(false)}
                        className={({ isActive }) =>
                            `flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                                isActive ? 'bg-[#0ECCEE]/15 text-[#0ECCEE]' : 'text-gray-400 hover:text-white hover:bg-white/5'
                            }`
                        }
                    >
                        <Footprints size={16} />
                        Club home
                    </NavLink>
                    {nav.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            end={item.end}
                            onClick={() => setSidebarOpen(false)}
                            className={({ isActive }) =>
                                `flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                                    isActive ? 'bg-[#0ECCEE]/15 text-[#0ECCEE]' : 'text-gray-400 hover:text-white hover:bg-white/5'
                                }`
                            }
                        >
                            <item.icon size={16} />
                            {item.label}
                        </NavLink>
                    ))}
                </nav>
                <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-gray-800">
                    <button type="button" onClick={logout} className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:text-red-400 hover:bg-red-500/10">
                        <LogOut size={16} /> Log out
                    </button>
                </div>
            </aside>

            <div className="flex-1 lg:ml-64 min-w-0">
                <header className="sticky top-0 z-30 bg-[#0f1011]/95 backdrop-blur border-b border-gray-800 px-4 py-3 flex items-center justify-between gap-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
                    <button
                        type="button"
                        className="lg:hidden inline-flex items-center justify-center gap-2 min-h-[44px] min-w-[44px] px-3 rounded-lg text-gray-300 border border-gray-800 hover:bg-white/5"
                        onClick={() => setSidebarOpen((v) => !v)}
                        aria-label="Open menu"
                    >
                        <Menu size={20} />
                        <span className="text-sm font-medium">Menu</span>
                    </button>
                    <div className="min-w-0 flex-1 text-right sm:text-left">
                        <p className="text-sm text-gray-300 truncate font-medium">
                            {activeEvent?.title || session?.runClub?.name || 'Run Club Organizer'}
                        </p>
                        <p className="text-[11px] text-gray-500 truncate hidden sm:block">
                            {activeEvent ? 'Run organizer portal' : 'CrwdCtrl'}
                        </p>
                    </div>
                </header>
                <main className="p-4 sm:p-6 max-w-7xl mx-auto">
                    <Outlet />
                </main>
            </div>
            {sidebarOpen ? <button type="button" className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} aria-label="Close menu" /> : null}
        </div>
    );
}
