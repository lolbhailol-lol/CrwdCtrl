import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
    ArrowLeft, RefreshCw, Ticket, QrCode, ToggleLeft, ToggleRight,
    Loader, Plus, Ban, Copy, Users, ScanLine, AlertTriangle, UserCheck,
    IdCard, CalendarDays, ShieldAlert,
} from 'lucide-react';
import {
    fetchFestOrganizerAuditorium,
    updateFestOrganizerAuditorium,
    createFestOrganizerAuditoriumInvite,
    deactivateFestOrganizerAuditoriumInvite,
    issueFestOrganizerAuditoriumDesk,
    uploadFestOrganizerImage,
} from '../../../services/api/festOrganizer.api';
import { useDialog } from '../../../context/DialogContext';
import { InlinePageLoader } from '../../../components/DetailPageLoader';
import { getFestPlugin } from '../plugins/registry';
import LocalQRCode from '../../../components/LocalQRCode';

function Toggle({ on, onClick, label, hint }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`w-full flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                on ? 'border-[#0ECCEE]/40 bg-[#0ECCEE]/10' : 'border-white/10 bg-[#161718]'
            }`}
        >
            <div>
                <p className="text-sm font-semibold text-white">{label}</p>
                {hint ? <p className="text-[11px] text-gray-500 mt-0.5">{hint}</p> : null}
            </div>
            {on ? <ToggleRight className="text-[#0ECCEE] shrink-0" size={28} /> : <ToggleLeft className="text-gray-500 shrink-0" size={28} />}
        </button>
    );
}

function StatPill({ label, value, tone = 'default' }) {
    const tones = {
        default: 'border-white/10 bg-white/4 text-white',
        cyan: 'border-[#0ECCEE]/30 bg-[#0ECCEE]/10 text-[#7DE8F7]',
        amber: 'border-amber-400/30 bg-amber-500/10 text-amber-200',
        emerald: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200',
        rose: 'border-rose-400/30 bg-rose-500/10 text-rose-200',
    };
    return (
        <div className={`rounded-xl border px-3 py-2.5 ${tones[tone] || tones.default}`}>
            <p className="text-lg font-bold tabular-nums leading-none">{value}</p>
            <p className="text-[10px] uppercase tracking-wide opacity-70 mt-1">{label}</p>
        </div>
    );
}

