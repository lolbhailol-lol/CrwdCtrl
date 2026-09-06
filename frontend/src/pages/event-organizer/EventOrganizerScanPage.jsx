import { useCallback, useState } from 'react';
import { useParams } from 'react-router-dom';
import CheckinScannerPage from '../../components/admin/CheckinScannerPage';
import OrganizerGateCheckinPanel from '../../components/organizer/OrganizerGateCheckinPanel';
import { getApiBaseUrl } from '../../config/apiBase';
import { getEventOrganizerToken } from '../../utils/eventShowOrganizerSession';
import {
    fetchEventOrganizerParticipants,
    eventOrganizerCheckin,
} from '../../services/api/eventShowOrganizer.api';
import { useDialog } from '../../context/DialogContext';

function normalizeEventRow(p) {
    if (!p) return null;
    return {
        id: String(p.id),
        name: p.userName || 'Guest',
        phone: p.userPhone || '',
        email: p.userEmail || '',
        checkedIn: Boolean(p.checkedIn),
        checkedInAt: p.checkedInAt || null,
        meta: [p.tierName, p.categoryLabel].filter(Boolean).join(' · '),
        raw: p,
    };
}

export default function EventOrganizerScanPage() {
    const { eventId } = useParams();
    const api = getApiBaseUrl();
    const { toast } = useDialog();
    const [rosterKey, setRosterKey] = useState(0);

    const listRoster = useCallback(
        async ({ checkInStatus, search, page, limit }) => {
            const params = { page, limit, status: 'approved' };
            if (checkInStatus === 'not_in' || checkInStatus === 'not_checked_in') {
                params.checkInStatus = 'not_checked_in';
            } else if (checkInStatus === 'checked_in') {
                params.checkInStatus = 'checked_in';
            }
            if (search) params.search = search;
            return fetchEventOrganizerParticipants(eventId, params);
        },
        [eventId],
    );

    const manualCheckin = useCallback(
        async (row) => eventOrganizerCheckin(eventId, { registrationId: row.id }),
        [eventId],
    );

    return (
        <div className="space-y-6 max-w-2xl mx-auto">
            <div>
                <h1 className="text-2xl font-bold">Scan QR</h1>
                <p className="text-sm text-gray-500">
                    Scan guest ticket QR, or search by name / phone when the QR is missing.
                </p>
            </div>

            <CheckinScannerPage
                embedded
                showStats
                showSheetStatus={false}
                festName="Event check-in"
                getAuthToken={getEventOrganizerToken}
                checkinUrl={`${api}/event-organizer/events/${eventId}/checkin`}
                statsUrl={`${api}/event-organizer/events/${eventId}/checkin/stats`}
                sessionExpiredMessage="Organizer session expired — please sign in again."
                authErrorMessage="Access denied or session expired — sign in at the organizer portal."
                title="Scan guest QR"
                subtitle="Point camera at ticket QR from My Bookings"
                onCheckinSuccess={() => setRosterKey((k) => k + 1)}
            />

            <OrganizerGateCheckinPanel
                listRoster={listRoster}
                manualCheckin={manualCheckin}
                normalize={normalizeEventRow}
                refreshKey={rosterKey}
                onToast={toast}
                searchPlaceholder="Name, phone, email, or registration ID"
                outsideStatus="not_checked_in"
                insideStatus="checked_in"
            />
        </div>
    );
}
