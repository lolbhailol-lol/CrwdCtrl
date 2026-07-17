import { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Users, UserCheck, Clock, IndianRupee, Calendar, Loader, Bell, Copy, ExternalLink, Hourglass, MapPin } from 'lucide-react';
import {
    fetchRunClubOrganizerDashboard,
    fetchRunClubOrganizerEvent,
    setRunClubOrganizerRegistrationStatus,
    expireRunClubOrganizerPendingPayments,
    updateRunClubOrganizerEvent,
    uploadRunClubOrganizerImage,
} from '../../services/api/runClubOrganizer.api';
import { sportRunPath } from '../../utils/slugRoutes';

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

const MODE_LABELS = {
    internal_form: 'In-app form (admin)',
    external_link: 'External link (admin)',
    organizer_qr: 'Form + UPI QR (admin)',
};

function RegistrationPricingPanel({ eventId, eventDetail, onSaved, busy, setBusy }) {
    const [fee, setFee] = useState('0');
    const [paymentQR, setPaymentQR] = useState('');
    const [paymentUpiId, setPaymentUpiId] = useState('');
    const [paymentQRMessage, setPaymentQRMessage] = useState('');
    const [notice, setNotice] = useState('');
    const [error, setError] = useState('');
    const [uploading, setUploading] = useState(false);

    const mode = eventDetail?.registration?.mode || 'internal_form';

    useEffect(() => {
        if (!eventDetail) return;
        setFee(String(Number(eventDetail.registrationFee) || 0));
        setPaymentQR(eventDetail.registration?.paymentQR || '');
        setPaymentUpiId(eventDetail.registration?.paymentUpiId || '');
        setPaymentQRMessage(eventDetail.registration?.paymentQRMessage || '');
        setNotice('');
        setError('');
    }, [eventDetail]);

    const feeNum = Math.max(0, Number(fee) || 0);
    const needsQr = mode === 'organizer_qr' && feeNum > 0;

    const save = async () => {
        setError('');
        setNotice('');
        if (needsQr && !String(paymentQR || '').trim()) {
            setError('Upload a payment QR when fee is greater than ₹0.');
            return;
        }
        setBusy(true);
        try {
            const payload = { registrationFee: feeNum };
            if (mode === 'organizer_qr') {
                payload.registration = {
                    paymentQR,
                    paymentUpiId: String(paymentUpiId || '').trim(),
                    paymentQRMessage: String(paymentQRMessage || '').trim(),
                    status: eventDetail?.registration?.status || 'open',
                    formInstructions: eventDetail?.registration?.formInstructions || '',
                    formSchema: eventDetail?.registration?.formSchema || [],
                    maxPeoplePerBooking: eventDetail?.registration?.maxPeoplePerBooking || 10,
                };
            }
            await updateRunClubOrganizerEvent(eventId, payload);
            setNotice('Registration fee saved');
            await onSaved?.();
        } catch (e) {
            setError(e.message || 'Failed to save fee');
        } finally {
            setBusy(false);
        }
    };

    const onQrFile = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        setUploading(true);
        setError('');
        try {
            const res = await uploadRunClubOrganizerImage(file);
            const url = res?.url || res?.secure_url || res?.imageUrl || '';
            if (!url) throw new Error('Upload failed');
            setPaymentQR(url);
        } catch (err) {
            setError(err.message || 'QR upload failed');
        } finally {
            setUploading(false);
        }
    };

    const inputClass = 'w-full rounded-lg border border-gray-700 bg-[#0E0E0F] px-3 py-2.5 text-sm text-white focus:border-[#0ECCEE] focus:outline-none';

    return (
        <div className="rounded-xl border border-gray-800 bg-[#161718] p-4 space-y-4">
            <div>
                <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                    <IndianRupee size={16} className="text-[#0ECCEE]" />
                    Registration fees
                </h2>
                <p className="text-[11px] text-gray-500 mt-1">
                    Set the fee for this run. Registration mode is set in the admin panel.
                </p>
            </div>

            <label className="block space-y-1.5">
                <span className="text-[11px] uppercase tracking-wide text-gray-500">Fee (₹)</span>
                <input
                    type="number"
                    min="0"
                    step="1"
                    value={fee}
                    onChange={(e) => setFee(e.target.value)}
                    className={inputClass}
                    disabled={busy}
                />
            </label>

            <p className="text-[11px] text-gray-500">
                Mode: <span className="text-gray-300">{MODE_LABELS[mode] || mode}</span>
            </p>

            {mode === 'organizer_qr' ? (
                <div className="space-y-3 border-t border-gray-800 pt-3">
                    <p className="text-[11px] text-gray-500">
                        {feeNum > 0
                            ? 'Runners fill the form, pay via your UPI QR, and upload a screenshot for you to approve.'
                            : 'Fee is ₹0 — registration confirms without a payment screenshot.'}
                    </p>
                    <label className="block space-y-1.5">
                        <span className="text-[11px] uppercase tracking-wide text-gray-500">
                            Payment QR {needsQr ? '(required)' : '(optional)'}
                        </span>
                        {paymentQR ? (
                            <div className="flex items-start gap-3">
                                <img src={paymentQR} alt="Payment QR" className="w-24 h-24 rounded-lg object-cover border border-gray-700" />
                                <button
                                    type="button"
                                    onClick={() => setPaymentQR('')}
                                    className="text-xs text-red-400 hover:underline"
                                    disabled={busy || uploading}
                                >
                                    Remove
                                </button>
                            </div>
                        ) : null}
                        <input
                            type="file"
                            accept="image/*"
                            onChange={onQrFile}
                            disabled={busy || uploading}
                            className="block w-full text-xs text-gray-400 file:mr-3 file:rounded-lg file:border-0 file:bg-[#0ECCEE] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-black"
                        />
                        {uploading ? <p className="text-[11px] text-gray-500">Uploading…</p> : null}
                    </label>
                    <label className="block space-y-1.5">
                        <span className="text-[11px] uppercase tracking-wide text-gray-500">UPI ID (optional)</span>
                        <input
                            type="text"
                            value={paymentUpiId}
                            onChange={(e) => setPaymentUpiId(e.target.value)}
                            placeholder="name@upi"
                            className={inputClass}
                            disabled={busy}
                        />
                    </label>
                    <label className="block space-y-1.5">
                        <span className="text-[11px] uppercase tracking-wide text-gray-500">Payment note (optional)</span>
                        <input
                            type="text"
                            value={paymentQRMessage}
                            onChange={(e) => setPaymentQRMessage(e.target.value)}
                            placeholder="Add run name in UPI remark"
                            className={inputClass}
                            disabled={busy}
                        />
                    </label>
                </div>
            ) : null}

            {error ? <p className="text-[11px] text-red-400">{error}</p> : null}
            {notice ? <p className="text-[11px] text-emerald-400">{notice}</p> : null}

            <button
                type="button"
                onClick={save}
                disabled={busy || uploading}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#0ECCEE] text-black text-sm font-bold disabled:opacity-50"
            >
                {busy ? 'Saving…' : 'Save fee'}
            </button>
        </div>
    );
}

