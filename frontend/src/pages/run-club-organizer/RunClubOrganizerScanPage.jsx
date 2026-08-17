import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Search, Loader, UserCheck } from 'lucide-react';
import CheckinScannerPage from '../../components/admin/CheckinScannerPage';
import { getApiBaseUrl } from '../../config/apiBase';
import { getRunClubOrganizerToken, getRunClubOrganizerSession } from '../../utils/runClubOrganizerSession';
import { lookupRunClubOrganizerParticipant, runClubOrganizerCheckin } from '../../services/api/runClubOrganizer.api';
import { useDialog } from '../../context/DialogContext';
import RunClubOrganizerParticipantModal from './RunClubOrganizerParticipantModal';
import { isEventsListingHub, organizerHubCopy } from '../../utils/listingHubCopy';

export default function RunClubOrganizerScanPage() {
    const { eventId } = useParams();
    const { toast, confirm } = useDialog();
    const api = getApiBaseUrl();
    const copy = organizerHubCopy(isEventsListingHub(getRunClubOrganizerSession()?.runClub));
    const [manualQuery, setManualQuery] = useState('');
    const [lookupLoading, setLookupLoading] = useState(false);
    const [lookupResults, setLookupResults] = useState([]);
    const [detailId, setDetailId] = useState(null);
    const [checkinLoading, setCheckinLoading] = useState(null);

    const runLookup = async (e) => {
        e?.preventDefault();
        const q = manualQuery.trim();
        if (!q) return;
        setLookupLoading(true);
        setLookupResults([]);
        try {
            const data = await lookupRunClubOrganizerParticipant(eventId, q);
            setLookupResults(data.participants || []);
            if (!data.participants?.length) toast('No matching participants');
        } catch (err) {
            toast(err.message || 'Lookup failed');
        } finally {
            setLookupLoading(false);
        }
    };

    const manualCheckin = async (participant) => {
        if (participant.checkInStatus === 'Checked In') {
            toast('Already checked in');
            return;
        }
        const ok = await confirm(`Check in ${participant.participantName}?`);
        if (!ok) return;
        setCheckinLoading(participant.bookingId);
        try {
            const res = await runClubOrganizerCheckin(eventId, { bookingId: participant.bookingId });
            if (res.success || res.status === 'checked_in') {
                toast('Check-in successful');
                setLookupResults((prev) =>
                    prev.map((p) =>
                        p.bookingId === participant.bookingId
                            ? { ...p, checkInStatus: 'Checked In', qrStatus: 'Checked In', checkedInAt: new Date().toISOString() }
                            : p,
                    ),
                );
            } else {
                toast(res.message || res.error || 'Check-in failed');
            }
        } catch (err) {
            toast(err.message || 'Check-in failed');
        } finally {
            setCheckinLoading(null);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold">Scan QR</h1>
                <p className="text-sm text-gray-500">Scan ticket QR or search manually by booking ID, phone, or name.</p>
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
                title="Scan participant QR"
                subtitle="Point camera at ticket QR from My Bookings"
            />

            <div className="rounded-xl border border-gray-800 bg-[#161718] p-4 space-y-3">
                <h2 className="text-sm font-semibold flex items-center gap-2">
                    <Search size={16} className="text-[#0ECCEE]" />
                    Manual lookup
                </h2>
                <form onSubmit={runLookup} className="flex gap-2">
                    <input
                        value={manualQuery}
                        onChange={(e) => setManualQuery(e.target.value)}
                        placeholder="Booking ID, phone, or name"
                        className="flex-1 px-3 py-2.5 rounded-xl bg-[#111213] border border-gray-800 text-sm focus:outline-none focus:border-[#0ECCEE]/50"
                    />
                    <button type="submit" disabled={lookupLoading} className="px-4 py-2.5 rounded-xl bg-[#0ECCEE] text-black text-sm font-bold disabled:opacity-60">
                        {lookupLoading ? <Loader className="animate-spin" size={16} /> : 'Search'}
                    </button>
                </form>

                {lookupResults.length > 0 ? (
                    <div className="space-y-2">
                        {lookupResults.map((p) => (
                            <div key={p.bookingId} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg border border-gray-800 bg-[#111213]">
                                <div>
                                    <p className="font-medium">{p.participantName}</p>
                                    <p className="text-xs text-gray-500">{p.phone} · {p.bookingId.slice(-8)}</p>
                                    <p className="text-xs mt-0.5">{p.checkInStatus}</p>
                                </div>
                                <div className="flex gap-2">
                                    <button type="button" onClick={() => setDetailId(p.bookingId)} className="px-3 py-1.5 rounded-lg border border-gray-700 text-xs">Details</button>
                                    <button
                                        type="button"
                                        disabled={checkinLoading === p.bookingId || p.checkInStatus === 'Checked In'}
                                        onClick={() => manualCheckin(p)}
                                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600/20 text-emerald-400 text-xs font-medium disabled:opacity-40"
                                    >
                                        {checkinLoading === p.bookingId ? <Loader className="animate-spin" size={12} /> : <UserCheck size={12} />}
                                        Check in
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : null}
            </div>

            {detailId ? (
                <RunClubOrganizerParticipantModal eventId={eventId} bookingId={detailId} onClose={() => setDetailId(null)} />
            ) : null}
        </div>
    );
}
