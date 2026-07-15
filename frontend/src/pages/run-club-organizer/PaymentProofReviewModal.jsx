import { useEffect, useState } from 'react';
import { X, CheckCircle, Phone, Copy, MessageCircle, ChevronLeft, ChevronRight, Loader } from 'lucide-react';

const REJECT_PRESETS = [
    'Wrong amount',
    'Unclear screenshot',
    'Transaction not found',
];

function whatsappHref(phone, name) {
    const digits = String(phone || '').replace(/\D/g, '');
    if (digits.length < 10) return '';
    const withCountry = digits.length === 10 ? `91${digits}` : digits;
    const text = encodeURIComponent(
        `Hi${name ? ` ${name}` : ''}, this is about your run registration payment on CrwdCtrl.`,
    );
    return `https://wa.me/${withCountry}?text=${text}`;
}

function formatSubmittedAt(value) {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export default function PaymentProofReviewModal({
    open,
    participant,
    expectedFee,
    queueIndex = 0,
    queueTotal = 0,
    eventTitle = '',
    onClose,
    onApprove,
    onReject,
    onPrev,
    onNext,
}) {
    const [rejectMode, setRejectMode] = useState(false);
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!open) {
            setRejectMode(false);
            setNote('');
            setBusy(false);
        }
    }, [open, participant?.bookingId]);

    if (!open || !participant) return null;

    const phone = participant.phone && participant.phone !== '—' ? participant.phone : '';
    const amount = Number(participant.amountPaid || participant.grossCollected || 0);
    const listAmount = Number(participant.listAmount || participant.amountBeforeDiscount || 0);
    const expected = Number(expectedFee ?? participant.expectedAmount ?? amount);
    const hasScreenshot = Boolean(String(participant.paymentScreenshotUrl || '').trim());
    const canApprove = hasScreenshot || amount <= 0;
    const people = Number(participant.people) || 1;
    const runDate = participant.trekDate || '';
    const submittedAt = formatSubmittedAt(participant.bookingDate);
    const hasQueue = queueTotal > 1;

    const handleApprove = async () => {
        setBusy(true);
        try {
            await onApprove(participant.bookingId);
        } finally {
            setBusy(false);
        }
    };

    const handleReject = async () => {
        if (note.trim().length < 3) return;
        setBusy(true);
        try {
            await onReject(participant.bookingId, note.trim());
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 p-0 sm:p-4">
            <div className="w-full max-w-lg max-h-[94dvh] flex flex-col rounded-t-2xl sm:rounded-2xl border border-gray-800 bg-[#161718] shadow-2xl">
                <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-800">
                    <div className="min-w-0">
                        <p className="text-xs uppercase tracking-wide text-amber-400">
                            Payment review
                            {hasQueue ? ` · ${queueIndex + 1} of ${queueTotal}` : ''}
                        </p>
                        <h2 className="text-lg font-bold truncate">{participant.participantName}</h2>
                        {eventTitle ? (
                            <p className="text-[11px] text-gray-500 truncate">{eventTitle}</p>
                        ) : null}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2.5 min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg hover:bg-white/5 text-gray-400"
                        aria-label="Close"
                    >
                        <X size={18} />
                    </button>
                </div>

                {hasQueue ? (
                    <div className="shrink-0 flex items-center justify-between gap-2 px-3 py-2 border-b border-gray-800/80 bg-[#111213]">
                        <button
                            type="button"
                            disabled={!onPrev || busy}
                            onClick={onPrev}
                            className="inline-flex items-center gap-1 px-3 py-2 min-h-[40px] rounded-lg text-xs font-medium text-gray-300 border border-gray-700 disabled:opacity-30"
                        >
                            <ChevronLeft size={16} /> Previous
                        </button>
                        <p className="text-[11px] text-gray-500">Next / Previous</p>
                        <button
                            type="button"
                            disabled={!onNext || busy}
                            onClick={onNext}
                            className="inline-flex items-center gap-1 px-3 py-2 min-h-[40px] rounded-lg text-xs font-medium text-gray-300 border border-gray-700 disabled:opacity-30"
                        >
                            Next <ChevronRight size={16} />
                        </button>
                    </div>
                ) : null}

                <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                    {participant.paymentScreenshotUrl ? (
                        <a href={participant.paymentScreenshotUrl} target="_blank" rel="noopener noreferrer" className="block">
                            <img
                                src={participant.paymentScreenshotUrl}
                                alt="Payment screenshot"
                                className="w-full max-h-[42vh] object-contain rounded-xl border border-gray-700 bg-black/40"
                            />
                            <p className="text-[10px] text-center text-gray-500 mt-1.5">Tap to open full size</p>
                        </a>
                    ) : (
                        <div className="rounded-xl border border-dashed border-gray-700 p-8 text-center text-sm text-gray-500">
                            No screenshot attached
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="rounded-lg bg-[#111213] border border-gray-800 px-3 py-2.5">
                            <p className="text-[10px] uppercase text-gray-500">Due (UPI)</p>
                            <p className="font-semibold text-[#0ECCEE] text-base">₹{expected.toLocaleString('en-IN')}</p>
                        </div>
                        <div className="rounded-lg bg-[#111213] border border-gray-800 px-3 py-2.5">
                            <p className="text-[10px] uppercase text-gray-500">List price</p>
                            <p className="font-semibold text-base">
                                ₹{(listAmount || expected).toLocaleString('en-IN')}
                            </p>
                        </div>
                        {participant.tierName ? (
                            <div className="col-span-2 rounded-lg bg-[#111213] border border-gray-800 px-3 py-2 text-xs text-gray-300">
                                Tier: <span className="font-semibold text-white">{participant.tierName}</span>
                                {Number(participant.tierFee) > 0
                                    ? ` · ₹${Number(participant.tierFee).toLocaleString('en-IN')}/person`
                                    : ''}
                            </div>
                        ) : null}
                        {participant.couponCode ? (
                            <div className="col-span-2 rounded-lg bg-green-500/10 border border-green-500/30 px-3 py-2 text-xs text-green-300">
                                Coupon `{participant.couponCode}`
                                {Number(participant.couponDiscount) > 0
                                    ? ` · −₹${Number(participant.couponDiscount).toLocaleString('en-IN')}`
                                    : ''}
                                {listAmount > 0
                                    ? ` (was ₹${listAmount.toLocaleString('en-IN')})`
                                    : ''}
                            </div>
                        ) : null}
                        {!hasScreenshot && amount > 0 ? (
                            <div className="col-span-2 rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-xs text-red-200">
                                No screenshot — Approve is blocked. Reject or ask them to re-register with proof.
                            </div>
                        ) : null}
                        <div className="rounded-lg bg-[#111213] border border-gray-800 px-3 py-2.5">
                            <p className="text-[10px] uppercase text-gray-500">People</p>
                            <p className="font-semibold">{people}</p>
                        </div>
                        <div className="rounded-lg bg-[#111213] border border-gray-800 px-3 py-2.5">
                            <p className="text-[10px] uppercase text-gray-500">Submitted</p>
                            <p className="font-semibold text-xs">{submittedAt || '—'}</p>
                        </div>
                        {runDate ? (
                            <div className="col-span-2 rounded-lg bg-[#111213] border border-gray-800 px-3 py-2.5">
                                <p className="text-[10px] uppercase text-gray-500">Run date</p>
                                <p className="font-semibold text-sm">
                                    {runDate}
                                    {participant.trekTime ? ` · ${participant.trekTime}` : ''}
                                </p>
                            </div>
                        ) : null}
                        {participant.transactionId ? (
                            <div className="col-span-2 rounded-lg bg-[#111213] border border-gray-800 px-3 py-2.5">
                                <p className="text-[10px] uppercase text-gray-500">Txn ID</p>
                                <p className="font-mono text-sm break-all">{participant.transactionId}</p>
                            </div>
                        ) : null}
                        {phone ? (
                            <div className="col-span-2 flex flex-wrap gap-2">
                                <a
                                    href={`tel:${phone.replace(/\s/g, '')}`}
                                    className="inline-flex items-center gap-1.5 px-3 py-2.5 min-h-[44px] rounded-lg bg-[#0ECCEE]/10 text-[#0ECCEE] text-xs font-medium"
                                >
                                    <Phone size={13} /> {phone}
                                </a>
                                {whatsappHref(phone, participant.participantName) ? (
                                    <a
                                        href={whatsappHref(phone, participant.participantName)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 px-3 py-2.5 min-h-[44px] rounded-lg bg-emerald-500/15 text-emerald-400 text-xs font-medium"
                                    >
                                        <MessageCircle size={13} /> WhatsApp
                                    </a>
                                ) : null}
                                <button
                                    type="button"
                                    onClick={() => navigator.clipboard?.writeText(phone)}
                                    className="inline-flex items-center gap-1.5 px-3 py-2.5 min-h-[44px] rounded-lg border border-gray-700 text-xs text-gray-300"
                                >
                                    <Copy size={13} /> Copy
                                </button>
                            </div>
                        ) : null}
                    </div>

                    {!rejectMode ? (
                        <div className="sticky bottom-0 -mx-4 px-4 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] bg-linear-to-t from-[#161718] via-[#161718] to-transparent space-y-2">
                            <button
                                type="button"
                                disabled={busy || !canApprove}
                                onClick={handleApprove}
                                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3.5 min-h-[52px] rounded-xl bg-emerald-500 text-black text-base font-bold disabled:opacity-60 active:scale-[0.98]"
                            >
                                {busy ? <Loader className="animate-spin" size={18} /> : <CheckCircle size={18} />}
                                {canApprove ? 'Approve payment' : 'Approve blocked — no screenshot'}
                            </button>
                            <button
                                type="button"
                                disabled={busy}
                                onClick={() => setRejectMode(true)}
                                className="w-full px-4 py-3 min-h-[48px] rounded-xl border border-red-500/40 text-red-400 text-sm font-medium hover:bg-red-500/10 disabled:opacity-60"
                            >
                                Reject
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-3 pt-1">
                            <div>
                                <p className="text-xs text-gray-400 mb-2">Quick reasons</p>
                                <div className="flex flex-wrap gap-2">
                                    {REJECT_PRESETS.map((preset) => (
                                        <button
                                            key={preset}
                                            type="button"
                                            onClick={() => setNote(preset)}
                                            className={`px-3 py-1.5 rounded-full text-xs border ${
                                                note === preset
                                                    ? 'border-red-400/60 bg-red-500/15 text-red-300'
                                                    : 'border-gray-700 text-gray-300'
                                            }`}
                                        >
                                            {preset}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <label className="block">
                                <span className="text-xs text-gray-400">Reject reason (required)</span>
                                <textarea
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    rows={3}
                                    className="mt-1 w-full rounded-lg bg-[#111213] border border-gray-700 px-3 py-2.5 text-base focus:outline-none focus:border-red-400/50"
                                    placeholder="Add or edit the note the runner will see"
                                />
                            </label>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => setRejectMode(false)}
                                    className="flex-1 px-4 py-3 min-h-[48px] rounded-xl border border-gray-700 text-sm"
                                >
                                    Back
                                </button>
                                <button
                                    type="button"
                                    disabled={busy || note.trim().length < 3}
                                    onClick={handleReject}
                                    className="flex-1 px-4 py-3 min-h-[48px] rounded-xl bg-red-500 text-white text-sm font-bold disabled:opacity-50"
                                >
                                    {busy ? <Loader className="animate-spin inline" size={16} /> : null}
                                    Confirm reject
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
