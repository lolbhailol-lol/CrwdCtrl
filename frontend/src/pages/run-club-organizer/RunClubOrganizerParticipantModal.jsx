import { useEffect, useState } from 'react';
import { X, Loader, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { fetchRunClubOrganizerParticipant, resendRunClubOrganizerConfirmation } from '../../services/api/runClubOrganizer.api';
import { useDialog } from '../../context/DialogContext';
import TrekRegistrationResponses from '../trek-organizer/TrekRegistrationResponses';

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
    return new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function RunClubOrganizerParticipantModal({ eventId, bookingId, onClose, onUpdated }) {
    const { confirm, toast } = useDialog();
    const [participant, setParticipant] = useState(null);
    const [loading, setLoading] = useState(true);
    const [resending, setResending] = useState(false);

    useEffect(() => {
        if (!eventId || !bookingId) return;
        (async () => {
            setLoading(true);
            try {
                const data = await fetchRunClubOrganizerParticipant(eventId, bookingId);
                setParticipant(data.participant);
            } catch (e) {
                toast(e.message || 'Failed to load participant');
                onClose();
            } finally {
                setLoading(false);
            }
        })();
    }, [eventId, bookingId, onClose, toast]);

    const handleResend = async () => {
        const ok = await confirm('Resend booking confirmation to this participant?');
        if (!ok) return;
        setResending(true);
        try {
            await resendRunClubOrganizerConfirmation(eventId, bookingId);
            toast('Confirmation resent');
            onUpdated?.();
        } catch (e) {
            toast(e.message || 'Failed to resend');
        } finally {
            setResending(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <button type="button" className="absolute inset-0 bg-black/60" onClick={onClose} aria-label="Close" />
            <div className="relative w-full sm:max-w-2xl max-h-[90dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-gray-800 bg-[#161718] shadow-2xl">
                <div className="sticky top-0 flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-[#161718] z-10">
                    <h2 className="font-semibold">Participant details</h2>
                    <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400">
                        <X size={18} />
                    </button>
                </div>

                {loading ? (
                    <div className="flex justify-center py-16"><Loader className="animate-spin text-[#0ECCEE]" /></div>
                ) : participant ? (
                    <div className="p-4 space-y-5">
                        <div>
                            <p className="text-lg font-bold">{participant.participantName}</p>
                            <p className="text-xs text-gray-500 font-mono mt-0.5">{participant.bookingId}</p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <Badge tone={participant.paymentStatus === 'Paid' ? 'success' : 'neutral'}>{participant.paymentStatus}</Badge>
                            <Badge tone={participant.checkInStatus === 'Checked In' ? 'success' : 'warning'}>{participant.checkInStatus}</Badge>
                            {participant.tierName ? (
                                <Badge tone="info">{participant.tierName}</Badge>
                            ) : null}
                            {participant.addOnSelected && participant.addOnLabel ? (
                                <Badge tone="success">+ {participant.addOnLabel}</Badge>
                            ) : null}
                        </div>

                        {participant.tierName ? (
                            <div className="rounded-xl border border-[#0ECCEE]/25 bg-[#0ECCEE]/5 px-4 py-3 text-sm">
                                <p className="text-[11px] uppercase tracking-wide text-[#0ECCEE] font-semibold mb-1">Selected tier</p>
                                <p className="font-semibold text-white">{participant.tierName}</p>
                                <p className="text-xs text-gray-400 mt-0.5">
                                    {Number(participant.tierFee) > 0
                                        ? `₹${Number(participant.tierFee).toLocaleString('en-IN')} per person`
                                        : 'Free tier'}
                                    {(participant.people ?? 1) > 1
                                        ? ` · ${participant.people} people`
                                        : ''}
                                </p>
                            </div>
                        ) : null}

                        {participant.addOnSelected && participant.addOnLabel ? (
                            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm">
                                <p className="text-[11px] uppercase tracking-wide text-emerald-400 font-semibold mb-1">Optional add-on</p>
                                <p className="font-semibold text-white">{participant.addOnLabel}</p>
                                <p className="text-xs text-gray-400 mt-0.5">
                                    {Number(participant.addOnFee) > 0
                                        ? `₹${Number(participant.addOnFee).toLocaleString('en-IN')} per person`
                                        : 'Included'}
                                    {(participant.people ?? 1) > 1 && Number(participant.addOnFee) > 0
                                        ? ` · ₹${Number(participant.addOnTotal || (participant.addOnFee * participant.people)).toLocaleString('en-IN')} total`
                                        : ''}
                                </p>
                            </div>
                        ) : null}

                        <div className="rounded-xl border border-gray-800 bg-[#111213] p-4">
                            <p className="text-xs font-semibold text-[#0ECCEE] mb-3 uppercase tracking-wide">Registration form</p>
                            <TrekRegistrationResponses
                                fields={participant.registrationFields || []}
                                bookingDetails={participant.bookingDetails}
                                userEmail={participant.userEmail}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                                <p className="text-[11px] text-gray-500 uppercase">Registered</p>
                                <p>{formatDt(participant.bookingDate)}</p>
                            </div>
                            <div>
                                <p className="text-[11px] text-gray-500 uppercase">Check-in time</p>
                                <p>{formatDt(participant.checkedInAt)}</p>
                            </div>
                            {(participant.organizerNet ?? 0) > 0 ? (
                                <div>
                                    <p className="text-[11px] text-gray-500 uppercase">Amount paid</p>
                                    <p className="text-emerald-400 font-medium">₹{Number(participant.organizerNet).toLocaleString('en-IN')}</p>
                                </div>
                            ) : null}
                        </div>

                        <div>
                            <p className="text-xs font-semibold text-gray-400 mb-2">Timeline</p>
                            <div className="space-y-2">
                                {(participant.timeline || []).map((item, i) => (
                                    <div key={i} className="flex gap-3 text-sm">
                                        {item.status === 'done' ? (
                                            <CheckCircle size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                                        ) : item.status === 'cancelled' ? (
                                            <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
                                        ) : (
                                            <Clock size={16} className="text-amber-400 shrink-0 mt-0.5" />
                                        )}
                                        <div>
                                            <p>{item.label}</p>
                                            {item.at ? <p className="text-xs text-gray-500">{formatDt(item.at)}</p> : null}
                                            {item.detail ? <p className="text-xs text-gray-500">{item.detail}</p> : null}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <button type="button" onClick={handleResend} disabled={resending} className="w-full py-2.5 rounded-xl border border-gray-700 text-sm font-medium hover:border-[#0ECCEE]/50 disabled:opacity-60">
                            {resending ? 'Sending…' : 'Resend confirmation'}
                        </button>
                    </div>
                ) : null}
            </div>
        </div>
    );
}
