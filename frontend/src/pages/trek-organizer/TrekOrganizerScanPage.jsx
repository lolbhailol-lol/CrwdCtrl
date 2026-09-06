import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { UserCheck, RefreshCw } from 'lucide-react';
import CheckinScannerPage from '../../components/admin/CheckinScannerPage';
import OrganizerGateCheckinPanel from '../../components/organizer/OrganizerGateCheckinPanel';
import { getApiBaseUrl } from '../../config/apiBase';
import { getTrekOrganizerToken } from '../../utils/trekOrganizerSession';
import {
    lookupTrekOrganizerParticipant,
    trekOrganizerCheckin,
    fetchTrekOrganizerCheckinStats,
    fetchTrekOrganizerParticipants,
} from '../../services/api/trekOrganizer.api';
import { useDialog } from '../../context/DialogContext';
import { ProgressBar, SectionCard } from './OrganizerUi';

function cleanPhone(phone) {
    if (!phone || phone === '—') return '';
    return String(phone);
}

function normalizeTrekRow(p) {
    if (!p) return null;
    return {
        id: String(p.bookingId),
        name: p.participantName || 'Participant',
        phone: cleanPhone(p.phone),
        email: p.userEmail || '',
        checkedIn: p.checkInStatus === 'Checked In' || Boolean(p.checkedIn),
        checkedInAt: p.checkedInAt || null,
        meta: [
            p.bookingId ? `#${String(p.bookingId).slice(-8)}` : '',
            (p.people ?? 1) > 1 ? `${p.people} people` : '',
            p.meetingPoint || '',
        ]
            .filter(Boolean)
            .join(' · '),
        raw: p,
    };
}

export default function TrekOrganizerScanPage() {
    const { trekId } = useParams();
    const { toast, confirm } = useDialog();
    const api = getApiBaseUrl();
    const [stats, setStats] = useState(null);
    const [statsLoading, setStatsLoading] = useState(true);
    const [rosterKey, setRosterKey] = useState(0);

    const loadStats = useCallback(async () => {
        if (!trekId) return;
        try {
            const res = await fetchTrekOrganizerCheckinStats(trekId);
            setStats(res);
        } catch {
            /* keep previous strip if poll fails */
        } finally {
            setStatsLoading(false);
        }
    }, [trekId]);

    useEffect(() => {
        loadStats();
        const poll = setInterval(loadStats, 30000);
        return () => clearInterval(poll);
    }, [loadStats]);

    const listRoster = useCallback(
        async ({ checkInStatus, search, page, limit }) => {
            const params = { page, limit };
            if (checkInStatus === 'not_in' || checkInStatus === 'pending') {
                params.checkInStatus = 'pending';
            } else if (checkInStatus === 'checked_in') {
                params.checkInStatus = 'checked_in';
            }
            if (search) params.search = search;
            return fetchTrekOrganizerParticipants(trekId, params);
        },
        [trekId],
    );

    const lookup = useCallback(
        (q) => lookupTrekOrganizerParticipant(trekId, q),
        [trekId],
    );

    const manualCheckin = useCallback(
        async (row) => {
            const res = await trekOrganizerCheckin(trekId, { bookingId: row.id });
            loadStats();
            return res;
        },
        [trekId, loadStats],
    );

    const totalRegistered = Number(stats?.totalRegistered ?? 0);
    const totalCheckedIn = Number(stats?.totalCheckedIn ?? 0);
    const checkinRate = Number(stats?.checkinRate ?? (totalRegistered > 0 ? Math.round((totalCheckedIn / totalRegistered) * 100) : 0));

    return (
        <div className="space-y-6 max-w-3xl mx-auto">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Scan QR</h1>
                    <p className="text-sm text-gray-500 mt-0.5">Scan ticket QR or search manually by booking ID, phone, or name.</p>
                </div>
                <button
                    type="button"
                    onClick={() => { setStatsLoading(true); loadStats(); setRosterKey((k) => k + 1); }}
                    className="p-2.5 min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 text-gray-400 hover:text-white hover:border-[#0ECCEE]/40"
                    aria-label="Refresh check-in stats"
                >
                    <RefreshCw size={16} className={statsLoading ? 'animate-spin' : ''} />
                </button>
            </div>

            <SectionCard className="p-4 sm:p-5 space-y-3.5">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                        <div className="size-10 rounded-xl bg-emerald-500/15 text-emerald-300 flex items-center justify-center">
                            <UserCheck size={18} />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-white">Gate check-in</p>
                            <p className="text-[11px] text-gray-500">
                                {statsLoading && !stats
                                    ? 'Loading live stats…'
                                    : `${totalCheckedIn} of ${totalRegistered} checked in`}
                            </p>
                        </div>
                    </div>
                    <p className="text-2xl font-semibold tabular-nums text-emerald-300">{checkinRate}%</p>
                </div>
                <ProgressBar pct={checkinRate} tone="emerald" />
                <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-2.5">
                        <p className="text-[10px] uppercase tracking-wide text-gray-500">Registered</p>
                        <p className="text-lg font-semibold tabular-nums text-white mt-0.5">{totalRegistered}</p>
                    </div>
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2.5">
                        <p className="text-[10px] uppercase tracking-wide text-gray-500">Checked in</p>
                        <p className="text-lg font-semibold tabular-nums text-emerald-300 mt-0.5">{totalCheckedIn}</p>
                    </div>
                </div>
            </SectionCard>

            <CheckinScannerPage
                embedded
                showStats
                showSheetStatus={false}
                trekId={trekId}
                festName="Trek check-in"
                getAuthToken={getTrekOrganizerToken}
                checkinUrl={`${api}/trek-organizer/treks/${trekId}/checkin`}
                statsUrl={`${api}/trek-organizer/treks/${trekId}/checkin/stats`}
                sessionExpiredMessage="Organizer session expired — please sign in again."
                authErrorMessage="Access denied or session expired — sign in at the organizer portal."
                title="Scan participant QR"
                subtitle="Point camera at ticket QR from My Bookings"
                onCheckinSuccess={() => {
                    loadStats();
                    setRosterKey((k) => k + 1);
                }}
            />

            <OrganizerGateCheckinPanel
                listRoster={listRoster}
                lookup={lookup}
                manualCheckin={manualCheckin}
                normalize={normalizeTrekRow}
                refreshKey={rosterKey}
                onToast={toast}
                confirmCheckin={(row) => {
                    const people = row.raw?.people ?? 1;
                    if (people <= 1) return true;
                    return confirm(`Check in ${row.name} (${people} people on ticket)?`);
                }}
                searchPlaceholder="Booking ID, phone, or name"
                outsideStatus="pending"
                insideStatus="checked_in"
            />
        </div>
    );
}
