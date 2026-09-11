import { useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader, Upload, X } from 'lucide-react';
import { adminFetch, adminFetchJSON } from '../../services/api/admin.api.js';

const STEPS = {
  UPLOAD: 'upload',
  PREVIEW: 'preview',
  DONE: 'done',
};

function truncate(text, max = 80) {
  if (!text) return '';
  return text.length <= max ? text : `${text.slice(0, max)}…`;
}

export default function CompetitionBulkImport({ fest, onClose, onImported }) {
  const fileInputRef = useRef(null);
  const [step, setStep] = useState(STEPS.UPLOAD);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);
  const [rows, setRows] = useState([]);
  const [result, setResult] = useState(null);

  const selectedCount = useMemo(
    () => rows.filter((row) => row.selected && row.parsed && !row.duplicate).length,
    [rows]
  );

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('zip', file);

      const response = await adminFetch(`/admin/fests/${fest._id}/competitions/import/preview`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || data.error || 'Failed to preview import');
      }

      setPreview(data);
      setRows(
        (data.items || []).map((item, index) => ({
          id: `${item.sourceFile}-${index}`,
          selected: item.status === 'ok' && !item.duplicate,
          duplicate: item.duplicate,
          status: item.status,
          sourceFile: item.sourceFile,
          warnings: item.warnings || [],
          parsed: item.parsed,
        }))
      );
      setStep(STEPS.PREVIEW);
    } catch (err) {
      setError(err.message || 'Failed to upload rulebook zip');
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const updateRow = (id, field, value) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== id || !row.parsed) return row;
        if (field === 'feeAmount') {
          const amount = Number(value) || 0;
          return {
            ...row,
            parsed: {
              ...row.parsed,
              feeAmount: amount,
              registrationFee: amount ? `₹${amount} per team` : 'TBA',
            },
          };
        }
        return {
          ...row,
          parsed: {
            ...row.parsed,
            [field]: value,
          },
        };
      })
    );
  };

  const toggleRow = (id) => {
    setRows((prev) =>
      prev.map((row) =>
        row.id === id && row.parsed && !row.duplicate
          ? { ...row, selected: !row.selected }
          : row
      )
    );
  };

  const handleConfirm = async () => {
    const payload = rows
      .filter((row) => row.selected && row.parsed && !row.duplicate)
      .map((row) => row.parsed);

    if (!payload.length) {
      setError('Select at least one competition to import');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const data = await adminFetchJSON(
        `/admin/fests/${fest._id}/competitions/import/confirm`,
        {
          method: 'POST',
          body: JSON.stringify({ competitions: payload }),
        }
      );
      setResult(data);
      setStep(STEPS.DONE);
      onImported?.(data);
    } catch (err) {
      setError(err.message || 'Failed to import competitions');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-6xl max-h-[90vh] overflow-hidden rounded-xl border border-gray-800 bg-[#111213] shadow-2xl flex flex-col">
        <div className="flex items-start justify-between gap-4 border-b border-gray-800 px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold">Bulk Import Rulebooks</h2>
            <p className="text-sm text-gray-400 mt-1">
              {fest.festName} — upload the Drive zip to create competitions automatically
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {error && (
            <div className="rounded-lg border border-red-700 bg-red-900/30 px-4 py-3 text-sm text-red-300 flex items-start gap-2">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {step === STEPS.UPLOAD && (
            <div className="rounded-xl border border-dashed border-gray-700 bg-[#1D1E20] p-10 text-center">
              <Upload className="mx-auto mb-4 text-[#0ECCEE]" size={36} />
              <h3 className="text-lg font-medium mb-2">Upload rulebook zip</h3>
              <p className="text-sm text-gray-400 mb-6 max-w-xl mx-auto">
                Use the Google Drive folder export (docx/pdf rulebooks grouped by category).
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip,application/zip,application/x-zip-compressed"
                className="hidden"
                onChange={handleFileChange}
              />
              <button
                type="button"
                disabled={loading}
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-lg bg-[#0ECCEE] px-4 py-2 text-sm font-medium text-black hover:bg-[#0bb8d6] disabled:opacity-50"
              >
                {loading ? <Loader size={16} className="animate-spin" /> : <Upload size={16} />}
                {loading ? 'Parsing rulebooks…' : 'Choose zip file'}
              </button>
            </div>
          )}

          {step === STEPS.PREVIEW && preview && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  ['Total', preview.summary?.total],
                  ['Parsed', preview.summary?.ok],
                  ['Errors', preview.summary?.errors],
                  ['Duplicates', preview.summary?.duplicates],
                  ['Selected', selectedCount],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-gray-800 bg-[#1D1E20] px-4 py-3">
                    <p className="text-xs text-gray-500">{label}</p>
                    <p className="text-lg font-semibold">{value ?? 0}</p>
                  </div>
                ))}
              </div>

              <div className="overflow-x-auto rounded-xl border border-gray-800">
                <table className="min-w-full text-sm">
                  <thead className="bg-[#1D1E20] text-left text-gray-400">
                    <tr>
                      <th className="px-3 py-3">Import</th>
                      <th className="px-3 py-3">Name</th>
                      <th className="px-3 py-3">Category</th>
                      <th className="px-3 py-3">Fee</th>
                      <th className="px-3 py-3">Prize</th>
                      <th className="px-3 py-3">Description</th>
                      <th className="px-3 py-3">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id} className="border-t border-gray-800 align-top">
                        <td className="px-3 py-3">
                          <input
                            type="checkbox"
                            checked={row.selected}
                            disabled={!row.parsed || row.duplicate}
                            onChange={() => toggleRow(row.id)}
                            className="h-4 w-4 rounded border-gray-600"
                          />
                        </td>
                        <td className="px-3 py-3 min-w-[160px]">
                          {row.parsed ? (
                            <input
                              value={row.parsed.name}
                              onChange={(e) => updateRow(row.id, 'name', e.target.value)}
                              className="w-full rounded bg-[#1D1E20] border border-gray-700 px-2 py-1"
                            />
                          ) : (
                            <span className="text-gray-500">{row.sourceFile}</span>
                          )}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          {row.parsed?.subtitle || '—'}
                        </td>
                        <td className="px-3 py-3 min-w-[100px]">
                          {row.parsed ? (
                            <input
                              type="number"
                              min="0"
                              value={row.parsed.feeAmount || 0}
                              onChange={(e) => updateRow(row.id, 'feeAmount', e.target.value)}
                              className="w-24 rounded bg-[#1D1E20] border border-gray-700 px-2 py-1"
                            />
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-3 py-3 min-w-[140px]">
                          {row.parsed ? (
                            <input
                              value={row.parsed.prizePool}
                              onChange={(e) => updateRow(row.id, 'prizePool', e.target.value)}
                              className="w-full rounded bg-[#1D1E20] border border-gray-700 px-2 py-1"
                            />
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-3 py-3 text-gray-400 max-w-xs">
                          {truncate(row.parsed?.description)}
                        </td>
                        <td className="px-3 py-3 text-xs text-amber-300 max-w-[180px]">
                          {row.duplicate && 'Already exists on fest. '}
                          {row.status === 'error' && 'Parse failed. '}
                          {(row.warnings || []).join(' ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {step === STEPS.DONE && result && (
            <div className="rounded-xl border border-green-800 bg-green-900/20 p-6">
              <div className="flex items-center gap-2 text-green-300 mb-4">
                <CheckCircle2 size={20} />
                <h3 className="text-lg font-semibold">Import complete</h3>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="rounded-lg bg-[#1D1E20] px-4 py-3">
                  <p className="text-xs text-gray-500">Created</p>
                  <p className="text-xl font-semibold text-green-300">{result.created}</p>
                </div>
                <div className="rounded-lg bg-[#1D1E20] px-4 py-3">
                  <p className="text-xs text-gray-500">Skipped</p>
                  <p className="text-xl font-semibold">{result.skipped}</p>
                </div>
                <div className="rounded-lg bg-[#1D1E20] px-4 py-3">
                  <p className="text-xs text-gray-500">Errors</p>
                  <p className="text-xl font-semibold">{result.errors}</p>
                </div>
              </div>
              {result.errorItems?.length > 0 && (
                <div className="text-sm text-amber-300 space-y-1">
                  {result.errorItems.map((item) => (
                    <p key={`${item.name}-${item.error}`}>
                      {item.name}: {item.error}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-gray-800 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 hover:border-gray-500"
          >
            {step === STEPS.DONE ? 'Close' : 'Cancel'}
          </button>

          {step === STEPS.PREVIEW && (
            <button
              type="button"
              disabled={loading || selectedCount === 0}
              onClick={handleConfirm}
              className="inline-flex items-center gap-2 rounded-lg bg-[#0ECCEE] px-4 py-2 text-sm font-medium text-black hover:bg-[#0bb8d6] disabled:opacity-50"
            >
              {loading ? <Loader size={16} className="animate-spin" /> : null}
              Import {selectedCount} competition{selectedCount === 1 ? '' : 's'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
