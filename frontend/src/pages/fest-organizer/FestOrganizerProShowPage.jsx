import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
    Bell, Loader, MessageCircle, Mic2, Phone, Plus, QrCode,
    RefreshCw, Settings2, Ticket, Users, X,
} from 'lucide-react';
import {
    fetchFestOrganizerProShow,
    updateFestOrganizerProShow,
    fetchFestOrganizerProShowTickets,
    issueFestOrganizerProShowPass,
} from '../../services/api/festOrganizer.api';
import { useDialog } from '../../context/DialogContext';

function waLink(phone) {
    const digits = String(phone || '').replace(/\D/g, '');
    if (!digits) return null;
    const withCountry = digits.length === 10 ? `91${digits}` : digits;
    return `https://wa.me/${withCountry}`;
}

function telLink(phone) {
    const digits = String(phone || '').replace(/\D/g, '');
    return digits ? `tel:${digits}` : null;
}

function StatBox({ label, value, hint, tone = 'default' }) {
    const tones = {
        default: 'border-white/10 bg-[#161718]',
        cyan: 'border-[#0ECCEE]/30 bg-[#0ECCEE]/10',
        emerald: 'border-emerald-400/30 bg-emerald-500/10',
        amber: 'border-amber-400/30 bg-amber-500/10',
        rose: 'border-rose-400/25 bg-rose-500/10',
    };
    return (
        <div className={`rounded-2xl border p-3.5 ${tones[tone] || tones.default}`}>
            <p className="text-2xl font-bold tabular-nums text-white leading-none">{value}</p>
            <p className="text-xs text-gray-300 mt-1.5">{label}</p>
            {hint ? <p className="text-[10px] text-gray-600 mt-0.5">{hint}</p> : null}
        </div>
    );
}

const emptyPass = {
    name: '',
    phone: '',
    email: '',
    passType: 'offline',
    tierId: '',
    paymentStatus: 'free',
    amountPaid: '',
    note: '',
};