function CapacityLocationPanel({ eventId, eventDetail, onSaved, busy, setBusy }) {
    const [maxParticipants, setMaxParticipants] = useState('');
    const [venue, setVenue] = useState('');
    const [routeMap, setRouteMap] = useState('');
    const [notice, setNotice] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (!eventDetail) return;
        setMaxParticipants(
            eventDetail.maxParticipants != null && eventDetail.maxParticipants !== ''
                ? String(eventDetail.maxParticipants)
                : '',
        );
        setVenue(eventDetail.venue || '');
        setRouteMap(eventDetail.routeMap || '');
        setNotice('');
        setError('');
    }, [eventDetail]);

    const save = async () => {
        setError('');
        setNotice('');
        const link = String(routeMap || '').trim();
        if (link && !/^https?:\/\//i.test(link)) {
            setError('Location link must start with https:// (Google Maps share link works best).');
            return;
        }
        setBusy(true);
        try {
            await updateRunClubOrganizerEvent(eventId, {
                maxParticipants: Math.max(0, Number(maxParticipants) || 0),
                venue: String(venue || '').trim(),
                routeMap: link,
            });
            setNotice('Capacity & location saved');
            await onSaved?.();
        } catch (e) {
            setError(e.message || 'Failed to save');
        } finally {
            setBusy(false);
        }
    };

    const inputClass = 'w-full rounded-lg border border-gray-700 bg-[#0E0E0F] px-3 py-2.5 text-sm text-white focus:border-[#0ECCEE] focus:outline-none';

    return (
        <div className="rounded-xl border border-gray-800 bg-[#161718] p-4 space-y-4">
            <div>
                <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                    <MapPin size={16} className="text-[#0ECCEE]" />
                    Capacity & location
                </h2>
                <p className="text-[11px] text-gray-500 mt-1">
                    Max people shows on the run page. Location label + maps link drive the location box runners see.
                </p>
            </div>

            <label className="block space-y-1.5">
                <span className="text-xs text-gray-400">Max people (0 = unlimited)</span>
                <input
                    type="number"
                    min="0"
                    value={maxParticipants}
                    onChange={(e) => setMaxParticipants(e.target.value)}
                    className={inputClass}
                    placeholder="e.g. 40"
                />
            </label>

            <label className="block space-y-1.5">
                <span className="text-xs text-gray-400">Location label</span>
                <input
                    type="text"
                    value={venue}
                    onChange={(e) => setVenue(e.target.value)}
                    className={inputClass}
                    placeholder="e.g. Cubbon Park — main gate"
                />
            </label>

            <label className="block space-y-1.5">
                <span className="text-xs text-gray-400">Location link (Google Maps)</span>
                <input
                    type="url"
                    value={routeMap}
                    onChange={(e) => setRouteMap(e.target.value)}
                    className={inputClass}
                    placeholder="https://maps.google.com/… or maps.app.goo.gl/…"
                />
                <span className="text-[10px] text-gray-600">
                    Paste the share link from Google Maps — same idea as Route Map in admin.
                </span>
            </label>

            {error ? <p className="text-[11px] text-red-400">{error}</p> : null}
            {notice ? <p className="text-[11px] text-emerald-400">{notice}</p> : null}

            <button
                type="button"
                onClick={save}
                disabled={busy}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#0ECCEE] text-black text-sm font-bold disabled:opacity-50"
            >
                {busy ? 'Saving…' : 'Save capacity & location'}
            </button>
        </div>
    );
}

