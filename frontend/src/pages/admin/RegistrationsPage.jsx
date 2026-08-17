import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    AlertCircle, Calendar, Flag, Footprints, Loader2,
    Mail, Mountain, Phone, Search, Theater, User,
} from 'lucide-react';
import { adminFetchJSON } from '../../services/api/admin.api.js';
import { primaryCoverUrl } from '../../utils/coverImages';
import { normalizeImageUrl } from '../../utils/uploadUrls';
import { InlinePageLoader } from '../../components/DetailPageLoader';

const TABS = [
    { id: 'fests', label: 'Fests', icon: Flag },
    { id: 'treks', label: 'Treks', icon: Mountain },
    { id: 'runs', label: 'Runs', icon: Footprints },
    { id: 'events', label: 'Events', icon: Theater },
];

const EVENT_MODE_LABEL = {
    internal_form: { label: 'Internal form', cls: 'bg-emerald-500/15 text-emerald-400' },
    organizer_qr: { label: 'QR payment', cls: 'bg-amber-500/15 text-amber-400' },
    external_link: { label: 'External link', cls: 'bg-sky-500/15 text-sky-400' },
};

const FEST_MODE_LABEL = {
    INTERNAL_FORM: { label: 'Internal form', cls: 'bg-emerald-500/15 text-emerald-400' },
    EXTERNAL_LINK: { label: 'External link', cls: 'bg-sky-500/15 text-sky-400' },
    CLOSED: { label: 'Closed', cls: 'bg-red-500/15 text-red-400' },
    NOT_STARTED: { label: 'Not started', cls: 'bg-white/8 text-gray-500' },
};

function formatDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

function normalizeResponses(responses) {
    if (!responses) return [];
    const entries = responses instanceof Map
        ? [...responses.entries()]
        : Object.entries(typeof responses === 'object' ? responses : {});
    return entries.filter(([, v]) => v !== null && v !== undefined && v !== '');
}

function ResponseValue({ value }) {
    const isFile = value && typeof value === 'object' && value.uploaded;
    if (isFile) {
        const link = value.cloudinaryLink || (value.driveLink?.startsWith('https://') ? value.driveLink : null);
        if (link) {
            return (
                <a href={link} target="_blank" rel="noopener noreferrer" className="text-[#0ECCEE] hover:underline">
                    View file
                </a>
            );
        }
        return <span className="text-emerald-400">File uploaded</span>;
    }
    if (Array.isArray(value)) return value.join(', ');
    return String(value ?? '—');
}

function RegistrationCard({
    name, email, phone, status, statusOptions, onStatusChange,
    paymentStatus, amountPaid, paymentId, responses, extraRows, submittedAt,
}) {
    return (
        <div className="rounded-xl border border-white/8 bg-[#121316] p-4">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-[#0ECCEE]/15 flex items-center justify-center shrink-0">
                        <User size={18} className="text-[#0ECCEE]" />
                    </div>
                    <div className="min-w-0">
                        <p className="font-semibold text-white truncate">{name || 'Unknown'}</p>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5 text-xs text-gray-500">
                            {email && (
                                <span className="flex items-center gap-1 truncate">
                                    <Mail size={11} />{email}
                                </span>
                            )}
                            {phone && (
                                <span className="flex items-center gap-1">
                                    <Phone size={11} />{phone}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap shrink-0">
                    {paymentStatus === 'paid' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400"
                            title={paymentId ? `Payment: ${paymentId}` : undefined}>
                            Paid ₹{amountPaid ?? 0}
                        </span>
                    )}
                    {paymentStatus === 'free' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/8 text-gray-500">Free</span>
                    )}
                    <select
                        value={status}
                        onChange={(e) => onStatusChange(e.target.value)}
                        className="text-xs px-2.5 py-1.5 bg-[#0D0E10] border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#0ECCEE]/50 capitalize"
                    >
                        {statusOptions.map((opt) => (
                            <option key={opt} value={opt} className="bg-[#0D0E10] capitalize">{opt}</option>
                        ))}
                    </select>
                </div>
            </div>

            {extraRows?.length > 0 && (
                <div className="mt-3 pt-3 border-t border-white/6 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {extraRows.map(({ label, value }) => (
                        <div key={label} className="flex gap-2">
                            <span className="text-gray-500 shrink-0">{label}:</span>
                            <span className="text-gray-300">{value}</span>
                        </div>
                    ))}
                </div>
            )}

            {normalizeResponses(responses).length > 0 && (
                <div className="mt-3 pt-3 border-t border-white/6">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-600 mb-2">Form responses</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        {normalizeResponses(responses).map(([key, value]) => (
                            <div key={key} className="flex gap-2">
                                <span className="text-gray-500 capitalize shrink-0 w-1/3">{key.replace(/_/g, ' ')}</span>
                                <span className="text-gray-300 w-2/3 wrap-break-word"><ResponseValue value={value} /></span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {submittedAt && (
                <p className="text-[10px] text-gray-600 mt-3">Submitted {formatDate(submittedAt)}</p>
            )}
        </div>
    );
}

