import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Bell, Loader, Megaphone } from 'lucide-react';
import {
    sendEventOrganizerReminder,
    sendEventOrganizerBroadcast,
} from '../../services/api/eventShowOrganizer.api';
import { useDialog } from '../../context/DialogContext';

export default function EventOrganizerNotificationsPage() {
    const { eventId } = useParams();
    const { toast, confirm } = useDialog();
    const [reminderTitle, setReminderTitle] = useState('');
    const [reminderMessage, setReminderMessage] = useState('');
    const [broadcastTitle, setBroadcastTitle] = useState('');
    const [broadcastMessage, setBroadcastMessage] = useState('');
    const [busy, setBusy] = useState('');

    const sendReminder = async (e) => {
        e.preventDefault();
        const ok = await confirm('Send reminder to all approved guests?');
        if (!ok) return;
        setBusy('reminder');
        try {
            const res = await sendEventOrganizerReminder(eventId, {
                title: reminderTitle || undefined,
                message: reminderMessage || undefined,
            });
            toast(res.message || 'Reminder sent');
        } catch (err) {
            toast(err.message || 'Failed to send reminder');
        } finally {
            setBusy('');
        }
    };

    const sendBroadcast = async (e) => {
        e.preventDefault();
        if (!broadcastMessage.trim()) {
            toast('Message is required');
            return;
        }
        const ok = await confirm('Send announcement to pending + approved guests?');
        if (!ok) return;
        setBusy('broadcast');
        try {
            const res = await sendEventOrganizerBroadcast(eventId, {
                title: broadcastTitle || undefined,
                message: broadcastMessage,
            });
            toast(res.message || 'Announcement sent');
            setBroadcastMessage('');
        } catch (err) {
            toast(err.message || 'Failed to send announcement');
        } finally {
            setBusy('');
        }
    };

    return (
        <div className="space-y-6 max-w-xl">
            <div>
                <h1 className="text-2xl font-bold">Notify guests</h1>
                <p className="text-sm text-gray-500">In-app notifications for registered guests.</p>
            </div>

            <form onSubmit={sendReminder} className="rounded-2xl border border-gray-800 bg-[#161718] p-4 space-y-3">
                <h2 className="text-sm font-semibold flex items-center gap-2">
                    <Bell size={16} className="text-[#0ECCEE]" /> Event reminder
                </h2>
                <input
                    value={reminderTitle}
                    onChange={(e) => setReminderTitle(e.target.value)}
                    placeholder="Title (optional)"
                    className="w-full px-3 py-2.5 rounded-xl bg-[#111213] border border-gray-800 text-sm focus:outline-none focus:border-[#0ECCEE]/50"
                />
                <textarea
                    value={reminderMessage}
                    onChange={(e) => setReminderMessage(e.target.value)}
                    placeholder="Message (optional — default reminder text is used if empty)"
                    rows={3}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#111213] border border-gray-800 text-sm focus:outline-none focus:border-[#0ECCEE]/50 resize-y"
                />
                <button
                    type="submit"
                    disabled={busy === 'reminder'}
                    className="px-4 py-2.5 rounded-xl bg-[#0ECCEE] text-black text-sm font-bold disabled:opacity-60 inline-flex items-center gap-2"
                >
                    {busy === 'reminder' ? <Loader className="animate-spin" size={14} /> : null}
                    Send reminder
                </button>
            </form>

            <form onSubmit={sendBroadcast} className="rounded-2xl border border-gray-800 bg-[#161718] p-4 space-y-3">
                <h2 className="text-sm font-semibold flex items-center gap-2">
                    <Megaphone size={16} className="text-[#0ECCEE]" /> Announcement
                </h2>
                <input
                    value={broadcastTitle}
                    onChange={(e) => setBroadcastTitle(e.target.value)}
                    placeholder="Title (optional)"
                    className="w-full px-3 py-2.5 rounded-xl bg-[#111213] border border-gray-800 text-sm focus:outline-none focus:border-[#0ECCEE]/50"
                />
                <textarea
                    value={broadcastMessage}
                    onChange={(e) => setBroadcastMessage(e.target.value)}
                    placeholder="Announcement message"
                    rows={4}
                    required
                    className="w-full px-3 py-2.5 rounded-xl bg-[#111213] border border-gray-800 text-sm focus:outline-none focus:border-[#0ECCEE]/50 resize-y"
                />
                <button
                    type="submit"
                    disabled={busy === 'broadcast'}
                    className="px-4 py-2.5 rounded-xl bg-white/10 text-white text-sm font-bold disabled:opacity-60 inline-flex items-center gap-2"
                >
                    {busy === 'broadcast' ? <Loader className="animate-spin" size={14} /> : null}
                    Send announcement
                </button>
            </form>
        </div>
    );
}
