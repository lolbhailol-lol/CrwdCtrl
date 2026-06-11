import { createElement, useState, useEffect } from 'react';
import {
  Users, FileText, Eye, Activity,
  TrendingUp, TrendingDown, Minus,
  Monitor, Smartphone, Tablet,
  BarChart3, RefreshCw, IndianRupee, Flag, Mountain, Footprints, Trophy,
} from 'lucide-react';
import { adminFetchJSON as adminFetch } from '../../utils/adminApi';

function formatINR(amount) {
  return `₹${(amount ?? 0).toLocaleString('en-IN')}`;
}

function StatCard({ icon, label, value, change, color, sublabel }) {
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
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-sm text-gray-400 mt-1">{label}</div>
      {sublabel && <div className="text-[11px] text-gray-600 mt-0.5">{sublabel}</div>}
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

function RevenueCategoryCard({ label, icon: Icon, data, accent }) {
  if (!data) return null;
  return (
    <div className="bg-[#111213] rounded-xl border border-gray-800 p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className={`p-2 rounded-lg ${accent}`}>
          <Icon size={18} />
        </div>
        <h3 className="font-semibold text-white">{label}</h3>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-gray-500 text-xs">Total sign-ups</p>
          <p className="text-white font-bold text-lg">{data.registrations ?? 0}</p>
        </div>
        <div>
          <p className="text-gray-500 text-xs">Paid transactions</p>
          <p className="text-white font-bold text-lg">{data.paidCount ?? 0}</p>
        </div>
        <div>
          <p className="text-gray-500 text-xs">Gross collected</p>
          <p className="text-[#0ECCEE] font-semibold">{formatINR(data.grossCollected)}</p>
        </div>
        <div>
          <p className="text-gray-500 text-xs">Organizer share</p>
          <p className="text-emerald-400 font-semibold">{formatINR(data.ticketRevenue)}</p>
        </div>
        <div className="col-span-2 pt-2 border-t border-gray-800">
          <p className="text-gray-500 text-xs">Platform commission (3%)</p>
          <p className="text-amber-400 font-semibold text-base">{formatINR(data.platformCommission)}</p>
        </div>
      </div>
    </div>
  );
}

export default function AnalyticsDashboardPage() {
  const [data, setData] = useState(null);
  const [revenue, setRevenue] = useState(null);
  const [realtime, setRealtime] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [analyticsRes, revenueRes, realtimeRes] = await Promise.all([
        adminFetch('/analytics/dashboard'),
        adminFetch('/analytics/revenue-summary').catch(() => null),
        adminFetch('/analytics/realtime').catch(() => ({ success: true, activeUsers: 0 })),
      ]);
      setData(analyticsRes);
      setRevenue(revenueRes);
      setRealtime(realtimeRes);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
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
  const totals = revenue?.totals;
  const last30 = revenue?.last30Days;
  const categories = revenue?.categories;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Analytics</h1>
          <p className="text-sm text-gray-400 mt-1">
            Revenue, registrations, and platform performance from saved records
          </p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 transition-colors"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* Revenue overview */}
      {totals && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-3">Revenue overview</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={IndianRupee}
              label="Gross collected"
              value={formatINR(totals.grossCollected)}
              sublabel="All paid transactions"
              color="bg-cyan-500/20 text-cyan-400"
            />
            <StatCard
              icon={Trophy}
              label="Organizer share"
              value={formatINR(totals.ticketRevenue)}
              sublabel="Base ticket / registration fees"
              color="bg-emerald-500/20 text-emerald-400"
            />
            <StatCard
              icon={BarChart3}
              label="Platform commission"
              value={formatINR(totals.platformCommission)}
              sublabel="3% convenience fee"
              color="bg-amber-500/20 text-amber-400"
            />
            <StatCard
              icon={FileText}
              label="Paid transactions"
              value={totals.paidCount ?? 0}
              sublabel={last30 ? `${formatINR(last30.grossCollected)} in last 30 days` : undefined}
              color="bg-violet-500/20 text-violet-400"
            />
          </div>
        </div>
      )}

      {/* Fests · Treks · Runs */}
      {categories && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-3">By category</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <RevenueCategoryCard
              label="Fests"
              icon={Flag}
              data={categories.fests}
              accent="bg-violet-500/20 text-violet-400"
            />
            <RevenueCategoryCard
              label="Treks"
              icon={Mountain}
              data={categories.treks}
              accent="bg-emerald-500/20 text-emerald-400"
            />
            <RevenueCategoryCard
              label="Runs"
              icon={Footprints}
              data={categories.runs}
              accent="bg-orange-500/20 text-orange-400"
            />
          </div>
          {(categories.competitions?.paidCount > 0 || categories.competitions?.registrations > 0) && (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <RevenueCategoryCard
                label="Competitions"
                icon={Trophy}
                data={categories.competitions}
                accent="bg-pink-500/20 text-pink-400"
              />
            </div>
          )}
        </div>
      )}

      {/* Platform stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          label="Total users"
          value={stats?.totalUsers}
          change={stats?.userGrowth}
          color="bg-blue-500/20 text-blue-400"
        />
        <StatCard
          icon={FileText}
          label="Total registrations"
          value={stats?.totalRegistrations}
          change={stats?.registrationGrowth}
          sublabel={`${stats?.festRegistrations ?? 0} fests · ${stats?.trekBookings ?? 0} treks · ${stats?.categoryRegistrations ?? 0} runs/other`}
          color="bg-green-500/20 text-green-400"
        />
        <StatCard
          icon={Eye}
          label="Page views (7d)"
          value={stats?.pageViews7d}
          color="bg-purple-500/20 text-purple-400"
        />
        <StatCard
          icon={Activity}
          label="Active now"
          value={realtime?.activeUsers || 0}
          color="bg-cyan-500/20 text-cyan-400"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#111213] rounded-xl border border-gray-800 p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={18} className="text-[#0ECCEE]" />
            <h3 className="font-semibold text-white">Fest registrations (last 30 days)</h3>
          </div>
          <SimpleBarChart
            data={charts?.registrationsByDay}
            valueKey="count"
            color="#007BFF"
          />
        </div>

        <div className="bg-[#111213] rounded-xl border border-gray-800 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Eye size={18} className="text-[#0ECCEE]" />
            <h3 className="font-semibold text-white">Top fests by views</h3>
          </div>
          <SimpleBarChart
            data={charts?.topFests}
            labelKey="name"
            valueKey="views"
            color="#0ECCEE"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-[#111213] rounded-xl border border-gray-800 p-5">
          <h3 className="font-semibold text-white mb-4">User signups (30d)</h3>
          <SimpleBarChart
            data={charts?.userSignupsByDay}
            valueKey="count"
            color="#00C9A7"
          />
        </div>

        <div className="bg-[#111213] rounded-xl border border-gray-800 p-5">
          <h3 className="font-semibold text-white mb-4">Device breakdown</h3>
          <DeviceBreakdown devices={stats?.devices} />
        </div>

        <div className="bg-[#111213] rounded-xl border border-gray-800 p-5">
          <h3 className="font-semibold text-white mb-4">Recent fest registrations</h3>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {recentRegistrations?.length > 0 ? (
              recentRegistrations.map((reg) => (
                <div key={reg.id} className="flex items-center justify-between text-sm gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-white truncate">{reg.userName}</div>
                    <div className="text-gray-500 text-xs truncate">
                      {reg.festName}{reg.competitionName ? ` → ${reg.competitionName}` : ''}
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 capitalize ${
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

      {revenue?.note && (
        <p className="text-[11px] text-gray-600 text-center">{revenue.note}</p>
      )}
    </div>
  );
}
