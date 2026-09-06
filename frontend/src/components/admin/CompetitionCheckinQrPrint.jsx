import { useCallback, useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { Loader, Printer, QrCode, X } from 'lucide-react';
import { adminFetchJSON } from '../../services/api/admin.api.js';
import LocalQRCode from '../LocalQRCode';

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function competitionCheckinUrl(festId, competitionId) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/fest-organizer/fests/${festId}/scan?competitionId=${encodeURIComponent(competitionId)}`;
}

const PRINT_CSS = `
  @page { size: A4; margin: 10mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: ui-sans-serif, system-ui, sans-serif; color: #111; background: #fff; }
  .sheet {
    page-break-after: always;
    min-height: 270mm;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 28px 24px;
    border: 2px solid #111213;
    border-radius: 20px;
  }
  .sheet:last-child { page-break-after: auto; }
  .brand {
    font-size: 11px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: #666;
    font-weight: 700;
  }
  .fest { font-size: 16px; margin: 10px 0 0; color: #333; }
  .name { font-size: 30px; font-weight: 800; margin: 10px 0 22px; line-height: 1.15; max-width: 520px; }
  img { width: 300px; height: 300px; }
  .hint { margin-top: 22px; font-size: 15px; color: #222; max-width: 440px; line-height: 1.45; }
  .note { margin-top: 8px; font-size: 12px; color: #555; max-width: 440px; }
  .url { margin-top: 14px; font-size: 10px; color: #888; word-break: break-all; max-width: 460px; }
`;

export async function printCompetitionCheckinSheets({ fest, competitions }) {
  const festId = fest?._id;
  const festName = fest?.festName || 'Fest';
  const list = (competitions || []).filter((c) => c?._id);
  if (!festId || !list.length) {
    throw new Error('No competitions to print');
  }

  const sheets = [];
  for (const comp of list) {
    const url = competitionCheckinUrl(festId, comp._id);
    const qr = await QRCode.toDataURL(url, {
      width: 360,
      margin: 1,
      color: { dark: '#111213', light: '#ffffff' },
    });
    sheets.push(`
      <section class="sheet">
        <p class="brand">CrwdCtrl · Check-in</p>
        <p class="fest">${escapeHtml(festName)}</p>
        <h1 class="name">${escapeHtml(comp.name || 'Competition')}</h1>
        <img src="${qr}" alt="Check-in QR" width="300" height="300" />
        <p class="hint">Scan with your phone to open check-in for this competition only.</p>
        <p class="note">Organizer must be signed in. Tickets from other competitions will be rejected.</p>
        <p class="url">${escapeHtml(url)}</p>
      </section>
    `);
  }

  const popup = window.open('', '_blank', 'width=900,height=1100');
  if (!popup) {
    throw new Error('Allow popups to print QR sheets');
  }
  popup.document.write(`<!doctype html><html><head>
    <title>${escapeHtml(festName)} · competition QRs</title>
    <style>${PRINT_CSS}</style>
  </head><body>${sheets.join('')}<script>window.onload=function(){window.print()}</script></body></html>`);
  popup.document.close();
}

export default function CompetitionCheckinQrPrint({ fest, onClose }) {
  const [competitions, setCompetitions] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const data = await adminFetchJSON(`/admin/fests/${fest._id}/competitions`);
        const list = Array.isArray(data?.competitions) ? data.competitions : [];
        if (cancelled) return;
        setCompetitions(list);
        setSelectedIds(list.map((c) => String(c._id)));
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load competitions');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [fest._id]);

  const selected = useMemo(
    () => competitions.filter((c) => selectedIds.includes(String(c._id))),
    [competitions, selectedIds],
  );

  const toggle = (id) => {
    const key = String(id);
    setSelectedIds((prev) => (prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]));
  };

  const printSelected = useCallback(async () => {
    setError('');
    setPrinting(true);
    try {
      await printCompetitionCheckinSheets({ fest, competitions: selected });
    } catch (err) {
      setError(err.message || 'Could not open print sheet');
    } finally {
      setPrinting(false);
    }
  }, [fest, selected]);

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4">
      <div className="bg-[#111213] rounded-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-800">
        <div className="sticky top-0 bg-[#111213] border-b border-gray-800 p-5 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-bold flex items-center gap-2">
              <QrCode size={20} className="text-[#0ECCEE]" />
              Print competition QRs
            </h3>
            <p className="text-sm text-gray-400 mt-1">
              One sheet per competition — give these to organizers to tape at the room.
              Scanning opens that competition&apos;s check-in.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors shrink-0"
            aria-label="Close"
          >
            <X size={22} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1">
          {error && (
            <div className="bg-red-900/20 border border-red-800 rounded-lg p-3 text-red-400 text-sm mb-4">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-400">
              <Loader className="w-6 h-6 animate-spin text-[#0ECCEE]" />
            </div>
          ) : competitions.length === 0 ? (
            <p className="text-center py-12 text-gray-400">No competitions on this fest yet.</p>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2 mb-3">
                <p className="text-xs text-gray-500">
                  {selected.length} of {competitions.length} selected
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedIds(competitions.map((c) => String(c._id)))}
                    className="text-xs text-[#0ECCEE] hover:underline"
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedIds([])}
                    className="text-xs text-gray-400 hover:underline"
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {competitions.map((comp) => {
                  const id = String(comp._id);
                  const checked = selectedIds.includes(id);
                  const url = competitionCheckinUrl(fest._id, id);
                  return (
                    <label
                      key={id}
                      className={`flex gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${
                        checked ? 'border-[#0ECCEE]/60 bg-[#0ECCEE]/5' : 'border-gray-700 bg-[#1D1E20]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(id)}
                        className="mt-1 w-4 h-4 accent-[#0ECCEE] shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm truncate">{comp.name || 'Competition'}</p>
                        {comp.venue ? (
                          <p className="text-xs text-gray-500 truncate mt-0.5">{comp.venue}</p>
                        ) : null}
                        <div className="mt-2 bg-white rounded-lg p-1.5 w-fit">
                          <LocalQRCode data={url} size={88} />
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <div className="border-t border-gray-800 p-4 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray-700 text-sm text-gray-300 hover:border-gray-500"
          >
            Close
          </button>
          <button
            type="button"
            disabled={loading || printing || selected.length === 0}
            onClick={printSelected}
            className="px-4 py-2 rounded-lg bg-[#0ECCEE] text-black text-sm font-semibold hover:bg-[#0ECCEE]/80 disabled:opacity-40 inline-flex items-center gap-2"
          >
            {printing ? <Loader size={16} className="animate-spin" /> : <Printer size={16} />}
            Print {selected.length || ''} sheet{selected.length === 1 ? '' : 's'}
          </button>
        </div>
      </div>
    </div>
  );
}
