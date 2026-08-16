import { useMemo, useState } from 'react';
import { Download, Loader, Printer, QrCode, X } from 'lucide-react';
import {
    buildBrandedCompetitionQrDataUrl,
    competitionPublicPageUrl,
    downloadAllCompetitionQrPngs,
    downloadCompetitionQrPng,
    printAllCompetitionQrs,
} from '../../utils/competitionPublicQr';
import { useDialog } from '../../context/DialogContext';

function CompRow({ competition, festName, busyId, onBusy }) {
    const id = String(competition.id || competition._id);
    const [preview, setPreview] = useState('');
    const url = useMemo(() => competitionPublicPageUrl(competition), [competition]);

    const ensurePreview = async () => {
        if (preview) return preview;
        const dataUrl = await buildBrandedCompetitionQrDataUrl(url, { size: 360 });
        setPreview(dataUrl);
        return dataUrl;
    };

    const downloadOne = async () => {
        onBusy(id);
        try {
            await ensurePreview();
            await downloadCompetitionQrPng(competition, festName);
        } finally {
            onBusy('');
        }
    };

    return (
        <div className="rounded-2xl border border-white/10 bg-[#121314] p-3 flex gap-3 items-center">
            <button
                type="button"
                onClick={() => ensurePreview().catch(() => {})}
                className="size-16 shrink-0 rounded-xl bg-white overflow-hidden border border-white/10 flex items-center justify-center"
                aria-label={`Preview QR for ${competition.name || 'competition'}`}
            >
                {preview ? (
                    <img src={preview} alt="" className="w-full h-full object-cover" />
                ) : (
                    <QrCode size={22} className="text-gray-500" />
                )}
            </button>
            <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white truncate">{competition.name || 'Competition'}</p>
                <p className="text-[10px] text-gray-500 truncate mt-0.5">{url.replace(/^https?:\/\//, '')}</p>
            </div>
            <button
                type="button"
                disabled={busyId === id}
                onClick={() => downloadOne().catch(() => {})}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#0ECCEE]/30 bg-[#0ECCEE]/10 text-xs font-semibold text-[#0ECCEE] disabled:opacity-50"
            >
                {busyId === id ? <Loader size={13} className="animate-spin" /> : <Download size={13} />}
                PNG
            </button>
        </div>
    );
}

/**
 * Modal: download each competition page QR (CrwdCtrl mark in center), or all as PNGs / print pack.
 */
export default function FestOrganizerCompetitionQrModal({
    open,
    onClose,
    festName = '',
    competitions = [],
}) {
    const { toast } = useDialog();
    const [busyId, setBusyId] = useState('');
    const [bulkBusy, setBulkBusy] = useState('');
    const list = useMemo(
        () => (competitions || []).filter((c) => c?.id || c?._id),
        [competitions],
    );

    if (!open) return null;

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
            <div className="relative w-full sm:max-w-lg max-h-[90dvh] overflow-hidden rounded-t-3xl sm:rounded-3xl border border-white/10 bg-[#161718] flex flex-col">
                <div className="flex items-start justify-between gap-3 p-4 border-b border-white/10">
                    <div className="min-w-0">
                        <p className="text-[10px] uppercase tracking-[0.14em] text-[#0ECCEE] font-semibold">Share</p>
                        <h2 className="text-lg font-bold text-white mt-0.5 flex items-center gap-2">
                            <QrCode size={18} className="text-[#0ECCEE]" /> Competition QRs
                        </h2>
                        <p className="text-xs text-gray-500 mt-1">
                            Scan opens the public competition page. CrwdCtrl mark sits in the center.
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

                <div className="p-4 flex flex-wrap gap-2 border-b border-white/8">
                    <button
                        type="button"
                        disabled={!list.length || Boolean(bulkBusy)}
                        onClick={() => downloadAll().catch(() => {})}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-[#0ECCEE] text-black text-xs font-semibold disabled:opacity-50"
                    >
                        {bulkBusy === 'png' ? <Loader size={14} className="animate-spin" /> : <Download size={14} />}
                        Download all PNGs
                    </button>
                    <button
                        type="button"
                        disabled={!list.length || Boolean(bulkBusy)}
                        onClick={() => printAll().catch(() => {})}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-white/15 text-xs font-medium text-gray-200 disabled:opacity-50"
                    >
                        {bulkBusy === 'print' ? <Loader size={14} className="animate-spin" /> : <Printer size={14} />}
                        Print / PDF pack
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
                    {list.length ? (
                        list.map((c) => (
                            <CompRow
                                key={String(c.id || c._id)}
                                competition={c}
                                festName={festName}
                                busyId={busyId}
                                onBusy={setBusyId}
                            />
                        ))
                    ) : (
                        <p className="text-sm text-gray-500 text-center py-12">No competitions yet</p>
                    )}
                </div>
            </div>
        </div>
    );
}
