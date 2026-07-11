import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Bell, Megaphone, Loader, User, Search, X } from 'lucide-react';
import {
    broadcastRunClubOrganizerAnnouncement,
    sendRunClubOrganizerReminder,
    fetchRunClubOrganizerParticipants,
    notifyRunClubOrganizerParticipant,
} from '../../services/api/runClubOrganizer.api';
import { useDialog } from '../../context/DialogContext';

const BROADCAST_PRESETS = [
    { title: 'Reporting time updated', message: 'The reporting time for the run has been updated. Please check the run page for the latest schedule.' },
    { title: 'Meeting point changed', message: 'The meeting point has changed. Please see the updated location on the run details page before you travel.' },
    { title: 'Run cancelled', message: 'We regret to inform you that this run has been cancelled. Refund details will be shared shortly.' },
];

const INDIVIDUAL_PRESETS = [
    { title: 'Payment received', message: 'We received your payment — see you at the run!' },
    { title: 'Please arrive early', message: 'Please arrive 10 minutes early for check-in and warm-up.' },
    { title: 'Quick check-in', message: 'Bring your QR ticket ready for a faster check-in.' },
];

function formatDeliveryToast(res) {
    const d = res.delivery;
    if (!d) return res.message || 'Sent';
    const parts = [];
    if (d.inApp) parts.push(`${d.inApp} in-app`);
    if (d.push) parts.push(`${d.push} push`);
    if (d.email) parts.push(`${d.email} email`);
    if (d.skipped) parts.push(`${d.skipped} skipped (no contact)`);
    return parts.length ? `${res.message} · ${parts.join(', ')}` : res.message || 'Sent';
}

