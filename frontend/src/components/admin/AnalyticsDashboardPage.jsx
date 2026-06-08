import { createElement, useState, useEffect } from 'react';
import {
  Users, FileText, Eye, Activity,
  TrendingUp, TrendingDown, Minus,
  Monitor, Smartphone, Tablet,
  BarChart3, RefreshCw
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

const getAdminToken = () => localStorage.getItem('admin_token');

const adminFetch = async (url) => {
  const token = getAdminToken();
  if (!token) throw new Error('No admin token');
  const res = await fetch(`${API_BASE_URL}${url}`, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
};

function StatCard({ icon, label, value, change, color }) {
  const isPositive = change > 0;
  const isNeutral = change === 0 || change === undefined;
  return (
    <div className="bg-[#111213] rounded-xl border border-gray-800 p-5">
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2 rounded-lg ${color}`}>
          {icon ? createElement(icon, { size: 20 }) : null}
        </div>
        {!isNeutral && (
          <div className={`flex items-center text-xs font-medium ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
            {isPositive ? <TrendingUp size={14} className="mr-0.5" /> : <TrendingDown size={14} className="mr-0.5" />}
            {Math.abs(change)}%
          </div>
        )}
        {isNeutral && change !== undefined && (
          <div className="flex items-center text-xs font-medium text-gray-500">
            <Minus size={14} className="mr-0.5" />0%
          </div>
        )}
      </div>
      <div className="text-2xl font-bold text-white">{value?.toLocaleString() ?? '—'}</div>
      <div className="text-sm text-gray-400 mt-1">{label}</div>
    </div>
  );
}

function SimpleBarChart({ data, labelKey = '_id', valueKey = 'count', color = '#007BFF' }) {
  if (!data || data.length === 0) {
    return <div className="text-gray-500 text-sm text-center py-8">No data yet</div>;
  }
  const maxVal = Math.max(...data.map(d => d[valueKey] || 0), 1);
  return (
    <div className="space-y-2">
      {data.map((item, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="text-xs text-gray-400 w-20 truncate text-right">
            {item[labelKey]?.substring(5) || item.name || '—'}
          </div>
          <div className="flex-1 bg-gray-800 rounded-full h-5 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.max((item[valueKey] / maxVal) * 100, 2)}%`,
                backgroundColor: color,
              }}
            />
          </div>
          <div className="text-xs text-white font-medium w-10 text-right">
            {item[valueKey]}
          </div>
        </div>
      ))}
    </div>
  );
}

function DeviceBreakdown({ devices }) {
  const deviceIcons = { desktop: Monitor, mobile: Smartphone, tablet: Tablet };
  const total = Object.values(devices || {}).reduce((a, b) => a + b, 0) || 1;

  return (
    <div className="space-y-3">
      {Object.entries(devices || {}).map(([device, count]) => {
        const Icon = deviceIcons[device] || Monitor;
        const pct = Math.round((count / total) * 100);
        return (
          <div key={device} className="flex items-center gap-3">
            <Icon size={16} className="text-gray-400 shrink-0" />
            <div className="flex-1">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-300 capitalize">{device || 'Unknown'}</span>
                <span className="text-white font-medium">{pct}%</span>
              </div>
              <div className="bg-gray-800 rounded-full h-2 overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#0ECCEE] transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          </div>
        );
      })}
      {(!devices || Object.keys(devices).length === 0) && (
        <div className="text-gray-500 text-sm text-center py-4">No device data yet</div>
      )}
    </div>
  );
}

function CategoryCard({ label, data, color }) {
  if (!data) return null;
  return (
    <div className="bg-[#111213] rounded-xl border border-gray-800 p-5">
      <h3 className={`font-semibold mb-3 capitalize ${color}`}>{label}</h3>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-gray-500 text-xs">Active events</p>
          <p className="text-white font-bold text-lg">{data.activeEvents ?? 0}</p>
        </div>
        <div>
          <p className="text-gray-500 text-xs">Registrations</p>
          <p className="text-white font-bold text-lg">{data.totalRegistrations ?? 0}</p>
        </div>
        <div>
          <p className="text-gray-500 text-xs">Confirmed</p>
          <p className="text-green-400 font-semibold">{data.confirmed ?? 0}</p>
        </div>
        <div>
          <p className="text-gray-500 text-xs">Revenue</p>
          <p className="text-[#0ECCEE] font-semibold">₹{(data.revenue ?? 0).toLocaleString('en-IN')}</p>
        </div>
      </div>
    </div>
  );
}

