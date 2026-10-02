import { useCallback, useEffect, useRef, useState } from 'react';
import { IndianRupee, RefreshCw, Landmark, LogOut } from 'lucide-react';
import {
    fetchMindSparkPaymentsSummary,
    syncMindSparkPaymentsSettlements,
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

function StatCard({ label, value, hint }) {
  return (
    <div className="bg-[#111213] rounded-xl border border-gray-800 p-4 min-w-0">
      <div className="text-[11px] uppercase tracking-wider text-gray-500 truncate">{label}</div>
      <div className="text-xl font-bold text-white mt-1.5 tabular-nums truncate">{value}</div>
      {hint ? <div className="text-xs text-gray-400 mt-1">{hint}</div> : null}
    </div>
  );
}

export default function MindSparkPaymentsPage() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [syncNote, setSyncNote] = useState('');
  const loadRef = useRef(null);
  const session = getMindSparkPaymentsSession();

  const load = useCallback(async () => {
    setError('');
    try {
      setSummary(await fetchMindSparkPaymentsSummary());
    } catch (err) {
      setError(err.message || 'Failed to load payments');
    } finally {
      setLoading(false);
    }
  }, []);
  loadRef.current = load;

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
      if (!cancelled) await loadRef.current?.();
    };
    syncThenLoad();
    const poll = setInterval(() => {
      if (!cancelled) loadRef.current?.();
    }, 60000);
    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, []);

  const syncSettlements = async () => {
    setSyncNote('');
    try {
      const result = await syncMindSparkPaymentsSettlements();
      setSyncNote(`Cashfree sync · ${result.success || 0} settled · ${result.pending || 0} pending`);
      await load();
    } catch (err) {
      setSyncNote(err.message || 'Settlement sync failed');
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

  const totals = summary?.totals || {};

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
              Payments summary
            </h2>
            <p className="text-sm text-gray-400 mt-1">MindSpark totals across Cashfree and Razorpay.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={syncSettlements} className="px-3 py-2 rounded-lg border border-gray-700 text-sm">
              <Landmark size={14} className="inline mr-1.5" />Sync
            </button>
            <button type="button" onClick={() => load()} className="px-3 py-2 rounded-lg border border-gray-700 text-sm">
              <RefreshCw size={14} className="inline mr-1.5" />Refresh
            </button>
          </div>
        </div>

        {error && <div className="bg-red-900/20 border border-red-800 rounded-lg p-3 text-sm text-red-400">{error}</div>}
        {syncNote && <div className="text-sm text-gray-400">{syncNote}</div>}

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <StatCard label="MindSpark collected" value={formatINR(totals.totalCollected)} />
          <StatCard label="Total deductions" value={formatINR(totals.totalDeductions)} hint="Settlement deductions included" />
          <StatCard label="Organizer payable" value={formatINR(totals.organizerPayable)} />
          <StatCard label="Paid entries" value={totals.paidEntries || 0} hint="Competition entries · Cashfree and Razorpay" />
          <StatCard label="Cleared / paid" value={formatINR(totals.alreadyPaid)} hint="Already paid out to organizers" />
        </div>
      </main>
    </div>
  );
}
