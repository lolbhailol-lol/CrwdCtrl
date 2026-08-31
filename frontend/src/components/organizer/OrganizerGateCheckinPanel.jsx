import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader, Phone, RefreshCw, Search, UserCheck, Users } from 'lucide-react';

const POLL_MS = 30000;

function formatTime(value) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function telHref(phone) {
  const digits = String(phone || '').replace(/[^\d+]/g, '');
  return digits ? `tel:${digits}` : null;
}

/**
 * Gate-side roster: Still outside / Checked in + search → one-tap check-in.
 * Portals pass thin adapters (list / lookup / checkin / normalize).
 */
export default function OrganizerGateCheckinPanel({
  listRoster,
  lookup = null,
  manualCheckin,
  normalize,
  refreshKey = 0,
  confirmCheckin = null,
  onToast = null,
  searchPlaceholder = 'Name, phone, email, or ID',
  outsideStatus = 'not_in',
  insideStatus = 'checked_in',
  pageSize = 30,
  labels = {},
}) {
  const L = {
    title: 'Gate roster',
    subtitle: "Who checked in, who didn't — name & contact at a glance",
    outside: 'Still outside',
    inside: 'Checked in',
    outsideEmpty: 'Everyone is checked in',
    insideEmpty: 'No check-ins yet',
    searchEmpty: 'No matches',
    checkIn: 'Check in',
    stillOutside: 'Still outside',
    checkedIn: 'Checked in',
    ...labels,
  };
  const [tab, setTab] = useState('outside'); // outside | inside | search
  const [query, setQuery] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checkinId, setCheckinId] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });

  const adaptersRef = useRef({ listRoster, lookup, normalize, manualCheckin, confirmCheckin, onToast });
  adaptersRef.current = { listRoster, lookup, normalize, manualCheckin, confirmCheckin, onToast };

  const stateRef = useRef({ tab, activeSearch, outsideStatus, insideStatus, pageSize, pagination });
  stateRef.current = { tab, activeSearch, outsideStatus, insideStatus, pageSize, pagination };

  const loadSeqRef = useRef(0);

  const toast = useCallback((msg) => {
    adaptersRef.current.onToast?.(msg);
  }, []);

  const load = useCallback(async (page = 1, opts = {}) => {
    const {
      tab: curTab,
      activeSearch: curSearch,
      outsideStatus: outSt,
      insideStatus: inSt,
      pageSize: limit,
    } = stateRef.current;
    const { listRoster: listFn, lookup: lookupFn, normalize: norm } = adaptersRef.current;

    const searchQ = opts.search !== undefined ? opts.search : curSearch;
    const forceTab = opts.tab || curTab;
    const seq = ++loadSeqRef.current;
    setLoading(true);
    try {
      if (searchQ && lookupFn) {
        const data = await lookupFn(searchQ);
        if (seq !== loadSeqRef.current) return;
        const list = (data?.participants || []).map(norm).filter(Boolean);
        setRows(list);
        setPagination({ page: 1, pages: 1, total: list.length });
        setTab('search');
        if (!list.length) toast('No matching participants');
        return;
      }

      if (searchQ && !lookupFn) {
        const data = await listFn({
          checkInStatus: '',
          search: searchQ,
          page,
          limit,
        });
        if (seq !== loadSeqRef.current) return;
        const list = (data?.participants || []).map(norm).filter(Boolean);
        setRows(list);
        setPagination({
          page: data?.pagination?.page || page,
          pages: data?.pagination?.pages || data?.pagination?.totalPages || 1,
          total: data?.pagination?.total ?? list.length,
        });
        setTab('search');
        if (!list.length) toast('No matching participants');
        return;
      }

      const checkInStatus = forceTab === 'inside' ? inSt : outSt;
      const data = await listFn({
        checkInStatus,
        search: '',
        page,
        limit,
      });
      if (seq !== loadSeqRef.current) return;
      const list = (data?.participants || []).map(norm).filter(Boolean);
      setRows(list);
      setPagination({
        page: data?.pagination?.page || page,
        pages: data?.pagination?.pages || data?.pagination?.totalPages || 1,
        total: data?.pagination?.total ?? list.length,
      });
    } catch (err) {
      if (seq !== loadSeqRef.current) return;
      toast(err?.message || 'Failed to load roster');
    } finally {
      if (seq === loadSeqRef.current) setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load(1);
  }, [refreshKey, outsideStatus, insideStatus, load]);

  useEffect(() => {
    if (tab === 'search' && activeSearch) return undefined;
    const poll = setInterval(() => {
      load(stateRef.current.pagination.page || 1);
    }, POLL_MS);
    return () => clearInterval(poll);
  }, [tab, activeSearch, load]);

  const runSearch = async (e) => {
    e?.preventDefault();
    const q = query.trim();
    if (!q) {
      setActiveSearch('');
      setTab('outside');
      await load(1, { search: '', tab: 'outside' });
      return;
    }
    setActiveSearch(q);
    await load(1, { search: q });
  };

  const switchTab = async (next) => {
    setQuery('');
    setActiveSearch('');
    setTab(next);
    await load(1, { search: '', tab: next });
  };

  const handleCheckin = async (row) => {
    if (row.checkedIn || checkinId) {
      if (row.checkedIn) toast('Already checked in');
      return;
    }
    const { confirmCheckin: confirmFn, manualCheckin: checkinFn } = adaptersRef.current;
    if (typeof confirmFn === 'function') {
      const ok = await confirmFn(row);
      if (!ok) return;
    }
    setCheckinId(row.id);
    try {
      const res = await checkinFn(row);
      if (res?.success || res?.status === 'checked_in' || res?.status === 'already_checked_in') {
        const wasAlready = res?.status === 'already_checked_in';
        toast(wasAlready ? (res?.message || 'Already checked in') : (res?.message || 'Checked in'));
        const viewingOutside = stateRef.current.tab === 'outside' && !stateRef.current.activeSearch;
        if (viewingOutside) {
          setRows((prev) => prev.filter((r) => r.id !== row.id));
          setPagination((p) => ({ ...p, total: Math.max(0, (p.total || 1) - 1) }));
        } else {
          setRows((prev) =>
            prev.map((r) =>
              r.id === row.id
                ? { ...r, checkedIn: true, checkedInAt: new Date().toISOString() }
                : r,
            ),
          );
        }
      } else {
        toast(res?.message || res?.error || 'Check-in failed');
      }
    } catch (err) {
      toast(err?.message || 'Check-in failed');
    } finally {
      setCheckinId(null);
    }
  };

  const title =
    tab === 'search'
      ? `Search results${pagination.total ? ` (${pagination.total})` : ''}`
      : tab === 'inside'
        ? L.inside
        : L.outside;

  return (
    <div className="rounded-xl border border-white/10 bg-[#161718] p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold flex items-center gap-2 text-white">
            <Users size={16} className="text-[#0ECCEE]" />
            {L.title}
          </h2>
          <p className="text-[11px] text-gray-500 mt-0.5">
            {L.subtitle}
          </p>
        </div>
        <button
          type="button"
          onClick={() => load(pagination.page || 1)}
          className="p-2.5 min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl border border-white/10 text-gray-400 hover:text-white"
          aria-label="Refresh roster"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-black/30 border border-white/5">
        <button
          type="button"
          onClick={() => switchTab('outside')}
          className={`min-h-[44px] rounded-lg text-sm font-semibold transition-colors ${
            tab === 'outside'
              ? 'bg-amber-500/20 text-amber-200'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          {L.outside}
          {tab === 'outside' && pagination.total != null && !activeSearch ? (
            <span className="ml-1 tabular-nums opacity-80">· {pagination.total}</span>
          ) : null}
        </button>
        <button
          type="button"
          onClick={() => switchTab('inside')}
          className={`min-h-[44px] rounded-lg text-sm font-semibold transition-colors ${
            tab === 'inside'
              ? 'bg-emerald-500/20 text-emerald-200'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          {L.inside}
          {tab === 'inside' && pagination.total != null && !activeSearch ? (
            <span className="ml-1 tabular-nums opacity-80">· {pagination.total}</span>
          ) : null}
        </button>
      </div>

      <form onSubmit={runSearch} className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={searchPlaceholder}
          className="flex-1 min-h-[44px] px-3 py-2.5 rounded-xl bg-[#111213] border border-white/10 text-sm focus:outline-none focus:border-[#0ECCEE]/50"
        />
        <button
          type="submit"
          disabled={loading}
          className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#0ECCEE] text-black text-sm font-bold disabled:opacity-60 inline-flex items-center gap-1.5"
        >
          {loading && tab === 'search' ? <Loader className="animate-spin" size={16} /> : <Search size={16} />}
          Find
        </button>
      </form>

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-gray-500">
          {title}
          {tab !== 'search' && pagination.total != null ? ` · ${pagination.total}` : ''}
        </p>
        {tab === 'search' && activeSearch ? (
          <button
            type="button"
            onClick={() => switchTab('outside')}
            className="text-xs text-[#0ECCEE]"
          >
            Clear
          </button>
        ) : null}
      </div>

      {loading && !rows.length ? (
        <div className="py-8 flex justify-center">
          <Loader className="animate-spin text-[#0ECCEE]" size={22} />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-6">
          {tab === 'inside' ? L.insideEmpty : tab === 'search' ? L.searchEmpty : L.outsideEmpty}
        </p>
      ) : (
        <div className="space-y-2 max-h-[28rem] overflow-y-auto overscroll-contain">
          {rows.map((row, idx) => {
            const phoneLink = telHref(row.phone);
            return (
              <div
                key={row.id}
                className="flex items-center justify-between gap-3 p-3 rounded-xl border border-white/10 bg-[#111213]"
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <span className="mt-0.5 shrink-0 size-6 rounded-md bg-white/5 border border-white/10 text-[11px] font-semibold tabular-nums text-gray-500 flex items-center justify-center">
                    {(pagination.page - 1) * pageSize + idx + 1}
                  </span>
                    <div className="min-w-0 space-y-0.5">
                    <p className="font-medium text-white truncate">{row.name || 'Guest'}</p>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-500">
                      {row.phone ? (
                        phoneLink ? (
                          <a
                            href={phoneLink}
                            className="inline-flex items-center gap-1 text-[#0ECCEE] hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Phone size={11} />
                            {row.phone}
                          </a>
                        ) : (
                          <span>{row.phone}</span>
                        )
                      ) : null}
                      {row.gender ? <span>· {row.gender}</span> : null}
                    </div>
                    {(row.drinkShort || row.skillShort || row.drink || row.skill) ? (
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {(row.drinkShort || row.drink) ? (
                          <span className="inline-flex max-w-full truncate rounded-md bg-[#0ECCEE]/15 px-1.5 py-0.5 text-[10px] font-semibold text-[#0ECCEE]">
                            Fuel · {row.drinkShort || row.drink}
                          </span>
                        ) : null}
                        {(row.skillShort || row.skill) ? (
                          <span className="inline-flex max-w-full truncate rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-gray-200">
                            Skill · {row.skillShort || row.skill}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                    <p className={`text-[11px] font-medium ${row.checkedIn ? 'text-emerald-400' : 'text-amber-300'}`}>
                      {row.checkedIn
                        ? `${L.checkedIn}${formatTime(row.checkedInAt) ? ` · ${formatTime(row.checkedInAt)}` : ''}`
                        : L.stillOutside}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={Boolean(checkinId) || row.checkedIn}
                  onClick={() => handleCheckin(row)}
                  className="shrink-0 min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500 text-black text-xs font-bold disabled:opacity-40 disabled:bg-emerald-500/20 disabled:text-emerald-300"
                >
                  {checkinId === row.id ? <Loader className="animate-spin" size={14} /> : <UserCheck size={14} />}
                  {row.checkedIn ? 'In' : L.checkIn}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {pagination.pages > 1 && tab !== 'search' ? (
        <div className="flex items-center justify-between gap-2 pt-1">
          <button
            type="button"
            disabled={pagination.page <= 1 || loading}
            onClick={() => load(pagination.page - 1)}
            className="min-h-[40px] px-3 rounded-lg border border-white/10 text-xs text-gray-300 disabled:opacity-40"
          >
            Prev
          </button>
          <span className="text-xs text-gray-500">
            Page {pagination.page} / {pagination.pages}
          </span>
          <button
            type="button"
            disabled={pagination.page >= pagination.pages || loading}
            onClick={() => load(pagination.page + 1)}
            className="min-h-[40px] px-3 rounded-lg border border-white/10 text-xs text-gray-300 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
}
