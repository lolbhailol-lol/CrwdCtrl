import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Users, UserCheck, Clock, IndianRupee, Calendar, Loader, Bell } from 'lucide-react';
import { fetchTrekOrganizerDashboard } from '../../services/api/trekOrganizer.api';

function StatCard({ label, value, icon: Icon, accent, hint }) {
    return (
        <div className="rounded-xl border border-gray-800 bg-[#161718] p-4">
            <div className="flex items-start justify-between gap-2">
                <div>
                    <p className="text-[11px] uppercase tracking-wide text-gray-500">{label}</p>
                    <p className="text-2xl font-bold mt-1 tabular-nums">{value}</p>
                    {hint ? <p className="text-[10px] text-gray-600 mt-1">{hint}</p> : null}
                </div>
                <div className={`size-9 rounded-lg flex items-center justify-center ${accent}`}>
                    <Icon size={16} />
                </div>
            </div>
        </div>
    );
}

export default function TrekOrganizerDashboardPage() {
    const { trekId } = useParams();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!trekId) return;
        (async () => {
            setLoading(true);
            setError('');
            try {
                const res = await fetchTrekOrganizerDashboard(trekId);
                setData(res);
            } catch (e) {
                setError(e.message);
            } finally {
                setLoading(false);
            }
        })();
    }, [trekId]);

    if (loading) return <div className="flex justify-center py-20"><Loader className="animate-spin text-[#0ECCEE]" /></div>;
    if (error) return <div className="text-red-400 text-sm">{error}</div>;
    if (!data) return null;

    const { trek, stats } = data;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold">{trek.trekName}</h1>
                <p className="text-sm text-gray-500">{trek.city || '—'} · Organizer dashboard</p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard label="Total registrations" value={stats.totalRegistrations} icon={Users} accent="bg-blue-500/15 text-blue-400" />
                <StatCard label="Seats filled" value={stats.seatsFilled} icon={Users} accent="bg-[#0ECCEE]/15 text-[#0ECCEE]" />
                <StatCard label="Seats remaining" value={stats.seatsRemaining ?? '—'} icon={Clock} accent="bg-amber-500/15 text-amber-400" />
                <StatCard label="Checked in" value={stats.checkedIn} icon={UserCheck} accent="bg-emerald-500/15 text-emerald-400" />
                <StatCard label="Pending check-in" value={stats.pendingCheckIn} icon={Clock} accent="bg-orange-500/15 text-orange-400" />
                <StatCard
                    label="Your revenue"
                    value={`₹${Number(stats.organizerRevenue ?? stats.revenue ?? 0).toLocaleString('en-IN')}`}
                    hint={stats.grossCollected > 0 ? `Excludes ₹${Number(stats.platformFees || 0).toLocaleString('en-IN')} CrwdCtrl platform fee` : 'Excludes CrwdCtrl platform fee'}
                    icon={IndianRupee}
                    accent="bg-purple-500/15 text-purple-400"
                />
                <StatCard label="Today's registrations" value={stats.todayRegistrations} icon={Calendar} accent="bg-pink-500/15 text-pink-400" />
            </div>

            <div className="flex flex-wrap gap-3">
                <Link to={`/trek-organizer/treks/${trekId}/participants`} className="px-4 py-3 min-h-[44px] inline-flex items-center rounded-xl bg-[#0ECCEE] text-black text-sm font-bold touch-manipulation">View participants</Link>
                <Link to={`/trek-organizer/treks/${trekId}/scan`} className="px-4 py-3 min-h-[44px] inline-flex items-center rounded-xl border border-gray-700 text-sm font-medium hover:border-[#0ECCEE]/50 touch-manipulation">Open QR scanner</Link>
                <Link to={`/trek-organizer/treks/${trekId}/notifications`} className="px-4 py-3 min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border border-gray-700 text-sm font-medium hover:border-[#0ECCEE]/50 touch-manipulation"><Bell size={16} /> Notify</Link>
            </div>
        </div>
    );
}
