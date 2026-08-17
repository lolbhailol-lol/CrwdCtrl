import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Plus, Tag, Trash2, X } from 'lucide-react';
import {
    createFestOrganizerCoupon,
    deleteFestOrganizerCoupon,
    fetchFestOrganizerCoupons,
    updateFestOrganizerCoupon,
} from '../../services/api/festOrganizer.api';
import { useDialog } from '../../context/DialogContext';
import {
    resolveMindSparkModule,
    sortMindSparkModules,
} from '../../features/fests/mindspark';
import { InlinePageLoader } from '../../components/DetailPageLoader';

const EMPTY = {
    code: '',
    description: '',
    discountType: 'percent',
    discountPercent: 10,
    maxDiscountAmount: 0,
    flatDiscountAmount: 100,
    minAmount: 0,
    maxTotalUses: 0,
    maxUsesPerUser: 1,
    active: true,
    startsAt: '',
    expiresAt: '',
    allCompetitions: true,
    competitionIds: [],
};

function toIstDatetimeLocal(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).formatToParts(d);
    const get = (type) => parts.find((p) => p.type === type)?.value || '';
    return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

function statusBadge(coupon) {
    if (!coupon.active) return { label: 'Off', className: 'bg-white/10 text-gray-400' };
    if (coupon.isExpired) return { label: 'Expired', className: 'bg-red-900/40 text-red-300' };
    if (coupon.isNotStarted) return { label: 'Scheduled', className: 'bg-amber-900/40 text-amber-200' };
    return { label: 'Live', className: 'bg-emerald-900/40 text-emerald-300' };
}

function inputClass() {
    return 'w-full bg-[#121314] border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#0ECCEE]/50';
}

function couponToForm(coupon) {
    return {
        code: coupon.code || '',
        description: coupon.description || '',
        discountType: coupon.discountType === 'flat' ? 'flat' : 'percent',
        discountPercent: Number(coupon.discountPercent) || 10,
        maxDiscountAmount: Number(coupon.maxDiscountAmount) || 0,
        flatDiscountAmount: Number(coupon.flatDiscountAmount) || 100,
        minAmount: Number(coupon.minAmount) || 0,
        maxTotalUses: Number(coupon.maxTotalUses) || 0,
        maxUsesPerUser: Number(coupon.maxUsesPerUser) || 1,
        active: coupon.active !== false,
        startsAt: toIstDatetimeLocal(coupon.startsAt),
        expiresAt: toIstDatetimeLocal(coupon.expiresAt),
        allCompetitions: Boolean(coupon.allCompetitions),
        competitionIds: coupon.competitionIds || [],
    };
}

