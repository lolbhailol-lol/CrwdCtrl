import { useCallback, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import CheckinScannerPage from '../../components/admin/CheckinScannerPage';
import OrganizerGateCheckinPanel from '../../components/organizer/OrganizerGateCheckinPanel';
import { getApiBaseUrl } from '../../config/apiBase';
import { getFestOrganizerToken } from '../../utils/festOrganizerSession';
import {
    fetchFestOrganizerParticipants,
    lookupFestOrganizerParticipant,
    festOrganizerCheckin,
} from '../../services/api/festOrganizer.api';
import { useDialog } from '../../context/DialogContext';

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

export default function FestOrganizerScanPage() {
    const { festId } = useParams();
    const [searchParams] = useSearchParams();
    const competitionId = searchParams.get('competitionId') || '';
    const proShow = searchParams.get('proShow') === '1' || searchParams.get('proShow') === 'true';
    const api = getApiBaseUrl();
    const { toast } = useDialog();
    const [rosterKey, setRosterKey] = useState(0);

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

            <CheckinScannerPage
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
                onCheckinSuccess={() => setRosterKey((k) => k + 1)}
            />

            <OrganizerGateCheckinPanel
                listRoster={listRoster}
                lookup={lookup}
                manualCheckin={manualCheckin}
                normalize={normalizeFestRow}
                refreshKey={rosterKey}
                onToast={toast}
                searchPlaceholder="Name, phone, email, or registration ID"
                outsideStatus="not_in"
                insideStatus="checked_in"
            />
        </div>
    );
}
