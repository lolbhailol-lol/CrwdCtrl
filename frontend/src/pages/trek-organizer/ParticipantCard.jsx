import { useState } from 'react';
import {
    ChevronDown, Phone, Calendar, Users,
    CheckCircle, Clock, Copy, MessageCircle, Trash2, Mail, Bell,
} from 'lucide-react';
import TrekRegistrationResponses from './TrekRegistrationResponses';

function Pill({ children, tone = 'neutral' }) {
    const styles = {
        paid: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/25',
        free: 'bg-gray-700/40 text-gray-400 border-gray-600/40',
        in: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/25',
        pending: 'bg-amber-500/20 text-amber-400 border-amber-500/25',
    };
    return (
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${styles[tone] || styles.free}`}>
            {children}
        </span>
    );
}

function initials(name = '') {
    const parts = String(name).trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function formatShortDate(d) {
    if (!d) return '';
    return new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function copyText(text, onDone) {
    if (!text) return;
    navigator.clipboard?.writeText(text).then(() => onDone?.()).catch(() => {});
}

export default function ParticipantCard({
    participant,
    index,
    forceOpen = false,
    selected = false,
    onToggleSelect,
    onResend,
    onSendEmail,
    onNotify,
    onDelete,
    onCopied,
    onApprovePayment,
    onRejectPayment,
    onReviewPayment,
}) {
    const [open, setOpen] = useState(false);
    const isOpen = forceOpen || open;
    const fields = participant.registrationFields || [];
    const checkedIn = participant.checkInStatus === 'Checked In';
    const paid = participant.paymentStatus === 'Paid';
    const pendingReview = participant.paymentStatus === 'Pending review' || participant.status === 'pending';
    const rejected = participant.paymentStatus === 'Rejected' || participant.status === 'cancelled';
    const phone = participant.phone && participant.phone !== '—' ? participant.phone : '';
    const email = participant.userEmail || participant.email || '';

    const borderTone = checkedIn
        ? 'border-l-emerald-500'
        : pendingReview
            ? 'border-l-amber-400'
            : rejected
                ? 'border-l-red-500'
                : paid
                    ? 'border-l-[#0ECCEE]'
                    : 'border-l-gray-500';

    return (
        <article className={`rounded-xl border border-gray-800 border-l-[3px] ${borderTone} bg-[#161718] overflow-hidden ${selected ? 'ring-1 ring-[#0ECCEE]/50' : ''}`}>
            <div className="flex items-start gap-2 p-3 sm:p-4 pb-0">
                {onToggleSelect ? (
                    <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => onToggleSelect(participant.bookingId)}
                        className="mt-3 rounded border-gray-600 shrink-0"
                        aria-label={`Select ${participant.participantName}`}
                    />
                ) : null}
                <button
                    type="button"
                    onClick={() => setOpen((v) => !v)}
                    className="flex-1 min-w-0 text-left flex gap-3 items-start pb-3 sm:pb-4 -mr-1 pr-1 rounded-lg"
                >
                    <div className="relative shrink-0">
                        <div className="size-10 sm:size-11 rounded-xl bg-linear-to-br from-[#0ECCEE]/20 to-[#053780]/30 text-[#0ECCEE] flex items-center justify-center text-sm font-bold">
                            {initials(participant.participantName)}
                        </div>
                        <span className="absolute -bottom-1 -right-1 size-5 rounded-full bg-[#111213] border border-gray-700 text-[9px] font-bold text-gray-400 flex items-center justify-center">
                            {index}
                        </span>
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 mb-1">
                            <h3 className="font-semibold text-[15px] sm:text-base truncate max-w-full">
                                {participant.participantName}
                            </h3>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mb-1.5">
                            <Pill tone={pendingReview ? 'pending' : rejected ? 'pending' : paid ? 'paid' : 'free'}>
                                {participant.paymentStatus}
                            </Pill>
                            {participant.tierName ? (
                                <Pill tone="paid">{participant.tierName}</Pill>
                            ) : null}
                            {participant.participantGender && participant.participantGender !== '—' ? (
                                <Pill tone="neutral">{participant.participantGender}</Pill>
                            ) : null}
                            <Pill tone={checkedIn ? 'in' : 'pending'}>
                                {checkedIn ? 'Checked in' : 'Awaiting'}
                            </Pill>
                        </div>

                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-400">
                            {phone ? (
                                <span className="inline-flex items-center gap-1 font-medium text-gray-300">
                                    <Phone size={12} className="text-[#0ECCEE]" />{phone}
                                </span>
                            ) : null}
                            {participant.trekDate ? (
                                <span className="inline-flex items-center gap-1">
                                    <Calendar size={12} />
                                    {participant.trekDate}
                                    {participant.trekTime ? ` · ${participant.trekTime}` : ''}
                                </span>
                            ) : null}
                            {(participant.people ?? 1) > 1 ? (
                                <span className="inline-flex items-center gap-1">
                                    <Users size={12} />{participant.people} people
                                </span>
                            ) : null}
                            {!isOpen && fields.length > 0 ? (
                                <span className="text-gray-600">
                                    {fields.length} form field{fields.length === 1 ? '' : 's'} · tap to view
                                </span>
                            ) : null}
                        </div>
                    </div>

                    <ChevronDown
                        size={18}
                        className={`text-gray-500 shrink-0 mt-1 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                    />
                </button>
            </div>

            <div className={`grid transition-[grid-template-rows] duration-200 ease-out ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                <div className="overflow-hidden">
                    <div className="px-3 sm:px-4 pb-4 border-t border-gray-800/80 space-y-3">
                        <div className="flex flex-wrap gap-2 pt-3">
                            {phone ? (
                                <>
                                    <a
                                        href={`tel:${phone.replace(/\s/g, '')}`}
                                        className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-lg bg-[#0ECCEE]/10 text-[#0ECCEE] text-xs font-medium"
                                    >
                                        <Phone size={13} /> Call
                                    </a>
                                    <button
                                        type="button"
                                        onClick={() => copyText(phone, () => onCopied?.('Phone copied'))}
                                        className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-lg border border-gray-700 text-xs text-gray-300"
                                    >
                                        <Copy size={13} /> Copy phone
                                    </button>
                                </>
                            ) : null}
                            <button
                                type="button"
                                onClick={() => copyText(participant.bookingId, () => onCopied?.('Booking ID copied'))}
                                className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-lg border border-gray-700 text-xs text-gray-300"
                            >
                                <Copy size={13} /> Copy ID
                            </button>
                            {onResend ? (
                                <button
                                    type="button"
                                    onClick={() => onResend(participant.bookingId)}
                                    className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-lg border border-gray-700 text-xs text-gray-300 hover:border-[#0ECCEE]/40 hover:text-[#0ECCEE]"
                                >
                                    <MessageCircle size={13} /> Resend ticket
                                </button>
                            ) : null}
                            {onNotify ? (
                                <button
                                    type="button"
                                    onClick={() => onNotify(participant)}
                                    className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-lg border border-gray-700 text-xs text-gray-300 hover:border-[#0ECCEE]/40 hover:text-[#0ECCEE]"
                                >
                                    <Bell size={13} /> Message
                                </button>
                            ) : null}
                            {onSendEmail ? (
                                <button
                                    type="button"
                                    onClick={() => onSendEmail(participant)}
                                    className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-lg border border-gray-700 text-xs text-gray-300 hover:border-[#0ECCEE]/40 hover:text-[#0ECCEE]"
                                >
                                    <Mail size={13} /> Email
                                </button>
                            ) : null}
                            {onDelete ? (
                                <button
                                    type="button"
                                    onClick={() => onDelete(participant.bookingId, participant.participantName)}
                                    className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-lg border border-red-900/50 text-xs text-red-400"
                                >
                                    <Trash2 size={13} /> Delete
                                </button>
                            ) : null}
                        </div>

                        {pendingReview || participant.paymentScreenshotUrl ? (
                            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
                                <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-300">Payment</p>
                                {participant.paymentScreenshotUrl ? (
                                    <a href={participant.paymentScreenshotUrl} target="_blank" rel="noopener noreferrer" className="block">
                                        <img
                                            src={participant.paymentScreenshotUrl}
                                            alt="Payment screenshot"
                                            className="max-h-44 w-full rounded-lg border border-gray-700 object-contain bg-black/40"
                                        />
                                    </a>
                                ) : (
                                    <p className="text-sm text-gray-500">No screenshot</p>
                                )}
                                {participant.transactionId ? (
                                    <p className="text-xs text-gray-400">
                                        Txn: <span className="text-gray-200 font-mono">{participant.transactionId}</span>
                                    </p>
                                ) : null}
                                {pendingReview && onReviewPayment ? (
                                    <button
                                        type="button"
                                        onClick={() => onReviewPayment(participant)}
                                        className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-3 min-h-[48px] rounded-xl bg-amber-400 text-black text-sm font-bold"
                                    >
                                        Review payment
                                    </button>
                                ) : null}
                                {pendingReview && !onReviewPayment && (onApprovePayment || onRejectPayment) ? (
                                    <div className="flex gap-2">
                                        {onApprovePayment ? (
                                            <button
                                                type="button"
                                                onClick={() => onApprovePayment(participant.bookingId)}
                                                className="flex-1 py-2.5 rounded-lg bg-emerald-500 text-black text-xs font-bold"
                                            >
                                                Approve
                                            </button>
                                        ) : null}
                                        {onRejectPayment ? (
                                            <button
                                                type="button"
                                                onClick={() => onRejectPayment(participant.bookingId)}
                                                className="flex-1 py-2.5 rounded-lg border border-red-500/40 text-xs text-red-400"
                                            >
                                                Reject
                                            </button>
                                        ) : null}
                                    </div>
                                ) : null}
                            </div>
                        ) : null}

                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2">
                                Registration details
                            </p>
                            <TrekRegistrationResponses
                                fields={fields}
                                bookingDetails={participant.bookingDetails}
                                userEmail={email}
                                phone={phone}
                                gender={participant.participantGender}
                                skipNamePhone
                                compact
                            />
                        </div>

                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 pt-1">
                            <span className="inline-flex items-center gap-1">
                                {checkedIn ? (
                                    <CheckCircle size={12} className="text-emerald-400" />
                                ) : (
                                    <Clock size={12} className="text-amber-400" />
                                )}
                                {checkedIn && participant.checkedInAt
                                    ? `Checked in ${formatShortDate(participant.checkedInAt)}`
                                    : `Registered ${formatShortDate(participant.bookingDate)}`}
                            </span>
                            {(participant.organizerNet ?? 0) > 0 ? (
                                <span className="text-emerald-400 font-medium">
                                    ₹{Number(participant.organizerNet).toLocaleString('en-IN')}
                                </span>
                            ) : null}
                        </div>
                    </div>
                </div>
            </div>
        </article>
    );
}