export default function RunClubOrganizerNotificationsPage() {
    const { eventId } = useParams();
    const { confirm, toast } = useDialog();
    const [tab, setTab] = useState('all'); // all | one
    const [reminderTitle, setReminderTitle] = useState('');
    const [reminderMessage, setReminderMessage] = useState('');
    const [broadcastTitle, setBroadcastTitle] = useState('');
    const [broadcastMessage, setBroadcastMessage] = useState('');
    const [sendingReminder, setSendingReminder] = useState(false);
    const [sendingBroadcast, setSendingBroadcast] = useState(false);

    const [participants, setParticipants] = useState([]);
    const [loadingPeople, setLoadingPeople] = useState(false);
    const [peopleSearch, setPeopleSearch] = useState('');
    const [selected, setSelected] = useState(null);
    const [oneTitle, setOneTitle] = useState('');
    const [oneMessage, setOneMessage] = useState('');
    const [sendingOne, setSendingOne] = useState(false);

    const loadPeople = useCallback(async () => {
        if (!eventId) return;
        setLoadingPeople(true);
        try {
            const data = await fetchRunClubOrganizerParticipants(eventId, {
                page: 1,
                limit: 100,
                sortBy: 'createdAt',
                sortDir: 'desc',
            });
            setParticipants((data.participants || []).filter((p) => p.status === 'confirmed'));
        } catch (e) {
            toast(e.message || 'Failed to load participants');
        } finally {
            setLoadingPeople(false);
        }
    }, [eventId, toast]);

    useEffect(() => {
        if (tab === 'one') loadPeople();
    }, [tab, loadPeople]);

    const filteredPeople = peopleSearch.trim()
        ? participants.filter((p) => {
            const q = peopleSearch.trim().toLowerCase();
            return (
                String(p.participantName || '').toLowerCase().includes(q)
                || String(p.phone || '').includes(q)
                || String(p.email || '').toLowerCase().includes(q)
            );
        })
        : participants;

    const sendReminder = async (e) => {
        e.preventDefault();
        const ok = await confirm('Send reminder to all confirmed participants?');
        if (!ok) return;
        setSendingReminder(true);
        try {
            const body = {};
            if (reminderTitle.trim()) body.title = reminderTitle.trim();
            if (reminderMessage.trim()) body.message = reminderMessage.trim();
            const res = await sendRunClubOrganizerReminder(eventId, body);
            toast(formatDeliveryToast(res));
        } catch (err) {
            toast(err.message || 'Failed to send reminder');
        } finally {
            setSendingReminder(false);
        }
    };

    const sendBroadcast = async (e) => {
        e.preventDefault();
        if (!broadcastTitle.trim() || !broadcastMessage.trim()) {
            toast('Title and message are required');
            return;
        }
        const ok = await confirm('Broadcast this announcement to all participants?');
        if (!ok) return;
        setSendingBroadcast(true);
        try {
            const res = await broadcastRunClubOrganizerAnnouncement(eventId, {
                title: broadcastTitle.trim(),
                message: broadcastMessage.trim(),
            });
            toast(formatDeliveryToast(res));
        } catch (err) {
            toast(err.message || 'Failed to send announcement');
        } finally {
            setSendingBroadcast(false);
        }
    };

    const sendOne = async (e) => {
        e.preventDefault();
        if (!selected) {
            toast('Pick a participant first');
            return;
        }
        if (!oneTitle.trim() || !oneMessage.trim()) {
            toast('Title and message are required');
            return;
        }
        const ok = await confirm(`Send message to ${selected.participantName}?`);
        if (!ok) return;
        setSendingOne(true);
        try {
            const res = await notifyRunClubOrganizerParticipant(eventId, selected.bookingId, {
                title: oneTitle.trim(),
                message: oneMessage.trim(),
            });
            toast(formatDeliveryToast({ ...res, message: res.message || 'Message sent' }));
            setOneMessage('');
        } catch (err) {
            toast(err.message || 'Failed to send');
        } finally {
            setSendingOne(false);
        }
    };

    return (
        <div className="space-y-5 max-w-2xl mx-auto">
            <div>
                <h1 className="text-2xl font-bold">Notifications</h1>
                <p className="text-sm text-gray-500">Message everyone or one runner — in-app, push, and email.</p>
            </div>

            <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-[#161718] border border-gray-800">
                <button
                    type="button"
                    onClick={() => setTab('all')}
                    className={`py-3 min-h-[48px] rounded-lg text-sm font-semibold transition-colors ${
                        tab === 'all' ? 'bg-[#0ECCEE] text-black' : 'text-gray-400'
                    }`}
                >
                    Everyone
                </button>
                <button
                    type="button"
                    onClick={() => setTab('one')}
                    className={`py-3 min-h-[48px] rounded-lg text-sm font-semibold transition-colors ${
                        tab === 'one' ? 'bg-[#0ECCEE] text-black' : 'text-gray-400'
                    }`}
                >
                    One person
                </button>
            </div>

            {tab === 'all' ? (
                <>
                    <form onSubmit={sendReminder} className="rounded-xl border border-gray-800 bg-[#161718] p-4 sm:p-5 space-y-4">
                        <div className="flex items-center gap-2">
                            <Bell size={18} className="text-[#0ECCEE]" />
                            <h2 className="font-semibold">Send reminder</h2>
                        </div>
                        <input
                            value={reminderTitle}
                            onChange={(e) => setReminderTitle(e.target.value)}
                            placeholder="Reminder title (optional)"
                            className="w-full px-3 py-3 min-h-[48px] rounded-xl bg-[#111213] border border-gray-800 text-base"
                        />
                        <textarea
                            value={reminderMessage}
                            onChange={(e) => setReminderMessage(e.target.value)}
                            rows={3}
                            placeholder="Reminder message (optional)"
                            className="w-full px-3 py-3 rounded-xl bg-[#111213] border border-gray-800 text-base resize-none"
                        />
                        <button
                            type="submit"
                            disabled={sendingReminder}
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-3.5 min-h-[52px] rounded-xl bg-[#0ECCEE] text-black text-sm font-bold disabled:opacity-60"
                        >
                            {sendingReminder ? <Loader className="animate-spin" size={16} /> : null}
                            Send reminder to all
                        </button>
                    </form>

                    <form onSubmit={sendBroadcast} className="rounded-xl border border-gray-800 bg-[#161718] p-4 sm:p-5 space-y-4">
                        <div className="flex items-center gap-2">
                            <Megaphone size={18} className="text-amber-400" />
                            <h2 className="font-semibold">Broadcast announcement</h2>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {BROADCAST_PRESETS.map((preset) => (
                                <button
                                    key={preset.title}
                                    type="button"
                                    onClick={() => {
                                        setBroadcastTitle(preset.title);
                                        setBroadcastMessage(preset.message);
                                    }}
                                    className="px-3 py-2 min-h-[36px] rounded-lg border border-gray-700 text-[11px] text-gray-400 hover:border-[#0ECCEE]/40"
                                >
                                    {preset.title}
                                </button>
                            ))}
                        </div>
                        <input
                            value={broadcastTitle}
                            onChange={(e) => setBroadcastTitle(e.target.value)}
                            placeholder="Announcement title"
                            required
                            className="w-full px-3 py-3 min-h-[48px] rounded-xl bg-[#111213] border border-gray-800 text-base"
                        />
                        <textarea
                            value={broadcastMessage}
                            onChange={(e) => setBroadcastMessage(e.target.value)}
                            rows={4}
                            placeholder="Announcement message"
                            required
                            className="w-full px-3 py-3 rounded-xl bg-[#111213] border border-gray-800 text-base resize-none"
                        />
                        <button
                            type="submit"
                            disabled={sendingBroadcast}
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-3.5 min-h-[52px] rounded-xl border border-amber-500/40 text-amber-400 text-sm font-bold disabled:opacity-60"
                        >
                            {sendingBroadcast ? <Loader className="animate-spin" size={16} /> : null}
                            Broadcast to all
                        </button>
                    </form>
                </>
            ) : (
                <form onSubmit={sendOne} className="rounded-xl border border-gray-800 bg-[#161718] p-4 sm:p-5 space-y-4">
                    <div className="flex items-center gap-2">
                        <User size={18} className="text-[#0ECCEE]" />
                        <h2 className="font-semibold">Message one runner</h2>
                    </div>

                    {selected ? (
                        <div className="flex items-center justify-between gap-2 rounded-xl border border-[#0ECCEE]/30 bg-[#0ECCEE]/10 px-3 py-3">
                            <div className="min-w-0">
                                <p className="font-medium truncate">{selected.participantName}</p>
                                <p className="text-xs text-gray-400 truncate">{selected.phone || selected.email || 'Confirmed'}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelected(null)}
                                className="p-2 rounded-lg text-gray-400 hover:bg-white/5"
                                aria-label="Clear selection"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                                <input
                                    value={peopleSearch}
                                    onChange={(e) => setPeopleSearch(e.target.value)}
                                    placeholder="Search confirmed runners…"
                                    className="w-full pl-9 pr-3 py-3 min-h-[48px] rounded-xl bg-[#111213] border border-gray-800 text-base"
                                />
                            </div>
                            <div className="max-h-56 overflow-y-auto rounded-xl border border-gray-800 divide-y divide-gray-800/80">
                                {loadingPeople ? (
                                    <div className="flex justify-center py-8">
                                        <Loader className="animate-spin text-[#0ECCEE]" size={20} />
                                    </div>
                                ) : filteredPeople.length === 0 ? (
                                    <p className="text-sm text-gray-500 text-center py-8">No confirmed participants</p>
                                ) : (
                                    filteredPeople.map((p) => (
                                        <button
                                            key={p.bookingId}
                                            type="button"
                                            onClick={() => {
                                                setSelected(p);
                                                if (!oneTitle) setOneTitle(`Hi ${String(p.participantName || '').split(' ')[0] || 'there'}`);
                                            }}
                                            className="w-full text-left px-3 py-3 min-h-[52px] hover:bg-white/5 active:bg-white/10"
                                        >
                                            <p className="text-sm font-medium truncate">{p.participantName}</p>
                                            <p className="text-[11px] text-gray-500 truncate">{p.phone || p.email || '—'}</p>
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                        {INDIVIDUAL_PRESETS.map((preset) => (
                            <button
                                key={preset.title}
                                type="button"
                                onClick={() => {
                                    setOneTitle(preset.title);
                                    setOneMessage(preset.message);
                                }}
                                className="px-3 py-2 min-h-[36px] rounded-lg border border-gray-700 text-[11px] text-gray-400 hover:border-[#0ECCEE]/40"
                            >
                                {preset.title}
                            </button>
                        ))}
                    </div>

                    <input
                        value={oneTitle}
                        onChange={(e) => setOneTitle(e.target.value)}
                        placeholder="Message title"
                        required
                        maxLength={120}
                        className="w-full px-3 py-3 min-h-[48px] rounded-xl bg-[#111213] border border-gray-800 text-base"
                    />
                    <textarea
                        value={oneMessage}
                        onChange={(e) => setOneMessage(e.target.value)}
                        rows={4}
                        placeholder="Write your message…"
                        required
                        maxLength={2000}
                        className="w-full px-3 py-3 rounded-xl bg-[#111213] border border-gray-800 text-base resize-none"
                    />
                    <button
                        type="submit"
                        disabled={sendingOne || !selected}
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-3.5 min-h-[52px] rounded-xl bg-[#0ECCEE] text-black text-sm font-bold disabled:opacity-60"
                    >
                        {sendingOne ? <Loader className="animate-spin" size={16} /> : <Bell size={16} />}
                        Send to this runner
                    </button>
                </form>
            )}
        </div>
    );
}
