import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
    Bell, Megaphone, Loader, User, Search, X, Mail, Smartphone, MessageSquare, Send,
} from 'lucide-react';
import { DetailLoader3DIcon } from '../../components/DetailPageLoader';
import {
    broadcastRunClubOrganizerAnnouncement,
    sendRunClubOrganizerReminder,
    fetchRunClubOrganizerParticipants,
    notifyRunClubOrganizerParticipant,
} from '../../services/api/runClubOrganizer.api';
import { useDialog } from '../../context/DialogContext';
import {
    organizerHubCopy,
    organizerBroadcastPresets,
    organizerIndividualPresets,
} from '../../utils/listingHubCopy';

function formatDeliveryToast(res) {
    const d = res.delivery;
    if (!d) return res.message || 'Sent';
    const parts = [];
    if (d.inApp) parts.push(`${d.inApp} in-app`);
    if (d.push) parts.push(`${d.push} push`);
    if (d.email) parts.push(`${d.email} email`);
    if (d.skipped) parts.push(`${d.skipped} skipped`);
    return parts.length ? `${res.message} · ${parts.join(', ')}` : res.message || 'Sent';
}

const inputClass =
    'w-full px-3.5 py-3 min-h-12 rounded-xl bg-[#111213] border border-white/10 text-base text-white placeholder:text-gray-600 focus:outline-none focus:border-[#0ECCEE]/50';

function Segmented({ value, onChange, options }) {
    return (
        <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#161718] border border-white/10">
            {options.map((opt) => (
                <button
                    key={opt.id}
                    type="button"
                    onClick={() => onChange(opt.id)}
                    className={`py-2.5 min-h-11 rounded-lg text-sm font-semibold transition-colors ${
                        value === opt.id
                            ? 'bg-[#0ECCEE] text-black'
                            : 'text-gray-400 hover:text-white'
                    }`}
                >
                    {opt.label}
                </button>
            ))}
        </div>
    );
}

function ModeCard({ active, onClick, icon: Icon, title, hint, tone = 'cyan' }) {
    const tones = {
        cyan: active
            ? 'border-[#0ECCEE]/40 bg-[#0ECCEE]/10'
            : 'border-white/10 bg-[#161718] hover:border-[#0ECCEE]/25',
        amber: active
            ? 'border-amber-400/40 bg-amber-500/10'
            : 'border-white/10 bg-[#161718] hover:border-amber-400/25',
    };
    const iconTone = tone === 'amber' ? 'text-amber-300 bg-amber-500/15' : 'text-[#0ECCEE] bg-[#0ECCEE]/12';
    return (
        <button
            type="button"
            onClick={onClick}
            className={`w-full text-left rounded-xl border px-3.5 py-3 transition-colors ${tones[tone]}`}
        >
            <div className="flex items-center gap-3">
                <span className={`size-9 rounded-lg flex items-center justify-center shrink-0 ${iconTone}`}>
                    <Icon size={16} />
                </span>
                <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">{title}</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">{hint}</p>
                </div>
            </div>
        </button>
    );
}