function EventPickerCard({ active, onClick, image, fallbackIcon, title, subtitle, badge }) {
    const FallbackIcon = fallbackIcon;
    return (
        <button
            type="button"
            onClick={onClick}
            className={`w-full text-left flex items-center gap-3 p-2.5 rounded-xl border transition-colors ${
                active
                    ? 'border-[#0ECCEE]/40 bg-[#0ECCEE]/8'
                    : 'border-transparent hover:bg-white/3'
            }`}
        >
            <div className="w-11 h-11 rounded-lg overflow-hidden shrink-0 bg-[#1A1B1D] flex items-center justify-center">
                {image ? (
                    <img src={image} alt="" className="w-full h-full object-cover" />
                ) : (
                    <FallbackIcon size={18} className="text-gray-600" />
                )}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{title}</p>
                {subtitle && <p className="text-[11px] text-gray-500 truncate">{subtitle}</p>}
                {badge && (
                    <span className={`inline-block mt-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${badge.cls}`}>
                        {badge.label}
                    </span>
                )}
            </div>
        </button>
    );
}

export default function RegistrationsPage() {
    const [tab, setTab] = useState('fests');
    const [loading, setLoading] = useState(true);
    const [regsLoading, setRegsLoading] = useState(false);
    const [error, setError] = useState('');

    const [fests, setFests] = useState([]);
    const [treks, setTreks] = useState([]);
    const [runs, setRuns] = useState([]);
    const [events, setEvents] = useState([]);

    const [selectedId, setSelectedId] = useState(null);
    const [registrations, setRegistrations] = useState([]);
    const [eventSearch, setEventSearch] = useState('');
    const [userSearch, setUserSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    const fetchLists = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const [festData, trekData, sportData, eventData] = await Promise.all([
                adminFetchJSON('/admin/fests?limit=500'),
                adminFetchJSON('/admin/treks?limit=500'),
                adminFetchJSON('/admin/sports?limit=500'),
                adminFetchJSON('/admin/events?limit=500'),
            ]);
            setFests(festData.fests || []);
            setTreks(trekData.treks || []);
            setRuns((sportData.events || []).filter((e) => e.runClubId));
            setEvents(eventData.shows || []);
        } catch (err) {
            setError(err.message || 'Failed to load events');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchLists(); }, [fetchLists]);

    const currentList = tab === 'fests'
        ? fests
        : tab === 'treks'
            ? treks
            : tab === 'events'
                ? events
                : runs;

    const tabCounts = {
        fests: fests.length,
        treks: treks.length,
        runs: runs.length,
        events: events.length,
    };

    const filteredEvents = useMemo(() => {
        const q = eventSearch.trim().toLowerCase();
        if (!q) return currentList;
        return currentList.filter((item) => {
            if (tab === 'fests') {
                return [item.festName, item.collegeName].some((v) => String(v || '').toLowerCase().includes(q));
            }
            if (tab === 'treks') {
                return [item.trekName, item.city, item.destination].some((v) => String(v || '').toLowerCase().includes(q));
            }
            if (tab === 'events') {
                return [item.title, item.displayName, item.venue, item.city, item.organizer].some((v) => String(v || '').toLowerCase().includes(q));
            }
            return [item.title, item.city, item.runCategory].some((v) => String(v || '').toLowerCase().includes(q));
        });
    }, [currentList, eventSearch, tab]);

    const selectedItem = useMemo(
        () => currentList.find((item) => (item._id || item.id) === selectedId) || null,
        [currentList, selectedId],
    );

    const fetchRegistrations = useCallback(async (type, id) => {
        if (!id) return;
        setRegsLoading(true);
        setError('');
        try {
            if (type === 'fests') {
                const data = await adminFetchJSON(`/registrations/admin/fests/${id}/registrations?limit=500`);
                setRegistrations((data.registrations || []).map((r) => ({ ...r, _kind: 'fest' })));
            } else if (type === 'treks') {
                const data = await adminFetchJSON(`/admin/treks/${id}/bookings`);
                setRegistrations((data.bookings || []).map((b) => ({ ...b, _kind: 'trek' })));
            } else if (type === 'events') {
                const data = await adminFetchJSON(`/admin/events/${id}/registrations?limit=500`);
                setRegistrations((data.registrations || []).map((r) => ({ ...r, _kind: 'event' })));
            } else {
                const data = await adminFetchJSON(`/category-registrations/admin/all?category=sports&eventId=${id}&limit=500`);
                setRegistrations((data.registrations || []).map((r) => ({ ...r, _kind: 'run' })));
            }
        } catch (err) {
            setError(err.message || 'Failed to load registrations');
            setRegistrations([]);
        } finally {
            setRegsLoading(false);
        }
    }, []);

    const handleTabChange = (nextTab) => {
        setTab(nextTab);
        setSelectedId(null);
        setRegistrations([]);
        setEventSearch('');
        setUserSearch('');
        setStatusFilter('all');
    };

    const handleSelectEvent = (item) => {
        const id = item._id || item.id;
        setSelectedId(id);
        setUserSearch('');
        setStatusFilter('all');
        if (tab === 'fests' && item.registration?.mode !== 'INTERNAL_FORM') {
            setRegistrations([]);
            return;
        }
        if (tab === 'events' && item.registration?.mode === 'external_link') {
            setRegistrations([]);
            return;
        }
        fetchRegistrations(tab, id);
    };

    const updateStatus = async (regId, status, kind) => {
        try {
            if (kind === 'fest') {
                await adminFetchJSON(`/registrations/admin/registrations/${regId}/status`, {
                    method: 'PUT',
                    body: JSON.stringify({ status }),
                });
            } else if (kind === 'trek') {
                await adminFetchJSON(`/admin/treks/bookings/${regId}/status`, {
                    method: 'PUT',
                    body: JSON.stringify({ status }),
                });
            } else if (kind === 'event') {
                await adminFetchJSON(`/admin/events/registrations/${regId}/status`, {
                    method: 'PUT',
                    body: JSON.stringify({ status }),
                });
            } else {
                await adminFetchJSON(`/category-registrations/admin/${regId}/status`, {
                    method: 'PUT',
                    body: JSON.stringify({ status }),
                });
            }
            if (selectedId) fetchRegistrations(tab, selectedId);
        } catch (err) {
            setError(err.message || 'Failed to update status');
        }
    };

    const filteredRegistrations = useMemo(() => {
        const q = userSearch.trim().toLowerCase();
        return registrations.filter((reg) => {
            const name = reg.user?.name || reg.userId?.name || reg.userName || '';
            const email = reg.user?.email || reg.userId?.email || reg.userEmail || '';
            const matchesSearch = !q || name.toLowerCase().includes(q) || email.toLowerCase().includes(q);
            const matchesStatus = statusFilter === 'all' || reg.status === statusFilter;
            return matchesSearch && matchesStatus;
        });
    }, [registrations, userSearch, statusFilter]);

    const statusOptions = tab === 'fests' || tab === 'events'
        ? ['pending', 'approved', 'rejected']
        : tab === 'treks'
            ? ['confirmed', 'cancelled']
            : ['pending', 'confirmed', 'cancelled'];

    const panelTitle = selectedItem
        ? (tab === 'fests'
            ? selectedItem.festName
            : tab === 'treks'
                ? selectedItem.trekName
                : selectedItem.title || selectedItem.displayName)
        : null;

    const festUsesExternal = tab === 'fests' && selectedItem && selectedItem.registration?.mode !== 'INTERNAL_FORM';
    const eventUsesExternal = tab === 'events' && selectedItem && selectedItem.registration?.mode === 'external_link';

    const selectLabel = tab === 'fests'
        ? 'fest'
        : tab === 'treks'
            ? 'trek'
            : tab === 'events'
                ? 'event'
                : 'run';

    return (
        <div className="max-w-6xl mx-auto space-y-5">
            <div>
                <h1 className="text-2xl font-bold text-white">Registrations</h1>
                <p className="text-sm text-gray-500 mt-0.5">View sign-ups for fests, treks, runs, and events</p>
            </div>

            {error && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-300">
                    <AlertCircle size={16} className="shrink-0" />
                    <span className="flex-1">{error}</span>
                    <button type="button" onClick={() => setError('')} className="text-xs underline shrink-0">Dismiss</button>
                </div>
            )}

            <div className="flex gap-1 bg-[#17181A] p-1 rounded-xl border border-white/8 w-fit">
                {TABS.map((t) => (
                    <button
                        key={t.id}
                        type="button"
                        onClick={() => handleTabChange(t.id)}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                            tab === t.id ? 'bg-[#0ECCEE] text-black' : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                    >
                        <t.icon size={14} />
                        {t.label}
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                            tab === t.id ? 'bg-black/20 text-black' : 'bg-white/8 text-gray-500'
                        }`}>
                            {tabCounts[t.id]}
                        </span>
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Event picker */}
                <div className="rounded-2xl border border-white/8 bg-[#17181A] overflow-hidden">
                    <div className="px-4 py-3 border-b border-white/6">
                        <h2 className="text-sm font-bold text-white">
                            Select {selectLabel}
                        </h2>
                        <div className="relative mt-2">
                            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
                            <input
                                type="text"
                                value={eventSearch}
                                onChange={(e) => setEventSearch(e.target.value)}
                                placeholder={`Search ${tab}…`}
                                className="w-full h-9 pl-9 pr-3 text-sm bg-[#0D0E10] border border-white/8 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-[#0ECCEE]/40"
                            />
                        </div>
                    </div>
                    <div className="max-h-[520px] overflow-y-auto p-2">
                        {loading ? (
                            <InlinePageLoader label="Loading…" minHeight={false} />
                        ) : filteredEvents.length === 0 ? (
                            <p className="text-center py-12 text-sm text-gray-600">No {tab} found</p>
                        ) : (
                            filteredEvents.map((item) => {
                                const id = item._id || item.id;
                                if (tab === 'fests') {
                                    const mode = item.registration?.mode || 'NOT_STARTED';
                                    const modeInfo = FEST_MODE_LABEL[mode] || FEST_MODE_LABEL.NOT_STARTED;
                                    return (
                                        <EventPickerCard
                                            key={id}
                                            active={selectedId === id}
                                            onClick={() => handleSelectEvent(item)}
                                            image={normalizeImageUrl(item.coverImage)}
                                            fallbackIcon={Flag}
                                            title={item.festName}
                                            subtitle={item.collegeName}
                                            badge={modeInfo}
                                        />
                                    );
                                }
                                if (tab === 'treks') {
                                    return (
                                        <EventPickerCard
                                            key={id}
                                            active={selectedId === id}
                                            onClick={() => handleSelectEvent(item)}
                                            image={normalizeImageUrl(item.coverImage || item.images?.[0])}
                                            fallbackIcon={Mountain}
                                            title={item.trekName}
                                            subtitle={[item.city, item.difficultyLevel].filter(Boolean).join(' · ')}
                                            badge={{
                                                label: item.registrationFee > 0 ? `₹${item.registrationFee}` : 'Free',
                                                cls: item.registrationFee > 0 ? 'bg-[#0ECCEE]/15 text-[#0ECCEE]' : 'bg-emerald-500/15 text-emerald-400',
                                            }}
                                        />
                                    );
                                }
                                if (tab === 'events') {
                                    const mode = item.registration?.mode || 'external_link';
                                    const modeInfo = EVENT_MODE_LABEL[mode] || EVENT_MODE_LABEL.external_link;
                                    return (
                                        <EventPickerCard
                                            key={id}
                                            active={selectedId === id}
                                            onClick={() => handleSelectEvent(item)}
                                            image={normalizeImageUrl(primaryCoverUrl(item.coverImages, item.poster))}
                                            fallbackIcon={Theater}
                                            title={item.displayName || item.title}
                                            subtitle={[item.venue, item.city].filter(Boolean).join(' · ')}
                                            badge={modeInfo}
                                        />
                                    );
                                }
                                return (
                                    <EventPickerCard
                                        key={id}
                                        active={selectedId === id}
                                        onClick={() => handleSelectEvent(item)}
                                        image={normalizeImageUrl(item.images?.[0] || item.coverImage)}
                                        fallbackIcon={Footprints}
                                        title={item.title}
                                        subtitle={[item.runCategory, item.city].filter(Boolean).join(' · ')}
                                        badge={{
                                            label: item.registrationFee > 0 ? `₹${item.registrationFee}` : 'Free',
                                            cls: item.registrationFee > 0 ? 'bg-[#0ECCEE]/15 text-[#0ECCEE]' : 'bg-emerald-500/15 text-emerald-400',
                                        }}
                                    />
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Registrations panel */}
                <div className="lg:col-span-2 rounded-2xl border border-white/8 bg-[#17181A] overflow-hidden flex flex-col min-h-[420px]">
                    {!selectedItem ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-gray-600 p-8">
                            <Calendar size={40} className="mb-3 opacity-40" />
                            <p className="text-sm">Select a {selectLabel} to view registrations</p>
                        </div>
                    ) : festUsesExternal ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-gray-500 p-8 text-center">
                            <Flag size={40} className="mb-3 opacity-40" />
                            <p className="text-sm font-medium text-gray-300">{panelTitle}</p>
                            <p className="text-xs mt-1 max-w-sm">
                                {selectedItem.registration?.mode === 'EXTERNAL_LINK'
                                    ? 'This fest uses an external registration link — sign-ups are not stored here.'
                                    : 'Registration is not enabled for this fest yet.'}
                            </p>
                            {selectedItem.registration?.externalLink && (
                                <a
                                    href={selectedItem.registration.externalLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-3 text-sm text-[#0ECCEE] hover:underline"
                                >
                                    Open external form
                                </a>
                            )}
                        </div>
                    ) : eventUsesExternal ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-gray-500 p-8 text-center">
                            <Theater size={40} className="mb-3 opacity-40" />
                            <p className="text-sm font-medium text-gray-300">{panelTitle}</p>
                            <p className="text-xs mt-1 max-w-sm">
                                This event uses an external registration link — sign-ups are not stored here.
                            </p>
                            {(selectedItem.registrationLink || selectedItem.registration?.externalLink) && (
                                <a
                                    href={selectedItem.registrationLink || selectedItem.registration?.externalLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-3 text-sm text-[#0ECCEE] hover:underline"
                                >
                                    Open external form
                                </a>
                            )}
                        </div>
                    ) : (
                        <>
                            <div className="px-4 py-3 border-b border-white/6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                <div>
                                    <h2 className="text-sm font-bold text-white">{panelTitle}</h2>
                                    <p className="text-[11px] text-gray-500">{filteredRegistrations.length} registration{filteredRegistrations.length !== 1 ? 's' : ''}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="relative">
                                        <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-600" />
                                        <input
                                            type="text"
                                            value={userSearch}
                                            onChange={(e) => setUserSearch(e.target.value)}
                                            placeholder="Search name or email"
                                            className="h-8 pl-8 pr-3 text-xs bg-[#0D0E10] border border-white/8 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-[#0ECCEE]/40 w-44"
                                        />
                                    </div>
                                    <select
                                        value={statusFilter}
                                        onChange={(e) => setStatusFilter(e.target.value)}
                                        className="h-8 px-2 text-xs bg-[#0D0E10] border border-white/8 rounded-lg text-white focus:outline-none focus:border-[#0ECCEE]/40 capitalize"
                                    >
                                        <option value="all" className="bg-[#0D0E10]">All status</option>
                                        {statusOptions.map((s) => (
                                            <option key={s} value={s} className="bg-[#0D0E10] capitalize">{s}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[520px]">
                                {regsLoading ? (
                                    <InlinePageLoader label="Loading registrations…" minHeight={false} />
                                ) : filteredRegistrations.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-16 text-gray-600">
                                        <User size={36} className="mb-2 opacity-40" />
                                        <p className="text-sm">No registrations yet</p>
                                    </div>
                                ) : (
                                    filteredRegistrations.map((reg) => {
                                        if (reg._kind === 'fest') {
                                            return (
                                                <RegistrationCard
                                                    key={reg._id}
                                                    name={reg.user?.name}
                                                    email={reg.user?.email}
                                                    phone={reg.user?.phone}
                                                    status={reg.status}
                                                    statusOptions={statusOptions}
                                                    onStatusChange={(s) => updateStatus(reg._id, s, 'fest')}
                                                    paymentStatus={reg.paymentStatus}
                                                    amountPaid={reg.amountPaid}
                                                    paymentId={reg.payment_id || reg.payment_order_id}
                                                    responses={reg.responses}
                                                    submittedAt={reg.submittedAt || reg.createdAt}
                                                />
                                            );
                                        }
                                        if (reg._kind === 'trek') {
                                            const bd = reg.bookingDetails || {};
                                            return (
                                                <RegistrationCard
                                                    key={reg._id}
                                                    name={reg.userId?.name || reg.userName}
                                                    email={reg.userId?.email || reg.userEmail}
                                                    phone={reg.userId?.phone}
                                                    status={reg.status}
                                                    statusOptions={statusOptions}
                                                    onStatusChange={(s) => updateStatus(reg._id, s, 'trek')}
                                                    paymentStatus={bd.amountPaid > 0 ? 'paid' : 'free'}
                                                    amountPaid={bd.amountPaid}
                                                    paymentId={bd.paymentId}
                                                    responses={reg.formData}
                                                    extraRows={[
                                                        ...(bd.date ? [{ label: 'Date', value: bd.date }] : []),
                                                        ...(bd.time ? [{ label: 'Time', value: bd.time }] : []),
                                                        ...(bd.people ? [{ label: 'People', value: String(bd.people) }] : []),
                                                    ]}
                                                    submittedAt={reg.createdAt}
                                                />
                                            );
                                        }
                                        if (reg._kind === 'event') {
                                            return (
                                                <RegistrationCard
                                                    key={reg._id}
                                                    name={reg.user?.name}
                                                    email={reg.user?.email}
                                                    phone={reg.user?.phone}
                                                    status={reg.status}
                                                    statusOptions={statusOptions}
                                                    onStatusChange={(s) => updateStatus(reg._id, s, 'event')}
                                                    paymentStatus={reg.paymentStatus}
                                                    amountPaid={reg.amountPaid}
                                                    paymentId={reg.payment_id || reg.payment_order_id}
                                                    responses={reg.responses}
                                                    extraRows={[
                                                        ...(reg.tierName ? [{ label: 'Package', value: reg.tierName }] : []),
                                                        ...(reg.reRegistrationCount > 0
                                                            ? [{ label: 'Re-registrations', value: String(reg.reRegistrationCount) }]
                                                            : []),
                                                    ]}
                                                    submittedAt={reg.submittedAt || reg.createdAt}
                                                />
                                            );
                                        }
                                        return (
                                            <RegistrationCard
                                                key={reg._id}
                                                name={reg.user?.name}
                                                email={reg.user?.email}
                                                phone={reg.user?.phone}
                                                status={reg.status}
                                                statusOptions={statusOptions}
                                                onStatusChange={(s) => updateStatus(reg._id, s, 'run')}
                                                paymentStatus={reg.paymentStatus}
                                                amountPaid={reg.amountPaid}
                                                paymentId={reg.payment_id}
                                                responses={reg.responses}
                                                submittedAt={reg.submittedAt || reg.createdAt}
                                            />
                                        );
                                    })
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
