import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import CheckinScannerPage from '../../../components/admin/CheckinScannerPage';
import OrganizerGateCheckinPanel from '../../../components/organizer/OrganizerGateCheckinPanel';
import { getApiBaseUrl } from '../../../config/apiBase';
import { getFestOrganizerSession, getFestOrganizerToken } from '../../../utils/festOrganizerSession';
import { organizerCompetitionIds } from './festOrganizerPages';
import {
    fetchFestOrganizerParticipants,
    lookupFestOrganizerParticipant,
    festOrganizerCheckin,
} from '../../../services/api/festOrganizer.api';
import { useDialog } from '../../../context/DialogContext';

function normalizeFestRow(p) {
    if (!p) return null;
    return {
        id: String(p.id),
        name: p.userName || 'Participant',
        phone: p.userPhone || '',
        email: p.userEmail || '',
        checkedIn: Boolean(p.checkedIn),
        checkedInAt: p.checkedInAt || null,
        meta: [p.competitionName, p.teamName, p.college].filter(Boolean).join(' · '),
        raw: p,
    };
}

function FestOrganizerScanPageContent() {
    const { festId } = useParams();
    const [searchParams, setSearchParams] = useSearchParams();
    const competitionId = searchParams.get('competitionId') || '';
    const proShow = searchParams.get('proShow') === '1' || searchParams.get('proShow') === 'true';
    const api = getApiBaseUrl();
    const { toast } = useDialog();
    const [rosterKey, setRosterKey] = useState(0);
    const [competitions, setCompetitions] = useState([]);
    const rosterTimerRef = useRef(null);
    const refreshRosterSoon = useCallback(() => {
        if (rosterTimerRef.current) return;
        rosterTimerRef.current = setTimeout(() => {
            rosterTimerRef.current = null;
            setRosterKey((k) => k + 1);
        }, 3000);
    }, []);
    useEffect(() => () => clearTimeout(rosterTimerRef.current), []);
    const scannerIds = useMemo(
        () => organizerCompetitionIds(getFestOrganizerSession(), festId, 'scanner'),
        [festId],
    );

    useEffect(() => {
        let cancelled = false;
        fetchFestOrganizerParticipants(festId, { status: 'approved', page: 1, limit: 10 })
            .then((data) => {
                if (cancelled) return;
                const list = Array.isArray(data?.competitions) ? data.competitions : [];
                setCompetitions(scannerIds ? list.filter((c) => scannerIds.has(String(c.id))) : list);
            })
            .catch((error) => {
                if (!cancelled) toast(error?.message || 'Could not load competitions');
            });
        return () => { cancelled = true; };
    }, [festId, toast, scannerIds]);

    const selectedCompetition = useMemo(
        () => competitions.find((item) => String(item.id) === String(competitionId)) || null,
        [competitions, competitionId],
    );

    const selectCompetition = (nextId) => {
        const next = new URLSearchParams(searchParams);
        next.delete('proShow');
        if (nextId) next.set('competitionId', nextId);
        else next.delete('competitionId');
        setSearchParams(next, { replace: true });
        setRosterKey((key) => key + 1);
    };

    useEffect(() => {
        if (!scannerIds || proShow || !competitions.length) return;
        if (!competitions.some((c) => String(c.id) === String(competitionId))) {
            selectCompetition(String(competitions[0].id));
        }
    }, [scannerIds, competitions, competitionId, proShow]);

    const statsQs = proShow
        ? '?proShow=1'
        : (competitionId ? `?competitionId=${encodeURIComponent(competitionId)}` : '');

    const scopeParams = {
        ...(proShow ? { proShow: '1' } : {}),
        ...(!proShow && competitionId ? { competitionId } : {}),
    };

    const modeLabel = proShow
        ? 'Pro Show gate — only night passes accepted.'
        : competitionId
            ? 'Competition room mode — tickets for other competitions will be rejected.'
            : 'Point the camera at a participant ticket QR, or search by name / phone below.';

    const listRoster = useCallback(
        async ({ checkInStatus, search, page, limit }) => {
            const params = {
                ...scopeParams,
                page,
                limit,
                status: 'approved',
            };
            if (checkInStatus) params.checkInStatus = checkInStatus;
            if (search) params.search = search;
            return fetchFestOrganizerParticipants(festId, params);
        },
        [festId, competitionId, proShow],
    );

    const lookup = useCallback(
        (q) => lookupFestOrganizerParticipant(festId, q, scopeParams),
        [festId, competitionId, proShow],
    );

    const manualCheckin = useCallback(
        async (row) => {
            const body = {
                registrationId: row.id,
                ...(proShow ? { proShowOnly: true } : {}),
                ...(!proShow && competitionId ? { competitionId } : {}),
            };
            return festOrganizerCheckin(festId, body);
        },
        [festId, competitionId, proShow],
    );

    return (
        <div className="space-y-4 max-w-2xl mx-auto">
            <div>
                <h1 className="text-xl font-bold">
                    {proShow ? 'Pro Show gate' : 'Scan QR'}
                </h1>
                <p className="text-sm text-gray-500 mt-1">{modeLabel}</p>
            </div>

            {!proShow && (
                <div className="rounded-2xl border border-white/10 bg-[#161718] p-4">
                    <label htmlFor="scanner-competition" className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                        Competition scanner
                    </label>
                    <select
                        id="scanner-competition"
                        value={competitionId}
                        onChange={(event) => selectCompetition(event.target.value)}
                        className="w-full min-h-[48px] rounded-xl border border-white/10 bg-[#111213] px-3 text-sm font-semibold text-white focus:border-[#0ECCEE] focus:outline-none"
                    >
                        {scannerIds ? null : <option value="">All competitions</option>}
                        {competitions.map((competition) => (
                            <option key={competition.id} value={competition.id}>{competition.name}</option>
                        ))}
                    </select>
                    <p className="mt-2 text-xs text-gray-500">
                        {selectedCompetition
                            ? `${selectedCompetition.name}: only this competition's approved tickets can check in.`
                            : 'Choose a competition for room-wise scanning, or keep all competitions for the main gate.'}
                    </p>
                </div>
            )}

            <CheckinScannerPage
                key={`scanner-${proShow ? 'pro-show' : competitionId || 'all'}`}
                embedded
                showStats
                showSheetStatus={false}
                festId={festId}
                competitionId={proShow ? null : (competitionId || null)}
                checkinExtraBody={proShow ? { proShowOnly: true } : null}
                festName={proShow ? 'Pro Show check-in' : competitionId ? 'Competition check-in' : 'Fest check-in'}
                getAuthToken={getFestOrganizerToken}
                checkinUrl={`${api}/fest-organizer/fests/${festId}/checkin`}
                statsUrl={`${api}/fest-organizer/fests/${festId}/checkin/stats${statsQs}`}
                sessionExpiredMessage="Organizer session expired — please sign in again."
                authErrorMessage="Access denied or session expired — sign in at the fest organizer portal."
                title={proShow ? 'Scan Pro Show QR' : competitionId ? 'Scan competition QR' : 'Scan participant QR'}
                subtitle="Allow camera when prompted · works on phone browser and app"
                onCheckinSuccess={refreshRosterSoon}
            />

            <OrganizerGateCheckinPanel
                key={`roster-${proShow ? 'pro-show' : competitionId || 'all'}`}
                listRoster={listRoster}
                lookup={lookup}
                manualCheckin={manualCheckin}
                normalize={normalizeFestRow}
                refreshKey={rosterKey}
                onToast={toast}
                searchPlaceholder="Name, phone, email, or registration ID"
                outsideStatus="not_in"
                insideStatus="checked_in"
                pollMs={10000}
                labels={{
                    title: selectedCompetition ? `${selectedCompetition.name} live roster` : 'Live fest roster',
                    subtitle: 'Approved entries update automatically · tap Check in for participants without a QR',
                    outside: 'Still outside',
                    inside: 'Checked in',
                }}
            />
        </div>
    );
}

export default function FestOrganizerScanPage() {
    return <FestOrganizerScanPageContent />;
}