export default function FestOrganizerProShowPage() {
    const { festId } = useParams();
    const { toast, confirm } = useDialog();
    const [data, setData] = useState(null);
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [setupOpen, setSetupOpen] = useState(false);
    const [passOpen, setPassOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [passForm, setPassForm] = useState(emptyPass);
    const [setupForm, setSetupForm] = useState({
        title: 'Pro Show',
        venue: '',
        capacity: '500',
        salesOpen: true,
        tiers: [],
    });
    const [ticketFilter, setTicketFilter] = useState('all');

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const [ops, list] = await Promise.all([
                fetchFestOrganizerProShow(festId),
                fetchFestOrganizerProShowTickets(festId, { limit: 40 }),
            ]);
            setData(ops);
            setTickets(list.tickets || []);
            if (!ops.config?.enabled) setSetupOpen(true);
        } catch (e) {
            setError(e.message || 'Failed to load Pro Show');
        } finally {
            setLoading(false);
        }
    }, [festId]);

    useEffect(() => {
        load();
    }, [load]);

    useEffect(() => {
        if (!data?.config) return;
        setSetupForm({
            title: data.config.title || 'Pro Show',
            venue: data.config.venue || '',
            capacity: String(data.config.capacity || 0),
            salesOpen: data.config.salesOpen !== false,
            tiers: (data.config.tiers || []).map((t) => ({
                id: t.id,
                name: t.name,
                kind: t.kind,
                price: String(t.price ?? 0),
                quota: String(t.quota ?? 0),
                active: t.active !== false,
            })),
        });
    }, [data?.config]);

    const enableProShow = async () => {
        setSaving(true);
        try {
            const res = await updateFestOrganizerProShow(festId, {
                enabled: true,
                title: setupForm.title || 'Pro Show',
                venue: setupForm.venue,
                capacity: Number(setupForm.capacity) || 0,
                salesOpen: true,
            });
            setData(res);
            toast('Pro Show enabled');
            setSetupOpen(false);
            await load();
        } catch (e) {
            toast(e.message || 'Failed');
        } finally {
            setSaving(false);
        }
    };

    const saveSetup = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const res = await updateFestOrganizerProShow(festId, {
                enabled: true,
                title: setupForm.title.trim() || 'Pro Show',
                venue: setupForm.venue.trim(),
                capacity: Number(setupForm.capacity) || 0,
                salesOpen: setupForm.salesOpen,
                tiers: setupForm.tiers.map((t, idx) => ({
                    id: t.id,
                    name: t.name,
                    kind: t.kind,
                    price: Number(t.price) || 0,
                    quota: Number(t.quota) || 0,
                    active: t.active !== false,
                    order: idx,
                })),
            });
            setData(res);
            toast('Saved');
            setSetupOpen(false);
        } catch (err) {
            toast(err.message || 'Failed to save');
        } finally {
            setSaving(false);
        }
    };

    const openPassModal = () => {
        const tiers = data?.tiers || data?.config?.tiers || [];
        const ga = tiers.find((t) => t.kind === 'ga') || tiers[0];
        setPassForm({
            ...emptyPass,
            tierId: ga?.id || '',
            passType: 'offline',
            paymentStatus: 'free',
            amountPaid: '',
        });
        setPassOpen(true);
    };

    const issuePass = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const amount = passForm.amountPaid === '' ? undefined : Number(passForm.amountPaid);
            const res = await issueFestOrganizerProShowPass(festId, {
                name: passForm.name.trim(),
                phone: passForm.phone.trim(),
                email: passForm.email.trim(),
                passType: passForm.passType,
                tierId: passForm.tierId,
                paymentStatus: passForm.paymentStatus,
                amountPaid: Number.isFinite(amount) ? amount : undefined,
                note: passForm.note.trim(),
            });
            toast(res.message || 'Pass issued');
            setPassOpen(false);
            await load();
        } catch (err) {
            toast(err.message || 'Failed to issue');
        } finally {
            setSaving(false);
        }
    };

    const setTierField = (idx, key, value) => {
        setSetupForm((prev) => ({
            ...prev,
            tiers: prev.tiers.map((t, i) => (i === idx ? { ...t, [key]: value } : t)),
        }));
    };

    if (loading && !data) {
        return (
            <div className="flex justify-center py-20 text-gray-400 gap-2">
                <Loader className="animate-spin" size={18} /> Loading Pro Show…
            </div>
        );
    }

    if (error && !data) {
        return (
            <div className="text-center py-16 space-y-3">
                <p className="text-red-400 text-sm">{error}</p>
                <button type="button" onClick={load} className="text-[#0ECCEE] text-sm">Retry</button>
            </div>
        );
    }

    const config = data?.config || {};
    const stats = data?.stats || {};
    const tiers = data?.tiers || [];
    const artists = config.artists || [];
    const enabled = Boolean(config.enabled);

    const filteredTickets = tickets.filter((t) => {
        if (ticketFilter === 'all') return true;
        if (ticketFilter === 'offline') return t.passType !== 'online';
        if (ticketFilter === 'not_in') return t.status === 'approved' && !t.checkedIn;
        if (ticketFilter === 'in') return t.checkedIn;
        return t.passType === ticketFilter;
    });

    return (
        <div className="max-w-3xl mx-auto space-y-4 pb-10">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-[#0ECCEE] font-semibold">Night ops</p>
                    <h1 className="text-xl font-bold text-white mt-0.5 flex items-center gap-2">
                        <Mic2 className="text-[#0ECCEE]" size={20} />
                        {config.title || 'Pro Show'}
                    </h1>
                    <p className="text-xs text-gray-500 mt-1">
                        Sold · remaining · early bird · offline passes · gate — not a competition
                    </p>
                </div>
                <div className="flex gap-2 shrink-0">
                    <button
                        type="button"
                        onClick={() => setSetupOpen(true)}
                        className="p-2 rounded-xl border border-white/10 text-gray-300"
                        aria-label="Setup"
                    >
                        <Settings2 size={16} />
                    </button>
                    <button type="button" onClick={load} className="p-2 rounded-xl border border-white/10 text-gray-400" aria-label="Refresh">
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {!enabled ? (
                <section className="rounded-2xl border border-[#0ECCEE]/30 bg-linear-to-br from-[#0ECCEE]/15 to-[#161718] p-5 space-y-4">
                    <h2 className="text-base font-semibold text-white">Turn on Pro Show desk</h2>
                    <p className="text-sm text-gray-400">
                        Track venue capacity, early bird / GA / VIP, and issue offline or VIP passes with the same QR as online tickets.
                    </p>
                    <div className="grid sm:grid-cols-2 gap-2">
                        <input
                            value={setupForm.title}
                            onChange={(e) => setSetupForm((f) => ({ ...f, title: e.target.value }))}
                            placeholder="Show title"
                            className="px-3 py-2.5 rounded-xl bg-[#121314] border border-white/10 text-sm text-white"
                        />
                        <input
                            value={setupForm.capacity}
                            onChange={(e) => setSetupForm((f) => ({ ...f, capacity: e.target.value }))}
                            placeholder="Venue capacity"
                            inputMode="numeric"
                            className="px-3 py-2.5 rounded-xl bg-[#121314] border border-white/10 text-sm text-white"
                        />
                    </div>
                    <button
                        type="button"
                        disabled={saving}
                        onClick={enableProShow}
                        className="w-full py-2.5 rounded-xl bg-[#0ECCEE] text-black text-sm font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-2"
                    >
                        {saving ? <Loader className="animate-spin" size={16} /> : <Ticket size={16} />}
                        Enable Pro Show
                    </button>
                </section>
            ) : (
                <>
                    {stats.soldOut ? (
                        <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-200">
                            Sold out — you can still issue VIP / guest / crew / offline passes.
                        </div>
                    ) : null}

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        <StatBox label="Sold" value={stats.sold || 0} hint={`${stats.onlineSold || 0} online`} tone="cyan" />
                        <StatBox
                            label="Remaining"
                            value={stats.remaining == null ? '∞' : stats.remaining}
                            hint={stats.capacity ? `of ${stats.capacity}` : 'No capacity set'}
                            tone={stats.remaining === 0 ? 'rose' : 'default'}
                        />
                        <StatBox
                            label="Checked in"
                            value={stats.checkedIn || 0}
                            hint={`${stats.checkInRate || 0}%`}
                            tone="emerald"
                        />
                        <StatBox
                            label="Revenue"
                            value={`₹${Number(stats.revenue || 0).toLocaleString('en-IN')}`}
                            hint={`${stats.offlineIssued || 0} offline passes`}
                            tone="emerald"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                        <div className={`rounded-2xl border p-3.5 ${stats.earlyBirdActive ? 'border-amber-400/30 bg-amber-500/10' : 'border-white/10 bg-[#161718]'}`}>
                            <p className="text-[11px] uppercase tracking-wide text-gray-500">Early bird</p>
                            <p className="text-sm font-semibold text-white mt-1">
                                {stats.earlyBirdActive ? 'Active' : 'Closed / full'}
                            </p>
                            <p className="text-[11px] text-gray-500 mt-1">
                                {stats.earlyBirdSold || 0} sold
                                {stats.earlyBirdLeft != null ? ` · ${stats.earlyBirdLeft} left` : ''}
                            </p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-[#161718] p-3.5">
                            <p className="text-[11px] uppercase tracking-wide text-gray-500">Sales</p>
                            <p className="text-sm font-semibold text-white mt-1">
                                {stats.salesOpen ? 'Open' : 'Paused / sold out'}
                            </p>
                            <p className="text-[11px] text-gray-500 mt-1 truncate">{config.venue || 'Venue not set'}</p>
                        </div>
                    </div>

                    <section className="rounded-2xl border border-white/10 bg-[#161718] p-4 space-y-3">
                        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                            <Ticket size={14} className="text-[#0ECCEE]" /> Tiers
                        </h2>
                        <div className="space-y-2">
                            {tiers.map((t) => (
                                <div
                                    key={t.id}
                                    className={`rounded-xl border px-3.5 py-3 ${
                                        t.selling ? 'border-white/10 bg-[#121314]' : 'border-white/5 bg-black/20 opacity-70'
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-white truncate">{t.name}</p>
                                            <p className="text-[11px] text-gray-500 mt-0.5 capitalize">
                                                {t.kind.replace('_', ' ')}
                                                {!t.selling ? ' · not selling' : ''}
                                                {t.ended ? ' · ended' : ''}
                                                {t.quotaFull ? ' · quota full' : ''}
                                            </p>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className="text-sm font-semibold text-emerald-300 tabular-nums">
                                                ₹{Number(t.price || 0).toLocaleString('en-IN')}
                                            </p>
                                            <p className="text-[11px] text-gray-500 tabular-nums mt-0.5">
                                                {t.sold} sold
                                                {t.quota > 0 ? ` / ${t.quota}` : ''}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {!tiers.length ? (
                                <p className="text-sm text-gray-500 text-center py-6">No tiers — open setup</p>
                            ) : null}
                        </div>
                    </section>

                    <div className="grid grid-cols-2 gap-2.5">
                        <button
                            type="button"
                            onClick={openPassModal}
                            className="rounded-2xl border border-[#0ECCEE]/30 bg-[#0ECCEE]/10 p-3.5 text-left hover:border-[#0ECCEE]/50 transition"
                        >
                            <Plus size={18} className="text-[#0ECCEE] mb-2" />
                            <p className="text-sm font-semibold text-white">Issue pass</p>
                            <p className="text-[11px] text-gray-500 mt-0.5">Offline / VIP / guest / crew</p>
                        </button>
                        <Link
                            to={`/fest-organizer/fests/${festId}/scan?proShow=1`}
                            className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-3.5 hover:border-emerald-400/50 transition"
                        >
                            <QrCode size={18} className="text-emerald-300 mb-2" />
                            <p className="text-sm font-semibold text-white">Pro night gate</p>
                            <p className="text-[11px] text-gray-500 mt-0.5">Only Pro Show QRs</p>
                        </Link>
                        <Link
                            to={`/fest-organizer/fests/${festId}/notifications?tab=connect`}
                            className="rounded-2xl border border-amber-400/25 bg-amber-500/10 p-3.5 hover:border-amber-400/40 transition"
                        >
                            <Bell size={18} className="text-amber-300 mb-2" />
                            <p className="text-sm font-semibold text-white">Connect</p>
                            <p className="text-[11px] text-gray-500 mt-0.5">WhatsApp / call guests</p>
                        </Link>
                        <button
                            type="button"
                            onClick={() => setSetupOpen(true)}
                            className="rounded-2xl border border-white/10 bg-[#161718] p-3.5 text-left hover:border-white/25 transition"
                        >
                            <Settings2 size={18} className="text-gray-300 mb-2" />
                            <p className="text-sm font-semibold text-white">Capacity & tiers</p>
                            <p className="text-[11px] text-gray-500 mt-0.5">Edit prices and quotas</p>
                        </button>
                    </div>

                    {artists.length ? (
                        <section className="rounded-2xl border border-white/10 bg-[#161718] p-4 space-y-2">
                            <h2 className="text-sm font-semibold text-white">Lineup (from fest artists)</h2>
                            <div className="flex gap-2 overflow-x-auto pb-1">
                                {artists.slice(0, 8).map((a, i) => (
                                    <div key={`${a.name}-${i}`} className="shrink-0 rounded-xl border border-white/8 bg-[#121314] px-3 py-2 min-w-[8rem]">
                                        <p className="text-xs font-medium text-white truncate">{a.name || 'Artist'}</p>
                                        <p className="text-[10px] text-gray-500 truncate">{a.genre || '—'}</p>
                                    </div>
                                ))}
                            </div>
                        </section>
                    ) : null}

                    <section className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                                <Users size={14} className="text-[#0ECCEE]" /> Guest list
                            </h2>
                            <div className="flex flex-wrap gap-1">
                                {[
                                    { id: 'all', label: 'All' },
                                    { id: 'offline', label: 'Offline+' },
                                    { id: 'vip', label: 'VIP' },
                                    { id: 'not_in', label: 'Outside' },
                                    { id: 'in', label: 'In' },
                                ].map((f) => (
                                    <button
                                        key={f.id}
                                        type="button"
                                        onClick={() => setTicketFilter(f.id)}
                                        className={`px-2.5 py-1 rounded-lg text-[11px] ${
                                            ticketFilter === f.id
                                                ? 'bg-[#0ECCEE]/15 text-[#0ECCEE]'
                                                : 'text-gray-500'
                                        }`}
                                    >
                                        {f.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2">
                            {filteredTickets.map((t) => {
                                const wa = waLink(t.phone);
                                const tel = telLink(t.phone);
                                return (
                                    <div
                                        key={t.id}
                                        className={`rounded-2xl border px-3.5 py-3 flex gap-3 ${
                                            t.checkedIn
                                                ? 'border-emerald-400/20 bg-emerald-500/5'
                                                : 'border-white/10 bg-[#161718]'
                                        }`}
                                    >
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-semibold text-white truncate">{t.name}</p>
                                            <p className="text-[11px] text-gray-500 truncate">
                                                {t.tierName || 'Tier'} · {t.passType}
                                                {t.phone ? ` · ${t.phone}` : ''}
                                                {t.checkedIn ? ' · in' : ''}
                                            </p>
                                            <p className="text-[11px] text-gray-600 mt-0.5">
                                                {t.paymentStatus}
                                                {Number(t.amountPaid) > 0
                                                    ? ` · ₹${Number(t.amountPaid).toLocaleString('en-IN')}`
                                                    : ''}
                                            </p>
                                        </div>
                                        <div className="flex gap-1.5 shrink-0 self-center">
                                            {wa ? (
                                                <a href={wa} target="_blank" rel="noreferrer" className="p-2 rounded-xl bg-emerald-500/15 text-emerald-300" aria-label="WhatsApp">
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
                            {!filteredTickets.length ? (
                                <div className="rounded-2xl border border-dashed border-white/10 py-12 text-center text-sm text-gray-500">
                                    No tickets yet — issue an offline pass to start
                                </div>
                            ) : null}
                        </div>
                    </section>
                </>
            )}

            {/* Setup sheet */}
            {setupOpen && enabled ? (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
                    <button type="button" className="absolute inset-0 bg-black/70" onClick={() => setSetupOpen(false)} aria-label="Close" />
                    <form
                        onSubmit={saveSetup}
                        className="relative w-full sm:max-w-lg max-h-[92dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-white/10 bg-[#121314] p-4 space-y-3"
                    >
                        <div className="flex items-center justify-between">
                            <h2 className="font-semibold text-white">Pro Show setup</h2>
                            <button type="button" onClick={() => setSetupOpen(false)} className="p-2 text-gray-400"><X size={18} /></button>
                        </div>
                        <input
                            value={setupForm.title}
                            onChange={(e) => setSetupForm((f) => ({ ...f, title: e.target.value }))}
                            placeholder="Title"
                            className="w-full px-3 py-2.5 rounded-xl bg-[#161718] border border-white/10 text-sm text-white"
                        />
                        <input
                            value={setupForm.venue}
                            onChange={(e) => setSetupForm((f) => ({ ...f, venue: e.target.value }))}
                            placeholder="Venue"
                            className="w-full px-3 py-2.5 rounded-xl bg-[#161718] border border-white/10 text-sm text-white"
                        />
                        <input
                            value={setupForm.capacity}
                            onChange={(e) => setSetupForm((f) => ({ ...f, capacity: e.target.value }))}
                            placeholder="Capacity (0 = unlimited)"
                            inputMode="numeric"
                            className="w-full px-3 py-2.5 rounded-xl bg-[#161718] border border-white/10 text-sm text-white"
                        />
                        <label className="flex items-center gap-2 text-sm text-gray-300">
                            <input
                                type="checkbox"
                                checked={setupForm.salesOpen}
                                onChange={(e) => setSetupForm((f) => ({ ...f, salesOpen: e.target.checked }))}
                            />
                            Sales open
                        </label>
                        <div className="space-y-2">
                            <p className="text-xs text-gray-500 uppercase tracking-wide">Tiers</p>
                            {setupForm.tiers.map((t, idx) => (
                                <div key={t.id || idx} className="rounded-xl border border-white/10 p-3 space-y-2">
                                    <div className="grid grid-cols-2 gap-2">
                                        <input
                                            value={t.name}
                                            onChange={(e) => setTierField(idx, 'name', e.target.value)}
                                            placeholder="Name"
                                            className="px-2.5 py-2 rounded-lg bg-[#161718] border border-white/10 text-sm text-white"
                                        />
                                        <select
                                            value={t.kind}
                                            onChange={(e) => setTierField(idx, 'kind', e.target.value)}
                                            className="px-2.5 py-2 rounded-lg bg-[#161718] border border-white/10 text-sm text-white"
                                        >
                                            <option value="early_bird">Early bird</option>
                                            <option value="ga">GA</option>
                                            <option value="vip">VIP</option>
                                            <option value="other">Other</option>
                                        </select>
                                        <input
                                            value={t.price}
                                            onChange={(e) => setTierField(idx, 'price', e.target.value)}
                                            placeholder="Price"
                                            inputMode="numeric"
                                            className="px-2.5 py-2 rounded-lg bg-[#161718] border border-white/10 text-sm text-white"
                                        />
                                        <input
                                            value={t.quota}
                                            onChange={(e) => setTierField(idx, 'quota', e.target.value)}
                                            placeholder="Quota (0=∞)"
                                            inputMode="numeric"
                                            className="px-2.5 py-2 rounded-lg bg-[#161718] border border-white/10 text-sm text-white"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                        <button
                            type="submit"
                            disabled={saving}
                            className="w-full py-2.5 rounded-xl bg-[#0ECCEE] text-black text-sm font-semibold disabled:opacity-50"
                        >
                            {saving ? 'Saving…' : 'Save setup'}
                        </button>
                        <button
                            type="button"
                            disabled={saving}
                            onClick={async () => {
                                const ok = await confirm({
                                    title: 'Disable Pro Show?',
                                    message: 'Desk stays; tickets already issued keep working.',
                                });
                                if (!ok) return;
                                setSaving(true);
                                try {
                                    await updateFestOrganizerProShow(festId, { enabled: false });
                                    toast('Disabled');
                                    setSetupOpen(false);
                                    await load();
                                } catch (err) {
                                    toast(err.message || 'Failed');
                                } finally {
                                    setSaving(false);
                                }
                            }}
                            className="w-full py-2 rounded-xl border border-white/10 text-xs text-gray-500"
                        >
                            Disable Pro Show
                        </button>
                    </form>
                </div>
            ) : null}

            {/* Issue pass */}
            {passOpen ? (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
                    <button type="button" className="absolute inset-0 bg-black/70" onClick={() => setPassOpen(false)} aria-label="Close" />
                    <form
                        onSubmit={issuePass}
                        className="relative w-full sm:max-w-md max-h-[92dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-white/10 bg-[#121314] p-4 space-y-3"
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="font-semibold text-white">Issue pass</h2>
                                <p className="text-xs text-gray-500 mt-0.5">Same QR as online — works at Pro night gate</p>
                            </div>
                            <button type="button" onClick={() => setPassOpen(false)} className="p-2 text-gray-400"><X size={18} /></button>
                        </div>
                        <input
                            required
                            value={passForm.name}
                            onChange={(e) => setPassForm((f) => ({ ...f, name: e.target.value }))}
                            placeholder="Name *"
                            className="w-full px-3 py-2.5 rounded-xl bg-[#161718] border border-white/10 text-sm text-white"
                        />
                        <div className="grid grid-cols-2 gap-2">
                            <input
                                value={passForm.phone}
                                onChange={(e) => setPassForm((f) => ({ ...f, phone: e.target.value }))}
                                placeholder="Phone"
                                inputMode="tel"
                                className="px-3 py-2.5 rounded-xl bg-[#161718] border border-white/10 text-sm text-white"
                            />
                            <input
                                value={passForm.email}
                                onChange={(e) => setPassForm((f) => ({ ...f, email: e.target.value }))}
                                placeholder="Email"
                                className="px-3 py-2.5 rounded-xl bg-[#161718] border border-white/10 text-sm text-white"
                            />
                        </div>
                        <select
                            value={passForm.passType}
                            onChange={(e) => setPassForm((f) => ({ ...f, passType: e.target.value }))}
                            className="w-full px-3 py-2.5 rounded-xl bg-[#161718] border border-white/10 text-sm text-white"
                        >
                            <option value="offline">Offline (cash/UPI desk)</option>
                            <option value="vip">VIP</option>
                            <option value="guest">Guest</option>
                            <option value="press">Press</option>
                            <option value="crew">Crew</option>
                            <option value="online">Online (recorded)</option>
                        </select>
                        <select
                            value={passForm.tierId}
                            onChange={(e) => setPassForm((f) => ({ ...f, tierId: e.target.value }))}
                            className="w-full px-3 py-2.5 rounded-xl bg-[#161718] border border-white/10 text-sm text-white"
                        >
                            {(data?.tiers || []).map((t) => (
                                <option key={t.id} value={t.id}>
                                    {t.name} · ₹{t.price}
                                </option>
                            ))}
                        </select>
                        <div className="grid grid-cols-2 gap-2">
                            <select
                                value={passForm.paymentStatus}
                                onChange={(e) => setPassForm((f) => ({ ...f, paymentStatus: e.target.value }))}
                                className="px-3 py-2.5 rounded-xl bg-[#161718] border border-white/10 text-sm text-white"
                            >
                                <option value="free">Free / comp</option>
                                <option value="paid">Paid</option>
                                <option value="pending">Pending</option>
                            </select>
                            <input
                                value={passForm.amountPaid}
                                onChange={(e) => setPassForm((f) => ({ ...f, amountPaid: e.target.value }))}
                                placeholder="Amount ₹"
                                inputMode="numeric"
                                className="px-3 py-2.5 rounded-xl bg-[#161718] border border-white/10 text-sm text-white"
                            />
                        </div>
                        <input
                            value={passForm.note}
                            onChange={(e) => setPassForm((f) => ({ ...f, note: e.target.value }))}
                            placeholder="Note (optional)"
                            className="w-full px-3 py-2.5 rounded-xl bg-[#161718] border border-white/10 text-sm text-white"
                        />
                        <button
                            type="submit"
                            disabled={saving}
                            className="w-full py-2.5 rounded-xl bg-[#0ECCEE] text-black text-sm font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-2"
                        >
                            {saving ? <Loader className="animate-spin" size={16} /> : <Plus size={16} />}
                            Issue pass
                        </button>
                    </form>
                </div>
            ) : null}
        </div>
    );
}
