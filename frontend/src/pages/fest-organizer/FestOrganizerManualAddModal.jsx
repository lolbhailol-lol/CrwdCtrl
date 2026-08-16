import { useEffect, useState } from 'react';
import { Loader, X } from 'lucide-react';
import { createFestOrganizerManualParticipant } from '../../services/api/festOrganizer.api';

const empty = {
    name: '',
    email: '',
    phone: '',
    teamName: '',
    college: '',
    membersText: '',
    paymentStatus: 'paid',
    amountPaid: '',
    note: '',
    whatsappGroupJoined: false,
};

export default function FestOrganizerManualAddModal({
    festId,
    competitionId,
    competitionName,
    defaultFee = 0,
    open,
    onClose,
    onCreated,
}) {
    const [form, setForm] = useState(empty);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!open) return;
        setForm({
            ...empty,
            amountPaid: defaultFee > 0 ? String(defaultFee) : '',
            paymentStatus: defaultFee > 0 ? 'paid' : 'free',
        });
        setError('');
    }, [open, defaultFee]);

    if (!open) return null;

    const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

    const submit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError('');
        try {
            const amount = form.amountPaid === '' ? undefined : Number(form.amountPaid);
            const data = await createFestOrganizerManualParticipant(festId, {
                competitionId: competitionId || undefined,
                name: form.name.trim(),
                email: form.email.trim(),
                phone: form.phone.trim(),
                teamName: form.teamName.trim(),
                college: form.college.trim(),
                membersText: form.membersText.trim(),
                paymentStatus: form.paymentStatus,
                amountPaid: Number.isFinite(amount) ? amount : undefined,
                status: 'approved',
                note: form.note.trim(),
                whatsappGroupJoined: Boolean(form.whatsappGroupJoined),
            });
            onCreated?.(data.participant);
            onClose?.();
        } catch (err) {
            setError(err.message || 'Failed to add');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4">
            <div className="w-full max-w-md max-h-[92dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-white/10 bg-[#121314] p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h2 className="text-base font-semibold text-white">Add walk-in / VIP</h2>
                        <p className="text-xs text-gray-500 mt-0.5">
                            {competitionName || 'Competition'} · same QR as online regs
                        </p>
                    </div>
                    <button type="button" onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:bg-white/5">
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={submit} className="space-y-3">
                    <label className="block space-y-1">
                        <span className="text-[11px] text-gray-500">Captain / name *</span>
                        <input
                            required
                            value={form.name}
                            onChange={(e) => set('name', e.target.value)}
                            className="w-full px-3 py-2 rounded-lg bg-[#1D1E20] border border-gray-700 text-sm text-white"
                        />
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <label className="block space-y-1">
                            <span className="text-[11px] text-gray-500">Phone</span>
                            <input
                                value={form.phone}
                                onChange={(e) => set('phone', e.target.value)}
                                className="w-full px-3 py-2 rounded-lg bg-[#1D1E20] border border-gray-700 text-sm text-white"
                            />
                        </label>
                        <label className="block space-y-1">
                            <span className="text-[11px] text-gray-500">Email</span>
                            <input
                                type="email"
                                value={form.email}
                                onChange={(e) => set('email', e.target.value)}
                                className="w-full px-3 py-2 rounded-lg bg-[#1D1E20] border border-gray-700 text-sm text-white"
                            />
                        </label>
                    </div>
                    <p className="text-[10px] text-gray-600">Need at least phone or email.</p>
                    <label className="block space-y-1">
                        <span className="text-[11px] text-gray-500">Team name</span>
                        <input
                            value={form.teamName}
                            onChange={(e) => set('teamName', e.target.value)}
                            className="w-full px-3 py-2 rounded-lg bg-[#1D1E20] border border-gray-700 text-sm text-white"
                        />
                    </label>
                    <label className="block space-y-1">
                        <span className="text-[11px] text-gray-500">College</span>
                        <input
                            value={form.college}
                            onChange={(e) => set('college', e.target.value)}
                            className="w-full px-3 py-2 rounded-lg bg-[#1D1E20] border border-gray-700 text-sm text-white"
                        />
                    </label>
                    <label className="block space-y-1">
                        <span className="text-[11px] text-gray-500">Members (comma or new line)</span>
                        <textarea
                            value={form.membersText}
                            onChange={(e) => set('membersText', e.target.value)}
                            rows={2}
                            className="w-full px-3 py-2 rounded-lg bg-[#1D1E20] border border-gray-700 text-sm text-white"
                        />
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                        <label className="block space-y-1">
                            <span className="text-[11px] text-gray-500">Payment</span>
                            <select
                                value={form.paymentStatus}
                                onChange={(e) => set('paymentStatus', e.target.value)}
                                className="w-full px-3 py-2 rounded-lg bg-[#1D1E20] border border-gray-700 text-sm text-white"
                            >
                                <option value="paid">Paid / offline collected</option>
                                <option value="free">Complimentary</option>
                                <option value="pending">Pending</option>
                            </select>
                        </label>
                        <label className="block space-y-1">
                            <span className="text-[11px] text-gray-500">Amount (₹)</span>
                            <input
                                type="number"
                                min="0"
                                value={form.amountPaid}
                                onChange={(e) => set('amountPaid', e.target.value)}
                                className="w-full px-3 py-2 rounded-lg bg-[#1D1E20] border border-gray-700 text-sm text-white"
                            />
                        </label>
                    </div>
                    <label className="block space-y-1">
                        <span className="text-[11px] text-gray-500">Note (optional)</span>
                        <input
                            value={form.note}
                            onChange={(e) => set('note', e.target.value)}
                            placeholder="VIP / press / guest of…"
                            className="w-full px-3 py-2 rounded-lg bg-[#1D1E20] border border-gray-700 text-sm text-white"
                        />
                    </label>

                    <label className="flex items-start gap-2.5 rounded-xl border border-white/10 bg-white/3 px-3 py-2.5 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={Boolean(form.whatsappGroupJoined)}
                            onChange={(e) => set('whatsappGroupJoined', e.target.checked)}
                            className="mt-0.5 rounded border-gray-600"
                        />
                        <span>
                            <span className="block text-sm text-white">Already in WhatsApp group</span>
                            <span className="block text-[11px] text-gray-500 mt-0.5">
                                Tick if they joined this competition&apos;s group before or at the desk.
                            </span>
                        </span>
                    </label>

                    {error ? <p className="text-sm text-red-400">{error}</p> : null}

                    <button
                        type="submit"
                        disabled={saving}
                        className="w-full py-2.5 rounded-xl bg-[#0ECCEE] text-black text-sm font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-2"
                    >
                        {saving ? <Loader className="animate-spin" size={16} /> : null}
                        Add &amp; issue QR
                    </button>
                </form>
            </div>
        </div>
    );
}
