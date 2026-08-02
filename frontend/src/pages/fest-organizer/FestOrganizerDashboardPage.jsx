import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Users, UserCheck, Clock, IndianRupee, Loader, Bell, QrCode, ExternalLink, RefreshCw,
    Trophy, Calendar, MapPin, Building2, ArrowRight,
} from 'lucide-react';
import { fetchFestOrganizerDashboard } from '../../services/api/festOrganizer.api';
import { getFestOrganizerSession } from '../../utils/festOrganizerSession';

function StatTile({ label, value, sub, tone = 'default', icon: Icon, to }) {
    const navigate = useNavigate();
    const tones = {
        default: 'border-white/10 from-[#1a1b1d] to-[#141516]',
        accent: 'border-[#0ECCEE]/25 from-[#0ECCEE]/15 to-[#0ECCEE]/5',
        ok: 'border-emerald-500/20 from-emerald-500/15 to-emerald-500/5',
        warn: 'border-amber-500/20 from-amber-500/15 to-amber-500/5',
        money: 'border-emerald-500/20 from-emerald-500/10 to-[#141516]',
    };
    const className = `rounded-2xl border bg-linear-to-br p-4 min-h-[100px] text-left ${tones[tone] || tones.default} ${to ? 'hover:border-[#0ECCEE]/45 cursor-pointer' : ''}`;
    const inner = (
        <div className="flex items-start justify-between gap-3">
            <div>
                <p className="text-[11px] uppercase tracking-wider text-gray-500">{label}</p>
                <p className="text-[1.65rem] font-semibold mt-2 tabular-nums text-white">{value}</p>
                {sub ? <p className="text-[11px] text-gray-500 mt-1">{sub}</p> : null}
            </div>
            {Icon ? (
                <div className="size-9 rounded-xl bg-white/5 flex items-center justify-center text-gray-300">
                    <Icon size={16} />
                </div>
            ) : null}
        </div>
    );
    if (to) {
        return <button type="button" onClick={() => navigate(to)} className={className}>{inner}</button>;
    }
    return <div className={className}>{inner}</div>;
}

function formatWhen(d) {
    if (!d) return '';
    try {
        return new Date(d).toLocaleString('en-IN', {
            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
        });
    } catch {
        return '';
    }
}

