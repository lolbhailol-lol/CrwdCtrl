import { useEffect, useState } from 'react';
import { X, Loader, Clock, CheckCircle, AlertCircle, Phone, Copy, UserRound, MessageCircle } from 'lucide-react';
import { fetchTrekOrganizerParticipant, resendTrekOrganizerConfirmation } from '../../services/api/trekOrganizer.api';
import { useDialog } from '../../context/DialogContext';
import TrekRegistrationResponses from './TrekRegistrationResponses';
import TrekOrganizerWhatsAppModal from './TrekOrganizerWhatsAppModal';
import { isValidWhatsAppPhone } from '../../utils/whatsappDeepLink';

function Badge({ children, tone = 'neutral' }) {
    const tones = {
        success: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
        warning: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
        neutral: 'bg-white/5 text-gray-300 border-white/10',
        info: 'bg-[#0ECCEE]/15 text-[#0ECCEE] border-[#0ECCEE]/30',
    };
    return (
        <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-medium border ${tones[tone] || tones.neutral}`}>
            {children}
        </span>
    );
}

function formatDt(d) {
    if (!d) return '—';
    return new Date(d).toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function initials(name = '') {
    const parts = String(name).trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export default function TrekOrganizerParticipantModal({ trekId, bookingId, onClose, onUpdated }) {
    const { confirm, toast } = useDialog();
    const [participant, setParticipant] = useState(null);
    const [loading, setLoading] = useState(true);
    const [resending, setResending] = useState(false);
    const [waOpen, setWaOpen] = useState(false);

    useEffect(() => {
        if (!trekId || !bookingId) return;
        (async () => {
            setLoading(true);
            try {
                const data = await fetchTrekOrganizerParticipant(trekId, bookingId);
                setParticipant(data.participant);
            } catch (e) {
                toast(e.message || 'Failed to load participant');
                onClose();
            } finally {
                setLoading(false);
            }
        })();
    }, [trekId, bookingId, onClose, toast]);

    const handleResend = async () => {
        const ok = await confirm('Resend booking confirmation to this participant?');
        if (!ok) return;
        setResending(true);
        try {
            await resendTrekOrganizerConfirmation(trekId, bookingId);
            toast('Confirmation resent');
            onUpdated?.();
        } catch (e) {
            toast(e.message || 'Failed to resend');
        } finally {
            setResending(false);
        }
    };

    const phone = participant?.phone && participant.phone !== '—' ? participant.phone : '';
    const canWhatsApp = isValidWhatsAppPhone(phone);

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <button type="button" className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" onClick={onClose} aria-label="Close" />
            <div className="relative w-full sm:max-w-lg max-h-[92dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-white/10 bg-[#121314] shadow-2xl">
                <div className="sticky top-0 flex items-center justify-between px-4 py-3.5 border-b border-white/10 bg-[#121314]/95 backdrop-blur z-10">
                    <div>
                        <p className="text-[10px] uppercase tracking-[0.12em] text-gray-500 font-semibold">Participant</p>
                        <h2 className="font-semibold text-white">Registration details</h2>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2.5 min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl border border-white/10 hover:bg-white/5 text-gray-400"
                    >
                        <X size={18} />
                    </button>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                        <Loader className="animate-spin text-[#0ECCEE]" />
                        <p className="text-xs text-gray-500">Loading details…</p>
                    </div>
                ) : participant ? (
                    <div className="p-4 sm:p-5 space-y-4 pb-[max(1.25rem,var(--safe-bottom))]">
                        <div className="rounded-2xl border border-white/10 bg-linear-to-br from-[#1a1b1d] to-[#141516] p-4">
                            <div className="flex items-start gap-3">
                                <div className="size-12 rounded-2xl bg-linear-to-br from-[#0ECCEE]/25 to-[#053780]/40 text-[#0ECCEE] flex items-center justify-center text-sm font-bold shrink-0">
                                    {initials(participant.participantName)}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-lg font-semibold tracking-tight">{participant.participantName}</p>
                                    <div className="flex flex-wrap gap-1.5 mt-2">
                                        <Badge tone={participant.paymentStatus === 'Paid' ? 'success' : 'neutral'}>
                                            {participant.paymentStatus}
                                        </Badge>
                                        <Badge tone={participant.checkInStatus === 'Checked In' ? 'success' : 'warning'}>
                                            {participant.checkInStatus}
                                        </Badge>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {phone ? (
                            <div className="flex flex-wrap gap-2">
                                <a
                                    href={`tel:${phone.replace(/\s/g, '')}`}
                                    className="inline-flex items-center gap-1.5 px-3.5 py-2.5 min-h-[44px] rounded-xl bg-[#0ECCEE] text-black text-xs font-semibold"
                                >
                                    <Phone size={13} /> {phone}
                                </a>
                                <button
                                    type="button"
                                    onClick={() => {
                                        navigator.clipboard?.writeText(phone);
                                        toast('Phone copied');
                                    }}
                                    className="inline-flex items-center gap-1.5 px-3.5 py-2.5 min-h-[44px] rounded-xl border border-white/10 text-xs text-gray-300 hover:border-[#0ECCEE]/40"
                                >
                                    <Copy size={13} /> Copy
                                </button>
                                {canWhatsApp ? (
                                    <button
                                        type="button"
                                        onClick={() => setWaOpen(true)}
                                        className="inline-flex items-center gap-1.5 px-3.5 py-2.5 min-h-[44px] rounded-xl bg-[#25D366] text-black text-xs font-semibold"
                                    >
                                        <MessageCircle size={13} /> WhatsApp
                                    </button>
                                ) : null}
                            </div>
                        ) : null}

                        <TrekRegistrationResponses
                            fields={participant.registrationFields || []}
                            bookingDetails={participant.bookingDetails}
                            userEmail={participant.userEmail}
                            phone={phone}
                            gender={participant.participantGender}
                            skipNamePhone
                        />

                        <div className="grid grid-cols-2 gap-2.5 text-sm">
                            <div className="rounded-2xl border border-white/10 bg-[#161718] px-3.5 py-3">
                                <p className="text-[10px] uppercase tracking-[0.08em] text-gray-500">Booked</p>
                                <p className="text-sm mt-1 text-gray-100">{formatDt(participant.bookingDate)}</p>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-[#161718] px-3.5 py-3">
                                <p className="text-[10px] uppercase tracking-[0.08em] text-gray-500">Check-in</p>
                                <p className="text-sm mt-1 text-gray-100">{formatDt(participant.checkedInAt)}</p>
                            </div>
                            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-3.5 py-3 col-span-2">
                                <p className="text-[10px] uppercase tracking-[0.08em] text-emerald-400/80">Your share</p>
                                <p className="text-base mt-1 text-emerald-300 font-semibold tabular-nums">
                                    ₹{Number(participant.organizerNet ?? participant.amountPaid ?? 0).toLocaleString('en-IN')}
                                </p>
                            </div>
                        </div>

                        {(participant.timeline || []).length > 0 ? (
                            <div className="rounded-2xl border border-white/10 bg-[#161718] p-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <UserRound size={14} className="text-gray-500" />
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-gray-500">Timeline</p>
                                </div>
                                <div className="space-y-3">
                                    {(participant.timeline || []).map((item, i) => (
                                        <div key={i} className="flex gap-2.5 text-sm">
                                            {item.status === 'done' ? (
                                                <CheckCircle size={15} className="text-emerald-400 shrink-0 mt-0.5" />
                                            ) : item.status === 'cancelled' ? (
                                                <AlertCircle size={15} className="text-red-400 shrink-0 mt-0.5" />
                                            ) : (
                                                <Clock size={15} className="text-amber-400 shrink-0 mt-0.5" />
                                            )}
                                            <div>
                                                <p className="text-gray-100">{item.label}</p>
                                                {item.at ? <p className="text-xs text-gray-500 mt-0.5">{formatDt(item.at)}</p> : null}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : null}

                        <button
                            type="button"
                            onClick={handleResend}
                            disabled={resending}
                            className="w-full py-3.5 min-h-[52px] rounded-2xl border border-white/10 bg-white/5 text-sm font-medium hover:border-[#0ECCEE]/45 hover:bg-[#0ECCEE]/10 disabled:opacity-60 transition-colors"
                        >
                            {resending ? 'Sending…' : 'Resend confirmation'}
                        </button>
                    </div>
                ) : null}

                <TrekOrganizerWhatsAppModal
                    open={waOpen}
                    onClose={() => setWaOpen(false)}
                    recipients={participant ? [{
                        name: participant.participantName,
                        phone: participant.phone,
                        trekName: participant.trekName || '',
                    }] : []}
                />
            </div>
        </div>
    );
}
