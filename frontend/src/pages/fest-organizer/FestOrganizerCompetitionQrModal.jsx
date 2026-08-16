import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Download, Loader, Printer, QrCode, X } from 'lucide-react';
import {
    buildBrandedCompetitionQrDataUrl,
    competitionPublicPageUrl,
    downloadAllCompetitionQrPngs,
    downloadCompetitionQrPng,
    printAllCompetitionQrs,
} from '../../utils/competitionPublicQr';
import { useDialog } from '../../context/DialogContext';

/**
 * Modal: preview branded QR first (transparent ctrl. mark, QR around it), then download.
 */
export default function FestOrganizerCompetitionQrModal({
    open,
    onClose,
    festName = '',
    competitions = [],
}) {
    const { toast } = useDialog();
    const [selectedId, setSelectedId] = useState('');
    const [preview, setPreview] = useState('');
    const [previewBusy, setPreviewBusy] = useState(false);
    const [bulkBusy, setBulkBusy] = useState('');
    const [dlBusy, setDlBusy] = useState(false);

    const list = useMemo(
        () => (competitions || []).filter((c) => c?.id || c?._id),
        [competitions],
    );

    const selected = useMemo(
        () => list.find((c) => String(c.id || c._id) === String(selectedId)) || list[0] || null,
        [list, selectedId],
    );

    const selectedUrl = selected ? competitionPublicPageUrl(selected) : '';

    useEffect(() => {
        if (!open) return;
        if (!list.length) {
            setSelectedId('');
            return;
        }
        const stillThere = list.some((c) => String(c.id || c._id) === String(selectedId));
        if (!stillThere) setSelectedId(String(list[0].id || list[0]._id));
    }, [open, list, selectedId]);

    useEffect(() => {
        if (!open || !selectedUrl) {
            setPreview('');
            return undefined;
        }
        let cancelled = false;
        setPreviewBusy(true);
        setPreview('');
        buildBrandedCompetitionQrDataUrl(selectedUrl, { size: 720 })
            .then((dataUrl) => {
                if (!cancelled) setPreview(dataUrl);
            })
            .catch(() => {
                if (!cancelled) setPreview('');
            })
            .finally(() => {
                if (!cancelled) setPreviewBusy(false);
            });
        return () => { cancelled = true; };
    }, [open, selectedUrl]);

    if (!open) return null;

    const downloadSelected = async () => {
        if (!selected) return;
        setDlBusy(true);
        try {
            await downloadCompetitionQrPng(selected, festName, preview || undefined);
            toast('Downloaded');
        } catch (e) {
            toast(e.message || 'Failed');
        } finally {
            setDlBusy(false);
        }
    };

    const downloadAll = async () => {
        if (!list.length) return;
        setBulkBusy('png');
        try {
            await downloadAllCompetitionQrPngs(list, festName);
            toast('Done');
        } catch (e) {
            toast(e.message || 'Failed');
        } finally {
            setBulkBusy('');
        }
    };

    const printAll = async () => {
        if (!list.length) return;
        setBulkBusy('print');
        try {
            await printAllCompetitionQrs({ festName, competitions: list });
            toast('Print ready');
        } catch (e) {
            toast(e.message || 'Failed');
        } finally {
            setBulkBusy('');
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <button
                type="button"
                className="absolute inset-0 bg-black/70"
                aria-label="Close"
                onClick={onClose}
            />
            <div className="relative w-full sm:max-w-lg max-h-[92dvh] overflow-hidden rounded-t-3xl sm:rounded-3xl border border-white/10 bg-[#161718] flex flex-col">
                <div className="flex items-start justify-between gap-3 p-4 border-b border-white/10">
                    <div className="min-w-0">
                        <p className="text-[10px] uppercase tracking-[0.14em] text-[#0ECCEE] font-semibold">Share</p>
                        <h2 className="text-lg font-bold text-white mt-0.5 flex items-center gap-2">
                            <QrCode size={18} className="text-[#0ECCEE]" /> Competition QRs
                        </h2>
                        <p className="text-xs text-gray-500 mt-1">
                            Each QR uses the competition title URL. Scan → short 3D load → competition opens.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 rounded-xl border border-white/10 text-gray-400"
                        aria-label="Close"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Large preview first */}
                <div className="p-4 border-b border-white/8 space-y-3">
                    <div className="mx-auto w-full max-w-[280px] aspect-square bg-white flex items-center justify-center overflow-hidden">
                        {previewBusy ? (
                            <Loader className="animate-spin text-gray-400" size={22} />
                        ) : preview ? (
                            <img src={preview} alt="QR preview" className="w-full h-full object-contain" />
                        ) : (
                            <p className="text-xs text-gray-400 text-center px-4">Pick a competition</p>
                        )}
                    </div>
                    {selected ? (
                        <div className="text-center space-y-1">
                            <p className="text-sm font-semibold text-white truncate">{selected.name}</p>
                            <p className="text-[10px] text-gray-500 truncate px-2">
                                {selectedUrl.replace(/^https?:\/\//, '')}
                            </p>
                        </div>
                    ) : null}
                    <div className="flex flex-wrap gap-2 justify-center">
                        <button
                            type="button"
                            disabled={!selected || dlBusy || previewBusy || !preview}
                            onClick={() => downloadSelected().catch(() => {})}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-[#0ECCEE] text-black text-xs font-semibold disabled:opacity-50"
                        >
                            {dlBusy ? <Loader size={14} className="animate-spin" /> : <Download size={14} />}
                            Download this PNG
                        </button>
                        <button
                            type="button"
                            disabled={!list.length || Boolean(bulkBusy)}
                            onClick={() => downloadAll().catch(() => {})}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-white/15 text-xs font-medium text-gray-200 disabled:opacity-50"
                        >
                            {bulkBusy === 'png' ? <Loader size={14} className="animate-spin" /> : <Download size={14} />}
                            All PNGs
                        </button>
                        <button
                            type="button"
                            disabled={!list.length || Boolean(bulkBusy)}
                            onClick={() => printAll().catch(() => {})}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-white/15 text-xs font-medium text-gray-200 disabled:opacity-50"
                        >
                            {bulkBusy === 'print' ? <Loader size={14} className="animate-spin" /> : <Printer size={14} />}
                            Print pack
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
                    <p className="text-[10px] uppercase tracking-wide text-gray-500 px-1 mb-1">Competitions</p>
                    {list.length ? (
                        list.map((c) => {
                            const id = String(c.id || c._id);
                            const active = id === String(selected?.id || selected?._id);
                            return (
                                <button
                                    key={id}
                                    type="button"
                                    onClick={() => setSelectedId(id)}
                                    className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left border transition ${
                                        active
                                            ? 'border-[#0ECCEE]/40 bg-[#0ECCEE]/10'
                                            : 'border-transparent bg-[#121314] hover:border-white/10'
                                    }`}
                                >
                                    <div className="min-w-0 flex-1">
                                        <p className={`text-sm font-medium truncate ${active ? 'text-[#0ECCEE]' : 'text-white'}`}>
                                            {c.name || 'Competition'}
                                        </p>
                                    </div>
                                    <ChevronRight size={14} className={active ? 'text-[#0ECCEE]' : 'text-gray-600'} />
                                </button>
                            );
                        })
                    ) : (
                        <p className="text-sm text-gray-500 text-center py-10">No competitions yet</p>
                    )}
                </div>
            </div>
        </div>
    );
}
