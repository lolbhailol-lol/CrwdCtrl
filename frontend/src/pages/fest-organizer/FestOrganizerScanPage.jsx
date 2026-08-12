import { useParams, useSearchParams } from 'react-router-dom';
import CheckinScannerPage from '../../components/admin/CheckinScannerPage';
import { getApiBaseUrl } from '../../config/apiBase';
import { getFestOrganizerToken } from '../../utils/festOrganizerSession';

export default function FestOrganizerScanPage() {
    const { festId } = useParams();
    const [searchParams] = useSearchParams();
    const competitionId = searchParams.get('competitionId') || '';
    const proShow = searchParams.get('proShow') === '1' || searchParams.get('proShow') === 'true';
    const api = getApiBaseUrl();
    const statsQs = proShow
        ? '?proShow=1'
        : (competitionId ? `?competitionId=${encodeURIComponent(competitionId)}` : '');

    const modeLabel = proShow
        ? 'Pro Show gate — only night passes accepted.'
        : competitionId
            ? 'Competition room mode — tickets for other competitions will be rejected.'
            : 'Point the camera at a participant ticket QR, or use photo / manual entry if needed.';

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
            />
        </div>
    );
}