export default function FestOrganizerCouponsPage() {
    const { festId } = useParams();
    const { toast, confirm } = useDialog();
    const [coupons, setCoupons] = useState([]);
    const [competitions, setCompetitions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [form, setForm] = useState(EMPTY);
    const [editingId, setEditingId] = useState('');
    const [showForm, setShowForm] = useState(false);

    const load = async () => {
        setLoading(true);
        setError('');
        try {
            const data = await fetchFestOrganizerCoupons(festId);
            setCoupons(data.coupons || []);
            setCompetitions(data.competitions || []);
        } catch (e) {
            setError(e.message || 'Failed to load coupons');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, [festId]);

    const modules = useMemo(() => {
        const grouped = {};
        competitions.forEach((c) => {
            const mod = resolveMindSparkModule(c);
            if (!grouped[mod]) grouped[mod] = [];
            grouped[mod].push(c);
        });
        return sortMindSparkModules(Object.keys(grouped)).map((mod) => ({
            module: mod,
            comps: grouped[mod],
        }));
    }, [competitions]);

    const openCreate = () => {
        setEditingId('');
        setForm(EMPTY);
        setShowForm(true);
        setError('');
    };

    const openEdit = (coupon) => {
        setEditingId(coupon.id);
        setForm(couponToForm(coupon));
        setShowForm(true);
        setError('');
    };

    const toggleComp = (id) => {
        setForm((prev) => {
            const has = prev.competitionIds.includes(id);
            return {
                ...prev,
                allCompetitions: false,
                competitionIds: has
                    ? prev.competitionIds.filter((x) => x !== id)
                    : [...prev.competitionIds, id],
            };
        });
    };

    const onSubmit = async (e) => {
        e.preventDefault();
        setError('');
        const isFlat = form.discountType === 'flat';
        if (!form.code.trim()) {
            setError('Enter a coupon code.');
            return;
        }
        if (isFlat && Number(form.flatDiscountAmount) <= 0) {
            setError('Enter rupees off greater than 0.');
            return;
        }
        if (!isFlat && (Number(form.discountPercent) < 1 || Number(form.discountPercent) > 100)) {
            setError('Percent must be between 1 and 100.');
            return;
        }
        if (!form.allCompetitions && !form.competitionIds.length) {
            setError('Pick at least one competition, or choose all.');
            return;
        }

        const body = {
            code: form.code.trim().toUpperCase(),
            description: form.description.trim(),
            discountType: isFlat ? 'flat' : 'percent',
            discountPercent: isFlat ? 0 : Number(form.discountPercent),
            maxDiscountAmount: isFlat ? 0 : Number(form.maxDiscountAmount) || 0,
            flatDiscountAmount: isFlat ? Number(form.flatDiscountAmount) : 0,
            minAmount: Number(form.minAmount) || 0,
            maxTotalUses: Number(form.maxTotalUses) || 0,
            maxUsesPerUser: Number(form.maxUsesPerUser) || 1,
            active: Boolean(form.active),
            startsAt: form.startsAt || null,
            expiresAt: form.expiresAt || null,
            competitionIds: form.allCompetitions ? [] : form.competitionIds,
        };

        setSaving(true);
        try {
            if (editingId) {
                await updateFestOrganizerCoupon(festId, editingId, body);
                toast('Saved');
            } else {
                await createFestOrganizerCoupon(festId, body);
                toast('Coupon live');
            }
            setShowForm(false);
            setEditingId('');
            setForm(EMPTY);
            await load();
        } catch (err) {
            setError(err.message || 'Failed to save coupon');
        } finally {
            setSaving(false);
        }
    };

    const onDelete = async (coupon) => {
        const ok = await confirm({
            title: `Delete ${coupon.code}?`,
            message: 'This code can be created again after delete.',
            confirmText: 'Delete',
            tone: 'danger',
        });
        if (!ok) return;
        try {
            await deleteFestOrganizerCoupon(festId, coupon.id);
            toast('Deleted');
            if (editingId === coupon.id) {
                setShowForm(false);
                setEditingId('');
            }
            await load();
        } catch (err) {
            toast(err.message || 'Failed');
        }
    };

    if (loading) {
        return <InlinePageLoader label="Loading coupons…" variant="fest" />;
    }

    return (
        <div className="max-w-3xl mx-auto space-y-4">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-[10px] uppercase tracking-[0.14em] text-[#0ECCEE] font-semibold">Ops</p>
                    <h1 className="text-xl font-bold text-white mt-0.5">Coupons</h1>
                    <p className="text-xs text-gray-500 mt-1">
                        Percent or ₹ off, per competition. Live on the fest checkout as soon as you save.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={openCreate}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#0ECCEE] text-black text-xs font-semibold"
                >
                    <Plus size={14} /> New coupon
                </button>
            </div>

            {showForm ? (
                <form
                    onSubmit={onSubmit}
                    className="rounded-2xl border border-white/10 bg-[#161718] p-4 space-y-3"
                >
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-white">
                            {editingId ? 'Edit coupon' : 'New coupon'}
                        </p>
                        <button
                            type="button"
                            onClick={() => { setShowForm(false); setError(''); }}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-white"
                            aria-label="Close"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-3">
                        <label className="block">
                            <span className="text-[11px] text-gray-500">Code</span>
                            <input
                                className={`${inputClass()} mt-1 uppercase`}
                                value={form.code}
                                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                                placeholder="FLASH10"
                                required
                            />
                        </label>
                        <label className="block">
                            <span className="text-[11px] text-gray-500">Note (optional)</span>
                            <input
                                className={`${inputClass()} mt-1`}
                                value={form.description}
                                onChange={(e) => setForm({ ...form, description: e.target.value })}
                                placeholder="Early bird"
                            />
                        </label>
                    </div>

                    <div className="flex gap-2">
                        {['percent', 'flat'].map((type) => (
                            <button
                                key={type}
                                type="button"
                                onClick={() => setForm({ ...form, discountType: type })}
                                className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                                    form.discountType === type
                                        ? 'bg-[#0ECCEE] text-black'
                                        : 'bg-white/5 text-gray-400 border border-white/10'
                                }`}
                            >
                                {type === 'percent' ? 'Percent %' : 'Rupees ₹'}
                            </button>
                        ))}
                    </div>

                    {form.discountType === 'percent' ? (
                        <div className="grid grid-cols-2 gap-3">
                            <label className="block">
                                <span className="text-[11px] text-gray-500">Percent off</span>
                                <input
                                    type="number"
                                    min={1}
                                    max={100}
                                    className={`${inputClass()} mt-1`}
                                    value={form.discountPercent}
                                    onChange={(e) => setForm({ ...form, discountPercent: e.target.value })}
                                />
                            </label>
                            <label className="block">
                                <span className="text-[11px] text-gray-500">Max save ₹ (0 = no cap)</span>
                                <input
                                    type="number"
                                    min={0}
                                    className={`${inputClass()} mt-1`}
                                    value={form.maxDiscountAmount}
                                    onChange={(e) => setForm({ ...form, maxDiscountAmount: e.target.value })}
                                />
                            </label>
                        </div>
                    ) : (
                        <label className="block">
                            <span className="text-[11px] text-gray-500">Rupees off</span>
                            <input
                                type="number"
                                min={1}
                                className={`${inputClass()} mt-1`}
                                value={form.flatDiscountAmount}
                                onChange={(e) => setForm({ ...form, flatDiscountAmount: e.target.value })}
                            />
                        </label>
                    )}

                    <label className="block">
                        <span className="text-[11px] text-gray-500">Minimum payable ₹ (0 = none)</span>
                        <input
                            type="number"
                            min={0}
                            className={`${inputClass()} mt-1`}
                            value={form.minAmount}
                            onChange={(e) => setForm({ ...form, minAmount: e.target.value })}
                        />
                    </label>

                    <div className="grid sm:grid-cols-2 gap-3">
                        <label className="block">
                            <span className="text-[11px] text-gray-500">Starts (IST)</span>
                            <input
                                type="datetime-local"
                                className={`${inputClass()} mt-1`}
                                value={form.startsAt}
                                onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                            />
                        </label>
                        <label className="block">
                            <span className="text-[11px] text-gray-500">Expires (IST)</span>
                            <input
                                type="datetime-local"
                                className={`${inputClass()} mt-1`}
                                value={form.expiresAt}
                                onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                            />
                        </label>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <label className="block">
                            <span className="text-[11px] text-gray-500">Max total uses (0 = unlimited)</span>
                            <input
                                type="number"
                                min={0}
                                className={`${inputClass()} mt-1`}
                                value={form.maxTotalUses}
                                onChange={(e) => setForm({ ...form, maxTotalUses: e.target.value })}
                            />
                        </label>
                        <label className="block">
                            <span className="text-[11px] text-gray-500">Max per user</span>
                            <input
                                type="number"
                                min={1}
                                className={`${inputClass()} mt-1`}
                                value={form.maxUsesPerUser}
                                onChange={(e) => setForm({ ...form, maxUsesPerUser: e.target.value })}
                            />
                        </label>
                    </div>

                    <div>
                        <p className="text-[11px] text-gray-500 mb-2">Competitions</p>
                        <button
                            type="button"
                            onClick={() => setForm({ ...form, allCompetitions: true, competitionIds: [] })}
                            className={`mb-2 px-3 py-1.5 rounded-full text-xs font-semibold ${
                                form.allCompetitions
                                    ? 'bg-[#0ECCEE] text-black'
                                    : 'bg-white/5 text-gray-400 border border-white/10'
                            }`}
                        >
                            All competitions
                        </button>
                        <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                            {modules.map((group) => (
                                <div key={group.module}>
                                    <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">
                                        {group.module}
                                    </p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {group.comps.map((c) => {
                                            const on = !form.allCompetitions && form.competitionIds.includes(c.id);
                                            return (
                                                <button
                                                    key={c.id}
                                                    type="button"
                                                    onClick={() => toggleComp(c.id)}
                                                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${
                                                        on
                                                            ? 'bg-[#0ECCEE]/15 text-[#0ECCEE] border border-[#0ECCEE]/40'
                                                            : 'bg-white/5 text-gray-400 border border-white/10'
                                                    }`}
                                                >
                                                    {c.name}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <label className="flex items-center gap-2 text-sm text-gray-300">
                        <input
                            type="checkbox"
                            checked={form.active}
                            onChange={(e) => setForm({ ...form, active: e.target.checked })}
                        />
                        Active (usable on checkout)
                    </label>

                    {error ? <p className="text-sm text-red-400">{error}</p> : null}

                    <button
                        type="submit"
                        disabled={saving}
                        className="w-full py-2.5 rounded-xl bg-[#0ECCEE] text-black text-sm font-semibold disabled:opacity-50"
                    >
                        {saving ? 'Saving…' : editingId ? 'Save coupon' : 'Create coupon'}
                    </button>
                </form>
            ) : null}

            <div className="space-y-2">
                {coupons.length ? coupons.map((c) => {
                    const badge = statusBadge(c);
                    return (
                        <div
                            key={c.id}
                            className="rounded-2xl border border-white/10 bg-[#161718] p-3.5"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <button
                                    type="button"
                                    onClick={() => openEdit(c)}
                                    className="min-w-0 text-left flex-1"
                                >
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <p className="text-sm font-semibold text-white">{c.code}</p>
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${badge.className}`}>
                                            {badge.label}
                                        </span>
                                    </div>
                                    <p className="text-xs text-[#0ECCEE] mt-1">{c.discountLabel}</p>
                                    <p className="text-[11px] text-gray-500 mt-1">
                                        {c.allCompetitions
                                            ? 'All competitions'
                                            : (c.competitionNames || []).join(', ') || 'Selected competitions'}
                                        {c.minAmount > 0 ? ` · min ₹${c.minAmount}` : ''}
                                        {c.maxTotalUses > 0
                                            ? ` · ${c.usedCount || 0}/${c.maxTotalUses} uses`
                                            : ` · ${c.usedCount || 0} uses`}
                                    </p>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onDelete(c)}
                                    className="p-2 rounded-lg text-gray-500 hover:text-red-400"
                                    aria-label={`Delete ${c.code}`}
                                >
                                    <Trash2 size={15} />
                                </button>
                            </div>
                        </div>
                    );
                }) : (
                    <div className="rounded-2xl border border-white/10 bg-[#161718] p-8 text-center">
                        <Tag className="mx-auto text-gray-600 mb-2" size={22} />
                        <p className="text-sm text-gray-400">No coupons yet</p>
                        <p className="text-xs text-gray-600 mt-1">Create one for FLASH, Robowars, or all comps.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
