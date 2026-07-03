import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Bell, Megaphone, Loader } from 'lucide-react';
import { broadcastRunClubOrganizerAnnouncement, sendRunClubOrganizerReminder } from '../../services/api/runClubOrganizer.api';
import { useDialog } from '../../context/DialogContext';

const BROADCAST_PRESETS = [
    { title: 'Reporting time updated', message: 'The reporting time for the run has been updated. Please check the run page for the latest schedule.' },
    { title: 'Meeting point changed', message: 'The meeting point has changed. Please see the updated location on the run details page before you travel.' },
    { title: 'Run cancelled', message: 'We regret to inform you that this run has been cancelled. Refund details will be shared shortly.' },
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
    const [reminderTitle, setReminderTitle] = useState('');
    const [reminderMessage, setReminderMessage] = useState('');
    const [broadcastTitle, setBroadcastTitle] = useState('');
    const [broadcastMessage, setBroadcastMessage] = useState('');
    const [sendingReminder, setSendingReminder] = useState(false);
    const [sendingBroadcast, setSendingBroadcast] = useState(false);

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

    return (
        <div className="space-y-6 max-w-2xl">
            <div>
                <h1 className="text-2xl font-bold">Notifications</h1>
                <p className="text-sm text-gray-500">Send in-app, push, and email to all confirmed participants.</p>
            </div>

            <form onSubmit={sendReminder} className="rounded-xl border border-gray-800 bg-[#161718] p-5 space-y-4">
                <div className="flex items-center gap-2">
                    <Bell size={18} className="text-[#0ECCEE]" />
                    <h2 className="font-semibold">Send reminder</h2>
                </div>
                <input value={reminderTitle} onChange={(e) => setReminderTitle(e.target.value)} placeholder="Reminder title (optional)" className="w-full px-3 py-2.5 rounded-xl bg-[#111213] border border-gray-800 text-sm" />
                <textarea value={reminderMessage} onChange={(e) => setReminderMessage(e.target.value)} rows={3} placeholder="Reminder message (optional)" className="w-full px-3 py-2.5 rounded-xl bg-[#111213] border border-gray-800 text-sm resize-none" />
                <button type="submit" disabled={sendingReminder} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0ECCEE] text-black text-sm font-bold disabled:opacity-60">
                    {sendingReminder ? <Loader className="animate-spin" size={16} /> : null}
                    Send reminder
                </button>
            </form>

            <form onSubmit={sendBroadcast} className="rounded-xl border border-gray-800 bg-[#161718] p-5 space-y-4">
                <div className="flex items-center gap-2">
                    <Megaphone size={18} className="text-amber-400" />
                    <h2 className="font-semibold">Broadcast announcement</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                    {BROADCAST_PRESETS.map((preset) => (
                        <button key={preset.title} type="button" onClick={() => { setBroadcastTitle(preset.title); setBroadcastMessage(preset.message); }} className="px-2.5 py-1 rounded-lg border border-gray-700 text-[11px] text-gray-400 hover:border-[#0ECCEE]/40">
                            {preset.title}
                        </button>
                    ))}
                </div>
                <input value={broadcastTitle} onChange={(e) => setBroadcastTitle(e.target.value)} placeholder="Announcement title" required className="w-full px-3 py-2.5 rounded-xl bg-[#111213] border border-gray-800 text-sm" />
                <textarea value={broadcastMessage} onChange={(e) => setBroadcastMessage(e.target.value)} rows={4} placeholder="Announcement message" required className="w-full px-3 py-2.5 rounded-xl bg-[#111213] border border-gray-800 text-sm resize-none" />
                <button type="submit" disabled={sendingBroadcast} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-amber-500/40 text-amber-400 text-sm font-bold disabled:opacity-60">
                    {sendingBroadcast ? <Loader className="animate-spin" size={16} /> : null}
                    Broadcast to all
                </button>
            </form>
        </div>
    );
}
