import { createElement, useCallback, useState, useEffect } from 'react';
import {
  Users, FileText, Eye,
  TrendingUp, TrendingDown, Minus,
  Monitor, Smartphone, Tablet,
  BarChart3, RefreshCw, IndianRupee, Flag, Mountain, Footprints, Trophy,
  LineChart, UserPlus, MousePointerClick, Clock, Globe, FileBarChart,
  Radio, Settings, ExternalLink, CalendarRange,
} from 'lucide-react';
import { adminFetchJSON as adminFetch } from '../../services/api/admin.api.js';

function formatINR(amount) {
  return `₹${(amount ?? 0).toLocaleString('en-IN')}`;
}

function formatDayLabel(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
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

function RevenueCategoryCard({ label, icon, data, accent }) {
  const Icon = icon;
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

function RankedList({ items, labelKey, emptyText = 'No data yet', color = '#0ECCEE' }) {
  if (!items || items.length === 0) {
    return <div className="text-gray-500 text-sm text-center py-6">{emptyText}</div>;
  }
  const maxVal = Math.max(...items.map((d) => d.value || 0), 1);
  return (
    <div className="space-y-2.5">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="text-xs text-gray-300 w-32 truncate" title={item[labelKey]}>
            {item[labelKey] || '—'}
          </div>
          <div className="flex-1 bg-gray-800 rounded-full h-2.5 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.max((item.value / maxVal) * 100, 2)}%`, backgroundColor: color }}
            />
          </div>
          <div className="text-xs text-white font-medium w-12 text-right">
            {item.value.toLocaleString('en-IN')}
          </div>
        </div>
      ))}
    </div>
  );
}

