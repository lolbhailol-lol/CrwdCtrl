import { useCallback, useEffect, useRef, useState } from 'react';
import { IndianRupee, RefreshCw, Landmark, Download, LogOut } from 'lucide-react';
import {
    fetchMindSparkPaymentsSummary,
    fetchMindSparkPaymentsHistory,
    syncMindSparkPaymentsSettlements,
    downloadMindSparkPaymentsExport,
} from '../../services/api/mindsparkPayments.api.js';
import {
    getMindSparkPaymentsSession,
    clearMindSparkPaymentsSession,
} from '../../utils/mindsparkPaymentsSession';
import { InlinePageLoader } from '../../components/DetailPageLoader';

function formatINR(amount) {
  return `₹${Number(amount || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDay(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Kolkata',
  });
}

function formatRange(start, end) {
  if (!start || !end) return '—';
  return `${formatDay(start)} – ${formatDay(end)}`;
}

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  });
}

function StatusPill({ value, label }) {
  const v = String(value || 'pending').toLowerCase();
  const tone = {
    paid: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/20',
    success: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/20',
    settled: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/20',
    ready: 'bg-sky-500/15 text-sky-300 border-sky-400/20',
    pending: 'bg-amber-500/15 text-amber-300 border-amber-400/20',
    waiting_t2: 'bg-amber-500/15 text-amber-300 border-amber-400/20',
    waiting_monday: 'bg-sky-500/15 text-sky-300 border-sky-400/20',
    due_monday: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/20',
    expected_in_bank: 'bg-sky-500/15 text-sky-300 border-sky-400/20',
    in_bank: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/20',
    partial: 'bg-amber-500/15 text-amber-300 border-amber-400/20',
    failed: 'bg-red-500/15 text-red-300 border-red-400/20',
  }[v] || 'bg-gray-700/40 text-gray-400 border-gray-600/40';
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-md text-[11px] border capitalize ${tone}`}>
      {label || v.replace(/_/g, ' ')}
    </span>
  );
}

function MonoId({ value }) {
  const text = String(value || '').trim();
  if (!text) return <span className="text-gray-600">—</span>;
  return <span className="font-mono text-[11px] text-gray-200 break-all">{text}</span>;
}

function StatCard({ label, value, hint }) {
  return (
    <div className="bg-[#111213] rounded-xl border border-gray-800 p-4 min-w-0">
      <div className="text-[11px] uppercase tracking-wider text-gray-500 truncate">{label}</div>
      <div className="text-xl font-bold text-white mt-1.5 tabular-nums truncate">{value}</div>
      {hint ? <div className="text-xs text-gray-400 mt-1">{hint}</div> : null}
    </div>
  );
}

