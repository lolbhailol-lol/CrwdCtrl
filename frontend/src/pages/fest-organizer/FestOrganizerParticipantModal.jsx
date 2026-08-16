import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { X, Loader, Check, Ban, RotateCcw, MessageCircle, Phone, Trash2 } from 'lucide-react';
import {
    fetchFestOrganizerParticipant,
    deleteFestOrganizerParticipant,
    updateFestOrganizerParticipantStatus,
    updateFestOrganizerParticipantWhatsappGroup,
} from '../../services/api/festOrganizer.api';
import { useDialog } from '../../context/DialogContext';
import { filterExtraFestFormResponses } from '../../utils/festFormResponseKeys';
import OrganizerTeamRoster from './OrganizerTeamRoster';
import WhatsAppGroupToggle from './WhatsAppGroupToggle';
import { isMindSparkFest } from '../../features/fests/mindspark';

function humanizeKey(key = '') {
    return String(key)
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b\w/g, (c) => c.toUpperCase()) || key;
}

function Badge({ children, tone = 'neutral' }) {
    const tones = {
        success: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
        warning: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
        danger: 'bg-red-500/15 text-red-300 border-red-500/30',
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

function statusTone(status) {
    if (status === 'approved') return 'success';
    if (status === 'pending') return 'warning';
    if (status === 'rejected') return 'danger';
    return 'neutral';
}

function waLink(phone) {
    const digits = String(phone || '').replace(/\D/g, '');
    if (!digits) return null;
    const withCountry = digits.length === 10 ? `91${digits}` : digits;
    return `https://wa.me/${withCountry}`;
}

function telLink(phone) {
    const digits = String(phone || '').replace(/\D/g, '');
    return digits ? `tel:${digits}` : null;
}

export default function FestOrganizerParticipantModal({ festId, registrationId, onClose, onUpdated }) {
    const { confirm, toast } = useDialog();
    const [participant, setParticipant] = useState(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState('');
    const noReview = isMindSparkFest(festId);

    useEffect(() => {
        if (!festId || !registrationId) return;
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const data = await fetchFestOrganizerParticipant(festId, registrationId);
                if (!cancelled) setParticipant(data.participant);
            } catch (e) {
                if (!cancelled) {
                    toast(e.message || 'Failed');
                    onClose();
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [festId, registrationId]);

    const setStatus = async (status, label) => {
        const ok = await confirm({
            title: `${label}?`,
            message: `${participant?.userName || participant?.userEmail || 'This registration'} will be marked ${status}.`,
        });
        if (!ok) return;
        setBusy(status);
        try {
            const data = await updateFestOrganizerParticipantStatus(festId, registrationId, status);
            setParticipant(data.participant);
            toast(data.message || 'Updated');
            onUpdated?.();
        } catch (e) {
            toast(e.message || 'Failed');
        } finally {
            setBusy('');
        }
    };

    const deleteEntry = async () => {
        const label = participant?.userName || participant?.teamName || participant?.userEmail || 'this entry';
        const ok = await confirm({
            title: 'Delete entry?',
            message: `Remove ${label} from the roster permanently? This cannot be undone.`,
            confirmText: 'Delete',
            tone: 'danger',
        });
        if (!ok) return;
        setBusy('delete');
        try {
            await deleteFestOrganizerParticipant(festId, registrationId);
            toast('Deleted');
            onUpdated?.();
            onClose();
        } catch (e) {
            toast(e.message || 'Failed');
        } finally {
            setBusy('');
        }
    };

    const toggleWhatsappGroup = async (joined) => {
        setBusy('wa');
        try {
            const data = await updateFestOrganizerParticipantWhatsappGroup(festId, registrationId, joined);
            setParticipant(data.participant);
            toast(joined ? 'In WA' : 'Cleared');
            onUpdated?.();
        } catch (e) {
            toast(e.message || 'Failed');
        } finally {
            setBusy('');
        }
    };

    const responses = participant?.responses && typeof participant.responses === 'object'
        ? filterExtraFestFormResponses(participant.responses)
        : [];

    const wa = participant ? waLink(participant.userPhone) : null;
    const tel = participant ? telLink(participant.userPhone) : null;
    const metaBits = participant
        ? [participant.college, participant.city, participant.year, participant.course].filter(Boolean)
        : [];

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <button type="button" className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" onClick={onClose} aria-label="Close" />
            <div className="relative w-full sm:max-w-lg max-h-[92dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-white/10 bg-[#121314] shadow-2xl">
                <div className="sticky top-0 flex items-center justify-between px-4 py-3.5 border-b border-white/10 bg-[#121314]/95 backdrop-blur z-10">
                    <div>
                        <p className="text-[10px] uppercase tracking-[0.12em] text-gray-500 font-semibold">Participant</p>
                        <h2 className="font-semibold text-white">Registration</h2>
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
                    <div className="flex justify-center py-16 text-gray-400 gap-2">
                        <Loader className="animate-spin" size={18} /> Loading…
                    </div>
                ) : participant ? (
                    <div className="p-4 space-y-4">
                        <div className="rounded-xl border border-white/10 bg-white/3 px-3 py-3 space-y-1.5">
                            <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">User details</p>
                            <p className="text-lg font-semibold text-white truncate">{participant.userName || '—'}</p>
                            {participant.teamName ? (
                                <p className="text-sm text-gray-400">Team · {participant.teamName}</p>
                            ) : null}
                            <p className="text-sm text-gray-400 truncate">{participant.userEmail || 'No email'}</p>
                            <p className="text-sm text-gray-400 tabular-nums">{participant.userPhone || 'No phone'}</p>
                            {metaBits.length ? (
                                <p className="text-xs text-gray-500 pt-1">{metaBits.join(' · ')}</p>
                            ) : null}
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap gap-1.5">
                                <Badge tone={statusTone(participant.status)}>{participant.status}</Badge>
                                <Badge tone="info">{participant.paymentStatus}</Badge>
                                {participant.checkedIn ? <Badge tone="success">Checked in</Badge> : null}
                                {noReview && participant.whatsappGroupJoined ? <Badge tone="success">In WA group</Badge> : null}
                                {participant.isManual ? <Badge tone="neutral">Manual</Badge> : null}
                            </div>
                            {(wa || tel) ? (
                                <div className="flex gap-1.5">
                                    {wa ? (
                                        <a
                                            href={wa}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="p-2 rounded-xl bg-emerald-500/15 text-emerald-300"
                                            aria-label="WhatsApp"
                                        >
                                            <MessageCircle size={15} />
                                        </a>
                                    ) : null}
                                    {tel ? (
                                        <a href={tel} className="p-2 rounded-xl bg-white/5 text-gray-300" aria-label="Call">
                                            <Phone size={15} />
                                        </a>
                                    ) : null}
                                </div>
                            ) : null}
                        </div>

                        {noReview ? (
                        <div className="rounded-xl border border-white/10 bg-white/3 px-3 py-3 space-y-2">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
                                        Competition WhatsApp
                                    </p>
                                    <p className="text-xs text-gray-400 mt-1">
                                        Prefer marking this on the competition desk. You can still toggle it here.
                                    </p>
                                </div>
                                <WhatsAppGroupToggle
                                    joined={Boolean(participant.whatsappGroupJoined)}
                                    busy={busy === 'wa'}
                                    onToggle={toggleWhatsappGroup}
                                />
                            </div>
                            {participant.whatsappGroupJoinedAt ? (
                                <p className="text-[11px] text-gray-600">
                                    Marked {formatDt(participant.whatsappGroupJoinedAt)}
                                </p>
                            ) : null}
                        </div>
                        ) : null}

                        <div className="grid grid-cols-2 gap-2 text-sm">
                            <div className="rounded-xl bg-white/3 px-3 py-2.5">
                                <p className="text-[10px] text-gray-500 uppercase">Competition</p>
                                <p className="text-white mt-1">{participant.competitionName || '—'}</p>
                                {participant.competitionId && festId ? (
                                    <Link
                                        to={`/fest-organizer/fests/${festId}/competitions/${participant.competitionId}`}
                                        className="text-[11px] text-[#0ECCEE] mt-1 inline-block"
                                        onClick={onClose}
                                    >
                                        Open desk →
                                    </Link>
                                ) : null}
                            </div>
                            <div className="rounded-xl bg-white/3 px-3 py-2.5">
                                <p className="text-[10px] text-gray-500 uppercase">Amount</p>
                                <p className="text-white mt-1">₹{Number(participant.amountPaid || 0).toLocaleString('en-IN')}</p>
                            </div>
                            <div className="rounded-xl bg-white/3 px-3 py-2.5">
                                <p className="text-[10px] text-gray-500 uppercase">Submitted</p>
                                <p className="text-white mt-1 text-xs">{formatDt(participant.submittedAt || participant.createdAt)}</p>
                            </div>
                            <div className="rounded-xl bg-white/3 px-3 py-2.5">
                                <p className="text-[10px] text-gray-500 uppercase">Check-in</p>
                                <p className="text-white mt-1 text-xs">
                                    {participant.checkedIn ? formatDt(participant.checkedInAt) : 'Not yet'}
                                </p>
                            </div>
                        </div>

                        {Array.isArray(participant.teamMembers) && participant.teamMembers.length ? (
                            <OrganizerTeamRoster
                                teamMembers={participant.teamMembers}
                                personFields={participant.personFields}
                                teamSize={participant.teamSize || participant.memberCount}
                            />
                        ) : null}

                        {responses.length ? (
                            <div className="rounded-xl border border-white/10 overflow-hidden">
                                <p className="px-3 py-2 text-[10px] uppercase tracking-wider text-gray-500 bg-white/3">
                                    Extra form answers
                                </p>
                                <div className="divide-y divide-white/5">
                                    {responses.map(([key, value]) => {
                                        const label = humanizeKey(key);
                                        const display = typeof value === 'object'
                                            ? (value?.url || value?.secure_url || JSON.stringify(value))
                                            : String(value);
                                        return (
                                            <div key={key} className="px-3 py-2.5 flex items-start justify-between gap-3">
                                                <p className="text-[11px] text-gray-500 shrink-0 max-w-[40%] break-words">{label}</p>
                                                <p className="text-sm text-white text-right break-all">{display}</p>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : !participant.teamMembers?.length ? (
                            <div className="rounded-xl border border-dashed border-white/10 px-3 py-4 text-center text-xs text-gray-600">
                                No extra form answers (name / email / phone shown above)
                            </div>
                        ) : null}

                        <div className="flex flex-wrap gap-2 pt-1">
                            {!noReview && participant.status !== 'approved' ? (
                                <button
                                    type="button"
                                    disabled={Boolean(busy)}
                                    onClick={() => setStatus('approved', 'Approve registration')}
                                    className="flex-1 min-w-[120px] inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-500 text-black text-sm font-semibold disabled:opacity-50"
                                >
                                    {busy === 'approved' ? <Loader className="animate-spin" size={14} /> : <Check size={14} />}
                                    Approve
                                </button>
                            ) : null}
                            {!noReview && participant.status !== 'rejected' ? (
                                <button
                                    type="button"
                                    disabled={Boolean(busy)}
                                    onClick={() => setStatus('rejected', 'Reject registration')}
                                    className="flex-1 min-w-[120px] inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-red-500/40 text-red-300 text-sm font-semibold disabled:opacity-50"
                                >
                                    {busy === 'rejected' ? <Loader className="animate-spin" size={14} /> : <Ban size={14} />}
                                    Reject
                                </button>
                            ) : null}
                            {!noReview && participant.status === 'rejected' ? (
                                <button
                                    type="button"
                                    disabled={Boolean(busy)}
                                    onClick={() => setStatus('pending', 'Move back to pending')}
                                    className="flex-1 min-w-[120px] inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-white/10 text-gray-300 text-sm disabled:opacity-50"
                                >
                                    {busy === 'pending' ? <Loader className="animate-spin" size={14} /> : <RotateCcw size={14} />}
                                    Set pending
                                </button>
                            ) : null}
                            {noReview ? (
                                <p className="w-full text-[11px] text-gray-500 text-center py-1">
                                    Payment is collected via gateway — contact this person from Connect if needed.
                                </p>
                            ) : null}
                            <button
                                type="button"
                                disabled={Boolean(busy)}
                                onClick={deleteEntry}
                                className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-red-500/40 text-red-300 text-sm font-semibold disabled:opacity-50"
                            >
                                {busy === 'delete' ? <Loader className="animate-spin" size={14} /> : <Trash2 size={14} />}
                                Delete entry
                            </button>
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    );
}