export default function AnalyticsDashboardPage() {
  const [data, setData] = useState(null);
  const [realtime, setRealtime] = useState(null);
  const [categoryData, setCategoryData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [analyticsRes, realtimeRes, categoryRes] = await Promise.all([
        adminFetch('/analytics/dashboard'),
        adminFetch('/analytics/realtime').catch(() => ({ success: true, activeUsers: 0 })),
        adminFetch('/analytics/category-summary').catch(() => null),
      ]);
      setData(analyticsRes);
      setRealtime(realtimeRes);
      setCategoryData(categoryRes?.categories || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Refresh realtime every 30s
    const interval = setInterval(async () => {
      try {
        const rt = await adminFetch('/analytics/realtime');
        setRealtime(rt);
      } catch (_) { /* silent */ }
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="animate-spin text-[#0ECCEE]" size={32} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-400 mb-4">Failed to load analytics: {error}</p>
        <button onClick={fetchData} className="px-4 py-2 bg-[#0ECCEE] text-black rounded-lg font-medium">
          Retry
        </button>
      </div>
    );
  }

  const { stats, charts, recentRegistrations } = data || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Analytics</h1>
          <p className="text-sm text-gray-400 mt-1">Platform performance overview</p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 transition-colors"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          label="Total Users"
          value={stats?.totalUsers}
          change={stats?.userGrowth}
          color="bg-blue-500/20 text-blue-400"
        />
        <StatCard
          icon={FileText}
          label="Total Registrations"
          value={stats?.totalRegistrations}
          change={stats?.registrationGrowth}
          color="bg-green-500/20 text-green-400"
        />
        <StatCard
          icon={Eye}
          label="Page Views (7d)"
          value={stats?.pageViews7d}
          color="bg-purple-500/20 text-purple-400"
        />
        <StatCard
          icon={Activity}
          label="Active Now"
          value={realtime?.activeUsers || 0}
          color="bg-cyan-500/20 text-cyan-400"
        />
      </div>

      {categoryData && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-3">Category Registrations</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <CategoryCard label="Sports" data={categoryData.sports} color="text-orange-400" />
            <CategoryCard label="Treks" data={categoryData.trek} color="text-emerald-400" />
            <CategoryCard label="Theatre" data={categoryData.theatre} color="text-pink-400" />
          </div>
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Registrations by Day */}
        <div className="bg-[#111213] rounded-xl border border-gray-800 p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={18} className="text-[#0ECCEE]" />
            <h3 className="font-semibold text-white">Registrations (Last 30 Days)</h3>
          </div>
          <SimpleBarChart
            data={charts?.registrationsByDay}
            valueKey="count"
            color="#007BFF"
          />
        </div>

        {/* Top Fests */}
        <div className="bg-[#111213] rounded-xl border border-gray-800 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Eye size={18} className="text-[#0ECCEE]" />
            <h3 className="font-semibold text-white">Top Fests by Views</h3>
          </div>
          <SimpleBarChart
            data={charts?.topFests}
            labelKey="name"
            valueKey="views"
            color="#0ECCEE"
          />
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User Signups */}
        <div className="bg-[#111213] rounded-xl border border-gray-800 p-5">
          <h3 className="font-semibold text-white mb-4">User Signups (30d)</h3>
          <SimpleBarChart
            data={charts?.userSignupsByDay}
            valueKey="count"
            color="#00C9A7"
          />
        </div>

        {/* Device Breakdown */}
        <div className="bg-[#111213] rounded-xl border border-gray-800 p-5">
          <h3 className="font-semibold text-white mb-4">Device Breakdown</h3>
          <DeviceBreakdown devices={stats?.devices} />
        </div>

        {/* Recent Registrations */}
        <div className="bg-[#111213] rounded-xl border border-gray-800 p-5">
          <h3 className="font-semibold text-white mb-4">Recent Registrations</h3>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {recentRegistrations?.length > 0 ? (
              recentRegistrations.map((reg) => (
                <div key={reg.id} className="flex items-center justify-between text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="text-white truncate">{reg.userName}</div>
                    <div className="text-gray-500 text-xs truncate">
                      {reg.festName}{reg.competitionName ? ` → ${reg.competitionName}` : ''}
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ml-2 ${
                    reg.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                    reg.status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                    'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {reg.status}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-gray-500 text-sm text-center py-4">No registrations yet</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
