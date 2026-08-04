import { useParams } from 'react-router-dom';
import CheckinScannerPage from '../../components/admin/CheckinScannerPage';
import { getApiBaseUrl } from '../../config/apiBase';
import { getEventOrganizerToken } from '../../utils/eventShowOrganizerSession';
import { eventOrganizerCheckin } from '../../services/api/eventShowOrganizer.api';
import { useState } from 'react';
import { Loader, UserCheck } from 'lucide-react';
import { useDialog } from '../../context/DialogContext';

export default function EventOrganizerScanPage() {
    const { eventId } = useParams();
    const api = getApiBaseUrl();
    const { toast, confirm } = useDialog();
    const [manualId, setManualId] = useState('');
    const [busy, setBusy] = useState(false);

    const manualCheckin = async (e) => {
        e.preventDefault();
        const id = manualId.trim();
        if (!id) return;
        const ok = await confirm('Check in this registration?');
        if (!ok) return;
        setBusy(true);
        try {
            const res = await eventOrganizerCheckin(eventId, { registrationId: id });
            if (res.success || res.status === 'checked_in' || res.status === 'already_checked_in') {
                toast(res.message || 'Checked in');
                setManualId('');
            } else {
                toast(res.message || 'Check-in failed');
            }
        } catch (err) {
            toast(err.message || 'Check-in failed');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold">Scan QR</h1>
                <p className="text-sm text-gray-500">Scan guest ticket QR or enter registration ID.</p>
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
            />

            <form onSubmit={manualCheckin} className="rounded-xl border border-gray-800 bg-[#161718] p-4 space-y-3">
                <h2 className="text-sm font-semibold flex items-center gap-2">
                    <UserCheck size={16} className="text-[#0ECCEE]" />
                    Manual check-in by registration ID
                </h2>
                <div className="flex gap-2">
                    <input
                        value={manualId}
                        onChange={(e) => setManualId(e.target.value)}
                        placeholder="Registration ID"
                        className="flex-1 px-3 py-2.5 rounded-xl bg-[#111213] border border-gray-800 text-sm focus:outline-none focus:border-[#0ECCEE]/50"
                    />
                    <button
                        type="submit"
                        disabled={busy}
                        className="px-4 py-2.5 rounded-xl bg-[#0ECCEE] text-black text-sm font-bold disabled:opacity-60 inline-flex items-center gap-2"
                    >
                        {busy ? <Loader className="animate-spin" size={16} /> : 'Check in'}
                    </button>
                </div>
            </form>
        </div>
    );
}