function SimpleTable({ columns, rows, empty }) {
  return (
    <div className="w-full max-w-full overflow-x-auto rounded-xl border border-gray-800">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="bg-[#1a1b1c] text-gray-400 text-xs uppercase tracking-wider">
          <tr>
            {columns.map((col) => (
              <th key={col.key} className="text-left font-medium px-3 py-2.5 whitespace-nowrap">{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-3 py-8 text-center text-gray-500">{empty || 'No rows'}</td>
            </tr>
          ) : rows.map((row, i) => (
            <tr key={row.orderId || row.id || i} className="border-t border-gray-800">
              {columns.map((col) => (
                <td key={col.key} className="px-3 py-2.5 text-gray-200 align-top">
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Chip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
        active
          ? 'bg-[#0ECCEE]/15 text-[#0ECCEE] border-[#0ECCEE]/40'
          : 'border-gray-700 text-gray-300 hover:border-gray-500'
      }`}
    >
      {children}
    </button>
  );
}

function eventLabel(row) {
  const name = String(row?.competitionName || row?.eventName || '').trim();
  if (name && name.toLowerCase() !== 'mindspark') return name;
  return 'Mindspark';
}

function getMindsparkSchedule(summary) {
  const cadence = summary?.schedule || {};
  const events = cadence.events?.length
    ? cadence.events
    : [
      cadence.mindspark && {
        id: 'mindspark',
        label: 'Mindspark',
        cadence: 'monday_clear',
        thisMondayClear: cadence.mindspark.thisMondayClear,
        nextMondayClear: cadence.mindspark.nextMondayClear,
      },
    ].filter(Boolean);
  return events.find((row) => row.id === 'mindspark') || events[0] || {};
}

function periodMetaFromSummary(sum, scope) {
  if (!scope || scope === 'all') return { bucket: 'mindspark' };
  const view = String(scope).split(':')[1];
  const event = getMindsparkSchedule(sum);
  const clear = view === 'next_week' ? event.nextMondayClear : event.thisMondayClear;
  return {
    bucket: 'mindspark',
    weekStartYmd: clear?.weekStartYmd || '',
    weekEndYmd: clear?.weekEndYmd || '',
    weekStart: clear?.weekStart,
    weekEnd: clear?.weekEnd,
    clearMonday: clear?.clearMonday,
    clearMondayYmd: clear?.clearMondayYmd || '',
    label: view === 'next_week' ? 'MindSpark · next week' : 'MindSpark · this week',
  };
}

function historyQuery(searchQuery, periodMeta = {}) {
  const params = new URLSearchParams({ limit: '500', bucket: 'mindspark' });
  if (periodMeta.weekStartYmd) params.set('weekStartYmd', periodMeta.weekStartYmd);
  if (periodMeta.weekEndYmd) params.set('weekEndYmd', periodMeta.weekEndYmd);
  if (periodMeta.clearMondayYmd) params.set('clearMondayYmd', periodMeta.clearMondayYmd);
  if (searchQuery) params.set('q', searchQuery);
  return `?${params.toString()}`;
}

function triggerBlobDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function MindSparkPaymentsPage() {
  const [summary, setSummary] = useState(null);
  const [history, setHistory] = useState({ rows: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [syncNote, setSyncNote] = useState('');
  const [q, setQ] = useState('');
  const [periodScope, setPeriodScope] = useState('all');

  const loadRef = useRef(null);
  const qRef = useRef(q);
  const periodScopeRef = useRef(periodScope);
  const loadGenRef = useRef(0);
  const txSectionRef = useRef(null);
  const session = getMindSparkPaymentsSession();

  qRef.current = q;
  periodScopeRef.current = periodScope;

  const load = useCallback(async (searchQuery = '', scopeOverride) => {
    setError('');
    const scope = scopeOverride ?? periodScopeRef.current;
    const gen = ++loadGenRef.current;
    try {
      const sum = await fetchMindSparkPaymentsSummary();
      if (gen !== loadGenRef.current) return;
      const periodMeta = periodMetaFromSummary(sum, scope);
      const hist = await fetchMindSparkPaymentsHistory(historyQuery(searchQuery, periodMeta));
      if (gen !== loadGenRef.current) return;
      const safeRows = (hist.rows || []).filter((row) => String(row?.bucket || '') === 'mindspark');
      setSummary(sum);
      setHistory({ ...hist, rows: safeRows, total: safeRows.length });
    } catch (err) {
      if (gen !== loadGenRef.current) return;
      setError(err.message || 'Failed to load payments');
    } finally {
      if (gen === loadGenRef.current) setLoading(false);
    }
  }, []);
  loadRef.current = load;

  useEffect(() => {
    load('');
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    const syncThenLoad = async () => {
      try {
        const result = await syncMindSparkPaymentsSettlements();
        if (!cancelled && !result.skipped) {
          setSyncNote(`Cashfree sync · ${result.success || 0} settled · ${result.pending || 0} pending`);
        }
      } catch (err) {
        if (!cancelled) setSyncNote(err.message || 'Settlement sync failed');
      }
      if (!cancelled && loadRef.current) {
        await loadRef.current(qRef.current, periodScopeRef.current);
      }
    };
    syncThenLoad();
    const poll = setInterval(() => {
      if (!cancelled && loadRef.current) {
        loadRef.current(qRef.current, periodScopeRef.current);
      }
    }, 60000);
    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, []);

  const applyScope = async (scope = 'all') => {
    setPeriodScope(scope);
    periodScopeRef.current = scope;
    setQ('');
    setHistory({ rows: [], total: 0 });
    setLoading(true);
    await load('', scope);
    if (scope !== 'all') {
      requestAnimationFrame(() => txSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  };

  const searchHistory = async (event) => {
    event.preventDefault();
    try {
      const periodMeta = periodMetaFromSummary(summary, periodScopeRef.current);
      const hist = await fetchMindSparkPaymentsHistory(historyQuery(q, periodMeta));
      const safeRows = (hist.rows || []).filter((row) => String(row?.bucket || '') === 'mindspark');
      setHistory({ ...hist, rows: safeRows, total: safeRows.length });
    } catch (err) {
      setError(err.message || 'Failed to search history');
    }
  };

  const syncSettlements = async () => {
    setSyncNote('');
    try {
      const result = await syncMindSparkPaymentsSettlements();
      setSyncNote(`Cashfree sync · ${result.success || 0} settled · ${result.pending || 0} pending`);
      await load(q, periodScopeRef.current);
    } catch (err) {
      setSyncNote(err.message || 'Settlement sync failed');
    }
  };

  const downloadExport = async (kind, opts = {}) => {
    setError('');
    try {
      const params = new URLSearchParams({ kind, bucket: 'mindspark' });
      if (opts.clearMondayYmd) params.set('clearMondayYmd', opts.clearMondayYmd);
      const { blob, filename } = await downloadMindSparkPaymentsExport(`?${params.toString()}`);
      triggerBlobDownload(blob, filename);
    } catch (err) {
      setError(err.message || 'Export failed');
    }
  };

  const logout = () => {
    clearMindSparkPaymentsSession();
    window.location.assign('/mindspark-payments/login');
  };

  if (loading && !summary) {
    return (
      <div className="min-h-screen bg-[#161718] text-white">
        <InlinePageLoader label="Loading MindSpark payments…" />
      </div>
    );
  }

  const mindspark = getMindsparkSchedule(summary);
  const thisClear = mindspark?.thisMondayClear || {};
  const nextClear = mindspark?.nextMondayClear || {};
  const cadence = summary?.schedule || {};
  const buckets = summary?.buckets || [];
  const activeBucket = buckets.find((b) => b.id === 'mindspark');
  const totals = summary?.totals || {};
  const viewTotals = activeBucket ? {
    totalCollected: activeBucket.gross,
    crwdctrlFee: activeBucket.fee,
    organizerPayable: activeBucket.organizerPayable,
    settlementSuccess: activeBucket.settlementSuccess || 0,
    successfulPayments: activeBucket.registrations || 0,
    alreadyPaid: activeBucket.alreadyPaid || 0,
    alreadyPaidCount: activeBucket.alreadyPaidCount || 0,
  } : totals;

  const periodMeta = periodMetaFromSummary(summary, periodScope);
  const historyRows = history.rows || [];

  const txColumns = [
    {
      key: 'createdAt',
      label: 'Paid at',
      render: (row) => <span className="whitespace-nowrap text-xs sm:text-sm">{formatDate(row.createdAt)}</span>,
    },
    { key: 'eventName', label: 'Event', render: (row) => eventLabel(row) },
    {
      key: 'ids',
      label: 'Order / Payment',
      render: (row) => (
        <div className="space-y-0.5 min-w-[9rem]">
          <div className="flex gap-1.5 items-start">
            <span className="text-[10px] uppercase tracking-wider text-gray-500 shrink-0 w-8 pt-0.5">Ord</span>
            <MonoId value={row.orderId} />
          </div>
          <div className="flex gap-1.5 items-start">
            <span className="text-[10px] uppercase tracking-wider text-gray-500 shrink-0 w-8 pt-0.5">Pay</span>
            <MonoId value={row.paymentId} />
          </div>
        </div>
      ),
    },
    { key: 'netGross', label: 'Amount', render: (row) => <span className="whitespace-nowrap">{formatINR(row.netGross)}</span> },
    {
      key: 'bank',
      label: 'Expected in bank',
      render: (row) => <span className="whitespace-nowrap text-xs">{formatDay(row.schedule?.expectedBankOn)}</span>,
    },
    {
      key: 'clear',
      label: 'Monday clear',
      render: (row) => (
        <span className="whitespace-nowrap text-xs">
          {row.schedule?.clearMonday ? formatDay(row.schedule.clearMonday) : '—'}
        </span>
      ),
    },
    {
      key: 'stage',
      label: 'Status',
      render: (row) => {
        if (row.payoutStatus === 'paid' || row.schedule?.stage === 'paid') {
          return <StatusPill value="paid" label="Paid successfully" />;
        }
        return <StatusPill value={row.schedule?.stage} label={row.schedule?.stageLabel} />;
      },
    },
    {
      key: 'cf',
      label: 'Cashfree UTR / IDs',
      render: (row) => (
        <div className="text-xs space-y-0.5 min-w-[10rem]">
          <div className="flex gap-1.5 items-start">
            <span className="text-[10px] uppercase tracking-wider text-gray-500 shrink-0 w-9 pt-0.5">UTR</span>
            {row.settlementUtr ? <MonoId value={row.settlementUtr} /> : <span className="text-gray-600">—</span>}
          </div>
          <div className="flex gap-1.5 items-start">
            <span className="text-[10px] uppercase tracking-wider text-gray-500 shrink-0 w-9 pt-0.5">Setl</span>
            {row.cfSettlementId ? <MonoId value={row.cfSettlementId} /> : <span className="text-gray-600">—</span>}
          </div>
          <div className="text-gray-500">
            {row.settlementDate ? formatDate(row.settlementDate) : 'No CF settlement yet'}
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-[#161718] text-white">
      <header className="bg-[#111213] border-b border-gray-800 px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-semibold truncate">MindSpark payments</h1>
          <p className="text-xs text-gray-500 truncate">
            {session?.organizer?.name || session?.organizer?.username || 'MindSpark'}
          </p>
        </div>
        <button
          type="button"
          onClick={logout}
          className="flex items-center gap-2 px-3.5 py-2 rounded-lg border border-red-800/60 text-red-400 hover:bg-red-900/30 text-sm font-medium"
        >
          <LogOut size={15} />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </header>

      <main className="p-3 sm:p-6 space-y-6 pb-10 min-w-0 max-w-full overflow-x-hidden">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
              <IndianRupee size={26} className="text-[#0ECCEE] shrink-0" />
              Payments tracking
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              Expected in bank = T+2. Weekly Monday clear for MindSpark.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => downloadExport('history')} className="px-3 py-2 rounded-lg border border-gray-700 text-sm">
              <Download size={14} className="inline mr-1.5" />Export
            </button>
            <button type="button" onClick={syncSettlements} className="px-3 py-2 rounded-lg border border-gray-700 text-sm">
              <Landmark size={14} className="inline mr-1.5" />Sync
            </button>
            <button type="button" onClick={() => load(q, periodScopeRef.current)} className="px-3 py-2 rounded-lg border border-gray-700 text-sm">
              <RefreshCw size={14} className="inline mr-1.5" />Refresh
            </button>
          </div>
        </div>

        {error && <div className="bg-red-900/20 border border-red-800 rounded-lg p-3 text-sm text-red-400">{error}</div>}
        {syncNote && <div className="text-sm text-gray-400">{syncNote}</div>}

        <section className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          <div className="bg-[#111213] border border-gray-800 rounded-xl p-4">
            <div className="text-xs text-gray-500 uppercase tracking-wider">1. Payment</div>
            <p className="text-white font-medium mt-1">Cashfree success</p>
          </div>
          <div className="bg-[#111213] border border-gray-800 rounded-xl p-4">
            <div className="text-xs text-gray-500 uppercase tracking-wider">2. Expected in bank</div>
            <p className="text-white font-medium mt-1">T+{cadence.tPlusDays || 2} working days</p>
          </div>
          <div className="bg-[#111213] border border-gray-800 rounded-xl p-4">
            <div className="text-xs text-gray-500 uppercase tracking-wider">3. Monday clear</div>
            <p className="text-white font-medium mt-1">Weekly Mon–Sun → clear Monday</p>
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className={`bg-[#111213] border rounded-xl p-4 ${periodScope === 'mindspark:this_week' ? 'border-[#0ECCEE]' : 'border-[#0ECCEE]/30'}`}>
            <div className="text-xs uppercase tracking-wider text-gray-500">This week</div>
            <div className="text-sm text-gray-400 mt-1">{formatRange(thisClear.weekStart, thisClear.weekEnd)}</div>
            <div className="text-2xl font-bold text-white mt-3 tabular-nums">
              {Number(thisClear.readyPayable) > 0
                ? formatINR(thisClear.readyPayable)
                : formatINR(0)}
            </div>
            <p className="text-sm text-gray-300 mt-1">Monday clear {formatDay(thisClear.clearMonday)}</p>
            {Number(thisClear.readyPayable) > 0 ? (
              <p className="text-xs text-gray-500 mt-1">Expected in bank · ready to pay</p>
            ) : Number(thisClear.paidPayable) > 0 ? (
              <p className="text-sm text-emerald-300 mt-1">
                Paid {formatINR(thisClear.paidPayable)} · {thisClear.paidCount || 0} payments
              </p>
            ) : (
              <p className="text-xs text-gray-500 mt-1">Nothing ready to pay</p>
            )}
            {thisClear.waitingT2Count ? (
              <p className="text-sm text-amber-300 mt-2">{formatINR(thisClear.waitingT2Payable)} waiting T+2 ({thisClear.waitingT2Count})</p>
            ) : Number(thisClear.readyPayable) > 0 ? (
              <p className="text-sm text-gray-500 mt-2">{thisClear.payments || 0} payments in week</p>
            ) : null}
            <div className="flex flex-wrap gap-2 mt-4">
              <Chip active={periodScope === 'mindspark:this_week'} onClick={() => applyScope('mindspark:this_week')}>
                Week transactions
              </Chip>
              <button type="button" onClick={() => downloadExport('monday_clear', { clearMondayYmd: thisClear.clearMondayYmd })} className="text-xs px-2.5 py-1.5 rounded-md border border-gray-700">
                Export
              </button>
            </div>
          </div>

          <div className={`bg-[#111213] border rounded-xl p-4 ${periodScope === 'mindspark:next_week' ? 'border-[#0ECCEE]' : 'border-gray-800'}`}>
            <div className="text-xs uppercase tracking-wider text-gray-500">Next week</div>
            <div className="text-sm text-gray-400 mt-1">{formatRange(nextClear.weekStart, nextClear.weekEnd)}</div>
            <div className="text-2xl font-bold text-white mt-3 tabular-nums">{formatINR(nextClear.payable)}</div>
            <p className="text-sm text-gray-300 mt-1">Monday clear {formatDay(nextClear.clearMonday)}</p>
            <p className="text-sm text-gray-500 mt-2">{nextClear.payments || 0} payments collecting now</p>
            <div className="mt-4">
              <Chip active={periodScope === 'mindspark:next_week'} onClick={() => applyScope('mindspark:next_week')}>
                Week transactions
              </Chip>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <StatCard label="MindSpark collected" value={formatINR(viewTotals.totalCollected)} />
          <StatCard label="Fee 1.6%" value={formatINR(viewTotals.crwdctrlFee)} />
          <StatCard label="Organizer payable" value={formatINR(viewTotals.organizerPayable)} />
          <StatCard
            label="MindSpark payments"
            value={viewTotals.successfulPayments || 0}
            hint="Cashfree success"
          />
          <StatCard
            label="Still to clear"
            value={Math.max(0, (viewTotals.successfulPayments || 0) - (viewTotals.alreadyPaidCount || 0))}
            hint="Not marked paid yet"
          />
          <StatCard
            label="Cleared / paid"
            value={formatINR(viewTotals.alreadyPaid)}
            hint={`${viewTotals.alreadyPaidCount || 0} payment${Number(viewTotals.alreadyPaidCount) === 1 ? '' : 's'}`}
          />
        </div>

        <section ref={txSectionRef} className="space-y-3 min-w-0 scroll-mt-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <h2 className="text-lg font-semibold">Transactions · MindSpark</h2>
              <form onSubmit={searchHistory} className="flex flex-wrap gap-2">
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Order ID or payment ID"
                  className="bg-[#111213] border border-gray-800 rounded-lg px-3 py-1.5 text-sm w-full sm:w-52"
                />
                <button type="submit" className="text-sm px-3 py-1.5 rounded-lg border border-gray-700">Search</button>
              </form>
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-xs text-gray-500">Week</span>
              <Chip active={periodScope === 'all'} onClick={() => applyScope('all')}>
                All latest
              </Chip>
              <Chip
                active={periodScope === 'mindspark:this_week'}
                onClick={() => applyScope('mindspark:this_week')}
              >
                This week {formatRange(thisClear.weekStart, thisClear.weekEnd)}
              </Chip>
              <Chip
                active={periodScope === 'mindspark:next_week'}
                onClick={() => applyScope('mindspark:next_week')}
              >
                Next week {formatRange(nextClear.weekStart, nextClear.weekEnd)}
              </Chip>
            </div>

            {periodScope !== 'all' && periodMeta.label ? (
              <p className="text-sm text-[#0ECCEE]">
                {periodMeta.label}
                {periodMeta.weekStart ? ` · ${formatRange(periodMeta.weekStart, periodMeta.weekEnd)}` : ''}
                {periodMeta.clearMonday ? ` · clears ${formatDay(periodMeta.clearMonday)}` : ''}
              </p>
            ) : null}
          </div>

          <SimpleTable
            empty="No MindSpark payments in this view"
            columns={txColumns}
            rows={historyRows}
          />
          <p className="text-xs text-gray-500">
            {historyRows.length} payments · MindSpark
            {periodScope.includes('week') ? ' · week filter on' : ''}
          </p>
        </section>
      </main>
    </div>
  );
}
