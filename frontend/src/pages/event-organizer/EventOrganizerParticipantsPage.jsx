import { useCallback, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { ChevronRight, Download, Loader, Search, Trash2 } from 'lucide-react';
import {
    fetchEventOrganizerParticipants,
    updateEventOrganizerParticipantStatus,
    deleteEventOrganizerParticipant,
    downloadEventOrganizerExport,
} from '../../services/api/eventShowOrganizer.api';
import { useDialog } from '../../context/DialogContext';

/** Keys already shown in structured Drivers / summary — hide from raw dump */
const HIDDEN_RESPONSE_KEYS = new Set([
    'name', 'full_name', 'leader_name', 'email', 'phone', 'mobile', 'contact_no',
    'blood_group', 'vehicle_details', 'vehicle', 'driver_count', 'package_name',
    'registration_type', 'join_drive', 'join_independence_day_drive', 'independence_day_drive',
    'payment_screenshot_url', 'transaction_id', 'coupon_code',
]);

function isHiddenResponseKey(key) {
    const k = String(key || '');
    if (HIDDEN_RESPONSE_KEYS.has(k)) return true;
    if (/^driver_\d+_(name|email|phone|blood_group)$/i.test(k)) return true;
    if (/^section_driver_/i.test(k)) return true;
    return false;
}

function formatResponseLabel(key) {
    return String(key || '')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatResponseValue(value) {
    if (value == null || value === '') return '—';
    if (typeof value === 'object') {
        if (value.url) return value.url;
        return JSON.stringify(value);
    }
    return String(value);
}

function paymentTone(paymentStatus) {
    const s = String(paymentStatus || '').toLowerCase();
    if (s === 'paid') return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25';
    if (s === 'pending') return 'bg-amber-500/15 text-amber-300 border-amber-500/25';
    if (s === 'failed') return 'bg-red-500/15 text-red-300 border-red-500/25';
    return 'bg-gray-500/15 text-gray-300 border-gray-500/25';
}

function money(amount) {
    const n = Number(amount) || 0;
    return n > 0 ? `₹${n.toLocaleString('en-IN')}` : 'Free';
}

function DriversBlock({ drivers, title = 'Drivers' }) {
    const list = Array.isArray(drivers) ? drivers : [];
    if (!list.length) return null;
    return (
        <div className="sm:col-span-2 rounded-lg border border-gray-800 bg-[#161718] p-3 space-y-2">
            <p className="text-[11px] uppercase tracking-wide text-gray-500">
                {title} ({list.length})
            </p>
            <div className="space-y-2">
                {list.map((d) => (
                    <div
                        key={d.index || d.name || d.phone}
                        className="rounded-lg border border-gray-800/80 bg-[#111213] px-3 py-2"
                    >
                        <p className="text-xs font-semibold text-gray-100">
                            Driver {d.index || '—'}
                            {d.name ? ` · ${d.name}` : ''}
                        </p>
                        <p className="text-[11px] text-gray-400 mt-0.5 break-all">
                            {[d.phone, d.email, d.bloodGroup ? `Blood ${d.bloodGroup}` : '']
                                .filter(Boolean)
                                .join(' · ') || 'No contact details'}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function EventOrganizerParticipantsPage() {
    const { eventId } = useParams();
    const [searchParams, setSearchParams] = useSearchParams();
    const { toast, confirm } = useDialog();
    const [rows, setRows] = useState([]);
    const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [search, setSearch] = useState(searchParams.get('search') || '');
    const [expandedId, setExpandedId] = useState(null);
    const status = searchParams.get('status') || '';
    const paymentStatus = searchParams.get('paymentStatus') || '';
    const checkInStatus = searchParams.get('checkInStatus') || '';
    const category = searchParams.get('category') || '';
    const page = Number(searchParams.get('page') || 1);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const data = await fetchEventOrganizerParticipants(eventId, {
                page,
                limit: 25,
                search,
                status,
                paymentStatus,
                checkInStatus,
                category,
            });
            setRows(data.participants || []);
            setPagination(data.pagination || { page: 1, pages: 1, total: 0 });
        } catch (e) {
            toast(e.message || 'Failed to load guests');
        } finally {
            setLoading(false);
        }
    }, [eventId, page, search, status, paymentStatus, checkInStatus, category, toast]);

    useEffect(() => { load(); }, [load]);

    const setFilter = (key, value) => {
        const next = new URLSearchParams(searchParams);
        if (value) next.set(key, value);
        else next.delete(key);
        if (key !== 'page') next.delete('page');
        setSearchParams(next);
    };

    const onExport = async (format = 'xlsx') => {
        setExporting(true);
        try {
            await downloadEventOrganizerExport(eventId, { format });
            toast(format === 'csv' ? 'CSV downloaded' : 'Excel sheet downloaded');
        } catch (e) {
            toast(e.message || 'Export failed');
        } finally {
            setExporting(false);
        }
    };

    const onStatus = async (id, nextStatus, options = {}) => {
        try {
            await updateEventOrganizerParticipantStatus(eventId, id, nextStatus, options);
            toast(`Marked ${nextStatus}`);
            load();
        } catch (e) {
            toast(e.message || 'Update failed');
        }
    };

    const onDelete = async (id, name) => {
        const ok = await confirm(`Delete registration for ${name || 'this guest'}?`);
        if (!ok) return;
        try {
            await deleteEventOrganizerParticipant(eventId, id);
            toast('Deleted');
            load();
        } catch (e) {
            toast(e.message || 'Delete failed');
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold">Guests</h1>
                    <p className="text-sm text-gray-500">{pagination.total} guests</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={() => onExport('xlsx')}
                        disabled={exporting}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#0ECCEE] text-black text-sm font-bold disabled:opacity-60"
                    >
                        {exporting ? <Loader className="animate-spin" size={14} /> : <Download size={14} />}
                        Export Excel
                    </button>
                    <button
                        type="button"
                        onClick={() => onExport('csv')}
                        disabled={exporting}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-700 text-gray-300 text-sm font-medium disabled:opacity-60"
                    >
                        CSV
                    </button>
                </div>
            </div>

            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    setFilter('search', search.trim());
                }}
                className="flex gap-2"
            >
                <div className="relative flex-1">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search name, phone, email, package…"
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#161718] border border-gray-800 text-sm focus:outline-none focus:border-[#0ECCEE]/50"
                    />
                </div>
                <button type="submit" className="px-4 py-2.5 rounded-xl border border-gray-700 text-sm">Search</button>
            </form>

            <div className="flex flex-wrap gap-2">
                {[
                    { key: 'status', value: '', label: 'All' },
                    { key: 'status', value: 'approved', label: 'Approved' },
                    { key: 'status', value: 'pending', label: 'Pending' },
                    { key: 'category', value: 'independence_drive', label: 'Drive' },
                    { key: 'category', value: 'trackday', label: 'Trackday' },
                    { key: 'paymentStatus', value: 'paid', label: 'Paid' },
                    { key: 'paymentStatus', value: 'pending', label: 'Pay pending' },
                    { key: 'checkInStatus', value: 'checked_in', label: 'Checked in' },
                ].map((f) => {
                    const active = (searchParams.get(f.key) || '') === f.value;
                    return (
                        <button
                            key={`${f.key}-${f.value || 'all'}`}
                            type="button"
                            onClick={() => setFilter(f.key, f.value)}
                            className={`px-3 py-1.5 rounded-full text-xs border ${
                                active
                                    ? 'border-[#0ECCEE] bg-[#0ECCEE]/15 text-[#0ECCEE]'
                                    : 'border-gray-700 text-gray-400'
                            }`}
                        >
                            {f.label}
                        </button>
                    );
                })}
            </div>

            {loading ? (
                <div className="flex justify-center py-16"><Loader className="animate-spin text-[#0ECCEE]" /></div>
            ) : rows.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-700 p-8 text-center text-gray-500 text-sm">
                    No guests match these filters.
                </div>
            ) : (
                <div className="space-y-2">
                    {rows.map((p) => {
                        const open = expandedId === p.id;
                        const drivers = Array.isArray(p.drivers) ? p.drivers : [];
                        const driverCount = Number(p.driverCount) || drivers.length || 1;
                        const extras = Array.isArray(p.additionalEntries) ? p.additionalEntries : [];
                        const responseEntries = Object.entries(p.responses || {})
                            .filter(([k]) => !isHiddenResponseKey(k));

                        return (
                            <div key={p.id} className="rounded-xl border border-gray-800 bg-[#161718] p-4">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setExpandedId(open ? null : p.id)}
                                        className="min-w-0 text-left flex-1"
                                    >
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <ChevronRight
                                                size={14}
                                                className={`shrink-0 text-gray-500 transition-transform ${open ? 'rotate-90' : ''}`}
                                            />
                                            <p className="font-semibold truncate">{p.userName || 'Guest'}</p>
                                            {driverCount > 1 ? (
                                                <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold border border-white/10 bg-white/5 text-gray-300">
                                                    {driverCount} drivers
                                                </span>
                                            ) : null}
                                            {p.reRegistrationCount > 0 ? (
                                                <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold border border-[#0ECCEE]/35 bg-[#0ECCEE]/10 text-[#0ECCEE]">
                                                    +{p.reRegistrationCount} more package{p.reRegistrationCount > 1 ? 's' : ''}
                                                </span>
                                            ) : null}
                                        </div>
                                        <p className="text-xs text-gray-500 truncate pl-5">
                                            {[p.userPhone, p.userEmail].filter(Boolean).join(' · ') || 'No contact'}
                                        </p>
                                        <p className="text-xs text-gray-400 mt-1 pl-5">
                                            {[
                                                p.tierName || p.categoryLabel,
                                                p.categoryLabel && p.tierName ? p.categoryLabel : null,
                                                money(p.amountPaid),
                                                p.status,
                                                p.checkedIn ? 'checked in' : null,
                                            ]
                                                .filter(Boolean)
                                                .filter((v, i, arr) => arr.indexOf(v) === i)
                                                .join(' · ')}
                                        </p>
                                        <div className="pl-5 mt-2 flex flex-wrap items-center gap-1.5">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] border ${paymentTone(p.paymentStatus)}`}>
                                                {p.paymentStatus || 'free'}
                                            </span>
                                            {p.bloodGroup ? (
                                                <span className="px-2 py-0.5 rounded-full text-[10px] border border-white/10 text-gray-400">
                                                    Blood {p.bloodGroup}
                                                </span>
                                            ) : null}
                                        </div>
                                    </button>

                                    {p.paymentScreenshotUrl ? (
                                        <a
                                            href={p.paymentScreenshotUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="block shrink-0"
                                            title="View payment proof"
                                        >
                                            <img
                                                src={p.paymentScreenshotUrl}
                                                alt="payment proof"
                                                className="h-14 w-14 rounded-lg object-cover border border-gray-700"
                                            />
                                        </a>
                                    ) : (
                                        <div className="h-14 w-14 rounded-lg border border-dashed border-gray-700 text-[10px] text-gray-500 flex items-center justify-center shrink-0">
                                            No proof
                                        </div>
                                    )}

                                    <div className="flex flex-wrap gap-2">
                                        {p.status !== 'approved' ? (
                                            <button type="button" onClick={() => onStatus(p.id, 'approved')} className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 text-xs">Approve</button>
                                        ) : null}
                                        {p.status !== 'rejected' ? (
                                            <button type="button" onClick={() => onStatus(p.id, 'rejected')} className="px-2.5 py-1 rounded-lg bg-red-500/15 text-red-300 text-xs">Reject</button>
                                        ) : null}
                                        <button type="button" onClick={() => onDelete(p.id, p.userName)} className="px-2.5 py-1 rounded-lg border border-gray-700 text-gray-400 text-xs inline-flex items-center gap-1">
                                            <Trash2 size={12} /> Delete
                                        </button>
                                    </div>
                                </div>

                                {open ? (
                                    <div className="mt-3 ml-5 rounded-lg border border-gray-800 bg-[#111213] p-3 space-y-3">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                                            <div className="flex justify-between gap-2">
                                                <span className="text-gray-500">Type</span>
                                                <span className="text-gray-200 text-right">{p.categoryLabel || '—'}</span>
                                            </div>
                                            <div className="flex justify-between gap-2">
                                                <span className="text-gray-500">Package</span>
                                                <span className="text-gray-200 text-right">{p.tierName || '—'}</span>
                                            </div>
                                            <div className="flex justify-between gap-2">
                                                <span className="text-gray-500">Drive</span>
                                                <span className="text-gray-200 text-right">
                                                    {p.joinsIndependenceDrive ? 'Yes' : (p.joinDrive || 'No')}
                                                </span>
                                            </div>
                                            {p.vehicleDetails ? (
                                                <div className="flex justify-between gap-2">
                                                    <span className="text-gray-500">Vehicle</span>
                                                    <span className="text-gray-200 text-right">{p.vehicleDetails}</span>
                                                </div>
                                            ) : null}
                                            <div className="flex justify-between gap-2">
                                                <span className="text-gray-500">Paid</span>
                                                <span className="text-gray-200 text-right">{money(p.amountPaid)}</span>
                                            </div>
                                            {p.transactionId ? (
                                                <div className="flex justify-between gap-2 sm:col-span-2">
                                                    <span className="text-gray-500">Txn ID</span>
                                                    <span className="text-gray-200 text-right break-all">{p.transactionId}</span>
                                                </div>
                                            ) : null}

                                            <DriversBlock drivers={drivers} title="Drivers on this package" />

                                            {p.paymentScreenshotUrl ? (
                                                <div className="sm:col-span-2 rounded-lg border border-gray-800 bg-[#161718] p-2.5">
                                                    <p className="text-gray-500 mb-2 text-[11px]">Payment proof</p>
                                                    <a href={p.paymentScreenshotUrl} target="_blank" rel="noreferrer" className="block">
                                                        <img
                                                            src={p.paymentScreenshotUrl}
                                                            alt="payment screenshot"
                                                            className="max-h-52 w-full object-contain rounded-lg border border-gray-700 bg-black/20"
                                                        />
                                                    </a>
                                                </div>
                                            ) : null}
                                        </div>

                                        {extras.length > 0 ? (
                                            <div className="space-y-2">
                                                <p className="text-[11px] uppercase tracking-wide text-gray-500">
                                                    Extra packages (re-register) · {extras.length}
                                                </p>
                                                {extras.map((entry, idx) => (
                                                    <div
                                                        key={entry.id || idx}
                                                        className="rounded-lg border border-gray-800 bg-[#161718] p-3 space-y-2"
                                                    >
                                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                                            <p className="text-xs font-semibold text-gray-200">
                                                                #{idx + 2} · {entry.tierName || 'Package'}
                                                            </p>
                                                            <div className="flex flex-wrap items-center gap-1.5">
                                                                <span className={`px-2 py-0.5 rounded-full text-[10px] border ${paymentTone(entry.paymentStatus)}`}>
                                                                    {entry.paymentStatus || 'free'}
                                                                </span>
                                                                <span className="px-2 py-0.5 rounded-full text-[10px] border border-gray-600 text-gray-400">
                                                                    {money(entry.amountPaid)}
                                                                </span>
                                                                <span className="px-2 py-0.5 rounded-full text-[10px] border border-gray-600 text-gray-400">
                                                                    {entry.status || 'pending'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <DriversBlock
                                                            drivers={entry.drivers}
                                                            title={`Drivers · package #${idx + 2}`}
                                                        />
                                                        {entry.transactionId ? (
                                                            <p className="text-[11px] text-gray-500 break-all">
                                                                Txn: {entry.transactionId}
                                                            </p>
                                                        ) : null}
                                                        {entry.paymentScreenshotUrl ? (
                                                            <a href={entry.paymentScreenshotUrl} target="_blank" rel="noreferrer" className="block">
                                                                <img
                                                                    src={entry.paymentScreenshotUrl}
                                                                    alt={`payment proof ${idx + 2}`}
                                                                    className="max-h-40 w-full object-contain rounded-lg border border-gray-700 bg-black/20"
                                                                />
                                                            </a>
                                                        ) : null}
                                                        <div className="flex flex-wrap gap-2 pt-1">
                                                            {entry.status !== 'approved' ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => onStatus(p.id, 'approved', {
                                                                        entryId: entry.id,
                                                                        entryIndex: idx,
                                                                    })}
                                                                    className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 text-xs"
                                                                >
                                                                    Approve entry
                                                                </button>
                                                            ) : null}
                                                            {entry.status !== 'rejected' ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => onStatus(p.id, 'rejected', {
                                                                        entryId: entry.id,
                                                                        entryIndex: idx,
                                                                    })}
                                                                    className="px-2.5 py-1 rounded-lg bg-red-500/15 text-red-300 text-xs"
                                                                >
                                                                    Reject entry
                                                                </button>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : null}

                                        {responseEntries.length > 0 ? (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-xs pt-1 border-t border-gray-800">
                                                <p className="sm:col-span-2 text-[11px] uppercase tracking-wide text-gray-500 mt-2 mb-1">
                                                    Other answers
                                                </p>
                                                {responseEntries.map(([key, value]) => (
                                                    <div key={key} className="flex justify-between gap-2 sm:col-span-2">
                                                        <span className="text-gray-500 shrink-0">{formatResponseLabel(key)}</span>
                                                        <span className="text-gray-200 text-right break-all">{formatResponseValue(value)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : null}
                                    </div>
                                ) : null}
                            </div>
                        );
                    })}
                </div>
            )}

            {pagination.pages > 1 ? (
                <div className="flex items-center justify-center gap-2 pt-2">
                    <button
                        type="button"
                        disabled={page <= 1}
                        onClick={() => setFilter('page', String(page - 1))}
                        className="px-3 py-1.5 rounded-lg border border-gray-700 text-xs disabled:opacity-40"
                    >
                        Prev
                    </button>
                    <span className="text-xs text-gray-500">{page} / {pagination.pages}</span>
                    <button
                        type="button"
                        disabled={page >= pagination.pages}
                        onClick={() => setFilter('page', String(page + 1))}
                        className="px-3 py-1.5 rounded-lg border border-gray-700 text-xs disabled:opacity-40"
                    >
                        Next
                    </button>
                </div>
            ) : null}
        </div>
    );
}
