import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Bell, Loader, Megaphone } from 'lucide-react';
import {
    sendFestOrganizerReminder,
    sendFestOrganizerBroadcast,
    fetchFestOrganizerDashboard,
} from '../../services/api/festOrganizer.api';
import { useDialog } from '../../context/DialogContext';

export default function FestOrganizerNotificationsPage() {
    const { festId } = useParams();
    const { toast } = useDialog();
    const [reminder, setReminder] = useState({ title: '', message: '', competitionId: '' });
    const [broadcast, setBroadcast] = useState({ title: '', message: '', competitionId: '' });
    const [competitions, setCompetitions] = useState([]);
    const [busy, setBusy] = useState('');

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const data = await fetchFestOrganizerDashboard(festId);
                if (!cancelled) {
                    setCompetitions((data.competitions || []).filter((c) => c.id));
                }
            } catch {
                /* ignore */
            }
        })();
        return () => { cancelled = true; };
    }, [festId]);

    const sendReminder = async (e) => {
        e.preventDefault();
        setBusy('reminder');
        try {
            const payload = {
                title: reminder.title,
                message: reminder.message,
            };
            if (reminder.competitionId) payload.competitionId = reminder.competitionId;
            const data = await sendFestOrganizerReminder(festId, payload);
            toast(data.message || 'Reminder sent');
        } catch (err) {
            toast(err.message || 'Failed');
        } finally {
            setBusy('');
        }
    };

    const sendBroadcast = async (e) => {
        e.preventDefault();
        setBusy('broadcast');
        try {
            const payload = {
                title: broadcast.title,
                message: broadcast.message,
            };
            if (broadcast.competitionId) payload.competitionId = broadcast.competitionId;
            const data = await sendFestOrganizerBroadcast(festId, payload);
            toast(data.message || 'Broadcast sent');
            setBroadcast({ title: '', message: '', competitionId: broadcast.competitionId });
        } catch (err) {
            toast(err.message || 'Failed');
        } finally {
            setBusy('');
        }
    };

    const competitionSelect = (value, onChange) => (
        competitions.length ? (
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#1D1E20] border border-gray-700 text-sm text-white"
            >
                <option value="">All competitions</option>
                {competitions.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                ))}
            </select>
        ) : null
    );

    return (
        <div className="max-w-lg mx-auto space-y-6">
            <div>
                <h1 className="text-xl font-bold flex items-center gap-2">
                    <Bell className="text-[#0ECCEE]" size={20} /> Notify participants
                </h1>
                <p className="text-sm text-gray-500 mt-1">In-app notifications to approved registrants.</p>
            </div>

            <form onSubmit={sendReminder} className="rounded-2xl border border-white/10 bg-[#161718] p-4 space-y-3">
                <p className="text-sm font-medium flex items-center gap-2">
                    <Bell size={14} className="text-[#0ECCEE]" /> Reminder
                </p>
                {competitionSelect(reminder.competitionId, (competitionId) => setReminder({ ...reminder, competitionId }))}
                <input
                    value={reminder.title}
                    onChange={(e) => setReminder({ ...reminder, title: e.target.value })}
                    placeholder="Title (optional)"
                    className="w-full px-3 py-2 rounded-lg bg-[#1D1E20] border border-gray-700 text-sm text-white"
                />
                <textarea
                    value={reminder.message}
                    onChange={(e) => setReminder({ ...reminder, message: e.target.value })}
                    placeholder="Message (optional — default reminder text used if empty)"
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg bg-[#1D1E20] border border-gray-700 text-sm text-white"
                />
                <button type="submit" disabled={busy === 'reminder'} className="w-full py-2.5 rounded-xl bg-[#0ECCEE] text-black text-sm font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-2">
                    {busy === 'reminder' ? <Loader className="animate-spin" size={16} /> : null}
                    Send reminder
                </button>
            </form>

            <form onSubmit={sendBroadcast} className="rounded-2xl border border-white/10 bg-[#161718] p-4 space-y-3">
                <p className="text-sm font-medium flex items-center gap-2">
                    <Megaphone size={14} className="text-[#0ECCEE]" /> Broadcast
                </p>
                {competitionSelect(broadcast.competitionId, (competitionId) => setBroadcast({ ...broadcast, competitionId }))}
                <input
                    required
                    value={broadcast.title}
                    onChange={(e) => setBroadcast({ ...broadcast, title: e.target.value })}
                    placeholder="Title"
                    className="w-full px-3 py-2 rounded-lg bg-[#1D1E20] border border-gray-700 text-sm text-white"
                />
                <textarea
                    required
                    value={broadcast.message}
                    onChange={(e) => setBroadcast({ ...broadcast, message: e.target.value })}
                    placeholder="Message"
                    rows={4}
                    className="w-full px-3 py-2 rounded-lg bg-[#1D1E20] border border-gray-700 text-sm text-white"
                />
                <button type="submit" disabled={busy === 'broadcast'} className="w-full py-2.5 rounded-xl bg-[#0ECCEE] text-black text-sm font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-2">
                    {busy === 'broadcast' ? <Loader className="animate-spin" size={16} /> : null}
                    Send broadcast
                </button>
            </form>
        </div>
    );
}