function GASetupCard({ steps, error }) {
  return (
    <div className="bg-[#111213] rounded-xl border border-gray-800 p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400">
          <Settings size={18} />
        </div>
        <h3 className="font-semibold text-white">
          {error ? 'Google Analytics needs attention' : 'Connect Google Analytics'}
        </h3>
      </div>
      {error && (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mb-3">
          {error}
        </p>
      )}
      <p className="text-sm text-gray-400 mb-3">
        Follow these steps to show live GA4 traffic metrics here:
      </p>
      <ol className="space-y-2 text-sm text-gray-300 list-decimal list-inside">
        {(steps || []).map((step, i) => (
          <li key={i} className="pl-1">{step}</li>
        ))}
      </ol>
      <a
        href="https://analytics.google.com/"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 mt-4 text-sm text-[#0ECCEE] hover:underline"
      >
        Open Google Analytics <ExternalLink size={13} />
      </a>
    </div>
  );
}

const todayIso = () => new Date().toISOString().slice(0, 10);
const isoDaysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

function GoogleAnalyticsSection() {
  const [ga, setGa] = useState(null);
  const [gaRealtime, setGaRealtime] = useState(0);
  const [days, setDays] = useState(28);
  const [mode, setMode] = useState('preset'); // 'preset' | 'custom'
  const [startDate, setStartDate] = useState(isoDaysAgo(28));
  const [endDate, setEndDate] = useState(todayIso());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchGa = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const query = mode === 'custom' && startDate && endDate
        ? `startDate=${startDate}&endDate=${endDate}`
        : `days=${days}`;
      const res = await adminFetch(`/analytics/google?${query}`);
      setGa(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [days, mode, startDate, endDate]);

  useEffect(() => {
    if (mode === 'preset') fetchGa();
    // In custom mode we wait for the user to click "Apply".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, mode]);

  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const rt = await adminFetch('/analytics/google/realtime');
        if (active) setGaRealtime(rt?.activeUsers || 0);
      } catch (_) { /* silent */ }
    };
    poll();
    const interval = setInterval(poll, 30000);
    return () => { active = false; clearInterval(interval); };
  }, []);

  const configured = ga?.configured !== false && !ga?.error;
  // Chart wants oldest→newest; the daily table shows newest→oldest.
  const daily = ga?.daily || [];
  const byDateChart = [...daily].reverse().map((d) => ({
    date: d.date,
    count: d.activeUsers,
  }));

  return (
    <div>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <LineChart size={20} className="text-[#0ECCEE]" />
          <h2 className="text-lg font-semibold text-white">Google Analytics</h2>
          <span className="text-xs text-gray-500">(GA4 — website traffic)</span>
        </div>
        {configured && (
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 bg-[#17181A] p-1 rounded-lg border border-white/8">
              {[7, 28, 90].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => { setMode('preset'); setDays(d); }}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                    mode === 'preset' && days === d ? 'bg-[#0ECCEE] text-black' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {d}d
                </button>
              ))}
              <button
                type="button"
                onClick={() => setMode('custom')}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                  mode === 'custom' ? 'bg-[#0ECCEE] text-black' : 'text-gray-400 hover:text-white'
                }`}
              >
                Custom
              </button>
            </div>

            {mode === 'custom' && (
              <div className="flex items-center gap-1.5 bg-[#17181A] p-1.5 rounded-lg border border-white/8">
                <input
                  type="date"
                  value={startDate}
                  max={endDate || todayIso()}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-[#0D0E10] border border-white/8 rounded-md px-2 py-1 text-xs text-white focus:outline-none focus:border-[#0ECCEE]/40 scheme-dark"
                />
                <span className="text-gray-500 text-xs">to</span>
                <input
                  type="date"
                  value={endDate}
                  min={startDate}
                  max={todayIso()}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-[#0D0E10] border border-white/8 rounded-md px-2 py-1 text-xs text-white focus:outline-none focus:border-[#0ECCEE]/40 scheme-dark"
                />
                <button
                  type="button"
                  onClick={fetchGa}
                  disabled={!startDate || !endDate || startDate > endDate}
                  className="px-3 py-1 rounded-md text-xs font-semibold bg-[#0ECCEE] text-black disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Apply
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {loading && !ga ? (
        <div className="bg-[#111213] rounded-xl border border-gray-800 p-8 flex items-center justify-center">
          <RefreshCw className="animate-spin text-[#0ECCEE]" size={24} />
        </div>
      ) : error ? (
        <GASetupCard error={error} steps={ga?.setupSteps} />
      ) : !configured ? (
        <GASetupCard error={ga?.error} steps={ga?.setupSteps} />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <StatCard icon={Radio} label="Active right now" value={gaRealtime}
              sublabel="Last 30 min" color="bg-rose-500/20 text-rose-400" />
            <StatCard icon={Users} label="Active users" value={(ga.totals.activeUsers).toLocaleString('en-IN')}
              color="bg-blue-500/20 text-blue-400" />
            <StatCard icon={UserPlus} label="New users" value={(ga.totals.newUsers).toLocaleString('en-IN')}
              color="bg-emerald-500/20 text-emerald-400" />
            <StatCard icon={MousePointerClick} label="Sessions" value={(ga.totals.sessions).toLocaleString('en-IN')}
              color="bg-violet-500/20 text-violet-400" />
            <StatCard icon={Eye} label="Page views" value={(ga.totals.pageViews).toLocaleString('en-IN')}
              color="bg-purple-500/20 text-purple-400" />
            <StatCard icon={Clock} label="Avg. session" value={ga.totals.avgSessionDuration}
              sublabel={`Bounce ${ga.totals.bounceRate}`} color="bg-amber-500/20 text-amber-400" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-[#111213] rounded-xl border border-gray-800 p-5">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 size={18} className="text-[#0ECCEE]" />
                <h3 className="font-semibold text-white">Active users by day</h3>
              </div>
              <SimpleBarChart data={byDateChart} labelKey="date" valueKey="count" color="#0ECCEE" />
            </div>

            <div className="bg-[#111213] rounded-xl border border-gray-800 p-5">
              <div className="flex items-center gap-2 mb-4">
                <FileBarChart size={18} className="text-[#0ECCEE]" />
                <h3 className="font-semibold text-white">Top pages</h3>
              </div>
              <RankedList items={ga.topPages} labelKey="page" color="#007BFF" />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-[#111213] rounded-xl border border-gray-800 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Globe size={18} className="text-[#0ECCEE]" />
                <h3 className="font-semibold text-white">Top countries</h3>
              </div>
              <RankedList items={ga.topCountries} labelKey="country" color="#00C9A7" />
            </div>

            <div className="bg-[#111213] rounded-xl border border-gray-800 p-5">
              <h3 className="font-semibold text-white mb-4">Device breakdown</h3>
              <DeviceBreakdown devices={ga.devices} />
            </div>

            <div className="bg-[#111213] rounded-xl border border-gray-800 p-5">
              <h3 className="font-semibold text-white mb-4">Traffic sources</h3>
              <RankedList items={ga.trafficSources} labelKey="source" color="#A78BFA" />
            </div>
          </div>

          {/* Top events */}
          <div className="bg-[#111213] rounded-xl border border-gray-800 p-5">
            <div className="flex items-center gap-2 mb-4">
              <MousePointerClick size={18} className="text-[#0ECCEE]" />
              <h3 className="font-semibold text-white">Events (what people do)</h3>
            </div>
            <RankedList items={ga.topEvents} labelKey="event" color="#F472B6" emptyText="No events tracked yet" />
          </div>

          {/* Detailed day-by-day breakdown */}
          <div className="bg-[#111213] rounded-xl border border-gray-800 overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-800">
              <CalendarRange size={18} className="text-[#0ECCEE]" />
              <h3 className="font-semibold text-white">Day-by-day breakdown</h3>
              <span className="text-xs text-gray-500">({daily.length} days)</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[720px]">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-800 text-xs uppercase tracking-wider">
                    <th className="px-4 py-2.5 font-semibold sticky left-0 bg-[#111213]">Date</th>
                    <th className="px-4 py-2.5 font-semibold text-right">Active users</th>
                    <th className="px-4 py-2.5 font-semibold text-right">New users</th>
                    <th className="px-4 py-2.5 font-semibold text-right">Sessions</th>
                    <th className="px-4 py-2.5 font-semibold text-right">Page views</th>
                    <th className="px-4 py-2.5 font-semibold text-right">Events</th>
                    <th className="px-4 py-2.5 font-semibold text-right">Avg. session</th>
                    <th className="px-4 py-2.5 font-semibold text-right">Engagement</th>
                    <th className="px-4 py-2.5 font-semibold text-right">Bounce</th>
                  </tr>
                </thead>
                <tbody>
                  {daily.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-gray-500">No daily data yet</td>
                    </tr>
                  ) : (
                    daily.map((d) => (
                      <tr key={d.date} className="border-b border-gray-800/60 hover:bg-white/2">
                        <td className="px-4 py-2.5 text-white font-medium whitespace-nowrap sticky left-0 bg-[#111213]">
                          {formatDayLabel(d.date)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-gray-200">{d.activeUsers.toLocaleString('en-IN')}</td>
                        <td className="px-4 py-2.5 text-right text-gray-400">{d.newUsers.toLocaleString('en-IN')}</td>
                        <td className="px-4 py-2.5 text-right text-gray-200">{d.sessions.toLocaleString('en-IN')}</td>
                        <td className="px-4 py-2.5 text-right text-gray-200">{d.pageViews.toLocaleString('en-IN')}</td>
                        <td className="px-4 py-2.5 text-right text-gray-400">{d.events.toLocaleString('en-IN')}</td>
                        <td className="px-4 py-2.5 text-right text-gray-400 whitespace-nowrap">{d.avgSessionDuration}</td>
                        <td className="px-4 py-2.5 text-right text-emerald-400">{d.engagementRate}</td>
                        <td className="px-4 py-2.5 text-right text-amber-400">{d.bounceRate}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AnalyticsDashboardPage() {
  const [revenue, setRevenue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const revenueRes = await adminFetch('/analytics/revenue-summary').catch(() => null);
      setRevenue(revenueRes);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
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

  const totals = revenue?.totals;
  const last30 = revenue?.last30Days;
  const categories = revenue?.categories;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Analytics</h1>
          <p className="text-sm text-gray-400 mt-1">
            Website traffic (Google Analytics) and revenue performance
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

      {/* Google Analytics (GA4) */}
      <GoogleAnalyticsSection />

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

      {revenue?.note && (
        <p className="text-[11px] text-gray-600 text-center">{revenue.note}</p>
      )}
    </div>
  );
}
