import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Users, UserCheck, Clock, IndianRupee, Loader, Bell, QrCode,
    Copy, ExternalLink, RefreshCw, Download,
} from 'lucide-react';
import {
    fetchTrekOrganizerDashboard,
    updateTrekOrganizerRegistration,
    exportTrekOrganizerParticipants,
} from '../../services/api/trekOrganizer.api';
import { trekPath } from '../../utils/slugRoutes';
import TrekOrganizerRegistrationPanel from './TrekOrganizerRegistrationPanel';

function formatTrekDate(d) {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
}

function StatTile({ label, value, tone = 'default', onClick, to }) {
    const navigate = useNavigate();
    const tones = {
        default: 'border-gray-800 bg-[#161718]',
        accent: 'border-[#0ECCEE]/25 bg-[#0ECCEE]/5',
        women: 'border-pink-500/20 bg-pink-500/5',
        men: 'border-sky-500/20 bg-sky-500/5',
        ok: 'border-emerald-500/20 bg-emerald-500/5',
        warn: 'border-amber-500/20 bg-amber-500/5',
    };
    const className = `rounded-2xl border p-4 min-h-[88px] text-left transition-colors ${tones[tone] || tones.default} ${
        onClick || to ? 'hover:border-[#0ECCEE]/40 active:scale-[0.99]' : ''
    }`;
    const inner = (
        <>
            <p className="text-[11px] uppercase tracking-wide text-gray-500">{label}</p>
            <p className="text-2xl font-bold mt-1.5 tabular-nums text-white">{value}</p>
        </>
    );
    if (to) {
        return (
            <button type="button" onClick={() => navigate(to)} className={className}>
                {inner}
            </button>
        );
    }
    if (onClick) {
        return <button type="button" onClick={onClick} className={className}>{inner}</button>;
    }
    return <div className={className}>{inner}</div>;
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
    const [exporting, setExporting] = useState(false);

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
        return (
            <div className="flex justify-center py-20">
                <Loader className="animate-spin text-[#0ECCEE]" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center py-16 space-y-3 max-w-md mx-auto">
                <p className="text-red-400 text-sm">{error}</p>
                <button
                    type="button"
                    onClick={() => load()}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-700 text-sm text-[#0ECCEE]"
                >
                    <RefreshCw size={14} /> Retry
                </button>
            </div>
        );
    }

    if (!data) return null;

    const { trek, stats, genderRegistration } = data;
    const total = stats.totalRegistrations ?? 0;
    const male = stats.maleCount ?? 0;
    const female = stats.femaleCount ?? 0;
    const others = Math.max(0, total - male - female);
    const checkedIn = stats.checkedIn ?? 0;
    const pending = stats.pendingCheckIn ?? Math.max(0, total - checkedIn);
    const revenue = Number(stats.organizerRevenue ?? stats.revenue ?? 0);
    const checkInPct = total > 0 ? Math.round((checkedIn / total) * 100) : 0;
    const regStatus = trek.registrationStatus || 'open';
    const isOpen = regStatus === 'open';

    const womenPct = total > 0 ? Math.round((female / total) * 100) : 0;
    const menPct = total > 0 ? Math.round((male / total) * 100) : 0;

    const copyLink = async () => {
        try {
            await navigator.clipboard.writeText(publicUrl);
            setCopyNotice('Link copied');
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
                trek: { ...prev.trek, ...res.trek },
                genderRegistration: res.genderRegistration ?? prev.genderRegistration,
            }));
            setActionNotice(next === 'open' ? 'Registration opened' : 'Registration closed');
        } catch (e) {
            setActionNotice(e.message || 'Could not update registration');
        } finally {
            setActionBusy(false);
        }
    };

    const handleExport = async () => {
        setExporting(true);
        try {
            const blob = await exportTrekOrganizerParticipants(trekId);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${(trek.trekName || 'trek').replace(/[^a-z0-9-_]+/gi, '_')}_participants.csv`;
            a.click();
            URL.revokeObjectURL(url);
            setActionNotice('CSV downloaded');
        } catch (e) {
            setActionNotice(e.message || 'Export failed');
        } finally {
            setExporting(false);
        }
    };

    return (
        <div className="space-y-5 max-w-3xl mx-auto">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <h1 className="text-2xl font-bold tracking-tight leading-tight">{trek.trekName}</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        {[trek.city, formatTrekDate(trek.trekDate)].filter(Boolean).join(' · ')}
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${
                            String(trek.status).toLowerCase() === 'published'
                                ? 'bg-emerald-500/15 text-emerald-400'
                                : 'bg-amber-500/15 text-amber-400'
                        }`}>
                            {trek.status || 'draft'}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            isOpen ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
                        }`}>
                            Reg {isOpen ? 'open' : 'closed'}
                        </span>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={() => load({ silent: true })}
                    disabled={refreshing}
                    className="shrink-0 p-2.5 min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl border border-gray-800 text-gray-400 hover:text-white hover:border-gray-600 disabled:opacity-50"
                    aria-label="Refresh"
                >
                    <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                </button>
            </div>

            {actionNotice ? (
                <p className="text-xs text-[#0ECCEE] -mt-2">{actionNotice}</p>
            ) : null}

            {/* Share */}
            {publicUrl ? (
                <div className="rounded-2xl border border-gray-800 bg-[#161718] p-4 space-y-3">
                    <div>
                        <p className="text-xs font-medium text-gray-400">Share with trekkers</p>
                        <p className="text-sm text-gray-300 break-all mt-1">{publicUrl}</p>
                        {copyNotice ? <p className="text-[11px] text-emerald-400 mt-1">{copyNotice}</p> : null}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            type="button"
                            onClick={copyLink}
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-3 min-h-[48px] rounded-xl border border-gray-700 text-sm font-medium hover:border-[#0ECCEE]/50"
                        >
                            <Copy size={15} /> Copy link
                        </button>
                        <a
                            href={publicPath}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-3 min-h-[48px] rounded-xl border border-gray-700 text-sm font-medium hover:border-[#0ECCEE]/50"
                        >
                            <ExternalLink size={15} /> Open page
                        </a>
                    </div>
                </div>
            ) : null}

            {/* Core stats */}
            <div className="grid grid-cols-2 gap-3">
                <StatTile label="Total booked" value={total} tone="accent" to={`/trek-organizer/treks/${trekId}/participants`} />
                <StatTile
                    label="Collected"
                    value={`₹${revenue.toLocaleString('en-IN')}`}
                />
                <StatTile
                    label="Women"
                    value={female}
                    tone="women"
                    to={`/trek-organizer/treks/${trekId}/participants`}
                />
                <StatTile
                    label="Men"
                    value={male}
                    tone="men"
                    to={`/trek-organizer/treks/${trekId}/participants`}
                />
                <StatTile
                    label="Checked in"
                    value={checkedIn}
                    tone="ok"
                    to={`/trek-organizer/treks/${trekId}/scan`}
                />
                <StatTile
                    label="Pending check-in"
                    value={pending}
                    tone="warn"
                    to={`/trek-organizer/treks/${trekId}/participants`}
                />
            </div>

            {/* Check-in progress */}
            <div className="rounded-2xl border border-gray-800 bg-[#161718] p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <UserCheck size={16} className="text-emerald-400" />
                        <p className="text-sm font-semibold">Check-in progress</p>
                    </div>
                    <p className="text-sm font-bold tabular-nums text-emerald-400">{checkInPct}%</p>
                </div>
                <div className="h-2.5 rounded-full bg-[#111213] overflow-hidden">
                    <div
                        className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                        style={{ width: `${checkInPct}%` }}
                    />
                </div>
                <p className="text-xs text-gray-500">
                    {checkedIn} of {total} checked in
                    {pending > 0 ? ` · ${pending} still waiting` : total > 0 ? ' · all done' : ''}
                </p>
                {total > 0 ? (
                    <div className="pt-1">
                        <div className="flex h-2 rounded-full overflow-hidden bg-[#111213]">
                            {female > 0 ? (
                                <div className="bg-pink-400/80" style={{ width: `${womenPct}%` }} title={`Women ${female}`} />
                            ) : null}
                            {male > 0 ? (
                                <div className="bg-sky-400/80" style={{ width: `${menPct}%` }} title={`Men ${male}`} />
                            ) : null}
                            {others > 0 ? (
                                <div className="bg-gray-500" style={{ width: `${100 - womenPct - menPct}%` }} title={`Others ${others}`} />
                            ) : null}
                        </div>
                        <div className="flex flex-wrap gap-3 mt-2 text-[11px] text-gray-500">
                            <span className="inline-flex items-center gap-1.5">
                                <span className="size-2 rounded-full bg-pink-400" /> Women {female}
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                                <span className="size-2 rounded-full bg-sky-400" /> Men {male}
                            </span>
                            {others > 0 ? (
                                <span className="inline-flex items-center gap-1.5">
                                    <span className="size-2 rounded-full bg-gray-500" /> Others {others}
                                </span>
                            ) : null}
                        </div>
                    </div>
                ) : null}
            </div>

            {/* Registration controls */}
            <div className="rounded-2xl border border-gray-800 bg-[#161718] p-4 space-y-4">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <p className="text-sm font-semibold">Registration</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                            {isOpen ? 'People can book this trek right now.' : 'Booking is paused for new registrations.'}
                        </p>
                    </div>
                    <button
                        type="button"
                        disabled={actionBusy}
                        onClick={toggleRegistration}
                        className={`shrink-0 px-4 py-2.5 min-h-[44px] rounded-xl text-xs font-bold border disabled:opacity-50 ${
                            isOpen
                                ? 'border-red-500/40 text-red-300 hover:bg-red-500/10'
                                : 'border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10'
                        }`}
                    >
                        {actionBusy ? '…' : isOpen ? 'Close booking' : 'Open booking'}
                    </button>
                </div>

                <TrekOrganizerRegistrationPanel
                    trekId={trekId}
                    trek={trek}
                    genderRegistration={genderRegistration}
                    embedded
                    onUpdated={(res) => setData((prev) => ({
                        ...prev,
                        ...res,
                        trek: { ...prev.trek, ...res.trek },
                        genderRegistration: res.genderRegistration,
                    }))}
                />
            </div>

            {/* Quick actions */}
            <div>
                <p className="text-xs uppercase tracking-wide text-gray-500 mb-2 px-0.5">Quick actions</p>
                <div className="grid grid-cols-2 gap-3">
                    <button
                        type="button"
                        onClick={() => navigate(`/trek-organizer/treks/${trekId}/participants`)}
                        className="rounded-2xl border border-gray-800 bg-[#161718] p-4 min-h-[88px] text-left hover:border-[#0ECCEE]/40 active:scale-[0.99] transition-all"
                    >
                        <Users className="text-[#0ECCEE] mb-2" size={20} />
                        <p className="text-sm font-semibold">Participants</p>
                        <p className="text-[11px] text-gray-500 mt-0.5">List, filter, message</p>
                    </button>
                    <button
                        type="button"
                        onClick={() => navigate(`/trek-organizer/treks/${trekId}/scan`)}
                        className="rounded-2xl border border-gray-800 bg-[#161718] p-4 min-h-[88px] text-left hover:border-[#0ECCEE]/40 active:scale-[0.99] transition-all"
                    >
                        <QrCode className="text-[#0ECCEE] mb-2" size={20} />
                        <p className="text-sm font-semibold">Scan QR</p>
                        <p className="text-[11px] text-gray-500 mt-0.5">Check-in at gate</p>
                    </button>
                    <button
                        type="button"
                        onClick={() => navigate(`/trek-organizer/treks/${trekId}/notifications`)}
                        className="rounded-2xl border border-gray-800 bg-[#161718] p-4 min-h-[88px] text-left hover:border-[#0ECCEE]/40 active:scale-[0.99] transition-all"
                    >
                        <Bell className="text-[#0ECCEE] mb-2" size={20} />
                        <p className="text-sm font-semibold">Notify</p>
                        <p className="text-[11px] text-gray-500 mt-0.5">Remind or announce</p>
                    </button>
                    <button
                        type="button"
                        onClick={handleExport}
                        disabled={exporting}
                        className="rounded-2xl border border-gray-800 bg-[#161718] p-4 min-h-[88px] text-left hover:border-[#0ECCEE]/40 active:scale-[0.99] transition-all disabled:opacity-60"
                    >
                        {exporting ? (
                            <Loader className="animate-spin text-[#0ECCEE] mb-2" size={20} />
                        ) : (
                            <Download className="text-[#0ECCEE] mb-2" size={20} />
                        )}
                        <p className="text-sm font-semibold">Export CSV</p>
                        <p className="text-[11px] text-gray-500 mt-0.5">Download guest list</p>
                    </button>
                </div>
            </div>

            {pending > 0 ? (
                <button
                    type="button"
                    onClick={() => navigate(`/trek-organizer/treks/${trekId}/scan`)}
                    className="flex w-full items-center justify-between gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3.5 min-h-[52px]"
                >
                    <span className="inline-flex items-center gap-2 text-sm text-amber-100 font-medium">
                        <Clock size={16} />
                        {pending} still need check-in
                    </span>
                    <span className="text-xs text-amber-300 font-semibold shrink-0">Open scanner →</span>
                </button>
            ) : null}
        </div>
    );
}
