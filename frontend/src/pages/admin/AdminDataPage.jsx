import { useCallback, useEffect, useState } from 'react';
import { Database, Loader2, Mail, Phone, Search, Users } from 'lucide-react';
import { adminFetchJSON } from '../../services/api/admin.api.js';
import { InlinePageLoader } from '../../components/DetailPageLoader';

export default function AdminDataPage() {
  const [datasets, setDatasets] = useState([]);
  const [selectedKey, setSelectedKey] = useState('');
  const [dataset, setDataset] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, pages: 1 });
  const [search, setSearch] = useState('');
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState('');

  const loadDatasets = useCallback(async () => {
    setLoadingList(true);
    setError('');
    try {
      const data = await adminFetchJSON('/admin/outreach-datasets');
      const rows = data.datasets || [];
      setDatasets(rows);
      if (!selectedKey && rows[0]) setSelectedKey(rows[0].key);
    } catch (err) {
      setError(err.message || 'Failed to load datasets');
    } finally {
      setLoadingList(false);
    }
  }, [selectedKey]);

  const loadDataset = useCallback(async (key, page = 1, q = '') => {
    if (!key) return;
    setLoadingDetail(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '50',
        ...(q ? { search: q } : {}),
      });
      const data = await adminFetchJSON(`/admin/outreach-datasets/${encodeURIComponent(key)}?${params}`);
      setDataset(data.dataset || null);
      setPagination(data.pagination || { page: 1, limit: 50, total: 0, pages: 1 });
    } catch (err) {
      setError(err.message || 'Failed to load dataset');
      setDataset(null);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    loadDatasets();
  }, [loadDatasets]);

  useEffect(() => {
    if (!selectedKey) return;
    const timer = setTimeout(() => {
      loadDataset(selectedKey, 1, search.trim());
    }, 200);
    return () => clearTimeout(timer);
  }, [selectedKey, search, loadDataset]);

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Database size={20} className="text-[#0ECCEE]" />
            Data
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Imported outreach lists (sheets, leads) for campaigns.
          </p>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      {loadingList ? (
        <InlinePageLoader label="Loading datasets…" />
      ) : (
        <div className="flex flex-wrap gap-2">
          {datasets.length === 0 ? (
            <p className="text-sm text-gray-500">No datasets yet.</p>
          ) : (
            datasets.map((row) => (
              <button
                key={row.key}
                type="button"
                onClick={() => {
                  setSelectedKey(row.key);
                  setSearch('');
                }}
                className={`rounded-xl px-3 py-2 text-sm border transition ${
                  selectedKey === row.key
                    ? 'border-[#0ECCEE]/40 bg-[#0ECCEE]/10 text-[#0ECCEE]'
                    : 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/8'
                }`}
              >
                <span className="font-medium">{row.name}</span>
                <span className="ml-2 text-xs text-gray-500">{row.uniqueEmailCount} emails</span>
              </button>
            ))
          )}
        </div>
      )}

      {dataset ? (
        <div className="space-y-3">
          <div className="rounded-2xl border border-white/10 bg-[#1a1b1c] p-4">
            <div className="flex flex-wrap items-center gap-3 justify-between">
              <div>
                <h2 className="font-semibold">{dataset.name}</h2>
                {dataset.description ? (
                  <p className="text-sm text-gray-500 mt-0.5">{dataset.description}</p>
                ) : null}
                {dataset.sourceUrl ? (
                  <a
                    href={dataset.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[#0ECCEE] hover:underline mt-1 inline-block"
                  >
                    Source sheet
                  </a>
                ) : null}
              </div>
              <div className="flex gap-3 text-xs text-gray-400">
                <span className="inline-flex items-center gap-1"><Users size={12} /> {dataset.contactCount} rows</span>
                <span className="inline-flex items-center gap-1"><Mail size={12} /> {dataset.uniqueEmailCount} unique</span>
              </div>
            </div>
          </div>

          <div className="relative max-w-md">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email, college, competition…"
              className="w-full rounded-xl border border-white/10 bg-[#121314] pl-9 pr-3 py-2 text-sm outline-none focus:border-[#0ECCEE]/40"
            />
          </div>

          {loadingDetail ? (
            <div className="flex items-center gap-2 text-sm text-gray-500 py-8 justify-center">
              <Loader2 size={16} className="animate-spin" /> Loading contacts…
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-white/10">
              <table className="min-w-full text-sm">
                <thead className="bg-white/5 text-gray-400 text-left">
                  <tr>
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">Email</th>
                    <th className="px-3 py-2 font-medium">Phone</th>
                    <th className="px-3 py-2 font-medium">Competition</th>
                    <th className="px-3 py-2 font-medium">College</th>
                    <th className="px-3 py-2 font-medium">City</th>
                  </tr>
                </thead>
                <tbody>
                  {(dataset.contacts || []).map((c) => (
                    <tr key={c._id || `${c.email}-${c.sourceRow}`} className="border-t border-white/5 hover:bg-white/[0.03]">
                      <td className="px-3 py-2 text-gray-200">{c.name || '—'}</td>
                      <td className="px-3 py-2 text-[#0ECCEE]">{c.email}</td>
                      <td className="px-3 py-2 text-gray-400">
                        {c.phone ? (
                          <span className="inline-flex items-center gap-1"><Phone size={11} />{c.phone}</span>
                        ) : '—'}
                      </td>
                      <td className="px-3 py-2 text-gray-300 max-w-[220px] truncate" title={c.competition}>{c.competition || '—'}</td>
                      <td className="px-3 py-2 text-gray-400 max-w-[200px] truncate" title={c.college}>{c.college || '—'}</td>
                      <td className="px-3 py-2 text-gray-500">{c.city || '—'}</td>
                    </tr>
                  ))}
                  {(dataset.contacts || []).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-8 text-center text-gray-500">No contacts match.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          )}

          {pagination.pages > 1 ? (
            <div className="flex items-center justify-between text-sm text-gray-400">
              <span>
                Page {pagination.page} / {pagination.pages} · {pagination.total} shown filter
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={pagination.page <= 1 || loadingDetail}
                  onClick={() => loadDataset(selectedKey, pagination.page - 1, search.trim())}
                  className="rounded-lg border border-white/10 px-3 py-1.5 disabled:opacity-40 hover:bg-white/5"
                >
                  Prev
                </button>
                <button
                  type="button"
                  disabled={pagination.page >= pagination.pages || loadingDetail}
                  onClick={() => loadDataset(selectedKey, pagination.page + 1, search.trim())}
                  className="rounded-lg border border-white/10 px-3 py-1.5 disabled:opacity-40 hover:bg-white/5"
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
