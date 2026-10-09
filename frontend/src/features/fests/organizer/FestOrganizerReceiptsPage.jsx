import { useCallback, useEffect, useMemo, useState } from 'react';
import { ExternalLink, FileImage, IndianRupee, Loader, Plus, Receipt, Trash2, Upload } from 'lucide-react';
import { useParams } from 'react-router-dom';
import {
    createFestTransferReceipt,
    deleteFestTransferReceipt,
    fetchFestTransferReceipts,
    uploadFestOrganizerImage,
} from '../../../services/api/festOrganizer.api';
import { InlinePageLoader } from '../../../components/DetailPageLoader';
import { useDialog } from '../../../context/DialogContext';
import { getFestOrganizerSession } from '../../../utils/festOrganizerSession';
import { canManageFestAccess } from './festOrganizerPages';

function formatINR(value) {
    return `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function localDateTimeValue() {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
}

function formatDateTime(value) {
    if (!value) return '—';
    return new Date(value).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
    });
}

export default function FestOrganizerReceiptsPage() {
    const { festId } = useParams();
    const { confirm, toast } = useDialog();
    const canManage = canManageFestAccess(getFestOrganizerSession());
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [amount, setAmount] = useState('');
    const [transferredAt, setTransferredAt] = useState(localDateTimeValue);
    const [note, setNote] = useState('');
    const [file, setFile] = useState(null);

    const load = useCallback(async () => {
        setError('');
        try {
            setData(await fetchFestTransferReceipts(festId));
        } catch (err) {
            setError(err.message || 'Failed to load receipts');
        } finally {
            setLoading(false);
        }
    }, [festId]);

    useEffect(() => { load(); }, [load]);

    const grouped = useMemo(() => {
        const groups = new Map();
        for (const receipt of data?.receipts || []) {
            const key = new Date(receipt.transferredAt).toLocaleDateString('en-IN', {
                day: '2-digit', month: 'long', year: 'numeric',
            });
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(receipt);
        }
        return [...groups.entries()];
    }, [data?.receipts]);

    const resetForm = () => {
        setAmount('');
        setTransferredAt(localDateTimeValue());
        setNote('');
        setFile(null);
        setShowForm(false);
    };

    const submit = async (event) => {
        event.preventDefault();
        if (!file) {
            toast('Select the payment receipt image first.');
            return;
        }
        setSaving(true);
        setError('');
        try {
            const formData = new FormData();
            formData.append('image', file);
            formData.append('folder', 'crwdctrl/fests/mindspark-receipts');
            const uploaded = await uploadFestOrganizerImage(formData);
            const proofUrl = uploaded?.url || uploaded?.secure_url || '';
            if (!proofUrl) throw new Error('Receipt upload did not return an image');
            await createFestTransferReceipt(festId, {
                amount: Number(amount),
                transferredAt: new Date(transferredAt).toISOString(),
                proofUrl,
                note,
            });
            resetForm();
            toast('COEP transfer receipt saved.');
            await load();
        } catch (err) {
            setError(err.message || 'Failed to save receipt');
        } finally {
            setSaving(false);
        }
    };

    const remove = async (receipt) => {
        const approved = await confirm({
            title: 'Delete transfer receipt?',
            message: `${formatINR(receipt.amount)} from ${formatDateTime(receipt.transferredAt)} will be removed.`,
            confirmText: 'Delete',
            tone: 'danger',
        });
        if (!approved) return;
        try {
            await deleteFestTransferReceipt(festId, receipt.id);
            toast('Receipt deleted.');
            await load();
        } catch (err) {
            setError(err.message || 'Failed to delete receipt');
        }
    };

    if (loading && !data) return <InlinePageLoader label="Loading receipts…" variant="fest" />;

    return (
        <div className="max-w-3xl mx-auto space-y-4 pb-12">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-[10px] uppercase tracking-[0.14em] text-[#0ECCEE]/80 font-semibold">COEP account</p>
                    <h1 className="text-xl font-bold text-white mt-0.5 flex items-center gap-2">
                        <Receipt className="text-[#0ECCEE]" size={20} /> Transfer receipts
                    </h1>
                    <p className="text-xs text-gray-500 mt-1">Daily payment proofs sent to the COEP account.</p>
                </div>
                {canManage ? (
                    <button
                        type="button"
                        onClick={() => setShowForm((value) => !value)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#0ECCEE] text-black text-sm font-semibold"
                    >
                        <Plus size={15} /> Add receipt
                    </button>
                ) : null}
            </div>

            {error ? <div className="rounded-xl border border-red-800 bg-red-950/30 p-3 text-sm text-red-300">{error}</div> : null}

            <section className="rounded-2xl border border-emerald-400/25 bg-linear-to-br from-emerald-500/20 to-[#161718] p-5">
                <p className="text-xs uppercase tracking-wider text-emerald-200/70">Total sent to COEP</p>
                <p className="text-3xl font-bold tabular-nums text-white mt-2">{formatINR(data?.totalTransferred)}</p>
                <p className="text-[11px] text-gray-400 mt-1">{data?.count || 0} successful transfers</p>
            </section>

            {canManage && showForm ? (
                <form onSubmit={submit} className="rounded-2xl border border-[#0ECCEE]/25 bg-[#111213] p-4 space-y-4">
                    <h2 className="font-semibold text-white flex items-center gap-2"><Upload size={16} /> Upload payment proof</h2>
                    <div className="grid sm:grid-cols-2 gap-3">
                        <label className="space-y-1.5">
                            <span className="text-xs text-gray-400">Amount sent</span>
                            <div className="relative">
                                <IndianRupee size={15} className="absolute left-3 top-3.5 text-gray-500" />
                                <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" min="0.01" step="0.01" required className="w-full min-h-11 rounded-xl border border-gray-700 bg-[#161718] pl-9 pr-3 text-white" />
                            </div>
                        </label>
                        <label className="space-y-1.5">
                            <span className="text-xs text-gray-400">Transfer date and time</span>
                            <input value={transferredAt} onChange={(e) => setTransferredAt(e.target.value)} type="datetime-local" required className="w-full min-h-11 rounded-xl border border-gray-700 bg-[#161718] px-3 text-white" />
                        </label>
                    </div>
                    <label className="block space-y-1.5">
                        <span className="text-xs text-gray-400">Receipt image</span>
                        <span className="flex min-h-12 items-center gap-2 rounded-xl border border-dashed border-gray-600 bg-[#161718] px-3 text-sm text-gray-300 cursor-pointer">
                            <FileImage size={17} className="text-[#0ECCEE]" />
                            <span className="truncate">{file?.name || 'Choose JPG, PNG, WebP or HEIC'}</span>
                            <input type="file" accept="image/*,.heic,.heif" required className="sr-only" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                        </span>
                    </label>
                    <label className="block space-y-1.5">
                        <span className="text-xs text-gray-400">Note (optional)</span>
                        <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="UTR or transfer note" className="w-full min-h-11 rounded-xl border border-gray-700 bg-[#161718] px-3 text-white" />
                    </label>
                    <div className="flex gap-2">
                        <button type="submit" disabled={saving} className="flex-1 min-h-11 rounded-xl bg-[#0ECCEE] text-black font-semibold disabled:opacity-60">
                            {saving ? <Loader size={17} className="animate-spin inline mr-2" /> : null}Save receipt
                        </button>
                        <button type="button" onClick={resetForm} disabled={saving} className="px-4 min-h-11 rounded-xl border border-gray-700 text-gray-300">Cancel</button>
                    </div>
                </form>
            ) : null}

            <div className="space-y-4">
                {grouped.map(([day, receipts]) => (
                    <section key={day} className="rounded-2xl border border-white/10 bg-[#111213] overflow-hidden">
                        <div className="px-4 py-3 border-b border-white/8 flex items-center justify-between gap-2">
                            <h2 className="text-sm font-semibold text-white">{day}</h2>
                            <span className="text-xs text-emerald-300 font-semibold">{formatINR(receipts.reduce((sum, item) => sum + Number(item.amount || 0), 0))}</span>
                        </div>
                        <div className="divide-y divide-white/8">
                            {receipts.map((receipt) => (
                                <div key={receipt.id} className="p-4 flex items-center gap-3">
                                    <a href={receipt.proofUrl} target="_blank" rel="noreferrer" className="size-14 rounded-xl overflow-hidden border border-white/10 bg-black/30 shrink-0">
                                        <img src={receipt.proofUrl} alt="Transfer receipt" className="size-full object-cover" />
                                    </a>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-base font-bold text-white tabular-nums">{formatINR(receipt.amount)}</p>
                                        <p className="text-[11px] text-gray-500 mt-0.5">{formatDateTime(receipt.transferredAt)} · Successful</p>
                                        {receipt.note ? <p className="text-xs text-gray-400 mt-1 truncate">{receipt.note}</p> : null}
                                    </div>
                                    <a href={receipt.proofUrl} target="_blank" rel="noreferrer" className="p-2 rounded-lg text-[#0ECCEE]" aria-label="View receipt"><ExternalLink size={16} /></a>
                                    {canManage ? (
                                        <button type="button" onClick={() => remove(receipt)} className="p-2 rounded-lg text-red-400" aria-label="Delete receipt"><Trash2 size={16} /></button>
                                    ) : null}
                                </div>
                            ))}
                        </div>
                    </section>
                ))}
                {!grouped.length ? <div className="rounded-2xl border border-dashed border-gray-700 p-10 text-center text-sm text-gray-500">No transfer receipts uploaded yet.</div> : null}
            </div>
        </div>
    );
}
