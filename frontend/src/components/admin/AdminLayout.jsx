import { useState } from 'react';
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
} from 'lucide-react';

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    navigate('/login');
  };

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/admin' },
    { icon: Calendar, label: 'Fests', path: '/admin/fests' },
    { icon: Dumbbell, label: 'Sports', path: '/admin/sports' },
    { icon: Mountain, label: 'Treks', path: '/admin/treks' },
    { icon: Theater, label: 'Theatre', path: '/admin/theatre' },
    { icon: Layers,    label: 'Sections',      path: '/admin/sections' },
    { icon: FileText,  label: 'Registrations', path: '/admin/registrations' },
    { icon: BarChart3, label: 'Analytics',     path: '/admin/analytics' },
  ];

  return (
    <div className="min-h-screen bg-[#161718] text-white flex">
      {/* Sidebar */}
      <aside
        className={`bg-[#111213] border-r border-gray-800 transition-all duration-300 ${
          sidebarOpen ? 'w-64' : 'w-20'
        } fixed h-full z-40`}
      >
        <div className="p-4 flex items-center justify-between border-b border-gray-800">
          {sidebarOpen && (
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#053780] to-[#0ECCEE]">
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
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
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
      <div className={`flex-1 transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-20'}`}>
        {/* Top Navbar */}
        <header className="bg-[#111213] border-b border-gray-800 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">
              {menuItems.find(item => item.path === location.pathname)?.label || 'Admin Dashboard'}
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
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

