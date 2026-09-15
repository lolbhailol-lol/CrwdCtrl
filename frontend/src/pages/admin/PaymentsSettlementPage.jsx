import { useCallback, useEffect, useRef, useState } from 'react';
import { IndianRupee, RefreshCw, Upload, Landmark, Download } from 'lucide-react';
import { adminFetchJSON, adminFetchDownload } from '../../services/api/admin.api.js';
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
    unmatched: 'bg-red-500/15 text-red-300 border-red-400/20',
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

const EVENT_FILTERS = [
  { id: 'overall', label: 'Overall' },
  { id: 'mindspark', label: 'Mindspark' },
  { id: 'touch_grass', label: 'Touch Grass' },
];

function eventLabel(row) {
  if (row?.bucket === 'mindspark') {
    const name = String(row?.competitionName || row?.eventName || '').trim();
    if (name && name.toLowerCase() !== 'mindspark') return name;
    return 'Mindspark';
  }
  if (row?.bucket === 'touch_grass') return 'Touch Grass';
  return row?.eventName || row?.groupName || '—';
}

function rowMatchesEventFilter(row, filter) {
  const bucket = String(row?.bucket || '').trim();
  if (!filter || filter === 'overall') return true;
  return bucket === filter;
}

function getScheduleParts(summary) {
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
      cadence.touchGrass && {
        id: 'touch_grass',
        label: 'Touch Grass',
        cadence: 't_plus',
        ...cadence.touchGrass,
      },
    ].filter(Boolean);
  return { cadence, events };
}

function periodMetaFromSummary(sum, scope) {
  if (!scope || scope === 'all') return {};
  const [bucket, view] = String(scope).split(':');
  const { events } = getScheduleParts(sum);
  const event = events.find((row) => row.id === bucket);
  if (!event) return { bucket };

  if (event.cadence === 'monday_clear') {
    const clear = view === 'next_week' ? event.nextMondayClear : event.thisMondayClear;
    return {
      bucket: 'mindspark',
      weekStartYmd: clear?.weekStartYmd || '',
      weekEndYmd: clear?.weekEndYmd || '',
      weekStart: clear?.weekStart,
      weekEnd: clear?.weekEnd,
      clearMonday: clear?.clearMonday,
      clearMondayYmd: clear?.clearMondayYmd || '',
      label: view === 'next_week' ? 'Mindspark · next week' : 'Mindspark · this week',
    };
  }

  if (view === 'waiting_t2') {
    return { bucket: 'touch_grass', stageGroup: 'waiting_t2', label: 'Touch Grass · waiting T+2' };
  }
  if (view === 'ready') {
    return { bucket: 'touch_grass', stageGroup: 'ready', label: 'Touch Grass · expected in bank' };
  }
  return { bucket: 'touch_grass', label: 'Touch Grass · all' };
}

