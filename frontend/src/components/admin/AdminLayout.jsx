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
  Trophy,
  QrCode,
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
    { icon: Dumbbell, label: 'Sports', path: '/admin/sports' },
    { icon: Mountain, label: 'Treks', path: '/admin/treks' },
    { icon: Theater, label: 'Theatre', path: '/admin/theatre' },
    { icon: Layers, label: 'Home & Sections', path: '/admin/sections' },
    { icon: FileText, label: 'Registrations', path: '/admin/registrations' },
    { icon: QrCode, label: 'Check-in', path: '/admin/checkin' },
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
        className={`bg-[#111213] border-r border-gray-800 transition-all duration-300 fixed h-full z-40 ${
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

        <nav className="p-4 space-y-2">
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

        <div className="absolute bottom-4 left-4 right-4">
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
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-400">
              Admin
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors text-sm font-medium"
            >
              Logout
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

