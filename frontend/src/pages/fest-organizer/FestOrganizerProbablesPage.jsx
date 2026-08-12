import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
    ArrowLeft, Loader, MessageCircle, Phone, Plus, RefreshCw, Search,
    UserPlus, Check, Trash2, ArrowRightLeft,
} from 'lucide-react';
import {
    fetchFestOrganizerProbables,
    createFestOrganizerProbable,
    updateFestOrganizerProbable,
    deleteFestOrganizerProbable,
    convertFestOrganizerProbable,
} from '../../services/api/festOrganizer.api';
import { useDialog } from '../../context/DialogContext';

function waLink(phone, competitionName) {
    const digits = String(phone || '').replace(/\D/g, '');
    if (!digits) return null;
    const withCountry = digits.length === 10 ? `91${digits}` : digits;
    const text = encodeURIComponent(
        competitionName
            ? `Hi! Following up on your interest in ${competitionName} at our fest.`
            : 'Hi! Following up on your interest in our fest competitions.',
    );
    return `https://wa.me/${withCountry}?text=${text}`;
}

function telLink(phone) {
    const digits = String(phone || '').replace(/\D/g, '');
    return digits ? `tel:${digits}` : null;
}

const emptyForm = {
    name: '',
    phone: '',
    competitionId: '',
    note: '',
};