function historyPath(filter, query, periodMeta = {}) {
  const params = new URLSearchParams({ limit: '500' });
  const bucket = periodMeta.bucket || (filter && filter !== 'overall' ? filter : '');
  if (bucket) params.set('bucket', bucket);
  if (periodMeta.weekStartYmd) params.set('weekStartYmd', periodMeta.weekStartYmd);
  if (periodMeta.weekEndYmd) params.set('weekEndYmd', periodMeta.weekEndYmd);
  if (periodMeta.clearMondayYmd) params.set('clearMondayYmd', periodMeta.clearMondayYmd);
  if (periodMeta.stageGroup) params.set('stageGroup', periodMeta.stageGroup);
  if (query) params.set('q', query);
  return `/admin/payments/history?${params.toString()}`;
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

export default function PaymentsSettlementPage() {
  const [summary, setSummary] = useState(null);
  const [history, setHistory] = useState({ rows: [], total: 0 });
  const [recon, setRecon] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [syncNote, setSyncNote] = useState('');
  const [q, setQ] = useState('');
  const [savingKey, setSavingKey] = useState('');
  const [eventFilter, setEventFilter] = useState('overall');
  const [periodScope, setPeriodScope] = useState('all');

  const loadRef = useRef(null);
  const qRef = useRef(q);
  const periodScopeRef = useRef(periodScope);
  const eventFilterRef = useRef(eventFilter);
  const loadGenRef = useRef(0);
  const txSectionRef = useRef(null);

  qRef.current = q;
  periodScopeRef.current = periodScope;
  eventFilterRef.current = eventFilter;

  const load = useCallback(async (searchQuery = '', scopeOverride, filterOverride) => {
    setError('');
    const scope = scopeOverride ?? periodScopeRef.current;
    const filter = filterOverride ?? eventFilterRef.current;
    const gen = ++loadGenRef.current;
    try {
      const sum = await adminFetchJSON('/admin/payments/summary');
      if (gen !== loadGenRef.current) return;
      const periodMeta = periodMetaFromSummary(sum, scope);
      if (!periodMeta.bucket && filter && filter !== 'overall') periodMeta.bucket = filter;

      const hist = await adminFetchJSON(historyPath(filter, searchQuery, periodMeta));
      if (gen !== loadGenRef.current) return;

      const bucketFilter = periodMeta.bucket || filter;
      const safeRows = (hist.rows || []).filter((row) => rowMatchesEventFilter(row, bucketFilter === 'overall' ? 'overall' : bucketFilter));
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
        const result = await adminFetchJSON('/admin/payments/settlements/sync', {
          method: 'POST',
          body: JSON.stringify({ dashboard: true, limit: 80 }),
        });
        if (!cancelled && !result.skipped) {
          setSyncNote(`Cashfree sync · ${result.success || 0} settled · ${result.pending || 0} pending`);
        }
      } catch (err) {
        if (!cancelled) setSyncNote(err.message || 'Settlement sync failed');
      }
      if (!cancelled && loadRef.current) {
        await loadRef.current(qRef.current, periodScopeRef.current, eventFilterRef.current);
      }
    };
    syncThenLoad();
    const poll = setInterval(() => {
      if (!cancelled && loadRef.current) {
        loadRef.current(qRef.current, periodScopeRef.current, eventFilterRef.current);
      }
    }, 60000);
    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, []);

  const applyFilter = async (filter, scope = 'all') => {
    setEventFilter(filter);
    eventFilterRef.current = filter;
    setPeriodScope(scope);
    periodScopeRef.current = scope;
    setQ('');
    setHistory({ rows: [], total: 0 });
    setLoading(true);
    await load('', scope, filter);
    if (scope !== 'all') {
      requestAnimationFrame(() => txSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  };

  const searchHistory = async (event) => {
    event.preventDefault();
    try {
      const filter = eventFilterRef.current;
      const periodMeta = periodMetaFromSummary(summary, periodScopeRef.current);
      if (!periodMeta.bucket && filter !== 'overall') periodMeta.bucket = filter;
      const hist = await adminFetchJSON(historyPath(filter, q, periodMeta));
      const bucketFilter = periodMeta.bucket || filter;
      const safeRows = (hist.rows || []).filter((row) => rowMatchesEventFilter(row, bucketFilter === 'overall' ? 'overall' : bucketFilter));
      setHistory({ ...hist, rows: safeRows, total: safeRows.length });
    } catch (err) {
      setError(err.message || 'Failed to search history');
    }
  };

  const syncSettlements = async () => {
    setSyncNote('');
    try {
      const result = await adminFetchJSON('/admin/payments/settlements/sync', {
        method: 'POST',
        body: JSON.stringify({ dashboard: true, limit: 80 }),
      });
      setSyncNote(`Cashfree sync · ${result.success || 0} settled · ${result.pending || 0} pending`);
      await load(q, periodScopeRef.current, eventFilterRef.current);
    } catch (err) {
      setSyncNote(err.message || 'Settlement sync failed');
    }
  };

  const uploadCsv = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const body = new FormData();
      body.append('file', file);
      setRecon(await adminFetchJSON('/admin/payments/reconcile', { method: 'POST', body }));
      await load(q, periodScopeRef.current, eventFilterRef.current);
    } catch (err) {
      setError(err.message || 'CSV upload failed');
    }
  };

  const downloadExport = async (kind, opts = {}) => {
    setError('');
    try {
      const params = new URLSearchParams({ kind });
      const bucket = opts.bucket
        || (eventFilterRef.current !== 'overall' ? eventFilterRef.current : null);
      if (bucket) params.set('bucket', bucket);
      if (opts.clearMondayYmd) params.set('clearMondayYmd', opts.clearMondayYmd);
      if (opts.stageGroup) params.set('stageGroup', opts.stageGroup);
      const { blob, filename } = await adminFetchDownload(`/admin/payments/export?${params.toString()}`);
      triggerBlobDownload(blob, filename);
    } catch (err) {
      setError(err.message || 'Export failed');
    }
  };

  const markBatchPaid = async ({ bucket, clearMondayYmd, stageGroup = 'ready' }) => {
    setSavingKey(`batch:${bucket}`);
    setError('');
    try {
      const result = await adminFetchJSON('/admin/payments/batch/mark-paid', {
        method: 'POST',
        body: JSON.stringify({ bucket, clearMondayYmd, stageGroup }),
      });
      setSyncNote(`Marked paid · ${formatINR(result.amount)} · ${result.paymentCount || 0} payments`);
      await load(q, periodScopeRef.current, eventFilterRef.current);
    } catch (err) {
      setError(err.message || 'Failed to mark batch paid');
    } finally {
      setSavingKey('');
    }
  };

  if (loading && !summary) {
    return <InlinePageLoader label="Loading payments…" />;
  }

  const { cadence, events: scheduleEvents } = getScheduleParts(summary);
  const mindspark = scheduleEvents.find((e) => e.id === 'mindspark');
  const touchGrass = scheduleEvents.find((e) => e.id === 'touch_grass');
  const thisClear = mindspark?.thisMondayClear || {};
  const nextClear = mindspark?.nextMondayClear || {};

  const buckets = summary?.buckets || [];
  const totals = summary?.totals || {};
  const activeBucket = eventFilter === 'overall' ? null : buckets.find((b) => b.id === eventFilter);
  const viewTotals = activeBucket ? {
    totalCollected: activeBucket.gross,
    crwdctrlFee: activeBucket.fee,
    organizerPayable: activeBucket.organizerPayable,
    settlementSuccess: activeBucket.settlementSuccess || 0,
    successfulPayments: activeBucket.registrations || 0,
    settlementPendingCount: Math.max(0, (activeBucket.registrations || 0) - (activeBucket.settlementSuccess || 0)),
    alreadyPaid: activeBucket.alreadyPaid || 0,
    alreadyPaidCount: activeBucket.alreadyPaidCount || 0,
    refunds: activeBucket.refunded || 0,
  } : totals;

  const filterLabel = EVENT_FILTERS.find((f) => f.id === eventFilter)?.label || 'Overall';
  const periodMeta = periodMetaFromSummary(summary, periodScope);
  const historyRows = history.rows || [];
  const showMs = eventFilter === 'overall' || eventFilter === 'mindspark';
  const showTg = eventFilter === 'overall' || eventFilter === 'touch_grass';

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
    ...(eventFilter === 'touch_grass' ? [] : [{
      key: 'clear',
      label: 'Monday clear',
      render: (row) => (
        <span className="whitespace-nowrap text-xs">
          {row.bucket === 'mindspark' && row.schedule?.clearMonday
            ? formatDay(row.schedule.clearMonday)
            : '—'}
        </span>
      ),
    }]),
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
    <div className="space-y-6 pb-10 min-w-0 max-w-full overflow-x-hidden">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <IndianRupee size={26} className="text-[#0ECCEE] shrink-0" />
            Payments & Settlement
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Expected in bank = T+2 for all. Weekly Monday clear = Mindspark only.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => downloadExport('history')} className="px-3 py-2 rounded-lg border border-gray-700 text-sm">
            <Download size={14} className="inline mr-1.5" />Export
          </button>
          <button type="button" onClick={syncSettlements} className="px-3 py-2 rounded-lg border border-gray-700 text-sm">
            <Landmark size={14} className="inline mr-1.5" />Sync
          </button>
          <button type="button" onClick={() => load(q, periodScopeRef.current, eventFilterRef.current)} className="px-3 py-2 rounded-lg border border-gray-700 text-sm">
            <RefreshCw size={14} className="inline mr-1.5" />Refresh
          </button>
        </div>
      </div>

      {error && <div className="bg-red-900/20 border border-red-800 rounded-lg p-3 text-sm text-red-400">{error}</div>}
      {syncNote && <div className="text-sm text-gray-400">{syncNote}</div>}

      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-sm text-gray-500">Event</span>
        {EVENT_FILTERS.map((f) => (
          <Chip key={f.id} active={periodScope === 'all' && eventFilter === f.id} onClick={() => applyFilter(f.id, 'all')}>
            {f.label}
          </Chip>
        ))}
      </div>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
        <div className="bg-[#111213] border border-gray-800 rounded-xl p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wider">1. Payment</div>
          <p className="text-white font-medium mt-1">Cashfree success</p>
        </div>
        <div className="bg-[#111213] border border-gray-800 rounded-xl p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wider">2. Expected in bank</div>
          <p className="text-white font-medium mt-1">T+{cadence.tPlusDays || 2} working days</p>
          <p className="text-xs text-gray-500 mt-1">Mindspark + Touch Grass</p>
        </div>
        <div className={`bg-[#111213] border border-gray-800 rounded-xl p-4 ${eventFilter === 'touch_grass' ? 'opacity-50' : ''}`}>
          <div className="text-xs text-gray-500 uppercase tracking-wider">3. Monday clear</div>
          <p className="text-white font-medium mt-1">Mindspark only</p>
          <p className="text-xs text-gray-500 mt-1">Weekly Mon–Sun → clear Monday</p>
        </div>
      </section>

      <section className={`grid grid-cols-1 gap-3 ${showMs && showTg ? 'xl:grid-cols-3' : 'lg:grid-cols-2'}`}>
        {showMs ? (
          <div className={`bg-[#111213] border rounded-xl p-4 ${periodScope === 'mindspark:this_week' ? 'border-[#0ECCEE]' : 'border-[#0ECCEE]/30'}`}>
            <div className="text-xs uppercase tracking-wider text-gray-500">Mindspark · this week</div>
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
              <Chip active={periodScope === 'mindspark:this_week'} onClick={() => applyFilter('mindspark', 'mindspark:this_week')}>
                Week transactions
              </Chip>
              <button type="button" onClick={() => downloadExport('monday_clear', { bucket: 'mindspark', clearMondayYmd: thisClear.clearMondayYmd })} className="text-xs px-2.5 py-1.5 rounded-md border border-gray-700">
                Export
              </button>
              {Number(thisClear.readyPayable) > 0 ? (
                <button
                  type="button"
                  disabled={savingKey.startsWith('batch:mindspark')}
                  onClick={() => markBatchPaid({ bucket: 'mindspark', clearMondayYmd: thisClear.clearMondayYmd })}
                  className="text-xs px-2.5 py-1.5 rounded-md border border-emerald-700/50 text-emerald-300"
                >
                  Mark paid
                </button>
              ) : Number(thisClear.paidPayable) > 0 ? (
                <span className="text-xs px-2.5 py-1.5 rounded-md border border-emerald-700/40 text-emerald-300">
                  Paid
                </span>
              ) : null}
            </div>
          </div>
        ) : null}

        {showMs ? (
          <div className={`bg-[#111213] border rounded-xl p-4 ${periodScope === 'mindspark:next_week' ? 'border-[#0ECCEE]' : 'border-gray-800'}`}>
            <div className="text-xs uppercase tracking-wider text-gray-500">Mindspark · next week</div>
            <div className="text-sm text-gray-400 mt-1">{formatRange(nextClear.weekStart, nextClear.weekEnd)}</div>
            <div className="text-2xl font-bold text-white mt-3 tabular-nums">{formatINR(nextClear.payable)}</div>
            <p className="text-sm text-gray-300 mt-1">Monday clear {formatDay(nextClear.clearMonday)}</p>
            <p className="text-sm text-gray-500 mt-2">{nextClear.payments || 0} payments collecting now</p>
            <div className="mt-4">
              <Chip active={periodScope === 'mindspark:next_week'} onClick={() => applyFilter('mindspark', 'mindspark:next_week')}>
                Week transactions
              </Chip>
            </div>
          </div>
        ) : null}

        {showTg ? (
          <div className={`bg-[#111213] border rounded-xl p-4 ${String(periodScope).startsWith('touch_grass') ? 'border-[#0ECCEE]' : 'border-gray-800'}`}>
            <div className="text-xs uppercase tracking-wider text-gray-500">Touch Grass · expected in bank</div>
            <div className="text-sm text-[#0ECCEE]/80 mt-1">No Monday clear</div>
            <div className="text-2xl font-bold text-white mt-3 tabular-nums">{formatINR(touchGrass?.expectedInBankPayable)}</div>
            <p className="text-sm text-amber-300 mt-2">{formatINR(touchGrass?.waitingT2Payable)} waiting T+2 ({touchGrass?.waitingT2Count || 0})</p>
            <div className="flex flex-wrap gap-2 mt-4">
              <Chip active={periodScope === 'touch_grass:all' || (eventFilter === 'touch_grass' && periodScope === 'all')} onClick={() => applyFilter('touch_grass', 'all')}>
                All TG
              </Chip>
              <Chip active={periodScope === 'touch_grass:ready'} onClick={() => applyFilter('touch_grass', 'touch_grass:ready')}>
                In bank
              </Chip>
              <Chip active={periodScope === 'touch_grass:waiting_t2'} onClick={() => applyFilter('touch_grass', 'touch_grass:waiting_t2')}>
                Waiting T+2
              </Chip>
            </div>
          </div>
        ) : null}
      </section>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard label={`${filterLabel} collected`} value={formatINR(viewTotals.totalCollected)} />
        <StatCard label="Fee 1.6%" value={formatINR(viewTotals.crwdctrlFee)} />
        <StatCard label="Organizer payable" value={formatINR(viewTotals.organizerPayable)} />
        <StatCard
          label={`${filterLabel} payments`}
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
            <h2 className="text-lg font-semibold">
              Transactions
              {eventFilter === 'mindspark' ? ' · Mindspark' : ''}
              {eventFilter === 'touch_grass' ? ' · Touch Grass only' : ''}
            </h2>
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

          {showMs ? (
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-xs text-gray-500">Mindspark week</span>
              <Chip
                active={eventFilter === 'mindspark' && periodScope === 'all'}
                onClick={() => applyFilter('mindspark', 'all')}
              >
                All latest
              </Chip>
              <Chip
                active={periodScope === 'mindspark:this_week'}
                onClick={() => applyFilter('mindspark', 'mindspark:this_week')}
              >
                This week {formatRange(thisClear.weekStart, thisClear.weekEnd)}
              </Chip>
              <Chip
                active={periodScope === 'mindspark:next_week'}
                onClick={() => applyFilter('mindspark', 'mindspark:next_week')}
              >
                Next week {formatRange(nextClear.weekStart, nextClear.weekEnd)}
              </Chip>
            </div>
          ) : null}

          {periodScope !== 'all' && periodMeta.label ? (
            <p className="text-sm text-[#0ECCEE]">
              {periodMeta.label}
              {periodMeta.weekStart ? ` · ${formatRange(periodMeta.weekStart, periodMeta.weekEnd)}` : ''}
              {periodMeta.clearMonday ? ` · clears ${formatDay(periodMeta.clearMonday)}` : ''}
            </p>
          ) : null}
        </div>

        <SimpleTable
          empty={
            eventFilter === 'mindspark'
              ? 'No Mindspark payments in this view'
              : eventFilter === 'touch_grass'
                ? 'No Touch Grass payments yet'
                : 'No Cashfree payments yet'
          }
          columns={txColumns}
          rows={historyRows}
        />
        <p className="text-xs text-gray-500">
          {historyRows.length} payments
          {eventFilter === 'mindspark' ? ' · Mindspark' : ''}
          {eventFilter === 'touch_grass' ? ' · Touch Grass only' : ''}
          {periodScope.includes('week') ? ' · week filter on' : ''}
        </p>
      </section>

      <section className="space-y-3 min-w-0">
        <h2 className="text-lg font-semibold">Cashfree reconciliation</h2>
        <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-700 text-sm cursor-pointer">
          <Upload size={14} />
          Upload CSV
          <input type="file" accept=".csv,text/csv" className="hidden" onChange={uploadCsv} />
        </label>
        {recon ? (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
            <div className="bg-[#111213] border border-gray-800 rounded-xl p-3">Matched<div className="text-lg font-semibold">{recon.matchedCount}</div></div>
            <div className="bg-[#111213] border border-gray-800 rounded-xl p-3">Unmatched CF<div className="text-lg font-semibold">{recon.unmatchedCashfreeCount}</div></div>
            <div className="bg-[#111213] border border-gray-800 rounded-xl p-3">Unmatched CC<div className="text-lg font-semibold">{recon.unmatchedCrwdctrlCount}</div></div>
            <div className="bg-[#111213] border border-gray-800 rounded-xl p-3">Mismatch<div className="text-lg font-semibold">{recon.amountMismatchCount}</div></div>
            <div className="bg-[#111213] border border-gray-800 rounded-xl p-3">Duplicates<div className="text-lg font-semibold">{recon.duplicateCount}</div></div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
