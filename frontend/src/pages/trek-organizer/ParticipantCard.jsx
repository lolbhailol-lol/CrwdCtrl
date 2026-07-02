import { useState } from 'react';
import {
    ChevronDown, Phone, Calendar, Users, ExternalLink,
    CheckCircle, Clock, Copy, MessageCircle, Trash2,
} from 'lucide-react';

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

function previewFields(fields, limit = 2) {
    const skip = new Set(['full_name', 'name', 'fullname', 'contact_no', 'phone', 'mobile']);
    return fields.filter((f) => !skip.has(f.fieldName)).slice(0, limit);
}

export default function ParticipantCard({ participant, index, forceOpen = false, onResend, onDelete, onCopied }) {
    const [open, setOpen] = useState(false);
    const isOpen = forceOpen || open;
    const fields = participant.registrationFields || [];
    const checkedIn = participant.checkInStatus === 'Checked In';
    const paid = participant.paymentStatus === 'Paid';
    const previews = previewFields(fields);
    const phone = participant.phone && participant.phone !== '—' ? participant.phone : '';

    const borderTone = checkedIn
        ? 'border-l-emerald-500'
        : paid
            ? 'border-l-[#0ECCEE]'
            : 'border-l-amber-500';

    return (
        <article className={`rounded-xl border border-gray-800 border-l-[3px] ${borderTone} bg-[#161718] overflow-hidden transition-shadow hover:shadow-lg hover:shadow-black/20`}>
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="w-full text-left p-4 flex gap-3 items-start hover:bg-white/2 transition-colors"
            >
                <div className="relative shrink-0">
                    <div className="size-11 rounded-xl bg-linear-to-br from-[#0ECCEE]/20 to-[#053780]/30 text-[#0ECCEE] flex items-center justify-center text-sm font-bold">
                        {initials(participant.participantName)}
                    </div>
                    <span className="absolute -bottom-1 -right-1 size-5 rounded-full bg-[#111213] border border-gray-700 text-[9px] font-bold text-gray-400 flex items-center justify-center">
                        {index}
                    </span>
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <h3 className="font-semibold text-base">{participant.participantName}</h3>
                        <Pill tone={paid ? 'paid' : 'free'}>{participant.paymentStatus}</Pill>
                        <Pill tone={checkedIn ? 'in' : 'pending'}>{checkedIn ? 'Checked in' : 'Awaiting'}</Pill>
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
                        {phone ? (
                            <span className="inline-flex items-center gap-1 font-medium text-gray-300">
                                <Phone size={12} className="text-[#0ECCEE]" />{phone}
                            </span>
                        ) : null}
                        {participant.trekDate ? (
                            <span className="inline-flex items-center gap-1">
                                <Calendar size={12} />{participant.trekDate}{participant.trekTime ? ` · ${participant.trekTime}` : ''}
                            </span>
                        ) : null}
                        {(participant.people ?? 1) > 1 ? (
                            <span className="inline-flex items-center gap-1"><Users size={12} />{participant.people} people</span>
                        ) : null}
                    </div>

                    {!isOpen && previews.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                            {previews.map((f) => (
                                <span key={f.fieldName} className="text-[10px] px-2 py-0.5 rounded-md bg-[#111213] text-gray-500 truncate max-w-[160px]">
                                    {f.label}: <span className="text-gray-400">{f.value}</span>
                                </span>
                            ))}
                            {fields.length > previews.length ? (
                                <span className="text-[10px] text-gray-600">+{fields.length - previews.length} more</span>
                            ) : null}
                        </div>
                    ) : null}
                </div>

                <ChevronDown size={18} className={`text-gray-500 shrink-0 mt-1 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            <div
                className={`grid transition-[grid-template-rows] duration-200 ease-out ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
            >
                <div className="overflow-hidden">
                    <div className="px-4 pb-4 border-t border-gray-800/80">
                        <div className="flex flex-wrap gap-2 py-3">
                            {phone ? (
                                <>
                                    <a
                                        href={`tel:${phone.replace(/\s/g, '')}`}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0ECCEE]/10 text-[#0ECCEE] text-xs font-medium hover:bg-[#0ECCEE]/20"
                                    >
                                        <Phone size={13} /> Call
                                    </a>
                                    <button
                                        type="button"
                                        onClick={() => copyText(phone, () => onCopied?.('Phone copied'))}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-700 text-xs text-gray-300 hover:border-gray-500"
                                    >
                                        <Copy size={13} /> Copy phone
                                    </button>
                                </>
                            ) : null}
                            <button
                                type="button"
                                onClick={() => copyText(participant.bookingId, () => onCopied?.('Booking ID copied'))}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-700 text-xs text-gray-300 hover:border-gray-500"
                            >
                                <Copy size={13} /> Copy ID
                            </button>
                            {onResend ? (
                                <button
                                    type="button"
                                    onClick={() => onResend(participant.bookingId)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-700 text-xs text-gray-300 hover:border-[#0ECCEE]/40 hover:text-[#0ECCEE]"
                                >
                                    <MessageCircle size={13} /> Resend ticket
                                </button>
                            ) : null}
                            {onDelete ? (
                                <button
                                    type="button"
                                    onClick={() => onDelete(participant.bookingId, participant.participantName)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-900/50 text-xs text-red-400 hover:bg-red-500/10 hover:border-red-500/40"
                                >
                                    <Trash2 size={13} /> Delete entry
                                </button>
                            ) : null}
                        </div>

                        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2">Registration form</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {fields.length > 0 ? fields.map((field) => (
                                <div key={field.fieldName} className="rounded-lg bg-[#111213] border border-gray-800/60 px-3 py-2.5">
                                    <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">{field.label}</p>
                                    {field.isFile && field.fileUrl ? (
                                        <a href={field.fileUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-[#0ECCEE] inline-flex items-center gap-1 hover:underline font-medium">
                                            <ExternalLink size={13} /> Open file
                                        </a>
                                    ) : field.isFile ? (
                                        <p className="text-sm text-emerald-400 font-medium">File uploaded</p>
                                    ) : (
                                        <p className="text-sm text-gray-100 wrap-break-word whitespace-pre-wrap leading-relaxed">{field.value}</p>
                                    )}
                                </div>
                            )) : (
                                <p className="text-sm text-gray-500 col-span-2 py-2">No form details saved.</p>
                            )}
                        </div>

                        <div className="mt-3 pt-3 border-t border-gray-800 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                            <span className="inline-flex items-center gap-1">
                                {checkedIn ? <CheckCircle size={12} className="text-emerald-400" /> : <Clock size={12} className="text-amber-400" />}
                                {checkedIn && participant.checkedInAt
                                    ? `Checked in ${formatShortDate(participant.checkedInAt)}`
                                    : `Registered ${formatShortDate(participant.bookingDate)}`}
                            </span>
                            {(participant.organizerNet ?? 0) > 0 ? (
                                <span className="text-emerald-400 font-medium">
                                    Your share ₹{Number(participant.organizerNet).toLocaleString('en-IN')}
                                    {(participant.platformFee ?? 0) > 0 ? (
                                        <span className="text-gray-500 font-normal"> · customer paid ₹{Number(participant.grossCollected ?? participant.amountPaid).toLocaleString('en-IN')}</span>
                                    ) : null}
                                </span>
                            ) : null}
                        </div>
                    </div>
                </div>
            </div>
        </article>
    );
}
