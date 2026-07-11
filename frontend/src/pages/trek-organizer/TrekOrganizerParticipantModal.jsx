import { useEffect, useState } from 'react';
import { X, Loader, Clock, CheckCircle, AlertCircle, Phone, Copy } from 'lucide-react';
import { fetchTrekOrganizerParticipant, resendTrekOrganizerConfirmation } from '../../services/api/trekOrganizer.api';
import { useDialog } from '../../context/DialogContext';
import TrekRegistrationResponses from './TrekRegistrationResponses';

function Badge({ children, tone = 'neutral' }) {
    const tones = {
        success: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
        warning: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
        neutral: 'bg-gray-500/15 text-gray-300 border-gray-600',
        info: 'bg-[#0ECCEE]/15 text-[#0ECCEE] border-[#0ECCEE]/30',
    };
    return (
        <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium border ${tones[tone] || tones.neutral}`}>
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

export default function TrekOrganizerParticipantModal({ trekId, bookingId, onClose, onUpdated }) {
    const { confirm, toast } = useDialog();
    const [participant, setParticipant] = useState(null);
    const [loading, setLoading] = useState(true);
    const [resending, setResending] = useState(false);

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

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <button type="button" className="absolute inset-0 bg-black/60" onClick={onClose} aria-label="Close" />
            <div className="relative w-full sm:max-w-lg max-h-[92dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-gray-800 bg-[#161718] shadow-2xl">
                <div className="sticky top-0 flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-[#161718] z-10">
                    <h2 className="font-semibold">Registration details</h2>
                    <button type="button" onClick={onClose} className="p-2.5 min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg hover:bg-white/5 text-gray-400">
                        <X size={18} />
                    </button>
                </div>

                {loading ? (
                    <div className="flex justify-center py-16"><Loader className="animate-spin text-[#0ECCEE]" /></div>
                ) : participant ? (
                    <div className="p-4 space-y-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                        <div>
                            <p className="text-lg font-bold">{participant.participantName}</p>
                            <div className="flex flex-wrap gap-1.5 mt-2">
                                <Badge tone={participant.paymentStatus === 'Paid' ? 'success' : 'neutral'}>
                                    {participant.paymentStatus}
                                </Badge>
                                <Badge tone={participant.checkInStatus === 'Checked In' ? 'success' : 'warning'}>
                                    {participant.checkInStatus}
                                </Badge>
                            </div>
                        </div>

                        {phone ? (
                            <div className="flex flex-wrap gap-2">
                                <a
                                    href={`tel:${phone.replace(/\s/g, '')}`}
                                    className="inline-flex items-center gap-1.5 px-3 py-2.5 min-h-[44px] rounded-lg bg-[#0ECCEE]/10 text-[#0ECCEE] text-xs font-medium"
                                >
                                    <Phone size={13} /> {phone}
                                </a>
                                <button
                                    type="button"
                                    onClick={() => {
                                        navigator.clipboard?.writeText(phone);
                                        toast('Phone copied');
                                    }}
                                    className="inline-flex items-center gap-1.5 px-3 py-2.5 min-h-[44px] rounded-lg border border-gray-700 text-xs text-gray-300"
                                >
                                    <Copy size={13} /> Copy
                                </button>
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

                        <div className="grid grid-cols-2 gap-2 text-sm">
                            <div className="rounded-xl border border-gray-800 bg-[#111213] px-3 py-2.5">
                                <p className="text-[10px] uppercase text-gray-500">Booked</p>
                                <p className="text-sm mt-0.5">{formatDt(participant.bookingDate)}</p>
                            </div>
                            <div className="rounded-xl border border-gray-800 bg-[#111213] px-3 py-2.5">
                                <p className="text-[10px] uppercase text-gray-500">Check-in</p>
                                <p className="text-sm mt-0.5">{formatDt(participant.checkedInAt)}</p>
                            </div>
                            <div className="rounded-xl border border-gray-800 bg-[#111213] px-3 py-2.5 col-span-2">
                                <p className="text-[10px] uppercase text-gray-500">Your share</p>
                                <p className="text-sm mt-0.5 text-emerald-400 font-medium">
                                    ₹{Number(participant.organizerNet ?? participant.amountPaid ?? 0).toLocaleString('en-IN')}
                                </p>
                            </div>
                        </div>

                        {(participant.timeline || []).length > 0 ? (
                            <div>
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2">Timeline</p>
                                <div className="space-y-2">
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
                                                <p>{item.label}</p>
                                                {item.at ? <p className="text-xs text-gray-500">{formatDt(item.at)}</p> : null}
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
                            className="w-full py-3.5 min-h-[52px] rounded-xl border border-gray-700 text-sm font-medium hover:border-[#0ECCEE]/50 disabled:opacity-60"
                        >
                            {resending ? 'Sending…' : 'Resend confirmation'}
                        </button>
                    </div>
                ) : null}
            </div>
        </div>
    );
}
