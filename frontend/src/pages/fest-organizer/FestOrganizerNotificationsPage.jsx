import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
    Bell, Check, Copy, Loader, Megaphone, MessageCircle, Phone,
    RefreshCw, Search, Users, Zap,
} from 'lucide-react';
import {
    sendFestOrganizerReminder,
    sendFestOrganizerBroadcast,
    fetchFestOrganizerDashboard,
    fetchFestOrganizerNotifyContacts,
    buildFestOrganizerAdminApi,
} from '../../services/api/festOrganizer.api';
import { InlinePageLoader } from '../../components/DetailPageLoader';
import { useDialog } from '../../context/DialogContext';
import { getFestPlugin } from '../../features/fests/plugins';

const AUDIENCES = [
    { id: 'approved', label: 'Approved', hint: 'Confirmed entries', mindSparkLabel: 'Registered', mindSparkHint: 'Paid / confirmed' },
    { id: 'pending', label: 'Need review', hint: 'Still pending' },
    { id: 'unpaid', label: 'Unpaid', hint: 'Payment pending', mindSparkHint: 'Still need to pay' },
    { id: 'not_in', label: 'Still outside', hint: 'Approved, not checked in', mindSparkHint: 'Registered, not checked in yet' },
    { id: 'checked_in', label: 'Checked in', hint: 'Already at venue' },
    { id: 'all_active', label: 'All active', hint: 'Pending + approved', mindSparkLabel: 'Everyone', mindSparkHint: 'All active registrations' },
];

const TEMPLATES = [
    {
        id: 'arrive',
        label: 'Arrive on time',
        title: 'Reminder — arrive on time',
        message: 'Hi! Please arrive on time with your QR ticket ready. See you at the fest!',
        wa: 'Hi! Please arrive on time with your QR ticket ready. See you at the fest!',
    },
    {
        id: 'payment',
        label: 'Payment due',
        title: 'Payment reminder',
        message: 'Hi! Your registration payment is still pending. Complete it soon to confirm your spot.',
        wa: 'Hi! Your fest registration payment is still pending. Complete it soon to confirm your spot. Reply if you need help.',
    },
    {
        id: 'venue',
        label: 'Venue update',
        title: 'Venue / timing update',
        message: 'Quick update on venue/timing for your competition. Check the fest page for details.',
        wa: 'Quick update on venue/timing for your competition — check the fest page or reply here for help.',
    },
    {
        id: 'checkin',
        label: 'Check-in open',
        title: 'Check-in is open',
        message: 'Gate check-in is open. Bring your QR ticket and head to the entrance.',
        wa: 'Check-in is open! Bring your QR ticket and head to the entrance. See you soon!',
    },
    {
        id: 'wa_group',
        label: 'Join WA group',
        title: 'Join the competition WhatsApp',
        message: 'Please join your competition WhatsApp group for updates and day-of instructions.',
        wa: 'Please join your competition WhatsApp group for updates and day-of instructions. Reply if you need the link again.',
        mindSparkOnly: true,
    },
    {
        id: 'results',
        label: 'Results soon',
        title: 'Results update',
        message: 'Results will be announced soon. Stay tuned on the fest page.',
        wa: 'Results will be announced soon — stay tuned! Congrats to everyone who competed.',
    },
];

function toWaDigits(phone) {
    const digits = String(phone || '').replace(/\D/g, '');
    if (!digits) return '';
    return digits.length === 10 ? `91${digits}` : digits;
}

function waLink(phone, text) {
    const d = toWaDigits(phone);
    if (!d) return null;
    const q = text ? `?text=${encodeURIComponent(text)}` : '';
    return `https://wa.me/${d}${q}`;
}

function telLink(phone) {
    const digits = String(phone || '').replace(/\D/g, '');
    return digits ? `tel:${digits}` : null;
}

function personalize(template, name, festName, competitionName) {
    const first = String(name || '').trim().split(/\s+/)[0] || '';
    let text = template || '';
    if (first && !/^hi[,!\s]/i.test(text)) {
        text = `Hi ${first}! ${text.replace(/^Hi[!,\s]*/i, '')}`;
    } else if (first) {
        text = text.replace(/^Hi[!]?/i, `Hi ${first}`);
    }
    if (festName && !text.includes(festName)) {
        /* keep short — fest name already optional in templates */
    }
    if (competitionName && text.includes('your competition')) {
        text = text.replace('your competition', competitionName);
    }
    return text;
}