export default function FestOrganizerProbablesPage() {
    const { festId } = useParams();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { toast, confirm } = useDialog();

    const prefillComp = searchParams.get('competitionId') || '';
    const [rows, setRows] = useState([]);
    const [competitions, setCompetitions] = useState([]);
    const [counts, setCounts] = useState({ probable: 0, converted: 0, dropped: 0, total: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [statusFilter, setStatusFilter] = useState('probable');
    const [compFilter, setCompFilter] = useState(prefillComp);
    const [query, setQuery] = useState('');
    const [form, setForm] = useState({ ...emptyForm, competitionId: prefillComp });
    const [saving, setSaving] = useState(false);
    const [busyId, setBusyId] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const params = {};
            if (statusFilter !== 'all') params.status = statusFilter;
            if (compFilter) params.competitionId = compFilter;
            if (query.trim()) params.search = query.trim();
            const data = await fetchFestOrganizerProbables(festId, params);
            setRows(data.probables || []);
            setCompetitions(data.competitions || []);
            setCounts(data.counts || { probable: 0, converted: 0, dropped: 0, total: 0 });
        } catch (e) {
            setError(e.message || 'Failed to load');
        } finally {
            setLoading(false);
        }
    }, [festId, statusFilter, compFilter, query]);

    useEffect(() => {
        load();
    }, [load]);

    useEffect(() => {
        if (prefillComp) {
            setCompFilter(prefillComp);
            setForm((f) => ({ ...f, competitionId: prefillComp }));
        }
    }, [prefillComp]);

    const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

    const addProbable = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await createFestOrganizerProbable(festId, {
                name: form.name.trim(),
                phone: form.phone.trim(),
                competitionId: form.competitionId,
                note: form.note.trim(),
            });
            toast('Probable added');
            setForm({
                ...emptyForm,
                competitionId: form.competitionId || prefillComp || '',
            });
            setStatusFilter('probable');
            await load();
        } catch (err) {
            toast(err.message || 'Failed to add');
        } finally {
            setSaving(false);
        }
    };

    const convert = async (row) => {
        const ok = await confirm({
            title: 'Convert to entry?',
            message: `${row.name} will become an approved registration for ${row.competitionName || 'this competition'}.`,
        });
        if (!ok) return;
        setBusyId(`convert-${row.id}`);
        try {
            const res = await convertFestOrganizerProbable(festId, row.id, {
                paymentStatus: 'pending',
            });
            toast(res.message || 'Converted');
            await load();
        } catch (err) {
            toast(err.message || 'Convert failed');
        } finally {
            setBusyId('');
        }
    };

    const markContacted = async (row) => {
        setBusyId(`contact-${row.id}`);
        try {
            await updateFestOrganizerProbable(festId, row.id, { contacted: !row.contacted });
            await load();
        } catch (err) {
            toast(err.message || 'Failed');
        } finally {
            setBusyId('');
        }
    };

    const remove = async (row) => {
        const ok = await confirm({
            title: 'Delete probable?',
            message: `${row.name} will be removed from the list.`,
        });
        if (!ok) return;
        setBusyId(`del-${row.id}`);
        try {
            await deleteFestOrganizerProbable(festId, row.id);
            toast('Deleted');
            await load();
        } catch (err) {
            toast(err.message || 'Failed');
        } finally {
            setBusyId('');
        }
    };

    const filteredHint = useMemo(() => {
        if (statusFilter === 'probable') return 'People interested — not entries yet. Convert when they confirm.';
        if (statusFilter === 'converted') return 'Already turned into competition registrations.';
        if (statusFilter === 'dropped') return 'Marked as not interested.';
        return 'All probables for this fest.';
    }, [statusFilter]);

    return (
        <div className="max-w-2xl mx-auto space-y-4 pb-10">
            <div className="flex items-start gap-3">
                <button
                    type="button"
                    onClick={() => navigate(`/fest-organizer/fests/${festId}/competitions`)}
                    className="p-2 rounded-xl text-gray-400 hover:bg-white/5 shrink-0"
                    aria-label="Back"
                >
                    <ArrowLeft size={18} />
                </button>
                <div className="min-w-0 flex-1">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-[#0ECCEE] font-semibold">Competition hub</p>
                    <h1 className="text-xl font-bold text-white mt-0.5">Competition probables</h1>
                    <p className="text-xs text-gray-500 mt-1">
                        Capture interested names &amp; phones → WhatsApp / call → convert to real entries
                    </p>
                </div>
                <button type="button" onClick={load} className="p-2 rounded-xl text-gray-400 hover:bg-white/5">
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
                {[
                    { id: 'probable', label: 'Probables', value: counts.probable, tone: 'border-amber-400/30 bg-amber-500/10 text-amber-200' },
                    { id: 'converted', label: 'Converted', value: counts.converted, tone: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200' },
                    { id: 'all', label: 'Total', value: counts.total, tone: 'border-[#0ECCEE]/30 bg-[#0ECCEE]/10 text-[#0ECCEE]' },
                ].map((b) => (
                    <button
                        key={b.id}
                        type="button"
                        onClick={() => setStatusFilter(b.id === 'all' ? 'all' : b.id)}
                        className={`rounded-2xl border p-3 text-center transition ${b.tone} ${
                            statusFilter === b.id || (b.id === 'all' && statusFilter === 'all') ? 'ring-1 ring-white/20' : ''
                        }`}
                    >
                        <p className="text-xl font-bold tabular-nums text-white">{b.value}</p>
                        <p className="text-[10px] uppercase tracking-wide text-gray-500 mt-1">{b.label}</p>
                    </button>
                ))}
            </div>

            {/* Add form */}
            <section className="rounded-2xl border border-[#0ECCEE]/25 bg-linear-to-br from-[#0ECCEE]/10 to-[#161718] p-4 space-y-3">
                <div className="flex items-center gap-2">
                    <UserPlus size={16} className="text-[#0ECCEE]" />
                    <h2 className="text-sm font-semibold text-white">Add probable</h2>
                </div>
                <form onSubmit={addProbable} className="space-y-2.5">
                    <select
                        required
                        value={form.competitionId}
                        onChange={(e) => set('competitionId', e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl bg-[#121314] border border-white/10 text-sm text-white"
                    >
                        <option value="">Select competition interested in</option>
                        {competitions.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <input
                            required
                            value={form.name}
                            onChange={(e) => set('name', e.target.value)}
                            placeholder="Name *"
                            className="w-full px-3 py-2.5 rounded-xl bg-[#121314] border border-white/10 text-sm text-white placeholder:text-gray-600"
                        />
                        <input
                            required
                            value={form.phone}
                            onChange={(e) => set('phone', e.target.value)}
                            placeholder="Phone *"
                            inputMode="tel"
                            className="w-full px-3 py-2.5 rounded-xl bg-[#121314] border border-white/10 text-sm text-white placeholder:text-gray-600"
                        />
                    </div>
                    <input
                        value={form.note}
                        onChange={(e) => set('note', e.target.value)}
                        placeholder="Note (optional)"
                        className="w-full px-3 py-2.5 rounded-xl bg-[#121314] border border-white/10 text-sm text-white placeholder:text-gray-600"
                    />
                    <button
                        type="submit"
                        disabled={saving || !competitions.length}
                        className="w-full py-2.5 rounded-xl bg-[#0ECCEE] text-black text-sm font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-2"
                    >
                        {saving ? <Loader className="animate-spin" size={16} /> : <Plus size={16} />}
                        Add to probables
                    </button>
                </form>
            </section>

            <div className="flex flex-wrap gap-2">
                <select
                    value={compFilter}
                    onChange={(e) => {
                        setCompFilter(e.target.value);
                        const next = new URLSearchParams(searchParams);
                        if (e.target.value) next.set('competitionId', e.target.value);
                        else next.delete('competitionId');
                        setSearchParams(next, { replace: true });
                    }}
                    className="flex-1 min-w-[10rem] px-3 py-2 rounded-xl bg-[#161718] border border-white/10 text-sm text-white"
                >
                    <option value="">All competitions</option>
                    {competitions.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>
                <div className="relative flex-[2] min-w-[12rem]">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search name / phone"
                        className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#161718] border border-white/10 text-sm text-white placeholder:text-gray-600"
                    />
                </div>
            </div>

            <p className="text-xs text-gray-500 px-0.5">{filteredHint}</p>

            {error ? <p className="text-sm text-red-400">{error}</p> : null}

            {loading && !rows.length ? (
                <div className="flex justify-center py-16 text-gray-400 gap-2">
                    <Loader className="animate-spin" size={18} /> Loading…
                </div>
            ) : (
                <div className="space-y-2.5">
                    {rows.map((row) => {
                        const wa = waLink(row.phone, row.competitionName);
                        const tel = telLink(row.phone);
                        return (
                            <div
                                key={row.id}
                                className={`rounded-2xl border p-3.5 space-y-2.5 ${
                                    row.status === 'converted'
                                        ? 'border-emerald-400/25 bg-emerald-500/5'
                                        : 'border-white/10 bg-[#161718]'
                                }`}
                            >
                                <div className="flex items-start gap-3">
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[11px] font-semibold text-[#0ECCEE] truncate">
                                            {row.competitionName || 'Competition'}
                                        </p>
                                        <p className="text-[15px] font-semibold text-white truncate">{row.name}</p>
                                        <p className="text-xs text-gray-400 mt-0.5 tabular-nums">{row.phone}</p>
                                        {row.note ? (
                                            <p className="text-[11px] text-gray-600 mt-1">{row.note}</p>
                                        ) : null}
                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                                                row.status === 'converted'
                                                    ? 'bg-emerald-500/15 text-emerald-300'
                                                    : row.status === 'dropped'
                                                        ? 'bg-white/5 text-gray-500'
                                                        : 'bg-amber-500/15 text-amber-300'
                                            }`}
                                            >
                                                {row.status}
                                            </span>
                                            {row.contacted ? (
                                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-gray-400">contacted</span>
                                            ) : null}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        {wa ? (
                                            <a
                                                href={wa}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="p-2.5 rounded-xl bg-emerald-500/15 text-emerald-300"
                                                aria-label="WhatsApp"
                                            >
                                                <MessageCircle size={16} />
                                            </a>
                                        ) : null}
                                        {tel ? (
                                            <a href={tel} className="p-2.5 rounded-xl bg-white/5 text-gray-300" aria-label="Call">
                                                <Phone size={16} />
                                            </a>
                                        ) : null}
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    {row.status === 'probable' ? (
                                        <button
                                            type="button"
                                            disabled={Boolean(busyId)}
                                            onClick={() => convert(row)}
                                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#0ECCEE] text-black text-xs font-semibold disabled:opacity-50"
                                        >
                                            {busyId === `convert-${row.id}` ? <Loader className="animate-spin" size={12} /> : <ArrowRightLeft size={12} />}
                                            Convert to entry
                                        </button>
                                    ) : null}
                                    {row.status === 'converted' && row.convertedRegistrationId ? (
                                        <Link
                                            to={`/fest-organizer/fests/${festId}/competitions/${row.competitionId}`}
                                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-emerald-400/30 text-emerald-300 text-xs"
                                        >
                                            Open competition desk
                                        </Link>
                                    ) : null}
                                    <button
                                        type="button"
                                        disabled={Boolean(busyId)}
                                        onClick={() => markContacted(row)}
                                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/10 text-gray-300 text-xs"
                                    >
                                        <Check size={12} />
                                        {row.contacted ? 'Unmark contacted' : 'Mark contacted'}
                                    </button>
                                    <button
                                        type="button"
                                        disabled={Boolean(busyId)}
                                        onClick={() => remove(row)}
                                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/10 text-gray-500 text-xs"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}

                    {!rows.length ? (
                        <div className="rounded-2xl border border-dashed border-white/10 py-14 text-center px-4">
                            <UserPlus className="mx-auto text-gray-600 mb-2" size={28} />
                            <p className="text-sm text-gray-500">No probables yet — add names from the form above</p>
                        </div>
                    ) : null}
                </div>
            )}
        </div>
    );
}
