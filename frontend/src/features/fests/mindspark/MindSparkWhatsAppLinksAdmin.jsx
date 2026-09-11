import { useEffect, useState } from 'react';
import { Loader, MessageCircle, Save } from 'lucide-react';
import { adminFetchJSON } from '../../../services/api/admin.api.js';

/**
 * Bulk edit WhatsApp group links for all competitions under a MindSpark fest.
 * Used in FestFormModal (admin + organizer).
 */
export default function MindSparkWhatsAppLinksAdmin({
  festId,
  api,
}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!festId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const data = api?.listCompetitions
          ? await api.listCompetitions(festId)
          : await adminFetchJSON(`/admin/fests/${festId}/competitions`);
        const list = Array.isArray(data)
          ? data
          : (data?.competitions || data?.data || []);
        if (cancelled) return;
        setRows(
          list
            .map((c) => ({
              _id: c._id || c.id,
              name: c.name || 'Untitled',
              whatsappGroupLink: String(c.registration?.whatsappGroupLink || '').trim(),
            }))
            .filter((c) => c._id)
            .sort((a, b) => a.name.localeCompare(b.name)),
        );
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || 'Failed to load competitions');
          setRows([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [festId, api]);

  const updateLink = (id, value) => {
    setRows((prev) => prev.map((r) => (r._id === id ? { ...r, whatsappGroupLink: value } : r)));
    setMessage('');
  };

  const saveAll = async () => {
    if (!festId || !rows.length) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      for (const row of rows) {
        const link = String(row.whatsappGroupLink || '').trim();
        const payload = { registration: { whatsappGroupLink: link } };
        if (api?.saveCompetition) {
          await api.saveCompetition({
            festId,
            competitionId: row._id,
            payload,
          });
        } else {
          await adminFetchJSON(`/admin/competitions/${row._id}`, {
            method: 'PUT',
            body: JSON.stringify(payload),
          });
        }
      }
      try {
        localStorage.removeItem('crwdctrl_fests_cache');
        localStorage.removeItem('crwdctrl_fests_timestamp');
        localStorage.removeItem('crwdctrl_fest_details_cache');
      } catch { /* ignore */ }
      if (api?.clearCache) {
        try { await api.clearCache(); } catch { /* ignore */ }
      }
      setMessage(`Saved ${rows.length} WhatsApp links. They appear on the registration success screen.`);
    } catch (err) {
      setError(err?.message || 'Failed to save links');
    } finally {
      setSaving(false);
    }
  };

  if (!festId) {
    return (
      <p className="text-xs text-gray-400">
        Save the fest first, then reopen to manage competition WhatsApp links.
      </p>
    );
  }

  return (
    <div className="bg-[#1D1E20] p-4 rounded-lg space-y-3 border border-[#25D366]/25">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h5 className="text-lg font-medium text-[#25D366] flex items-center gap-2">
            <MessageCircle size={18} />
            Competition WhatsApp links
          </h5>
          <p className="text-xs text-gray-400 mt-1">
            Main CTA after registration for each competition. Edit here or on the competition modal.
          </p>
        </div>
        <button
          type="button"
          disabled={saving || loading || !rows.length}
          onClick={saveAll}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#25D366] text-black text-sm font-semibold hover:opacity-90 disabled:opacity-50"
        >
          {saving ? <Loader size={16} className="animate-spin" /> : <Save size={16} />}
          Save all links
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 flex items-center gap-2">
          <Loader size={14} className="animate-spin" /> Loading competitions…
        </p>
      ) : null}

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {message ? <p className="text-sm text-green-400">{message}</p> : null}

      {!loading && rows.length === 0 ? (
        <p className="text-xs text-gray-500">No competitions found for this fest.</p>
      ) : null}

      <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
        {rows.map((row) => (
          <div key={row._id} className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <label className="sm:w-44 shrink-0 text-sm font-medium text-white truncate" title={row.name}>
              {row.name}
            </label>
            <input
              type="url"
              placeholder="https://chat.whatsapp.com/..."
              value={row.whatsappGroupLink}
              onChange={(e) => updateLink(row._id, e.target.value)}
              className="flex-1 min-w-0 px-2.5 py-2 rounded-lg bg-[#111213] border border-gray-700 focus:border-[#25D366] focus:outline-none text-sm"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