export default function EventCommunityOrganizerNotificationsPage() {
    const { eventId } = useParams();
    const { confirm, toast } = useDialog();
    const copy = organizerHubCopy(true);
    const broadcastPresets = organizerBroadcastPresets(true);
    const individualPresets = organizerIndividualPresets(true);
    const [tab, setTab] = useState('all');
    const [allMode, setAllMode] = useState('reminder'); // reminder | broadcast
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
            toast(e.message || 'Failed to load guests');
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
        const ok = await confirm('Send reminder to all confirmed guests?');
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
        const ok = await confirm('Broadcast this announcement to all guests?');
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
            toast('Pick a guest first');
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
        <div className="space-y-4 max-w-xl mx-auto pb-6">
            <div>
                <h1 className="text-xl font-semibold tracking-tight text-white">Notify</h1>
                <p className="text-sm text-gray-500 mt-0.5">{copy.messageEveryone}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                    {[
                        { icon: MessageSquare, label: 'In-app' },
                        { icon: Smartphone, label: 'Push' },
                        { icon: Mail, label: 'Email' },
                    ].map((ch) => (
                        <span
                            key={ch.label}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium text-gray-400 bg-white/5 border border-white/10"
                        >
                            <ch.icon size={10} className="text-[#0ECCEE]" />
                            {ch.label}
                        </span>
                    ))}
                </div>
            </div>

            <Segmented
                value={tab}
                onChange={setTab}
                options={[
                    { id: 'all', label: 'Everyone' },
                    { id: 'one', label: 'One guest' },
                ]}
            />

            {tab === 'all' ? (
                <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                        <ModeCard
                            active={allMode === 'reminder'}
                            onClick={() => setAllMode('reminder')}
                            icon={Bell}
                            title="Reminder"
                            hint="Quick nudge"
                            tone="cyan"
                        />
                        <ModeCard
                            active={allMode === 'broadcast'}
                            onClick={() => setAllMode('broadcast')}
                            icon={Megaphone}
                            title="Announce"
                            hint="News / changes"
                            tone="amber"
                        />
                    </div>

                    {allMode === 'reminder' ? (
                        <form onSubmit={sendReminder} className="rounded-xl border border-white/10 bg-[#161718] p-4 space-y-3">
                            <p className="text-xs text-gray-500">
                                Leave blank to send the default event reminder, or write your own.
                            </p>
                            <input
                                value={reminderTitle}
                                onChange={(e) => setReminderTitle(e.target.value)}
                                placeholder="Title (optional)"
                                maxLength={120}
                                className={inputClass}
                            />
                            <textarea
                                value={reminderMessage}
                                onChange={(e) => setReminderMessage(e.target.value)}
                                rows={3}
                                placeholder="Message (optional)"
                                maxLength={2000}
                                className={`${inputClass} resize-none min-h-0`}
                            />
                            <button
                                type="submit"
                                disabled={sendingReminder}
                                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3.5 min-h-[52px] rounded-xl bg-[#0ECCEE] text-black text-sm font-bold disabled:opacity-60"
                            >
                                {sendingReminder ? <Loader className="animate-spin" size={16} /> : <Send size={16} />}
                                Send reminder to all
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={sendBroadcast} className="rounded-xl border border-amber-500/20 bg-[#161718] p-4 space-y-3">
                            <div className="flex flex-wrap gap-1.5">
                                {broadcastPresets.map((preset) => {
                                    const active = broadcastTitle === preset.title;
                                    return (
                                        <button
                                            key={preset.title}
                                            type="button"
                                            onClick={() => {
                                                setBroadcastTitle(preset.title);
                                                setBroadcastMessage(preset.message);
                                            }}
                                            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-colors ${
                                                active
                                                    ? 'border-amber-400/40 bg-amber-500/15 text-amber-200'
                                                    : 'border-white/10 text-gray-400 hover:text-white'
                                            }`}
                                        >
                                            {preset.title}
                                        </button>
                                    );
                                })}
                            </div>
                            <input
                                value={broadcastTitle}
                                onChange={(e) => setBroadcastTitle(e.target.value)}
                                placeholder="Announcement title"
                                required
                                maxLength={120}
                                className={inputClass}
                            />
                            <div>
                                <textarea
                                    value={broadcastMessage}
                                    onChange={(e) => setBroadcastMessage(e.target.value)}
                                    rows={4}
                                    placeholder="What should everyone know?"
                                    required
                                    maxLength={2000}
                                    className={`${inputClass} resize-none min-h-0`}
                                />
                                <p className="text-[10px] text-gray-600 text-right mt-1">
                                    {broadcastMessage.length}/2000
                                </p>
                            </div>
                            {(broadcastTitle || broadcastMessage) ? (
                                <div className="rounded-lg border border-white/10 bg-black/25 px-3 py-2.5">
                                    <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">Preview</p>
                                    <p className="text-sm font-medium text-white">{broadcastTitle || 'Untitled'}</p>
                                    <p className="text-xs text-gray-400 mt-1 whitespace-pre-wrap line-clamp-3">
                                        {broadcastMessage || '—'}
                                    </p>
                                </div>
                            ) : null}
                            <button
                                type="submit"
                                disabled={sendingBroadcast || !broadcastTitle.trim() || !broadcastMessage.trim()}
                                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3.5 min-h-[52px] rounded-xl bg-amber-400 text-black text-sm font-bold disabled:opacity-60"
                            >
                                {sendingBroadcast ? <Loader className="animate-spin" size={16} /> : <Megaphone size={16} />}
                                Broadcast to all
                            </button>
                        </form>
                    )}
                </div>
            ) : (
                <form onSubmit={sendOne} className="rounded-xl border border-white/10 bg-[#161718] p-4 space-y-3">
                    <div className="flex items-center gap-2.5">
                        <span className="size-9 rounded-lg bg-[#0ECCEE]/12 text-[#0ECCEE] flex items-center justify-center">
                            <User size={16} />
                        </span>
                        <div>
                            <p className="text-sm font-semibold text-white">{copy.messageOne}</p>
                            <p className="text-[11px] text-gray-500">Pick someone, then send</p>
                        </div>
                    </div>

                    {selected ? (
                        <div className="flex items-center justify-between gap-2 rounded-xl border border-[#0ECCEE]/30 bg-[#0ECCEE]/10 px-3 py-3">
                            <div className="min-w-0">
                                <p className="font-medium truncate text-white">{selected.participantName}</p>
                                <p className="text-xs text-[#0ECCEE]/90 truncate">
                                    {selected.phone || selected.email || 'Confirmed guest'}
                                </p>
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
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                                <input
                                    value={peopleSearch}
                                    onChange={(e) => setPeopleSearch(e.target.value)}
                                    placeholder={copy.searchPeople}
                                    className={`${inputClass} pl-10`}
                                />
                            </div>
                            <div className="max-h-52 overflow-y-auto rounded-xl border border-white/10 divide-y divide-white/5">
                                {loadingPeople ? (
                                    <div className="flex justify-center py-8">
                                        <DetailLoader3DIcon size="compact" />
                                    </div>
                                ) : filteredPeople.length === 0 ? (
                                    <p className="text-sm text-gray-500 text-center py-8">No confirmed guests</p>
                                ) : (
                                    filteredPeople.map((p) => (
                                        <button
                                            key={p.bookingId}
                                            type="button"
                                            onClick={() => {
                                                setSelected(p);
                                                if (!oneTitle) {
                                                    setOneTitle(`Hi ${String(p.participantName || '').split(' ')[0] || 'there'}`);
                                                }
                                            }}
                                            className="w-full text-left px-3 py-3 min-h-[52px] hover:bg-white/5 active:bg-white/10"
                                        >
                                            <p className="text-sm font-medium truncate text-white">{p.participantName}</p>
                                            <p className="text-[11px] text-gray-500 truncate">{p.phone || p.email || '—'}</p>
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    <div className="flex flex-wrap gap-1.5">
                        {individualPresets.map((preset) => {
                            const active = oneTitle === preset.title;
                            return (
                                <button
                                    key={preset.title}
                                    type="button"
                                    onClick={() => {
                                        setOneTitle(preset.title);
                                        setOneMessage(preset.message);
                                    }}
                                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-colors ${
                                        active
                                            ? 'border-[#0ECCEE]/40 bg-[#0ECCEE]/15 text-[#0ECCEE]'
                                            : 'border-white/10 text-gray-400 hover:text-white'
                                    }`}
                                >
                                    {preset.title}
                                </button>
                            );
                        })}
                    </div>

                    <input
                        value={oneTitle}
                        onChange={(e) => setOneTitle(e.target.value)}
                        placeholder="Message title"
                        required
                        maxLength={120}
                        className={inputClass}
                    />
                    <div>
                        <textarea
                            value={oneMessage}
                            onChange={(e) => setOneMessage(e.target.value)}
                            rows={4}
                            placeholder={copy.guestMessage}
                            required
                            maxLength={2000}
                            className={`${inputClass} resize-none min-h-0`}
                        />
                        <p className="text-[10px] text-gray-600 text-right mt-1">{oneMessage.length}/2000</p>
                    </div>

                    <button
                        type="submit"
                        disabled={sendingOne || !selected}
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-3.5 min-h-[52px] rounded-xl bg-[#0ECCEE] text-black text-sm font-bold disabled:opacity-60"
                    >
                        {sendingOne ? <Loader className="animate-spin" size={16} /> : <Bell size={16} />}
                        {selected ? `Send to ${String(selected.participantName).split(' ')[0]}` : copy.notifyGuest}
                    </button>
                </form>
            )}
        </div>
    );
}
