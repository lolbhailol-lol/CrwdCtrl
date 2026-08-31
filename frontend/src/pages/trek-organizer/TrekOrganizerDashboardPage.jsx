import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Users, UserCheck, Clock, IndianRupee,
    Copy, ExternalLink, RefreshCw, MapPin, QrCode,
} from 'lucide-react';
import {
    fetchTrekOrganizerDashboard,
    updateTrekOrganizerRegistration,
} from '../../services/api/trekOrganizer.api';
import { trekPath } from '../../utils/slugRoutes';
import { formatOrganizerTrekDate } from '../../utils/trekDateDisplay';
import TrekOrganizerRegistrationPanel from './TrekOrganizerRegistrationPanel';
import { InlinePageLoader } from '../../components/DetailPageLoader';
import { CapacityBar, ProgressBar, SectionCard, StatTile } from './OrganizerUi';
import { getCoverImageUrl } from '../../utils/coverImages';

function formatUpdatedAt(ts) {
    if (!ts) return '';
    try {
        return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
        return '';
    }
}

export default function TrekOrganizerDashboardPage() {
    const { trekId } = useParams();
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');
    const [copyNotice, setCopyNotice] = useState('');
    const [actionBusy, setActionBusy] = useState(false);
    const [actionNotice, setActionNotice] = useState('');
    const [lastUpdatedAt, setLastUpdatedAt] = useState(null);

    const load = useCallback(async ({ silent = false } = {}) => {
        if (!trekId) return;
        if (silent) setRefreshing(true);
        else {
            setLoading(true);
            setError('');
        }
        try {
            const res = await fetchTrekOrganizerDashboard(trekId);
            setData(res);
            setLastUpdatedAt(Date.now());
            if (!silent) setError('');
        } catch (e) {
            if (!silent) setError(e.message || 'Failed to load dashboard');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [trekId]);

    useEffect(() => {
        load();
        const poll = setInterval(() => load({ silent: true }), 60000);
        return () => clearInterval(poll);
    }, [load]);

    const publicPath = useMemo(() => {
        if (!data?.trek) return '';
        return trekPath({
            _id: data.trek.id || trekId,
            trekName: data.trek.trekName,
        });
    }, [data, trekId]);

    const publicUrl = useMemo(() => {
        if (!publicPath || typeof window === 'undefined') return publicPath;
        return `${window.location.origin}${publicPath}`;
    }, [publicPath]);

    if (loading) {
        return <InlinePageLoader label="Loading trek dashboard…" variant="trek" />;
    }

    if (error) {
        return (
            <div className="text-center py-16 space-y-4 max-w-md mx-auto">
                <p className="text-red-300 text-sm">{error}</p>
                <button
                    type="button"
                    onClick={() => load()}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm text-[#0ECCEE]"
                >
                    <RefreshCw size={14} /> Retry
                </button>
            </div>
        );
    }

    if (!data?.trek) return null;

    const trek = data.trek;
    const stats = data.stats || {};

    const total = Number(stats.totalRegistrations) || 0;
    const checkedIn = Number(stats.checkedIn) || 0;
    const pending = Number(stats.pendingCheckIn ?? Math.max(0, total - checkedIn)) || 0;
    const revenue = Number(stats.organizerRevenue ?? stats.revenue) || 0;
    const fees = Number(stats.platformFees) || 0;
    const gross = Number(stats.grossCollected) || 0;
    const today = Number(stats.todayRegistrations) || 0;
    const seatsFilled = Number(stats.seatsFilled ?? total) || 0;
    const capacity = Number(trek.capacity ?? stats.capacity) || 0;
    const seatsRemaining = stats.seatsRemaining != null
        ? Number(stats.seatsRemaining)
        : (capacity > 0 ? Math.max(0, capacity - seatsFilled) : null);
    const checkInPct = total > 0 ? Math.round((checkedIn / total) * 100) : 0;
    const isOrganizerQr = (trek.registrationMode || 'internal_form') === 'organizer_qr';
    const pendingReviewCount = Number(stats.pendingReview) || 0;
    const isOpen = (trek.registrationStatus || 'open') === 'open';
    const paymentLabel = String(stats.paymentGatewayLabel || '').trim();

    const batches = Array.isArray(trek.trekBatches) ? trek.trekBatches.filter((b) => b?.date) : [];
    const availableDates = Array.isArray(trek.availableDates) ? trek.availableDates.filter(Boolean) : [];
    const departureCount = Math.max(batches.length, availableDates.length);
    const dateLine = departureCount > 1
        ? `${departureCount} dates`
        : (trek.dateLabel || formatOrganizerTrekDate(trek) || '');

    const coverSrc = getCoverImageUrl(
        {
            coverImage: trek.coverImage,
            coverImages: trek.coverImages,
            image: Array.isArray(trek.images) ? trek.images[0] : null,
        },
        'hero',
    );

    const moneyHint = (() => {
        const bits = [];
        if (paymentLabel) bits.push(paymentLabel);
        if (gross > 0 && fees > 0) bits.push(`Guest paid ₹${gross.toLocaleString('en-IN')}`);
        if (fees > 0) bits.push(`Platform ₹${fees.toLocaleString('en-IN')}`);
        return bits.length ? bits.join(' · ') : undefined;
    })();

    const copyLink = async () => {
        if (!publicUrl) return;
        try {
            await navigator.clipboard.writeText(publicUrl);
            setCopyNotice('Copied');
            setTimeout(() => setCopyNotice(''), 2000);
        } catch {
            setCopyNotice('Copy failed');
            setTimeout(() => setCopyNotice(''), 2000);
        }
    };

    const toggleRegistration = async () => {
        const next = isOpen ? 'closed' : 'open';
        setActionBusy(true);
        setActionNotice('');
        try {
            const res = await updateTrekOrganizerRegistration(trekId, { registrationStatus: next });
            setData((prev) => ({
                ...prev,
                trek: { ...prev.trek, ...(res.trek || {}) },
                genderRegistration: res.genderRegistration ?? prev.genderRegistration,
            }));
            setActionNotice(next === 'open' ? 'Booking opened' : 'Booking closed');
            setTimeout(() => setActionNotice(''), 2500);
        } catch (e) {
            setActionNotice(e.message || 'Could not update booking');
        } finally {
            setActionBusy(false);
        }
    };

    return (
        <div className="space-y-4 max-w-3xl mx-auto w-full">
            {/* Hero */}
            <SectionCard className="overflow-hidden">
                <div className="relative h-36 sm:h-40">
                    {coverSrc ? (
                        <img src={coverSrc} alt="" className="absolute inset-0 size-full object-cover" />
                    ) : (
                        <div className="absolute inset-0 bg-linear-to-br from-[#053780] via-[#0ECCEE]/25 to-[#0c0d0e]" />
                    )}
                    <div className="absolute inset-0 bg-linear-to-t from-[#0c0d0e] via-[#0c0d0e]/65 to-black/15" />
                    <button
                        type="button"
                        onClick={() => load({ silent: true })}
                        disabled={refreshing}
                        className="absolute top-2.5 right-2.5 p-2 min-h-10 min-w-10 inline-flex items-center justify-center rounded-xl border border-white/15 bg-black/45 text-gray-200 disabled:opacity-50"
                        aria-label="Refresh"
                    >
                        <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
                    </button>
                    <div className="absolute inset-x-0 bottom-0 p-4 space-y-1.5">
                        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white leading-tight">
                            {trek.trekName}
                        </h1>
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-gray-300">
                            {trek.city ? (
                                <span className="inline-flex items-center gap-1">
                                    <MapPin size={12} className="text-[#0ECCEE]" /> {trek.city}
                                </span>
                            ) : null}
                            {dateLine ? <span>{dateLine}</span> : null}
                            {lastUpdatedAt ? (
                                <span className="text-gray-500 tabular-nums">· {formatUpdatedAt(lastUpdatedAt)}</span>
                            ) : null}
                        </div>
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                isOpen
                                    ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/30'
                                    : 'bg-red-500/20 text-red-200 border-red-400/30'
                            }`}>
                                {isOpen ? 'Booking open' : 'Booking closed'}
                            </span>
                            {today > 0 ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold border border-[#0ECCEE]/35 bg-[#0ECCEE]/15 text-[#0ECCEE]">
                                    +{today} today
                                </span>
                            ) : null}
                        </div>
                    </div>
                </div>
            </SectionCard>

            {actionNotice ? (
                <div className="rounded-xl border border-[#0ECCEE]/20 bg-[#0ECCEE]/10 px-3 py-2 text-xs text-[#9BE8F7]">
                    {actionNotice}
                </div>
            ) : null}

            {/* Share */}
            {publicUrl ? (
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={copyLink}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 min-h-11 rounded-xl border border-white/10 bg-white/5 text-sm font-medium hover:border-[#0ECCEE]/40"
                    >
                        <Copy size={14} /> {copyNotice || 'Copy link'}
                    </button>
                    <a
                        href={publicPath}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 min-h-11 rounded-xl bg-[#0ECCEE] text-black text-sm font-semibold"
                    >
                        <ExternalLink size={14} /> Open page
                    </a>
                </div>
            ) : null}

            {/* Core numbers — 4 tiles only */}
            <div className="grid grid-cols-2 gap-2.5">
                <StatTile
                    compact
                    label="Booked"
                    value={total}
                    tone="accent"
                    icon={Users}
                    to={`/trek-organizer/treks/${trekId}/participants`}
                    hint={today > 0 ? `+${today} today` : undefined}
                />
                <StatTile
                    compact
                    label="Your money"
                    value={`₹${revenue.toLocaleString('en-IN')}`}
                    tone="money"
                    icon={IndianRupee}
                    hint={moneyHint}
                    to={`/trek-organizer/treks/${trekId}/participants?paymentStatus=paid`}
                />
                <StatTile
                    compact
                    label="Checked in"
                    value={`${checkedIn}/${total}`}
                    tone="ok"
                    icon={UserCheck}
                    to={`/trek-organizer/treks/${trekId}/participants?checkInStatus=checked_in`}
                    hint={total > 0 ? `${checkInPct}%` : undefined}
                />
                {(isOrganizerQr || pendingReviewCount > 0) ? (
                    <StatTile
                        compact
                        label="Payment review"
                        value={pendingReviewCount}
                        tone="warn"
                        icon={Clock}
                        to={`/trek-organizer/treks/${trekId}/participants?paymentStatus=pending_review`}
                    />
                ) : (
                    <StatTile
                        compact
                        label="Need check-in"
                        value={pending}
                        tone="warn"
                        icon={QrCode}
                        to={`/trek-organizer/treks/${trekId}/participants?checkInStatus=pending`}
                    />
                )}
            </div>

            {/* Capacity */}
            <SectionCard className="p-4 space-y-4">
                <CapacityBar filled={seatsFilled} capacity={capacity} remaining={seatsRemaining} />
                <div className="border-t border-white/10 pt-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-white">Check-in</p>
                        <p className="text-sm tabular-nums text-emerald-300">{checkedIn}/{total}</p>
                    </div>
                    <ProgressBar pct={checkInPct} tone="emerald" />
                    {pending > 0 ? (
                        <button
                            type="button"
                            onClick={() => navigate(`/trek-organizer/treks/${trekId}/scan`)}
                            className="mt-1 w-full rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-100 font-medium"
                        >
                            Scan {pending} remaining →
                        </button>
                    ) : null}
                </div>
            </SectionCard>

            {/* Booking on/off */}
            <SectionCard className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                        <p className="text-sm font-semibold">Booking</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                            {isOpen ? 'Guests can register' : 'Registration paused'}
                        </p>
                    </div>
                    <button
                        type="button"
                        disabled={actionBusy}
                        onClick={toggleRegistration}
                        className={`shrink-0 px-3.5 py-2.5 min-h-11 rounded-xl text-xs font-bold border disabled:opacity-50 ${
                            isOpen
                                ? 'border-red-500/35 text-red-300 bg-red-500/5'
                                : 'border-emerald-500/35 text-emerald-300 bg-emerald-500/5'
                        }`}
                    >
                        {actionBusy ? '…' : isOpen ? 'Close' : 'Open'}
                    </button>
                </div>
                <TrekOrganizerRegistrationPanel
                    trekId={trekId}
                    trek={trek}
                    genderRegistration={data.genderRegistration}
                    embedded
                    onUpdated={(res) => setData((prev) => ({
                        ...prev,
                        ...res,
                        trek: { ...prev.trek, ...(res.trek || {}) },
                        genderRegistration: res.genderRegistration ?? prev.genderRegistration,
                    }))}
                />
            </SectionCard>
        </div>
    );
}