export default function FestOrganizerAuditoriumPage() {
    const { festId } = useParams();
    const navigate = useNavigate();
    const { toast } = useDialog();
    const plugin = getFestPlugin(festId);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [data, setData] = useState(null);
    const [seatDraft, setSeatDraft] = useState([]);
    const [inviteForm, setInviteForm] = useState({ categoryId: '', maxUses: 3, code: '', note: '' });
    const [deskForm, setDeskForm] = useState({
        categoryId: '', name: '', phone: '', email: '', college: '', misId: '', ticketPhotoUrl: '', idCardPhotoUrl: '', note: '',
    });
    const [deskBusy, setDeskBusy] = useState(false);
    const [issuedTicket, setIssuedTicket] = useState(null);
    const [rosterFilter, setRosterFilter] = useState('all');

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetchFestOrganizerAuditorium(festId);
            const payload = res?.data || res;
            setData(payload);
            setSeatDraft((payload?.stats?.categories || payload?.config?.categories || []).map((c) => ({
                id: c.id,
                label: c.label,
                seats: c.seats,
                channel: c.channel,
            })));
            const inviteCats = (payload?.config?.categories || []).filter((c) => c.channel === 'invite' || c.channel === 'desk');
            if (inviteCats[0] && !inviteForm.categoryId) {
                setInviteForm((f) => ({ ...f, categoryId: inviteCats[0].id }));
                setDeskForm((f) => ({ ...f, categoryId: inviteCats[0].id }));
            }
        } catch (e) {
            toast(e.message || 'Failed to load auditorium');
        } finally {
            setLoading(false);
        }
    }, [festId, toast]);

    useEffect(() => { load(); }, [load]);

    const config = data?.config || {};
    const stats = data?.stats || {};
    const invites = data?.invites || [];
    const recent = data?.recent || [];
    const risks = data?.risks || [];

    const inviteCategories = useMemo(
        () => (config.categories || []).filter((c) => c.channel === 'invite' || c.channel === 'desk'),
        [config.categories],
    );

    const filteredRecent = useMemo(() => {
        if (rosterFilter === 'all') return recent;
        if (rosterFilter === 'checked') return recent.filter((t) => t.checkedIn);
        if (rosterFilter === 'outside') return recent.filter((t) => !t.checkedIn);
        if (rosterFilter === 'noid') return recent.filter((t) => !t.idCardPhotoUrl);
        return recent.filter((t) => String(t.categoryId) === rosterFilter);
    }, [recent, rosterFilter]);

    if (plugin.id !== 'mindspark') {
        return (
            <div className="max-w-lg mx-auto p-6 text-center space-y-3">
                <p className="text-sm text-gray-400">Auditorium tickets are MindSpark-only.</p>
                <Link to={`/fest-organizer/fests/${festId}`} className="text-[#0ECCEE] text-sm">Back</Link>
            </div>
        );
    }

    const patchConfig = async (partial) => {
        setSaving(true);
        try {
            const res = await updateFestOrganizerAuditorium(festId, partial);
            const next = res?.data || {};
            setData((d) => ({
                ...d,
                config: next.config || d.config,
                stats: next.stats || d.stats,
            }));
            if (next.stats?.categories) {
                setSeatDraft(next.stats.categories.map((c) => ({
                    id: c.id, label: c.label, seats: c.seats, channel: c.channel,
                })));
            }
            toast('Saved');
        } catch (e) {
            toast(e.message || 'Save failed');
        } finally {
            setSaving(false);
        }
    };

    const saveSeats = async () => {
        await patchConfig({ categories: seatDraft });
    };

    const createInvite = async () => {
        try {
            const res = await createFestOrganizerAuditoriumInvite(festId, inviteForm);
            toast(`Invite ${res?.invite?.code || ''} created`);
            await load();
        } catch (e) {
            toast(e.message || 'Invite failed');
        }
    };

    const onDeskPhoto = async (file, field = 'ticketPhotoUrl') => {
        if (!file) return;
        try {
            const fd = new FormData();
            fd.append('image', file);
            fd.append('folder', 'auditorium-tickets');
            const res = await uploadFestOrganizerImage(fd);
            const url = res?.url || res?.secure_url || res?.data?.url || res?.imageUrl || '';
            if (!url) throw new Error('Upload failed');
            setDeskForm((f) => ({ ...f, [field]: url }));
            toast(field === 'idCardPhotoUrl' ? 'ID uploaded' : 'Photo uploaded');
        } catch (e) {
            toast(e.message || 'Upload failed');
        }
    };

    const issueDesk = async () => {
        setDeskBusy(true);
        setIssuedTicket(null);
        try {
            const res = await issueFestOrganizerAuditoriumDesk(festId, deskForm);
            setIssuedTicket(res?.ticket || null);
            toast('Ticket issued');
            await load();
        } catch (e) {
            if (e.code === 'ALREADY_REGISTERED' || e.ticket) {
                setIssuedTicket(e.ticket || null);
            }
            toast(e.message || 'Issue failed');
        } finally {
            setDeskBusy(false);
        }
    };

    if (loading && !data) return <InlinePageLoader label="Loading auditorium…" />;

    const filled = Number(stats.totalFilled) || 0;
    const seats = Number(stats.totalSeats) || 0;
    const left = stats.totalLeft != null ? stats.totalLeft : Math.max(0, seats - filled);
    const fillPct = seats > 0 ? Math.min(100, Math.round((filled / seats) * 100)) : 0;

    return (
        <div className="max-w-6xl mx-auto pb-16">
            <div className="flex items-center justify-between gap-2 mb-4">
                <button
                    type="button"
                    onClick={() => navigate(`/fest-organizer/fests/${festId}`)}
                    className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white"
                >
                    <ArrowLeft size={16} /> Dashboard
                </button>
                <button type="button" onClick={load} className="p-2 rounded-xl border border-white/10 text-gray-300">
                    <RefreshCw size={16} />
                </button>
            </div>

            <div className="lg:grid lg:grid-cols-[1fr_300px] lg:gap-5 lg:items-start space-y-4 lg:space-y-0">
                {/* Main column */}
                <div className="space-y-4 min-w-0">
                    <section className="rounded-3xl border border-[#0ECCEE]/25 bg-[#121314] p-5 space-y-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <p className="text-[11px] uppercase tracking-wide text-[#0ECCEE] font-semibold">MindSpark</p>
                                <h1 className="text-2xl font-bold text-white flex items-center gap-2 mt-0.5">
                                    <Ticket size={22} className="text-[#0ECCEE]" /> Auditorium ops
                                </h1>
                                <p className="text-sm text-gray-400 mt-1">
                                    Seats · invites · desk · gate — live fill {fillPct}%
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-2xl font-bold tabular-nums text-white">{filled}<span className="text-white/35 text-base">/{seats}</span></p>
                                <p className="text-[11px] text-gray-500">{left} seats left</p>
                            </div>
                        </div>
                        <div className="h-2 rounded-full bg-white/8 overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all ${fillPct >= 90 ? 'bg-amber-400' : 'bg-[#0ECCEE]'}`}
                                style={{ width: `${fillPct}%` }}
                            />
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            <StatPill label="Checked in" value={stats.checkedIn || 0} tone="emerald" />
                            <StatPill label="Outside" value={stats.outside || 0} tone="amber" />
                            <StatPill label="Today" value={stats.todayCount || 0} tone="cyan" />
                            <StatPill label="Missing ID" value={stats.missingIdCount || 0} tone={stats.missingIdCount ? 'rose' : 'default'} />
                        </div>
                    </section>

                    <section className="space-y-2">
                        <h2 className="text-sm font-semibold text-white px-1">Public visibility</h2>
                        <Toggle
                            on={Boolean(config.showPublicTicketBox)}
                            label="Show ticket box on MindSpark page"
                            hint="Appears below Live updates when on"
                            onClick={() => patchConfig({ showPublicTicketBox: !config.showPublicTicketBox })}
                        />
                        <Toggle
                            on={Boolean(config.registrationOpen)}
                            label="Registration open"
                            hint="Students can claim year seats when on"
                            onClick={() => {
                                if (config.registrationOpen && !window.confirm('Close auditorium registration?')) return;
                                patchConfig({ registrationOpen: !config.registrationOpen });
                            }}
                        />
                    </section>

                    <section className="rounded-2xl border border-white/10 bg-[#161718] p-4 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                            <div>
                                <h2 className="text-sm font-semibold text-white">Seat allotment</h2>
                                <p className="text-[11px] text-gray-500 mt-0.5">
                                    Public {stats.byChannel?.public || 0} · Invite {stats.byChannel?.invite || 0} · Desk {stats.byChannel?.desk || 0}
                                </p>
                            </div>
                            <button
                                type="button"
                                disabled={saving}
                                onClick={saveSeats}
                                className="px-3 py-1.5 rounded-xl bg-[#0ECCEE] text-black text-xs font-semibold disabled:opacity-50"
                            >
                                {saving ? 'Saving…' : 'Save seats'}
                            </button>
                        </div>
                        <div className="space-y-2">
                            {(stats.categories || seatDraft).map((cat, idx) => {
                                const draft = seatDraft.find((d) => d.id === cat.id) || cat;
                                const catFilled = Number(cat.filled) || 0;
                                const catSeats = Number(draft.seats) || 0;
                                const pct = catSeats > 0 ? Math.min(100, Math.round((catFilled / catSeats) * 100)) : 0;
                                const low = catSeats > 0 && (catSeats - catFilled) / catSeats < 0.1;
                                return (
                                    <div key={cat.id} className={`rounded-xl border px-3 py-2.5 ${low ? 'border-amber-400/40 bg-amber-500/5' : 'border-white/8 bg-white/3'}`}>
                                        <div className="flex items-center gap-2">
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-medium text-white truncate">{cat.label}</p>
                                                <p className="text-[10px] text-gray-500 uppercase tracking-wide">
                                                    {cat.channel} · {catFilled} filled · {Math.max(0, catSeats - catFilled)} left
                                                </p>
                                            </div>
                                            <input
                                                type="number"
                                                min={catFilled}
                                                value={draft.seats}
                                                onChange={(e) => {
                                                    const v = Math.max(catFilled, Math.floor(Number(e.target.value) || 0));
                                                    setSeatDraft((rows) => rows.map((r, i) => (
                                                        r.id === cat.id || i === idx ? { ...r, seats: v } : r
                                                    )));
                                                }}
                                                className="w-20 px-2 py-1.5 rounded-lg bg-[#121314] border border-white/10 text-sm text-white tabular-nums text-right"
                                            />
                                        </div>
                                        <div className="mt-2 h-1.5 rounded-full bg-white/8 overflow-hidden">
                                            <div className={`h-full rounded-full ${low ? 'bg-amber-400' : 'bg-[#0ECCEE]'}`} style={{ width: `${pct}%` }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>

                    <section className="grid grid-cols-2 gap-2">
                        <Link
                            to={`/fest-organizer/fests/${festId}/auditorium/scan`}
                            className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 hover:border-emerald-400/50"
                        >
                            <QrCode className="text-emerald-300 mb-2" size={20} />
                            <p className="text-sm font-semibold text-white">Auditorium scanner</p>
                            <p className="text-[11px] text-gray-500 mt-0.5">Face + college ID at gate</p>
                        </Link>
                        <a
                            href="/mindspark/auditorium"
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-2xl border border-white/10 bg-[#161718] p-4 hover:border-[#0ECCEE]/40"
                        >
                            <ScanLine className="text-[#0ECCEE] mb-2" size={20} />
                            <p className="text-sm font-semibold text-white">Public register</p>
                            <p className="text-[11px] text-gray-500 mt-0.5">Student ticket page</p>
                        </a>
                    </section>

                    <section className="rounded-2xl border border-white/10 bg-[#161718] p-4 space-y-3">
                        <h2 className="text-sm font-semibold text-white">Invite codes</h2>
                        <p className="text-[11px] text-gray-500">
                            Faculty / special — default 3 uses, max 20 · {stats.activeInvites || 0} active · {stats.inviteUsesLeft || 0} uses left
                        </p>
                        <div className="grid sm:grid-cols-2 gap-2">
                            <select
                                value={inviteForm.categoryId}
                                onChange={(e) => setInviteForm((f) => ({ ...f, categoryId: e.target.value }))}
                                className="px-3 py-2.5 rounded-xl bg-[#121314] border border-white/10 text-sm text-white"
                            >
                                {inviteCategories.map((c) => (
                                    <option key={c.id} value={c.id}>{c.label}</option>
                                ))}
                            </select>
                            <input
                                value={inviteForm.maxUses}
                                onChange={(e) => setInviteForm((f) => ({ ...f, maxUses: e.target.value }))}
                                type="number"
                                min={1}
                                max={20}
                                placeholder="Max uses"
                                className="px-3 py-2.5 rounded-xl bg-[#121314] border border-white/10 text-sm text-white"
                            />
                            <input
                                value={inviteForm.code}
                                onChange={(e) => setInviteForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                                placeholder="Code (optional)"
                                className="px-3 py-2.5 rounded-xl bg-[#121314] border border-white/10 text-sm text-white sm:col-span-2"
                            />
                        </div>
                        <button
                            type="button"
                            onClick={createInvite}
                            className="w-full py-2.5 rounded-xl bg-[#0ECCEE] text-black text-sm font-semibold inline-flex items-center justify-center gap-2"
                        >
                            <Plus size={16} /> Create invite
                        </button>
                        <div className="space-y-1.5 max-h-48 overflow-y-auto">
                            {invites.map((inv) => (
                                <div key={inv.id} className="flex items-center gap-2 rounded-xl bg-white/4 border border-white/8 px-3 py-2">
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-mono text-white">{inv.code}</p>
                                        <p className="text-[10px] text-gray-500">
                                            {inv.categoryId} · {inv.usedCount}/{inv.maxUses}
                                            {!inv.active ? ' · off' : ''}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        className="p-1.5 text-gray-400"
                                        title="Copy link"
                                        onClick={() => {
                                            const url = `${window.location.origin}/mindspark/auditorium?code=${encodeURIComponent(inv.code)}`;
                                            navigator.clipboard?.writeText(url);
                                            toast('Link copied');
                                        }}
                                    >
                                        <Copy size={14} />
                                    </button>
                                    {inv.active ? (
                                        <button
                                            type="button"
                                            className="p-1.5 text-amber-300"
                                            title="Deactivate"
                                            onClick={async () => {
                                                await deactivateFestOrganizerAuditoriumInvite(festId, inv.id);
                                                toast('Deactivated');
                                                load();
                                            }}
                                        >
                                            <Ban size={14} />
                                        </button>
                                    ) : null}
                                </div>
                            ))}
                            {!invites.length ? <p className="text-xs text-gray-600 text-center py-2">No invites yet</p> : null}
                        </div>
                    </section>

                    <section className="rounded-2xl border border-white/10 bg-[#161718] p-4 space-y-3">
                        <h2 className="text-sm font-semibold text-white">Desk issue</h2>
                        <p className="text-[11px] text-gray-500">Walk-up invite / buffer — free photo ticket</p>
                        <select
                            value={deskForm.categoryId}
                            onChange={(e) => setDeskForm((f) => ({ ...f, categoryId: e.target.value }))}
                            className="w-full px-3 py-2.5 rounded-xl bg-[#121314] border border-white/10 text-sm text-white"
                        >
                            {inviteCategories.map((c) => (
                                <option key={c.id} value={c.id}>{c.label}</option>
                            ))}
                        </select>
                        <input
                            value={deskForm.name}
                            onChange={(e) => setDeskForm((f) => ({ ...f, name: e.target.value }))}
                            placeholder="Full name"
                            className="w-full px-3 py-2.5 rounded-xl bg-[#121314] border border-white/10 text-sm text-white"
                        />
                        <div className="grid grid-cols-2 gap-2">
                            <input
                                value={deskForm.phone}
                                onChange={(e) => setDeskForm((f) => ({ ...f, phone: e.target.value }))}
                                placeholder="Phone"
                                className="px-3 py-2.5 rounded-xl bg-[#121314] border border-white/10 text-sm text-white"
                            />
                            <input
                                value={deskForm.email}
                                onChange={(e) => setDeskForm((f) => ({ ...f, email: e.target.value }))}
                                placeholder="Email"
                                className="px-3 py-2.5 rounded-xl bg-[#121314] border border-white/10 text-sm text-white"
                            />
                        </div>
                        <input
                            value={deskForm.misId || ''}
                            onChange={(e) => setDeskForm((f) => ({ ...f, misId: e.target.value }))}
                            placeholder="MIS (if year seat)"
                            className="w-full px-3 py-2.5 rounded-xl bg-[#121314] border border-white/10 text-sm text-white"
                        />
                        <label className="block">
                            <span className="text-[11px] text-gray-500">Face photo</span>
                            <input
                                type="file"
                                accept="image/*"
                                capture="user"
                                onChange={(e) => onDeskPhoto(e.target.files?.[0], 'ticketPhotoUrl')}
                                className="mt-1 block w-full text-xs text-gray-400"
                            />
                        </label>
                        {deskForm.ticketPhotoUrl ? (
                            <img src={deskForm.ticketPhotoUrl} alt="" className="w-20 h-20 rounded-xl object-cover border border-white/10" />
                        ) : null}
                        <label className="block">
                            <span className="text-[11px] text-gray-500">College ID (for year seats)</span>
                            <input
                                type="file"
                                accept="image/*"
                                capture="environment"
                                onChange={(e) => onDeskPhoto(e.target.files?.[0], 'idCardPhotoUrl')}
                                className="mt-1 block w-full text-xs text-gray-400"
                            />
                        </label>
                        {deskForm.idCardPhotoUrl ? (
                            <img src={deskForm.idCardPhotoUrl} alt="ID" className="w-28 h-20 rounded-xl object-cover border border-white/10" />
                        ) : null}
                        <button
                            type="button"
                            disabled={deskBusy}
                            onClick={issueDesk}
                            className="w-full py-2.5 rounded-xl bg-emerald-500 text-black text-sm font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-2"
                        >
                            {deskBusy ? <Loader className="animate-spin" size={16} /> : <Users size={16} />}
                            Issue free ticket
                        </button>
                        {issuedTicket ? (
                            <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3 space-y-2">
                                <div className="flex gap-3">
                                    {issuedTicket.ticketPhotoUrl ? (
                                        <img src={issuedTicket.ticketPhotoUrl} alt="" className="w-16 h-16 rounded-lg object-cover" />
                                    ) : null}
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm text-emerald-200 font-semibold">{issuedTicket.fullName}</p>
                                        <p className="text-[11px] text-gray-400">{issuedTicket.categoryLabel}</p>
                                    </div>
                                </div>
                                {issuedTicket.qrCodeData ? (
                                    <div className="bg-white p-2 rounded-xl w-fit mx-auto">
                                        <LocalQRCode
                                            data={JSON.stringify({
                                                hash: issuedTicket.qrCodeData,
                                                registrationId: issuedTicket.registrationId || issuedTicket.id,
                                            })}
                                            size={120}
                                            printSafe
                                        />
                                    </div>
                                ) : null}
                                <a href={issuedTicket.ticketUrl} target="_blank" rel="noreferrer" className="text-xs text-[#0ECCEE] underline block text-center">
                                    Open ticket page
                                </a>
                            </div>
                        ) : null}
                    </section>

                    <section className="rounded-2xl border border-white/10 bg-[#161718] p-4 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <h2 className="text-sm font-semibold text-white">Recent tickets</h2>
                            <select
                                value={rosterFilter}
                                onChange={(e) => setRosterFilter(e.target.value)}
                                className="px-2.5 py-1.5 rounded-lg bg-[#121314] border border-white/10 text-[11px] text-gray-300"
                            >
                                <option value="all">All</option>
                                <option value="outside">Outside</option>
                                <option value="checked">Checked in</option>
                                <option value="noid">Missing ID</option>
                                {(stats.categories || []).map((c) => (
                                    <option key={c.id} value={c.id}>{c.label}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-1.5 max-h-80 overflow-y-auto">
                            {filteredRecent.map((t) => (
                                <div key={t.id} className="flex items-center gap-3 rounded-xl bg-white/4 px-3 py-2">
                                    {t.ticketPhotoUrl ? (
                                        <img src={t.ticketPhotoUrl} alt="" className="w-10 h-10 rounded-lg object-cover" />
                                    ) : (
                                        <div className="w-10 h-10 rounded-lg bg-white/10" />
                                    )}
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm text-white truncate">{t.fullName}</p>
                                        <p className="text-[10px] text-gray-500 truncate">
                                            {t.categoryLabel} · {t.phone}
                                            {t.misId ? ` · ${t.misId}` : ''}
                                        </p>
                                    </div>
                                    <div className="flex flex-col items-end gap-0.5 shrink-0">
                                        {t.checkedIn ? (
                                            <span className="text-[9px] uppercase text-emerald-300">In</span>
                                        ) : (
                                            <span className="text-[9px] uppercase text-amber-300">Out</span>
                                        )}
                                        {t.idCardPhotoUrl ? (
                                            <IdCard size={12} className="text-[#0ECCEE]/70" />
                                        ) : (
                                            <span className="text-[9px] text-rose-300">No ID</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {!filteredRecent.length ? <p className="text-xs text-gray-600 text-center py-4">No tickets in this filter</p> : null}
                        </div>
                    </section>
                </div>

                {/* Side panel */}
                <aside className="lg:sticky lg:top-4 space-y-3">
                    <div className="rounded-2xl border border-white/10 bg-[#161718] p-4 space-y-3">
                        <p className="text-[10px] uppercase tracking-[0.18em] text-[#0ECCEE] font-semibold">Live snapshot</p>
                        <div className="space-y-2 text-sm">
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-gray-400 inline-flex items-center gap-1.5"><UserCheck size={13} /> Gate rate</span>
                                <span className="font-semibold text-white tabular-nums">{stats.checkInRate || 0}%</span>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-gray-400 inline-flex items-center gap-1.5"><CalendarDays size={13} /> Issued today</span>
                                <span className="font-semibold text-white tabular-nums">{stats.todayCount || 0}</span>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-gray-400 inline-flex items-center gap-1.5"><IdCard size={13} /> Missing ID</span>
                                <span className={`font-semibold tabular-nums ${(stats.missingIdCount || 0) > 0 ? 'text-rose-300' : 'text-white'}`}>
                                    {stats.missingIdCount || 0}
                                </span>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-gray-400">Reg open</span>
                                <span className={config.registrationOpen ? 'text-emerald-300 text-xs font-semibold' : 'text-amber-300 text-xs font-semibold'}>
                                    {config.registrationOpen ? 'Yes' : 'Closed'}
                                </span>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-gray-400">Public box</span>
                                <span className={config.showPublicTicketBox ? 'text-emerald-300 text-xs font-semibold' : 'text-gray-500 text-xs font-semibold'}>
                                    {config.showPublicTicketBox ? 'Visible' : 'Hidden'}
                                </span>
                            </div>
                        </div>
                        <Link
                            to={`/fest-organizer/fests/${festId}/auditorium/scan`}
                            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-emerald-500 text-black text-sm font-semibold"
                        >
                            <QrCode size={16} /> Open scanner
                        </Link>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-[#161718] p-4 space-y-2">
                        <p className="text-[10px] uppercase tracking-[0.18em] text-gray-400 font-semibold">By channel</p>
                        {[
                            { key: 'public', label: 'Year seats (public)' },
                            { key: 'invite', label: 'Invite' },
                            { key: 'desk', label: 'Desk / buffer' },
                        ].map((row) => (
                            <div key={row.key} className="flex items-center justify-between text-sm">
                                <span className="text-gray-400">{row.label}</span>
                                <span className="text-white font-semibold tabular-nums">{stats.byChannel?.[row.key] || 0}</span>
                            </div>
                        ))}
                    </div>

                    <div className="rounded-2xl border border-amber-400/20 bg-amber-500/5 p-4 space-y-2">
                        <p className="text-[10px] uppercase tracking-[0.18em] text-amber-300 font-semibold inline-flex items-center gap-1">
                            <ShieldAlert size={12} /> Watchlist
                        </p>
                        {risks.length ? risks.map((r) => (
                            <p key={r} className="text-[12px] text-amber-100/90 leading-snug flex gap-1.5">
                                <AlertTriangle size={12} className="shrink-0 mt-0.5" /> {r}
                            </p>
                        )) : (
                            <p className="text-[12px] text-gray-500">No active risks flagged</p>
                        )}
                        <ul className="text-[11px] text-gray-500 space-y-1 pt-1 border-t border-white/8">
                            <li>Gate: match face ↔ ID ↔ claimed year</li>
                            <li>Deactivate leaked invite links ASAP</li>
                            <li>One Google account + one MIS per seat</li>
                        </ul>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-[#161718] p-4 space-y-2">
                        <p className="text-[10px] uppercase tracking-[0.18em] text-gray-400 font-semibold">Nearly full</p>
                        {(stats.categories || [])
                            .filter((c) => c.seats > 0)
                            .sort((a, b) => (a.left ?? 99) - (b.left ?? 99))
                            .slice(0, 5)
                            .map((c) => (
                                <div key={c.id} className="flex items-center justify-between gap-2 text-sm">
                                    <span className="text-gray-300 truncate">{c.label}</span>
                                    <span className={`tabular-nums text-xs font-semibold ${c.full || (c.left != null && c.left <= 5) ? 'text-amber-300' : 'text-white/60'}`}>
                                        {c.left != null ? `${c.left} left` : '—'}
                                    </span>
                                </div>
                            ))}
                    </div>
                </aside>
            </div>
        </div>
    );
}