export default function FestOrganizerNotificationsPage() {
    const { festId } = useParams();
    const [searchParams, setSearchParams] = useSearchParams();
    const { toast, confirm } = useDialog();
    const plugin = getFestPlugin(festId);
    const mindSpark = plugin.id === 'mindspark';
    const WhatsAppAdmin = plugin.WhatsAppAdmin;
    const adminApi = useMemo(
        () => (mindSpark ? buildFestOrganizerAdminApi(festId) : null),
        [mindSpark, festId],
    );

    const tab = searchParams.get('tab') || 'connect';
    const audience = searchParams.get('audience') || (mindSpark ? 'approved' : 'approved');
    const prefillCompetitionId = searchParams.get('competitionId') || '';

    const audiences = useMemo(
        () => (mindSpark
            ? AUDIENCES
                .filter((a) => a.id !== 'pending')
                .map((a) => ({
                    ...a,
                    label: a.mindSparkLabel || a.label,
                    hint: a.mindSparkHint || a.hint,
                }))
            : AUDIENCES),
        [mindSpark],
    );

    useEffect(() => {
        if (mindSpark && audience === 'pending') {
            const p = new URLSearchParams(searchParams);
            p.set('audience', 'unpaid');
            setSearchParams(p, { replace: true });
        }
    }, [mindSpark, audience, searchParams, setSearchParams]);

    const [festName, setFestName] = useState('');
    const [competitions, setCompetitions] = useState([]);
    const [competitionId, setCompetitionId] = useState(prefillCompetitionId);
    const [contacts, setContacts] = useState([]);
    const [meta, setMeta] = useState({ total: 0, withPhone: 0, withEmail: 0 });
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState('');
    const [waMessage, setWaMessage] = useState(TEMPLATES[0].wa);
    const [appForm, setAppForm] = useState({
        title: TEMPLATES[0].title,
        message: TEMPLATES[0].message,
    });
    const [notifyChannels, setNotifyChannels] = useState({ inApp: true, email: false });
    const [busy, setBusy] = useState('');
    const [waCursor, setWaCursor] = useState(0);

    const setTab = (next) => {
        const p = new URLSearchParams(searchParams);
        p.set('tab', next);
        setSearchParams(p, { replace: true });
    };

    const setAudience = (next) => {
        const p = new URLSearchParams(searchParams);
        p.set('audience', next);
        setSearchParams(p, { replace: true });
        setWaCursor(0);
    };

    const loadDash = useCallback(async () => {
        try {
            const data = await fetchFestOrganizerDashboard(festId);
            setFestName(data.fest?.festName || '');
            setCompetitions((data.competitions || []).filter((c) => c.id));
        } catch {
            /* ignore */
        }
    }, [festId]);

    const loadContacts = useCallback(async () => {
        setLoading(true);
        try {
            const data = await fetchFestOrganizerNotifyContacts(festId, {
                audience,
                competitionId: competitionId || undefined,
                limit: 300,
            });
            setContacts(data.contacts || []);
            setMeta({ total: data.total || 0, withPhone: data.withPhone || 0, withEmail: data.withEmail || 0 });
        } catch (e) {
            toast(e.message || 'Failed');
            setContacts([]);
            setMeta({ total: 0, withPhone: 0, withEmail: 0 });
        } finally {
            setLoading(false);
        }
    }, [festId, audience, competitionId, toast]);

    useEffect(() => {
        loadDash();
    }, [loadDash]);

    useEffect(() => {
        if (prefillCompetitionId) setCompetitionId(prefillCompetitionId);
    }, [prefillCompetitionId]);

    useEffect(() => {
        loadContacts();
    }, [loadContacts]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return contacts;
        return contacts.filter((c) =>
            [c.name, c.phone, c.email, c.competitionName].some((v) => String(v || '').toLowerCase().includes(q)),
        );
    }, [contacts, query]);

    const withPhone = useMemo(() => filtered.filter((c) => c.phone), [filtered]);

    const applyTemplate = (t) => {
        setWaMessage(t.wa);
        setAppForm({ title: t.title, message: t.message });
        toast(t.label);
    };

    const copyText = async (text, okMsg) => {
        try {
            await navigator.clipboard.writeText(text);
            toast(okMsg || 'Copied');
        } catch {
            toast('Copy failed');
        }
    };

    const copyAllPhones = () => {
        const lines = withPhone.map((c) => `${c.name}\t${c.phone}`).join('\n');
        if (!lines) {
            toast('No phones');
            return;
        }
        copyText(lines, `Copied ${withPhone.length} contacts`);
    };

    const openNextWhatsApp = () => {
        if (!withPhone.length) {
            toast('No phones');
            return;
        }
        const idx = waCursor % withPhone.length;
        const c = withPhone[idx];
        const text = personalize(waMessage, c.name, festName, c.competitionName);
        const link = waLink(c.phone, text);
        if (link) window.open(link, '_blank', 'noopener,noreferrer');
        setWaCursor(idx + 1);
        toast(`${idx + 1}/${withPhone.length} · ${c.name?.split(/\s+/)[0] || 'WA'}`);
    };

    const sendInApp = async (mode) => {
        const title = appForm.title.trim();
        const message = appForm.message.trim();
        if (mode === 'broadcast' && (!title || !message)) {
            toast('Add title & message');
            return;
        }
        const channelParts = [];
        if (notifyChannels.inApp) channelParts.push('in-app');
        if (notifyChannels.email) channelParts.push('email');
        if (!channelParts.length) {
            toast('Pick a channel');
            return;
        }
        const ok = await confirm({
            title: mode === 'reminder' ? 'Send reminder?' : 'Send broadcast?',
            message: `${channelParts.join(' + ')} to ~${meta.total} people (${audiences.find((a) => a.id === audience)?.label || AUDIENCES.find((a) => a.id === audience)?.label || audience})${competitionId ? ' in this competition' : ''}.`,
        });
        if (!ok) return;
        setBusy(mode);
        try {
            const channels = [];
            if (notifyChannels.inApp) channels.push('inApp');
            if (notifyChannels.email) channels.push('email');
            const payload = {
                title: title || undefined,
                message: message || undefined,
                audience,
                channels,
            };
            if (competitionId) payload.competitionId = competitionId;
            await (mode === 'reminder'
                ? sendFestOrganizerReminder(festId, payload)
                : sendFestOrganizerBroadcast(festId, {
                    title: title || 'Announcement',
                    message: message || 'Update from the fest team.',
                    audience,
                    competitionId: competitionId || undefined,
                    channels,
                }));
            toast('Sent');
        } catch (err) {
            toast(err.message || 'Failed');
        } finally {
            setBusy('');
        }
    };

    const audienceLabel = audiences.find((a) => a.id === audience)?.label
        || AUDIENCES.find((a) => a.id === audience)?.label
        || audience;

    const templates = useMemo(
        () => TEMPLATES.filter((t) => !t.mindSparkOnly || mindSpark),
        [mindSpark],
    );

    const quickWho = mindSpark
        ? [
            { id: 'unpaid', label: 'Chase unpaid', hint: 'Payment still pending' },
            { id: 'not_in', label: 'Still outside', hint: 'Not checked in' },
            { id: 'approved', label: 'Registered', hint: 'Paid / confirmed' },
        ]
        : null;

    return (
        <div className="max-w-2xl mx-auto space-y-4 pb-10">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-[10px] uppercase tracking-[0.14em] text-[#0ECCEE] font-semibold">Outreach</p>
                    <h1 className="text-xl font-bold text-white mt-0.5 flex items-center gap-2">
                        <Bell className="text-[#0ECCEE]" size={20} /> Connect
                    </h1>
                    <p className="text-xs text-gray-500 mt-1">
                        {mindSpark
                            ? '1) Pick who · 2) Message · 3) WhatsApp or notify — no approve queue'
                            : 'WhatsApp · call · in-app · email — pick who, use a template, tap to connect'}
                    </p>
                </div>
                <button type="button" onClick={loadContacts} className="p-2 rounded-xl border border-white/10 text-gray-400" aria-label="Refresh">
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>

            {quickWho ? (
                <div className="grid grid-cols-3 gap-2">
                    {quickWho.map((q) => {
                        const active = audience === q.id;
                        return (
                            <button
                                key={q.id}
                                type="button"
                                onClick={() => {
                                    setAudience(q.id);
                                    setTab('connect');
                                }}
                                className={`rounded-2xl border px-2.5 py-3 text-left transition ${
                                    active
                                        ? 'border-[#0ECCEE]/40 bg-[#0ECCEE]/12'
                                        : 'border-white/10 bg-[#161718] hover:border-white/20'
                                }`}
                            >
                                <p className={`text-xs font-semibold ${active ? 'text-[#0ECCEE]' : 'text-white'}`}>{q.label}</p>
                                <p className="text-[10px] text-gray-500 mt-1 leading-snug">{q.hint}</p>
                            </button>
                        );
                    })}
                </div>
            ) : null}

            {/* Audience */}
            <section className="rounded-2xl border border-white/10 bg-[#161718] p-3.5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] uppercase tracking-wide text-gray-500">
                        {mindSpark ? '1 · Who' : 'Who'}
                    </p>
                    <p className="text-xs text-gray-400 tabular-nums">
                        <span className="text-white font-medium">{meta.total}</span> people
                        {meta.withPhone ? <> · <span className="text-emerald-300">{meta.withPhone}</span> phone</> : null}
                        {meta.withEmail ? <> · <span className="text-sky-300">{meta.withEmail}</span> email</> : null}
                    </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                    {audiences.map((a) => (
                        <button
                            key={a.id}
                            type="button"
                            onClick={() => setAudience(a.id)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                                audience === a.id
                                    ? 'bg-[#0ECCEE]/15 text-[#0ECCEE] border border-[#0ECCEE]/35'
                                    : 'text-gray-500 border border-transparent hover:text-gray-300'
                            }`}
                            title={a.hint}
                        >
                            {a.label}
                        </button>
                    ))}
                </div>
                {competitions.length ? (
                    <select
                        value={competitionId}
                        onChange={(e) => {
                            setCompetitionId(e.target.value);
                            const p = new URLSearchParams(searchParams);
                            if (e.target.value) p.set('competitionId', e.target.value);
                            else p.delete('competitionId');
                            setSearchParams(p, { replace: true });
                        }}
                        className="w-full px-3 py-2.5 rounded-xl bg-[#121314] border border-white/10 text-sm text-white"
                    >
                        <option value="">All competitions</option>
                        {competitions.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                ) : null}
            </section>

            {/* Templates */}
            <section className="space-y-2">
                <p className="text-[11px] uppercase tracking-wide text-gray-500 px-0.5">
                    {mindSpark ? '2 · Quick message' : 'Quick templates'}
                </p>
                <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
                    {templates.map((t) => (
                        <button
                            key={t.id}
                            type="button"
                            onClick={() => applyTemplate(t)}
                            className="shrink-0 px-3 py-2 rounded-xl border border-white/10 bg-[#161718] text-xs text-gray-300 hover:border-[#0ECCEE]/40 hover:text-white transition inline-flex items-center gap-1.5"
                        >
                            <Zap size={12} className="text-[#0ECCEE]" />
                            {t.label}
                        </button>
                    ))}
                </div>
            </section>

            {/* Tabs */}
            <div className="grid grid-cols-2 gap-2">
                {[
                    { id: 'connect', label: mindSpark ? '3 · WhatsApp' : 'WhatsApp & call', icon: MessageCircle, sub: 'One-by-one + call' },
                    { id: 'app', label: mindSpark ? '3 · Notify' : 'Notify', icon: Megaphone, sub: `Push to ${audienceLabel.toLowerCase()}` },
                ].map((t) => {
                    const active = tab === t.id;
                    return (
                        <button
                            key={t.id}
                            type="button"
                            onClick={() => setTab(t.id)}
                            className={`rounded-2xl border px-3 py-3 text-left transition ${
                                active
                                    ? 'border-[#0ECCEE]/40 bg-[#0ECCEE]/10'
                                    : 'border-white/10 bg-[#161718] hover:border-white/20'
                            }`}
                        >
                            <t.icon size={16} className={active ? 'text-[#0ECCEE]' : 'text-gray-500'} />
                            <p className={`text-sm font-semibold mt-1.5 ${active ? 'text-white' : 'text-gray-300'}`}>{t.label}</p>
                            <p className="text-[10px] text-gray-500 mt-0.5">{t.sub}</p>
                        </button>
                    );
                })}
            </div>

            {tab === 'connect' ? (
                <div className="space-y-3">
                    <section className="rounded-2xl border border-emerald-400/25 bg-linear-to-br from-emerald-500/10 to-[#161718] p-4 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <MessageCircle size={16} className="text-emerald-300" />
                                <h2 className="text-sm font-semibold text-white">WhatsApp message</h2>
                            </div>
                            <span className="text-[10px] text-gray-500 tabular-nums">
                                {audienceLabel} · {withPhone.length} phones
                            </span>
                        </div>
                        <textarea
                            value={waMessage}
                            onChange={(e) => setWaMessage(e.target.value)}
                            rows={3}
                            placeholder="Message that opens with WhatsApp…"
                            className="w-full px-3 py-2.5 rounded-xl bg-[#121314] border border-white/10 text-sm text-white placeholder:text-gray-600"
                        />
                        <button
                            type="button"
                            onClick={openNextWhatsApp}
                            disabled={!withPhone.length}
                            className="w-full py-3 rounded-xl bg-emerald-500 text-black text-sm font-semibold disabled:opacity-40 inline-flex items-center justify-center gap-2"
                        >
                            <MessageCircle size={16} />
                            {withPhone.length
                                ? `Open next WhatsApp (${Math.min(waCursor + 1, withPhone.length)}/${withPhone.length})`
                                : 'No phones in this list'}
                        </button>
                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => copyText(waMessage, 'Message copied')}
                                className="text-xs px-3 py-1.5 rounded-lg border border-white/10 text-gray-400 inline-flex items-center gap-1.5"
                            >
                                <Copy size={12} /> Copy text
                            </button>
                            <button
                                type="button"
                                onClick={copyAllPhones}
                                className="text-xs px-3 py-1.5 rounded-lg border border-white/10 text-gray-400 inline-flex items-center gap-1.5"
                            >
                                <Copy size={12} /> Copy all phones
                            </button>
                            {waCursor > 0 ? (
                                <button
                                    type="button"
                                    onClick={() => setWaCursor(0)}
                                    className="text-xs px-3 py-1.5 rounded-lg border border-white/10 text-gray-400"
                                >
                                    Reset queue
                                </button>
                            ) : null}
                        </div>
                        <p className="text-[11px] text-gray-500">
                            Opens WhatsApp one by one with your message — no Business API needed.
                        </p>
                    </section>

                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                        <input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Filter contacts…"
                            className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#161718] border border-white/10 text-sm text-white placeholder:text-gray-600"
                        />
                    </div>

                    {loading ? (
                        <InlinePageLoader label="Loading contacts…" variant="fest" minHeight={false} />
                    ) : (
                        <div className="space-y-2">
                            {filtered.map((c) => {
                                const text = personalize(waMessage, c.name, festName, c.competitionName);
                                const wa = waLink(c.phone, text);
                                const tel = telLink(c.phone);
                                return (
                                    <div
                                        key={c.id}
                                        className="rounded-2xl border border-white/10 bg-[#161718] px-3.5 py-3 flex items-center gap-3"
                                    >
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-semibold text-white truncate">{c.name}</p>
                                            <p className="text-[11px] text-gray-500 truncate">
                                                {c.competitionName || 'Fest'}
                                                {c.phone ? ` · ${c.phone}` : ' · no phone'}
                                                {c.paymentStatus === 'pending' ? ' · unpaid' : ''}
                                                {!mindSpark && c.status === 'pending' ? ' · review' : ''}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            {wa ? (
                                                <a
                                                    href={wa}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/15 text-emerald-300 text-xs font-semibold"
                                                    aria-label={`WhatsApp ${c.name}`}
                                                >
                                                    <MessageCircle size={14} /> WA
                                                </a>
                                            ) : (
                                                <span className="p-2.5 rounded-xl bg-white/5 text-gray-600" title="No phone">
                                                    <MessageCircle size={16} />
                                                </span>
                                            )}
                                            {tel ? (
                                                <a
                                                    href={tel}
                                                    className="p-2.5 rounded-xl bg-white/5 text-gray-200"
                                                    aria-label={`Call ${c.name}`}
                                                >
                                                    <Phone size={16} />
                                                </a>
                                            ) : null}
                                        </div>
                                    </div>
                                );
                            })}
                            {!filtered.length ? (
                                <div className="rounded-2xl border border-dashed border-white/10 py-12 text-center px-4">
                                    <Users className="mx-auto text-gray-600 mb-2" size={28} />
                                    <p className="text-sm text-gray-500">No contacts in this audience</p>
                                    <Link
                                        to={`/fest-organizer/fests/${festId}/participants`}
                                        className="text-xs text-[#0ECCEE] mt-2 inline-block"
                                    >
                                        Open guest roster →
                                    </Link>
                                </div>
                            ) : null}
                        </div>
                    )}
                </div>
            ) : (
                <div className="space-y-3">
                    <section className="rounded-2xl border border-[#0ECCEE]/25 bg-linear-to-br from-[#0ECCEE]/10 to-[#161718] p-4 space-y-3">
                        <div className="flex items-center gap-2">
                            <Megaphone size={16} className="text-[#0ECCEE]" />
                            <h2 className="text-sm font-semibold text-white">
                                {mindSpark ? 'Notify this list' : 'Notify participants'}
                            </h2>
                        </div>
                        <p className="text-[11px] text-gray-500">
                            Send to <span className="text-white">{audienceLabel}</span>
                            {competitionId ? ' in the selected competition' : ' across the fest'}
                            {' '}(~{meta.total} people).
                        </p>
                        <div className="flex flex-wrap gap-4 text-xs text-gray-300">
                            <label className="inline-flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={notifyChannels.inApp}
                                    onChange={(e) => setNotifyChannels((c) => ({ ...c, inApp: e.target.checked }))}
                                />
                                In-app notification
                            </label>
                            <label className="inline-flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={notifyChannels.email}
                                    onChange={(e) => setNotifyChannels((c) => ({ ...c, email: e.target.checked }))}
                                />
                                Email
                                {!meta.withEmail ? <span className="text-gray-600">(none in list)</span> : null}
                            </label>
                        </div>
                        <input
                            value={appForm.title}
                            onChange={(e) => setAppForm((f) => ({ ...f, title: e.target.value }))}
                            placeholder="Title"
                            className="w-full px-3 py-2.5 rounded-xl bg-[#121314] border border-white/10 text-sm text-white"
                        />
                        <textarea
                            value={appForm.message}
                            onChange={(e) => setAppForm((f) => ({ ...f, message: e.target.value }))}
                            rows={4}
                            placeholder="Message"
                            className="w-full px-3 py-2.5 rounded-xl bg-[#121314] border border-white/10 text-sm text-white"
                        />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <button
                                type="button"
                                disabled={busy === 'reminder' || meta.total === 0}
                                onClick={() => sendInApp('reminder')}
                                className="py-2.5 rounded-xl bg-[#0ECCEE] text-black text-sm font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-2"
                            >
                                {busy === 'reminder' ? <Loader className="animate-spin" size={16} /> : <Bell size={16} />}
                                Send reminder
                            </button>
                            <button
                                type="button"
                                disabled={busy === 'broadcast' || meta.total === 0}
                                onClick={() => sendInApp('broadcast')}
                                className="py-2.5 rounded-xl border border-[#0ECCEE]/40 text-[#0ECCEE] text-sm font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-2"
                            >
                                {busy === 'broadcast' ? <Loader className="animate-spin" size={16} /> : <Megaphone size={16} />}
                                Broadcast
                            </button>
                        </div>
                    </section>

                    <div className="rounded-xl border border-white/10 bg-[#161718] px-4 py-3 flex items-start gap-2 text-xs text-gray-400">
                        <Check size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                        <p>
                            {mindSpark
                                ? 'Use WhatsApp for unpaid / outside chase. Use Notify for fest-wide updates. Filter by competition to message one desk only.'
                                : (
                                    <>
                                        Tip: use <span className="text-white">WhatsApp &amp; call</span> for urgent nudges, and{' '}
                                        <span className="text-white">email + in-app</span> for formal updates.
                                        Filter by competition above to notify one comp only.
                                    </>
                                )}
                        </p>
                    </div>
                </div>
            )}

            {WhatsAppAdmin && adminApi ? (
                <section className="rounded-2xl border border-emerald-400/20 bg-[#161718] p-4 space-y-2">
                    <div>
                        <p className="text-sm font-semibold text-white flex items-center gap-2">
                            <MessageCircle size={16} className="text-emerald-300" /> Competition WhatsApp groups
                        </p>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                            Shown after paid registration — keep invite links current
                        </p>
                    </div>
                    <WhatsAppAdmin festId={festId} api={adminApi} />
                </section>
            ) : null}
        </div>
    );
}
