import { useCallback, useState } from 'react';
import { useParams } from 'react-router-dom';
import { QrCode } from 'lucide-react';
import CheckinScannerPage from '../../components/admin/CheckinScannerPage';
import OrganizerGateCheckinPanel from '../../components/organizer/OrganizerGateCheckinPanel';
import { getApiBaseUrl } from '../../config/apiBase';
import { getRunClubOrganizerToken, getRunClubOrganizerSession } from '../../utils/runClubOrganizerSession';
import {
    lookupRunClubOrganizerParticipant,
    runClubOrganizerCheckin,
    fetchRunClubOrganizerParticipants,
} from '../../services/api/runClubOrganizer.api';
import { useDialog } from '../../context/DialogContext';
import { isEventsListingHub, organizerHubCopy } from '../../utils/listingHubCopy';
import { getGuestOpsAnswers, shortOpsLabel } from '../trek-organizer/ParticipantCard';

function cleanPhone(phone) {
    if (!phone || phone === '—') return '';
    return String(phone);
}

function normalizeRunClubRow(p) {
    if (!p) return null;
    const ops = getGuestOpsAnswers(p);
    return {
        id: String(p.bookingId),
        name: p.participantName || 'Guest',
        phone: cleanPhone(p.phone),
        email: p.userEmail || '',
        checkedIn: p.checkInStatus === 'Checked In' || Boolean(p.checkedIn),
        checkedInAt: p.checkedInAt || null,
        meta: p.bookingId ? `#${String(p.bookingId).slice(-8)}` : '',
        gender: ops.gender?.value || p.participantGender || '',
        drink: ops.drink?.value || '',
        drinkLabel: ops.drink?.label || 'Post game fuel',
        skill: ops.skill?.value || '',
        skillLabel: ops.skill?.label || 'Skill',
        drinkShort: ops.drink?.value ? shortOpsLabel(ops.drink.value) : '',
        skillShort: ops.skill?.value ? shortOpsLabel(ops.skill.value) : '',
        raw: p,
    };
}

export default function RunClubOrganizerScanPage() {
    const { eventId } = useParams();
    const { toast } = useDialog();
    const api = getApiBaseUrl();
    const isEventHub = isEventsListingHub(getRunClubOrganizerSession()?.runClub);
    const copy = organizerHubCopy(isEventHub);
    const [rosterKey, setRosterKey] = useState(0);

    const listRoster = useCallback(
        async ({ checkInStatus, search, page, limit }) => {
            const params = { page, limit };
            if (checkInStatus === 'not_in' || checkInStatus === 'pending') {
                params.checkInStatus = 'pending';
            } else if (checkInStatus === 'checked_in') {
                params.checkInStatus = 'checked_in';
            }
            if (search) params.search = search;
            return fetchRunClubOrganizerParticipants(eventId, params);
        },
        [eventId],
    );

    const lookup = useCallback(
        (q) => lookupRunClubOrganizerParticipant(eventId, q),
        [eventId],
    );

    const manualCheckin = useCallback(
        async (row) => runClubOrganizerCheckin(eventId, { bookingId: row.id }),
        [eventId],
    );

    return (
        <div className={`mx-auto space-y-4 ${isEventHub ? 'max-w-xl' : 'max-w-2xl space-y-6'}`}>
            <div className="flex items-start gap-3">
                {isEventHub ? (
                    <span className="size-10 rounded-xl bg-[#0ECCEE]/12 text-[#0ECCEE] flex items-center justify-center shrink-0">
                        <QrCode size={18} />
                    </span>
                ) : null}
                <div className="min-w-0">
                    <h1 className={isEventHub ? 'text-xl font-semibold tracking-tight' : 'text-2xl font-bold'}>
                        {isEventHub ? 'Scan' : 'Scan QR'}
                    </h1>
                    <p className="text-sm text-gray-500 mt-0.5">
                        {isEventHub
                            ? 'Scan a ticket QR, or check someone in from the list below.'
                            : 'Scan ticket QR or search manually by booking ID, phone, or name.'}
                    </p>
                </div>
            </div>

            <CheckinScannerPage
                embedded
                showStats
                showSheetStatus={false}
                sportEventId={eventId}
                festName={copy.scanName}
                getAuthToken={getRunClubOrganizerToken}
                checkinUrl={`${api}/run-club-organizer/events/${eventId}/checkin`}
                statsUrl={`${api}/run-club-organizer/events/${eventId}/checkin/stats`}
                sessionExpiredMessage="Organizer session expired — please sign in again."
                authErrorMessage="Access denied or session expired — sign in at the organizer portal."
                title={isEventHub ? 'Scan guest QR' : 'Scan participant QR'}
                subtitle={isEventHub ? 'Point at the ticket QR from their booking' : 'Point camera at ticket QR from My Bookings'}
                onCheckinSuccess={() => setRosterKey((k) => k + 1)}
            />

            <OrganizerGateCheckinPanel
                listRoster={listRoster}
                lookup={lookup}
                manualCheckin={manualCheckin}
                normalize={normalizeRunClubRow}
                refreshKey={rosterKey}
                onToast={toast}
                searchPlaceholder={isEventHub ? 'Name, phone, or booking ID' : 'Booking ID, phone, or name'}
                outsideStatus="pending"
                insideStatus="checked_in"
                labels={isEventHub ? {
                    title: 'Guest list',
                    subtitle: 'If QR won’t scan — find them and let them in',
                    outside: 'Outside',
                    inside: 'Inside',
                    outsideEmpty: 'Everyone is inside',
                    insideEmpty: 'No check-ins yet',
                    checkIn: 'Let in',
                    stillOutside: 'Outside',
                    checkedIn: 'Inside',
                } : undefined}
            />
        </div>
    );
}
