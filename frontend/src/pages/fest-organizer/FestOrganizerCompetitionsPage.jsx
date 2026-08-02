import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader, RefreshCw, Trophy, Users, Bell } from 'lucide-react';
import { fetchFestOrganizerDashboard } from '../../services/api/festOrganizer.api';

export default function FestOrganizerCompetitionsPage() {
    const { festId } = useParams();
    const navigate = useNavigate();
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [festName, setFestName] = useState('');

    const load = async () => {
        setLoading(true);
        setError('');
        try {
            const data = await fetchFestOrganizerDashboard(festId);
            setFestName(data.fest?.festName || '');
            setRows(data.competitions || []);
        } catch (e) {
            setError(e.message || 'Failed to load competitions');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, [festId]);

    if (loading) {
        return (
            <div className="flex justify-center py-20 text-gray-400 gap-2">
                <Loader className="animate-spin" size={18} /> Loading competitions…
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-xl font-bold flex items-center gap-2">
                        <Trophy className="text-[#0ECCEE]" size={20} /> Competitions
                    </h1>
                    <p className="text-xs text-gray-500 mt-1">{festName || 'Per-competition breakdown'}</p>
                </div>
                <button type="button" onClick={load} className="p-2 rounded-xl border border-white/10 text-gray-400">
                    <RefreshCw size={16} />
                </button>
            </div>

            {error ? <p className="text-sm text-red-400">{error}</p> : null}

            <div className="space-y-2">
                {rows.map((c) => {
                    const id = c.id ? String(c.id) : '';
                    return (
                        <div key={id || 'other'} className="rounded-2xl border border-white/10 bg-[#161718] p-4 space-y-3">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <p className="font-semibold text-white">{c.name}</p>
                                    {c.competitionType ? (
                                        <p className="text-[11px] text-gray-600 capitalize mt-0.5">{c.competitionType}</p>
                                    ) : null}
                                </div>
                                <p className="text-sm tabular-nums text-emerald-300">
                                    ₹{Number(c.revenue || 0).toLocaleString('en-IN')}
                                </p>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
                                {[
                                    ['Total', c.total],
                                    ['Approved', c.approved],
                                    ['Pending', c.pending],
                                    ['Rejected', c.rejected],
                                    ['Checked in', `${c.checkedIn} (${c.checkInRate}%)`],
                                ].map(([label, value]) => (
                                    <div key={label} className="rounded-xl bg-white/3 px-2 py-2">
                                        <p className="text-sm font-semibold tabular-nums text-white">{value}</p>
                                        <p className="text-[10px] text-gray-500">{label}</p>
                                    </div>
                                ))}
                            </div>
                            {id ? (
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        onClick={() => navigate(`/fest-organizer/fests/${festId}/participants?competitionId=${id}`)}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0ECCEE]/15 text-[#0ECCEE] text-xs"
                                    >
                                        <Users size={12} /> Participants
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => navigate(`/fest-organizer/fests/${festId}/notifications`)}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-gray-300 text-xs"
                                    >
                                        <Bell size={12} /> Notify
                                    </button>
                                </div>
                            ) : null}
                        </div>
                    );
                })}
                {!rows.length ? (
                    <p className="text-center text-gray-500 py-12 text-sm">No competitions for this fest.</p>
                ) : null}
            </div>
        </div>
    );
}