export default function FestOrganizerDashboardPage() {
    const { festId } = useParams();
    const navigate = useNavigate();
    const session = getFestOrganizerSession();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const load = async () => {
        setLoading(true);
        setError('');
        try {
            setData(await fetchFestOrganizerDashboard(festId));
        } catch (e) {
            setError(e.message || 'Failed to load dashboard');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, [festId]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20 text-gray-400 gap-2">
                <Loader className="animate-spin" size={18} /> Loading overview…
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="text-center py-16 space-y-3">
                <p className="text-red-400 text-sm">{error || 'Not found'}</p>
                <button type="button" onClick={load} className="text-[#0ECCEE] text-sm inline-flex items-center gap-1">
                    <RefreshCw size={14} /> Retry
                </button>
            </div>
        );
    }

    const { fest, stats, competitions = [], recent = [] } = data;
    const payments = stats.payments || {};
    const publicUrl = fest.slug
        ? `${window.location.origin}/view-details/${fest.slug}`
        : `${window.location.origin}/view-details/${fest.id}`;
    const topComps = competitions.filter((c) => c.id).slice(0, 5);
    const meId = String(session?.organizer?.id || session?.organizer?._id || '');
    const loggedInUsers = Array.isArray(data.loggedInUsers) ? data.loggedInUsers : [];
    const loggedInSorted = [...loggedInUsers].sort((a, b) => {
        if (a.isYou || String(a.id) === meId) return -1;
        if (b.isYou || String(b.id) === meId) return 1;
        return String(a.name || '').localeCompare(String(b.name || ''));
    });

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <div className="flex flex-wrap items-center gap-2">
                        <h1 className="text-2xl font-bold">{fest.festName}</h1>
                        {fest.status ? (
                            <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-white/5 text-gray-400">
                                {fest.status}
                            </span>
                        ) : null}
                    </div>
                    <p className="text-sm text-gray-500 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                        {fest.collegeName ? (
                            <span className="inline-flex items-center gap-1"><Building2 size={12} />{fest.collegeName}</span>
                        ) : null}
                        {fest.city ? (
                            <span className="inline-flex items-center gap-1"><MapPin size={12} />{fest.city}</span>
                        ) : null}
                        {(fest.festDate || fest.venue) ? (
                            <span className="inline-flex items-center gap-1">
                                <Calendar size={12} />
                                {[fest.festDate, fest.venue].filter(Boolean).join(' · ')}
                            </span>
                        ) : null}
                    </p>
                </div>
                <div className="flex gap-2">
                    <a href={publicUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/10 text-sm text-gray-300 hover:border-[#0ECCEE]/40">
                        <ExternalLink size={14} /> Public page
                    </a>
                    <button type="button" onClick={load} className="p-2 rounded-xl border border-white/10 text-gray-400 hover:text-white">
                        <RefreshCw size={16} />
                    </button>
                </div>
            </div>

            <section className="rounded-2xl border border-white/10 bg-[#161718] px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-white">
                        {loggedInSorted.length} user{loggedInSorted.length === 1 ? '' : 's'} logged in to this dashboard
                    </p>
                    <p className="text-[11px] text-gray-500">Saved on sign-in</p>
                </div>
                {loggedInSorted.length ? (
                    <ul className="mt-3 flex flex-wrap gap-2">
                        {loggedInSorted.map((person) => {
                            const you = person.isYou || String(person.id) === meId;
                            return (
                                <li
                                    key={person.id}
                                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${
                                        you
                                            ? 'border-[#0ECCEE]/35 bg-[#0ECCEE]/10 text-[#0ECCEE]'
                                            : 'border-white/10 bg-white/5 text-gray-200'
                                    }`}
                                >
                                    <span className="font-medium">{person.name || person.username || 'Organizer'}</span>
                                    {you ? <span className="text-[10px] opacity-80">(you)</span> : null}
                                </li>
                            );
                        })}
                    </ul>
                ) : (
                    <p className="mt-2 text-xs text-gray-500">No logins recorded yet.</p>
                )}
            </section>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatTile label="Approved" value={stats.totalRegistrations} sub={`${stats.allActive || 0} active total`} icon={Users} tone="accent" to={`/fest-organizer/fests/${festId}/participants?status=approved`} />
                <StatTile label="Pending review" value={stats.pendingRegistrations} sub={`${stats.todayRegistrations || 0} new today`} icon={Clock} tone="warn" to={`/fest-organizer/fests/${festId}/participants?status=pending`} />
                <StatTile label="Checked in" value={`${stats.checkedIn} (${stats.checkInRate}%)`} sub={`${stats.pendingCheckIn} still pending`} icon={UserCheck} tone="ok" to={`/fest-organizer/fests/${festId}/scan`} />
                <StatTile label="Revenue" value={`₹${Number(stats.revenue || 0).toLocaleString('en-IN')}`} sub={`${payments.paid || 0} paid · ${payments.pending || 0} unpaid`} icon={IndianRupee} tone="money" to={`/fest-organizer/fests/${festId}/revenue`} />
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                    { label: 'Competitions', desc: `${stats.competitionCount || competitions.length} events`, to: 'competitions', icon: Trophy },
                    { label: 'Participants', desc: 'Filter & export', to: 'participants', icon: Users },
                    { label: 'Scan QR', desc: `${stats.pendingCheckIn} left`, to: 'scan', icon: QrCode },
                    { label: 'Notify', desc: 'Remind / broadcast', to: 'notifications', icon: Bell },
                ].map((item) => (
                    <button
                        key={item.to}
                        type="button"
                        onClick={() => navigate(`/fest-organizer/fests/${festId}/${item.to === 'scan' ? 'scan' : item.to}`)}
                        className="rounded-2xl border border-white/10 bg-[#161718] p-4 text-left hover:border-[#0ECCEE]/40"
                    >
                        <item.icon className="text-[#0ECCEE] mb-2" size={18} />
                        <p className="font-medium">{item.label}</p>
                        <p className="text-xs text-gray-500 mt-1">{item.desc}</p>
                    </button>
                ))}
            </div>

            <div className="grid lg:grid-cols-2 gap-4">
                <section className="rounded-2xl border border-white/10 bg-[#161718] p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                        <h2 className="text-sm font-semibold flex items-center gap-2">
                            <Trophy className="text-[#0ECCEE]" size={14} /> Top competitions
                        </h2>
                        <button type="button" onClick={() => navigate(`/fest-organizer/fests/${festId}/competitions`)} className="text-xs text-[#0ECCEE] inline-flex items-center gap-1">
                            View all <ArrowRight size={12} />
                        </button>
                    </div>
                    {topComps.length ? (
                        <div className="space-y-2">
                            {topComps.map((c) => (
                                <button
                                    key={String(c.id)}
                                    type="button"
                                    onClick={() => navigate(`/fest-organizer/fests/${festId}/participants?competitionId=${c.id}`)}
                                    className="w-full flex items-center justify-between gap-3 rounded-xl bg-white/3 px-3 py-2.5 text-left hover:bg-white/5"
                                >
                                    <div className="min-w-0">
                                        <p className="text-sm text-white truncate">{c.name}</p>
                                        <p className="text-[11px] text-gray-500">
                                            {c.approved} approved · {c.pending} pending · {c.checkInRate}% in
                                        </p>
                                    </div>
                                    <p className="text-sm tabular-nums text-gray-300 shrink-0">₹{Number(c.revenue || 0).toLocaleString('en-IN')}</p>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-gray-500 py-6 text-center">No competition data yet.</p>
                    )}
                </section>

                <section className="rounded-2xl border border-white/10 bg-[#161718] p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                        <h2 className="text-sm font-semibold">Recent registrations</h2>
                        <button type="button" onClick={() => navigate(`/fest-organizer/fests/${festId}/participants`)} className="text-xs text-[#0ECCEE] inline-flex items-center gap-1">
                            All guests <ArrowRight size={12} />
                        </button>
                    </div>
                    {recent.length ? (
                        <div className="space-y-2">
                            {recent.map((r) => (
                                <div key={r.id} className="rounded-xl bg-white/3 px-3 py-2.5">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <p className="text-sm text-white truncate">{r.userName || '—'}</p>
                                            <p className="text-[11px] text-gray-500 truncate">
                                                {r.competitionName || 'General'} · {r.status} · {r.paymentStatus}
                                            </p>
                                        </div>
                                        <p className="text-[10px] text-gray-600 shrink-0">{formatWhen(r.createdAt)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-gray-500 py-6 text-center">No registrations yet.</p>
                    )}
                </section>
            </div>
        </div>
    );
}
