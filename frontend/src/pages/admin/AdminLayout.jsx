import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  Calendar,
  Dumbbell,
  Mountain,
  Theater,
  LogOut,
  Menu,
  X,
  FileText,
  BarChart3,
  Layers,
  LayoutGrid,
  Trophy,
  QrCode,
  Users,
} from 'lucide-react';

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  );
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 1024) return;
      setSidebarOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_refresh_token');
    navigate('/admin/login');
  };

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/admin', exact: true },
    { icon: Calendar, label: 'Fests', path: '/admin/fests' },
    { icon: Trophy, label: 'Competitions', path: '/admin/competitions' },
    { icon: Dumbbell, label: 'Run Clubs', path: '/admin/sports' },
    { icon: Mountain, label: 'Treks', path: '/admin/treks' },
    { icon: Theater, label: 'Events', path: '/admin/events' },
    { icon: Layers, label: 'Home & Sections', path: '/admin/sections' },
    { icon: LayoutGrid, label: 'Page Sections', path: '/admin/page-sections' },
    { icon: FileText, label: 'Registrations', path: '/admin/registrations' },
    { icon: Users, label: 'User Logins', path: '/admin/user-logins' },
    { icon: QrCode, label: 'Scanner Access', path: '/admin/scanner-access', exact: true },
    { icon: BarChart3, label: 'Analytics', path: '/admin/analytics' },
  ];

  const isActivePath = (path, exact = false) =>
    exact ? location.pathname === path : location.pathname === path || location.pathname.startsWith(`${path}/`);

  return (
    <div className="min-h-screen bg-[#161718] text-white flex">
      {/* Sidebar */}
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`bg-[#111213] border-r border-gray-800 transition-all duration-300 fixed h-full z-40 flex flex-col ${
          sidebarOpen ? 'w-64' : 'w-0 lg:w-20 overflow-hidden'
        }`}
      >
        <div className="p-4 flex items-center justify-between border-b border-gray-800">
          {sidebarOpen && (
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-linear-to-r from-[#053780] to-[#0ECCEE]">
              CRWDCTRL Admin
            </h1>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <nav className="p-4 space-y-2 flex-1 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = isActivePath(item.path, item.exact);
            return (
              <button
                key={item.path}
                onClick={() => {
                  navigate(item.path);
                  if (window.innerWidth < 1024) setSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-[#0ECCEE] text-black font-semibold'
                    : 'hover:bg-gray-800 text-gray-300'
                }`}
              >
                <Icon size={20} />
                {sidebarOpen && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-800 shrink-0">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-red-900/30 text-red-400 transition-colors"
          >
            <LogOut size={20} />
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className={`flex-1 transition-all duration-300 ml-0 ${sidebarOpen ? 'lg:ml-64' : 'lg:ml-20'}`}>
        {/* Top Navbar */}
        <header className="bg-[#111213] border-b border-gray-800 px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-800 shrink-0"
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>
            <h2 className="text-lg sm:text-xl font-semibold truncate">
              {menuItems.find(item => isActivePath(item.path, item.exact))?.label || 'Admin Dashboard'}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#0ECCEE]/10 border border-[#0ECCEE]/20">
              <span className="w-2 h-2 rounded-full bg-[#0ECCEE]" />
              <span className="text-xs font-medium text-[#0ECCEE]">Admin</span>
            </div>
            <div className="h-6 w-px bg-gray-800 hidden sm:block" />
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg border border-red-800/60 text-red-400 hover:bg-red-900/30 hover:border-red-700 transition-colors text-sm font-medium"
              title="Log out of admin"
            >
              <LogOut size={15} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-3 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

