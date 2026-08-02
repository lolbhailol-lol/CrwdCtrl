import { useParams } from 'react-router-dom';
import CheckinScannerPage from '../../components/admin/CheckinScannerPage';
import { getApiBaseUrl } from '../../config/apiBase';
import { getFestOrganizerToken } from '../../utils/festOrganizerSession';

export default function FestOrganizerScanPage() {
    const { festId } = useParams();
    const api = getApiBaseUrl();

    return (
        <div className="space-y-4 max-w-2xl mx-auto">
            <div>
                <h1 className="text-xl font-bold">Scan QR</h1>
                <p className="text-sm text-gray-500 mt-1">
                    Point the camera at a participant ticket QR, or use photo / manual entry if needed.
                </p>
            </div>

            <CheckinScannerPage
                embedded
                showStats
                showSheetStatus={false}
                festId={festId}
                festName="Fest check-in"
                getAuthToken={getFestOrganizerToken}
                checkinUrl={`${api}/fest-organizer/fests/${festId}/checkin`}
                statsUrl={`${api}/fest-organizer/fests/${festId}/checkin/stats`}
                sessionExpiredMessage="Organizer session expired — please sign in again."
                authErrorMessage="Access denied or session expired — sign in at the fest organizer portal."
                title="Scan participant QR"
                subtitle="Allow camera when prompted · works on phone browser and app"
            />
        </div>
    );
}