export default function RunClubOrganizerDashboardPage() {
    const { eventId } = useParams();
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [eventDetail, setEventDetail] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [copyNotice, setCopyNotice] = useState('');
    const [actionBusy, setActionBusy] = useState(false);
    const [actionNotice, setActionNotice] = useState('');

    const load = useCallback(async ({ silent = false } = {}) => {
        if (!eventId) return;
        if (!silent) {
            setLoading(true);
            setError('');
        }
        try {
            const [dash, detail] = await Promise.all([
                fetchRunClubOrganizerDashboard(eventId),
                fetchRunClubOrganizerEvent(eventId).catch(() => null),
            ]);
            setData(dash);
            setEventDetail(detail?.event || null);
        } catch (e) {
            if (!silent) setError(e.message);
        } finally {
            if (!silent) setLoading(false);
        }
    }, [eventId]);

    useEffect(() => {
        if (!eventId) return;
        let cancelled = false;
        load();
        const poll = setInterval(() => {
            if (!cancelled) load({ silent: true });
        }, 45000);
        return () => {
            cancelled = true;
            clearInterval(poll);
        };
    }, [eventId, load]);

    const publicPath = useMemo(() => {
        const event = eventDetail || (data?.event ? { _id: data.event.id, title: data.event.title } : null);
        if (!event) return '';
        return sportRunPath(event);
    }, [eventDetail, data]);

    const publicUrl = useMemo(() => {
        if (!publicPath || typeof window === 'undefined') return publicPath;
        return `${window.location.origin}${publicPath}`;
    }, [publicPath]);

    if (loading) return <div className="flex justify-center py-20"><Loader className="animate-spin text-[#0ECCEE]" /></div>;
    if (error) return <div className="text-red-400 text-sm">{error}</div>;
    if (!data) return null;

    const { event, stats } = data;
    const status = eventDetail?.status || event.status;
    const fee = Number(eventDetail?.registrationFee || 0);
    const mode = eventDetail?.registration?.mode || 'internal_form';
    const regStatus = eventDetail?.registration?.status || event.registrationStatus || 'open';
    const ttlHours = stats.manualExpireTtlHours || 72;

    const toggleRegistration = async () => {
        const next = regStatus === 'open' ? 'closed' : 'open';
        setActionBusy(true);
        setActionNotice('');
        try {
            await setRunClubOrganizerRegistrationStatus(eventId, next);
            setActionNotice(next === 'open' ? 'Registration opened' : 'Registration closed');
            await load({ silent: true });
        } catch (e) {
            setActionNotice(e.message || 'Failed to update registration');
        } finally {
            setActionBusy(false);
        }
    };

    const expireStale = async () => {
        setActionBusy(true);
        setActionNotice('');
        try {
            const res = await expireRunClubOrganizerPendingPayments(eventId);
            setActionNotice(res.message || `Expired ${res.expired || 0}`);
            await load({ silent: true });
        } catch (e) {
            setActionNotice(e.message || 'Failed to expire pending payments');
        } finally {
            setActionBusy(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-2xl font-bold">{event.title}</h1>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium capitalize ${
                        status === 'published'
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : 'bg-amber-500/15 text-amber-400'
                    }`}>
                        {status || 'draft'}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-700/40 text-gray-300">
                        {fee > 0 ? (mode === 'organizer_qr' ? `QR · ₹${fee}` : `Paid · ₹${fee}`) : 'Free'}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        regStatus === 'open'
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : 'bg-red-500/15 text-red-400'
                    }`}>
                        Reg {regStatus}
                    </span>
                </div>
                <p className="text-sm text-gray-500">
                    {event.city || '—'}
                    {event.distance ? ` · ${event.distance}` : ''} · Manage registrations & check-in
                </p>
                {actionNotice ? <p className="text-[11px] text-[#0ECCEE] mt-1">{actionNotice}</p> : null}
            </div>

            {publicUrl && status === 'published' ? (
                <div className="rounded-xl border border-gray-800 bg-[#161718] p-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                        <p className="text-xs text-gray-500 mb-1">Share with runners</p>
                        <p className="text-sm text-gray-300 break-all">{publicUrl}</p>
                        {copyNotice ? <p className="text-[11px] text-emerald-400 mt-1">{copyNotice}</p> : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={async () => {
                                try {
                                    await navigator.clipboard.writeText(publicUrl);
                                    setCopyNotice('Copied');
                                    setTimeout(() => setCopyNotice(''), 2000);
                                } catch {
                                    setCopyNotice('Copy failed');
                                }
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-700 text-sm hover:border-[#0ECCEE]/50"
                        >
                            <Copy size={14} /> Copy
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                if (!publicUrl) return;
                                window.open(publicUrl, '_blank', 'noopener,noreferrer');
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-700 text-sm hover:border-[#0ECCEE]/50"
                        >
                            <ExternalLink size={14} /> Open
                        </button>
                    </div>
                </div>
            ) : null}

            <RegistrationPricingPanel
                eventId={eventId}
                eventDetail={eventDetail}
                onSaved={() => load({ silent: true })}
                busy={actionBusy}
                setBusy={setActionBusy}
            />

            <CapacityLocationPanel
                eventId={eventId}
                eventDetail={eventDetail}
                onSaved={() => load({ silent: true })}
                busy={actionBusy}
                setBusy={setActionBusy}
            />

            <div className="grid grid-cols-2 gap-3">
                <StatCard label="Confirmed" value={stats.totalRegistrations} icon={Users} accent="bg-blue-500/15 text-blue-400" />
                <StatCard label="Needs review" value={stats.pendingPaymentReview ?? 0} icon={Hourglass} accent="bg-amber-500/15 text-amber-400" hint="QR screenshots" />
                <StatCard
                    label="Seats left"
                    value={stats.seatsRemaining == null ? '—' : stats.seatsRemaining}
                    icon={Users}
                    accent="bg-cyan-500/15 text-cyan-400"
                    hint={stats.capacity ? `${stats.seatsFilled ?? 0} / ${stats.capacity} held` : 'No capacity limit'}
                />
                <StatCard label="Checked in" value={stats.checkedIn} icon={UserCheck} accent="bg-emerald-500/15 text-emerald-400" />
                <StatCard label="Pending check-in" value={stats.pendingCheckIn} icon={Clock} accent="bg-orange-500/15 text-orange-400" />
                <StatCard
                    label="Collected"
                    value={`₹${Number(stats.organizerRevenue ?? stats.revenue ?? 0).toLocaleString('en-IN')}`}
                    icon={IndianRupee}
                    accent="bg-purple-500/15 text-purple-400"
                />
                <StatCard
                    label="Pending ₹"
                    value={`₹${Number(stats.pendingAmountAtRisk ?? 0).toLocaleString('en-IN')}`}
                    icon={Hourglass}
                    accent="bg-amber-500/15 text-amber-400"
                    hint="Awaiting approval"
                />
                <StatCard label="Today" value={stats.todayRegistrations} icon={Calendar} accent="bg-pink-500/15 text-pink-400" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                    type="button"
                    onClick={() => navigate(`/run-club-organizer/events/${eventId}/participants`)}
                    className="px-4 py-3.5 min-h-[52px] inline-flex items-center justify-center rounded-xl bg-[#0ECCEE] text-black text-sm font-bold"
                >
                    View participants
                </button>
                {(stats.pendingPaymentReview ?? 0) > 0 ? (
                    <button
                        type="button"
                        onClick={() => navigate(`/run-club-organizer/events/${eventId}/participants?paymentStatus=pending_review`)}
                        className="px-4 py-3.5 min-h-[52px] inline-flex items-center justify-center rounded-xl border border-amber-500/40 text-amber-300 text-sm font-bold hover:bg-amber-500/10"
                    >
                        Review {stats.pendingPaymentReview} payment{stats.pendingPaymentReview === 1 ? '' : 's'}
                    </button>
                ) : null}
                <button
                    type="button"
                    disabled={actionBusy}
                    onClick={toggleRegistration}
                    className="px-4 py-3.5 min-h-[52px] inline-flex items-center justify-center rounded-xl border border-gray-700 text-sm font-medium hover:border-[#0ECCEE]/50 disabled:opacity-50"
                >
                    {regStatus === 'open' ? 'Close registration' : 'Open registration'}
                </button>
                {(stats.pendingPaymentReview ?? 0) > 0 ? (
                    <button
                        type="button"
                        disabled={actionBusy}
                        onClick={expireStale}
                        className="px-4 py-3.5 min-h-[52px] inline-flex items-center justify-center rounded-xl border border-amber-500/30 text-amber-200/90 text-sm font-medium hover:bg-amber-500/10 disabled:opacity-50"
                        title={`Manual only — cancels pending QR payments older than ${ttlHours}h. Payments never auto-expire.`}
                    >
                        Clear old pending ({ttlHours}h+)
                    </button>
                ) : null}
                <button
                    type="button"
                    onClick={() => navigate(`/run-club-organizer/events/${eventId}/scan`)}
                    className="px-4 py-3.5 min-h-[52px] inline-flex items-center justify-center rounded-xl border border-gray-700 text-sm font-medium hover:border-[#0ECCEE]/50"
                >
                    Open QR scanner
                </button>
                <button
                    type="button"
                    onClick={() => navigate(`/run-club-organizer/events/${eventId}/notifications`)}
                    className="px-4 py-3.5 min-h-[52px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-700 text-sm font-medium hover:border-[#0ECCEE]/50"
                >
                    <Bell size={16} /> Notify runners
                </button>
            </div>
        </div>
    );
}
