import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { IndianRupee, Loader, RefreshCw, Trophy } from 'lucide-react';
import { fetchFestOrganizerDashboard } from '../../services/api/festOrganizer.api';

export default function FestOrganizerRevenuePage() {
    const { festId } = useParams();
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const load = async () => {
        setLoading(true);
        setError('');
        try {
            setData(await fetchFestOrganizerDashboard(festId));
        } catch (e) {
            setError(e.message || 'Failed to load revenue');
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
                <Loader className="animate-spin" size={18} /> Loading revenue…
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="text-center py-16 space-y-3">
                <p className="text-red-400 text-sm">{error || 'Not found'}</p>
                <button type="button" onClick={load} className="text-[#0ECCEE] text-sm">Retry</button>
            </div>
        );
    }

    const { stats, competitions = [], fest } = data;
    const payments = stats.payments || {};
    const earners = [...competitions]
        .filter((c) => Number(c.revenue) > 0)
        .sort((a, b) => Number(b.revenue) - Number(a.revenue));

    return (
        <div className="max-w-3xl mx-auto space-y-5">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h1 className="text-xl font-bold flex items-center gap-2">
                        <IndianRupee className="text-[#0ECCEE]" size={20} /> Revenue
                    </h1>
                    <p className="text-xs text-gray-500 mt-1">{fest.festName}</p>
                </div>
                <button type="button" onClick={load} className="p-2 rounded-xl border border-white/10 text-gray-400">
                    <RefreshCw size={16} />
                </button>
            </div>

            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-5">
                <p className="text-xs uppercase tracking-wider text-emerald-200/70">Collected (approved)</p>
                <p className="text-3xl font-semibold tabular-nums text-white mt-2">
                    ₹{Number(stats.revenue || 0).toLocaleString('en-IN')}
                </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    ['Paid', payments.paid || 0],
                    ['Payment pending', payments.pending || 0],
                    ['Free', payments.free || 0],
                    ['Failed', payments.failed || 0],
                ].map(([label, value]) => (
                    <div key={label} className="rounded-2xl border border-white/10 bg-[#161718] p-4 text-center">
                        <p className="text-xl font-semibold tabular-nums">{value}</p>
                        <p className="text-[11px] text-gray-500 mt-1">{label}</p>
                    </div>
                ))}
            </div>

            <section className="space-y-3">
                <h2 className="text-sm font-semibold flex items-center gap-2">
                    <Trophy className="text-[#0ECCEE]" size={14} /> By competition
                </h2>
                {earners.length ? (
                    <div className="space-y-2">
                        {earners.map((c) => (
                            <button
                                key={String(c.id || c.name)}
                                type="button"
                                onClick={() => c.id && navigate(`/fest-organizer/fests/${festId}/participants?competitionId=${c.id}`)}
                                className="w-full flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#161718] px-4 py-3 text-left hover:border-[#0ECCEE]/40"
                            >
                                <div className="min-w-0">
                                    <p className="text-sm text-white truncate">{c.name}</p>
                                    <p className="text-[11px] text-gray-500">{c.approved} approved</p>
                                </div>
                                <p className="text-sm font-semibold tabular-nums text-emerald-300">
                                    ₹{Number(c.revenue || 0).toLocaleString('en-IN')}
                                </p>
                            </button>
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-gray-500 text-center py-10">No paid registrations yet.</p>
                )}
            </section>
        </div>
    );
}
