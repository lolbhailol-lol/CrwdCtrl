import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
    ArrowRight, IndianRupee, MessageCircle, Phone, RefreshCw,
    Trophy, Users, AlertCircle,
} from 'lucide-react';
import {
    fetchFestOrganizerDashboard,
    fetchFestOrganizerNotifyContacts,
} from '../../services/api/festOrganizer.api';
import { InlinePageLoader } from '../../components/DetailPageLoader';
import { isMindSparkFest } from '../../features/fests/mindspark';

function waLink(phone, text) {
    const digits = String(phone || '').replace(/\D/g, '');
    if (!digits) return null;
    const withCountry = digits.length === 10 ? `91${digits}` : digits;
    const q = text ? `?text=${encodeURIComponent(text)}` : '';
    return `https://wa.me/${withCountry}${q}`;
}

function telLink(phone) {
    const digits = String(phone || '').replace(/\D/g, '');
    return digits ? `tel:${digits}` : null;
}

export default function FestOrganizerRevenuePage() {
    const { festId } = useParams();
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [unpaid, setUnpaid] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const mindSpark = isMindSparkFest(festId);

    const load = async () => {
        setLoading(true);
        setError('');
        try {
            const [dash, contacts] = await Promise.all([
                fetchFestOrganizerDashboard(festId),
                fetchFestOrganizerNotifyContacts(festId, { audience: 'unpaid', limit: 40 }).catch(() => null),
            ]);
            setData(dash);
            setUnpaid(contacts?.contacts || []);
        } catch (e) {
            setError(e.message || 'Failed to load revenue');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, [festId]);

    const { stats, competitions = [], fest } = data || {};
    const payments = stats?.payments || {};
    const mindSparkMode = mindSpark || isMindSparkFest(festId, fest);

    const ranked = useMemo(() => {
        return [...competitions]
            .filter((c) => c.id)
            .sort((a, b) => Number(b.revenue || 0) - Number(a.revenue || 0));
    }, [competitions]);

    const totalEntries = ranked.reduce(
        (s, c) => s + (Number(c.approved) || Number(c.total) || 0),
        0,
    );
    const unpaidMsg = (name, festName) =>
        `Hi${name ? ` ${name.split(' ')[0]}` : ''}! Reminder to complete payment for ${festName || 'our fest'}. Reply here if you need help.`;

    if (loading) {
        return <InlinePageLoader label="Loading revenue…" variant="fest" />;
    }

    if (error || !data) {
        return (
            <div className="text-center py-16 space-y-3">
                <p className="text-red-400 text-sm">{error || 'Not found'}</p>
                <button type="button" onClick={load} className="text-[#0ECCEE] text-sm">Retry</button>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto space-y-4 pb-10">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-[10px] uppercase tracking-[0.14em] text-emerald-300/80 font-semibold">Money desk</p>
                    <h1 className="text-xl font-bold text-white mt-0.5 flex items-center gap-2">
                        <IndianRupee className="text-emerald-300" size={20} /> Revenue
                    </h1>
                    <p className="text-xs text-gray-500 mt-1">
                        {fest?.festName}
                        {mindSparkMode
                            ? ' — paid vs unpaid by competition'
                            : ' — collected vs unpaid, by competition'}
                    </p>
                </div>
                <button type="button" onClick={load} className="p-2 rounded-xl border border-white/10 text-gray-400" aria-label="Refresh">
                    <RefreshCw size={16} />
                </button>
            </div>

            <section className="rounded-2xl border border-emerald-400/25 bg-linear-to-br from-emerald-500/20 to-[#161718] p-5">
                <p className="text-xs uppercase tracking-wider text-emerald-200/70">
                    {mindSparkMode ? 'After 1.6% gateway' : 'Collected'}
                </p>
                <p className="text-3xl font-bold tabular-nums text-white mt-2">
                    ₹{Number(stats.revenue || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </p>
                {mindSparkMode ? (
                    <p className="text-[11px] text-gray-400 mt-2">
                        Students paid ₹{Number(stats.grossCollected ?? stats.revenue ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        {' · '}
                        1.6% Cashfree gateway ₹{Number(stats.gatewayFees || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </p>
                ) : (
                    <p className="text-[11px] text-gray-400 mt-2">
                        {`${payments.paid || 0} paid · ${payments.pending || 0} unpaid · ${totalEntries} entries`}
                    </p>
                )}
                {mindSparkMode ? (
                    <>
                        <p className="text-[11px] text-gray-500 mt-1">
                            {`${payments.paid || 0} paid · ${payments.pending || 0} unpaid · ${totalEntries} registrations`}
                        </p>
                        <p className="mt-3 text-[11px] leading-relaxed text-emerald-100/80 rounded-xl border border-emerald-400/20 bg-black/20 px-3 py-2.5">
                            1.6% payment gateway fee is deducted on each Cashfree entry. This is not a CrwdCtrl commission.
                        </p>
                    </>
                ) : null}
            </section>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {[
                    {
                        label: 'Paid',
                        value: payments.paid || 0,
                        to: mindSparkMode
                            ? 'participants?paymentStatus=collected'
                            : 'participants?paymentStatus=paid&status=approved',
                        tone: 'border-emerald-400/25 bg-emerald-500/10',
                    },
                    {
                        label: 'Unpaid',
                        value: payments.pending || 0,
                        to: 'participants?paymentStatus=pending',
                        tone: 'border-amber-400/25 bg-amber-500/10',
                    },
                    { label: 'Free', value: payments.free || 0, to: 'participants', tone: 'border-white/10 bg-[#161718]' },
                    { label: 'Failed', value: payments.failed || 0, to: 'participants', tone: 'border-rose-400/20 bg-rose-500/8' },
                ].map((b) => (
                    <button
                        key={b.label}
                        type="button"
                        onClick={() => navigate(`/fest-organizer/fests/${festId}/${b.to}`)}
                        className={`rounded-2xl border p-3.5 text-left hover:scale-[1.01] transition ${b.tone}`}
                    >
                        <p className="text-xl font-bold tabular-nums text-white">{b.value}</p>
                        <p className="text-[11px] text-gray-500 mt-1">{b.label}</p>
                    </button>
                ))}
            </div>

            {(payments.pending || 0) > 0 ? (
                <section className="rounded-2xl border border-amber-400/25 bg-amber-500/8 p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 min-w-0">
                            <AlertCircle size={16} className="text-amber-300 shrink-0 mt-0.5" />
                            <div>
                                <h2 className="text-sm font-semibold text-amber-100">Chase unpaid</h2>
                                <p className="text-[11px] text-gray-500 mt-0.5">
                                    WhatsApp / call people with payment still pending
                                </p>
                            </div>
                        </div>
                        <Link
                            to={`/fest-organizer/fests/${festId}/notifications?audience=unpaid&tab=connect`}
                            className="text-xs text-amber-200 inline-flex items-center gap-1 shrink-0"
                        >
                            Open Connect <ArrowRight size={12} />
                        </Link>
                    </div>
                    {unpaid.length ? (
                        <div className="space-y-2">
                            {unpaid.slice(0, 8).map((c) => {
                                const wa = waLink(c.phone, unpaidMsg(c.name, fest?.festName));
                                const tel = telLink(c.phone);
                                return (
                                    <div
                                        key={c.id}
                                        className="flex items-center gap-3 rounded-xl bg-black/20 border border-amber-400/15 px-3 py-2.5"
                                    >
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm text-white truncate">{c.name}</p>
                                            <p className="text-[11px] text-gray-500 truncate">
                                                {c.competitionName || 'Competition'}
                                                {c.phone ? ` · ${c.phone}` : ''}
                                            </p>
                                        </div>
                                        <div className="flex gap-1.5 shrink-0">
                                            {wa ? (
                                                <a
                                                    href={wa}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="p-2 rounded-xl bg-emerald-500/15 text-emerald-300"
                                                    aria-label="WhatsApp"
                                                >
                                                    <MessageCircle size={14} />
                                                </a>
                                            ) : null}
                                            {tel ? (
                                                <a href={tel} className="p-2 rounded-xl bg-white/5 text-gray-300" aria-label="Call">
                                                    <Phone size={14} />
                                                </a>
                                            ) : null}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <p className="text-xs text-gray-500">No phone numbers on unpaid entries yet.</p>
                    )}
                </section>
            ) : null}

            <section className="rounded-2xl border border-white/10 bg-[#161718] p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold flex items-center gap-2 text-white">
                        <Trophy className="text-[#0ECCEE]" size={14} /> By competition
                    </h2>
                    <button
                        type="button"
                        onClick={() => navigate(`/fest-organizer/fests/${festId}/competitions`)}
                        className="text-xs text-[#0ECCEE] inline-flex items-center gap-1"
                    >
                        Hub <ArrowRight size={12} />
                    </button>
                </div>
                {ranked.length ? (
                    <div className="space-y-2">
                        {ranked.map((c, idx) => {
                            const rev = Number(c.revenue) || 0;
                            const gross = Number(c.grossCollected);
                            const showGross = mindSparkMode && Number.isFinite(gross) && gross !== rev;
                            const entries = Number(c.approved) || Number(c.total) || 0;
                            const unpaidCount = mindSparkMode
                                ? null
                                : Number(c.pending) || 0;
                            return (
                                <button
                                    key={String(c.id)}
                                    type="button"
                                    onClick={() => navigate(`/fest-organizer/fests/${festId}/competitions/${c.id}`)}
                                    className="w-full rounded-xl border border-white/8 bg-[#121314] px-3.5 py-3 text-left hover:border-[#0ECCEE]/35 transition flex items-center gap-3"
                                >
                                    <span className="text-[11px] tabular-nums text-gray-600 w-5 shrink-0">
                                        {idx + 1}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm text-white truncate font-medium">{c.name}</p>
                                        <p className="text-[11px] text-gray-500 mt-0.5">
                                            {mindSparkMode
                                                ? `${entries} registered`
                                                : `${entries} entries${unpaidCount ? ` · ${unpaidCount} review` : ''}`}
                                            {showGross
                                                ? ` · ₹${gross.toLocaleString('en-IN', { maximumFractionDigits: 2 })} collected`
                                                : ''}
                                        </p>
                                    </div>
                                    <p className="text-sm font-semibold tabular-nums text-emerald-300 shrink-0">
                                        ₹{rev.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                                    </p>
                                </button>
                            );
                        })}
                    </div>
                ) : (
                    <p className="text-sm text-gray-500 text-center py-10">No competitions yet.</p>
                )}
            </section>

            {(payments.pending || 0) > 0 ? (
                <div className="rounded-xl border border-white/10 bg-[#161718] px-4 py-3 flex items-center gap-3 text-xs text-gray-400">
                    <Users size={14} className="text-[#0ECCEE] shrink-0" />
                    <span className="flex-1">Need the full unpaid list with filters?</span>
                    <Link to={`/fest-organizer/fests/${festId}/participants?paymentStatus=pending`} className="text-[#0ECCEE] font-medium">
                        Guest roster →
                    </Link>
                </div>
            ) : null}
        </div>
    );
}
