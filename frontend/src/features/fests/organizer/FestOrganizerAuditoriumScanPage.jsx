import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Search } from 'lucide-react';
import CheckinScannerPage from '../../../components/admin/CheckinScannerPage';
import { getApiBaseUrl } from '../../../config/apiBase';
import { getFestOrganizerToken } from '../../../utils/festOrganizerSession';
import {
    fetchFestOrganizerAuditorium,
    lookupFestOrganizerAuditoriumPhone,
    festOrganizerCheckin,
} from '../../../services/api/festOrganizer.api';
import { useDialog } from '../../../context/DialogContext';
import { getFestPlugin } from '../plugins/registry';

export default function FestOrganizerAuditoriumScanPage() {
    const { festId } = useParams();
    const navigate = useNavigate();
    const api = getApiBaseUrl();
    const { toast } = useDialog();
    const [competitionId, setCompetitionId] = useState('');
    const [phone, setPhone] = useState('');
    const [lookupBusy, setLookupBusy] = useState(false);
    const [lookupTicket, setLookupTicket] = useState(null);
    const [needYearAck, setNeedYearAck] = useState(false);

    useEffect(() => {
        if (getFestPlugin(festId).id !== 'mindspark') return;
        fetchFestOrganizerAuditorium(festId)
            .then((res) => {
                const id = res?.data?.competitionId || res?.competitionId || '';
                setCompetitionId(id);
            })
            .catch((e) => toast(e.message || 'Failed to load auditorium'));
    }, [festId, toast]);

    const manualCheckin = useCallback(async ({ confirmYear = false } = {}) => {
        if (!lookupTicket?.registrationId && !lookupTicket?.id) return;
        if (!competitionId) return;
        setLookupBusy(true);
        try {
            const res = await festOrganizerCheckin(festId, {
                registrationId: lookupTicket.registrationId || lookupTicket.id,
                competitionId,
                ...(confirmYear || needYearAck ? { confirmYear: true } : {}),
            });
            if (res?.status === 'needs_year_confirm') {
                setNeedYearAck(true);
                toast(res.message || 'Confirm year matches ID');
                return;
            }
            toast(res?.message || 'Checked in');
            setLookupTicket((t) => (t ? { ...t, checkedIn: true } : t));
            setNeedYearAck(false);
        } catch (e) {
            toast(e.message || 'Check-in failed');
        } finally {
            setLookupBusy(false);
        }
    }, [lookupTicket, competitionId, festId, toast, needYearAck]);

    const doLookup = async () => {
        setLookupBusy(true);
        setLookupTicket(null);
        setNeedYearAck(false);
        try {
            const res = await lookupFestOrganizerAuditoriumPhone(festId, phone);
            setLookupTicket(res?.ticket || null);
        } catch (e) {
            toast(e.message || 'Not found');
        } finally {
            setLookupBusy(false);
        }
    };

    if (getFestPlugin(festId).id !== 'mindspark') {
        return (
            <div className="p-6 text-center text-sm text-gray-400">
                Auditorium scanner is MindSpark-only.{' '}
                <Link to={`/fest-organizer/fests/${festId}`} className="text-[#0ECCEE]">Back</Link>
            </div>
        );
    }

    return (
        <div className="space-y-4 max-w-2xl mx-auto pb-10">
            <div className="flex items-center justify-between gap-2">
                <button
                    type="button"
                    onClick={() => navigate(`/fest-organizer/fests/${festId}/auditorium`)}
                    className="inline-flex items-center gap-1.5 text-sm text-gray-400"
                >
                    <ArrowLeft size={16} /> Auditorium
                </button>
            </div>

            <div>
                <h1 className="text-xl font-bold text-white">Auditorium gate</h1>
                <p className="text-sm text-gray-500 mt-1">
                    Photo ticket check-in only. Other competition QRs will be rejected.
                </p>
            </div>

            {competitionId ? (
                <CheckinScannerPage
                    embedded
                    showStats
                    showSheetStatus={false}
                    festId={festId}
                    competitionId={competitionId}
                    festName="Auditorium check-in"
                    getAuthToken={getFestOrganizerToken}
                    checkinUrl={`${api}/fest-organizer/fests/${festId}/checkin`}
                    statsUrl={`${api}/fest-organizer/fests/${festId}/checkin/stats?competitionId=${encodeURIComponent(competitionId)}`}
                    sessionExpiredMessage="Organizer session expired — please sign in again."
                    authErrorMessage="Access denied or session expired."
                    title="Scan auditorium ticket"
                    subtitle="Face photo + ID appear after a successful scan"
                />
            ) : (
                <p className="text-sm text-gray-500">Loading scanner…</p>
            )}

            <section className="rounded-2xl border border-white/10 bg-[#161718] p-4 space-y-3">
                <p className="text-sm font-semibold text-white">Phone lookup (damaged QR)</p>
                <div className="flex gap-2">
                    <input
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="10-digit phone"
                        className="flex-1 px-3 py-2.5 rounded-xl bg-[#121314] border border-white/10 text-sm text-white"
                    />
                    <button
                        type="button"
                        disabled={lookupBusy}
                        onClick={doLookup}
                        className="px-3 py-2.5 rounded-xl bg-[#0ECCEE] text-black"
                    >
                        <Search size={16} />
                    </button>
                </div>
                {lookupTicket ? (
                    <div className="space-y-3 rounded-xl border border-white/10 bg-white/4 p-3">
                        <div className="flex gap-3 items-start">
                            {lookupTicket.ticketPhotoUrl ? (
                                <img
                                    src={lookupTicket.ticketPhotoUrl}
                                    alt=""
                                    className="w-24 h-24 rounded-xl object-cover shrink-0"
                                />
                            ) : null}
                            <div className="min-w-0 flex-1 space-y-1">
                                <p className="text-sm font-semibold text-white">{lookupTicket.fullName}</p>
                                <p className="text-[11px] text-gray-400">{lookupTicket.categoryLabel}</p>
                                <p className="text-[11px] text-gray-500">{lookupTicket.phone} · {lookupTicket.email}</p>
                                {lookupTicket.checkedIn ? (
                                    <p className="text-xs text-amber-300">Already checked in</p>
                                ) : needYearAck ? (
                                    <button
                                        type="button"
                                        disabled={lookupBusy}
                                        onClick={() => manualCheckin({ confirmYear: true })}
                                        className="mt-1 px-3 py-1.5 rounded-lg bg-emerald-500 text-black text-xs font-semibold"
                                    >
                                        Year matches ID — check in
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        disabled={lookupBusy}
                                        onClick={() => manualCheckin()}
                                        className="mt-1 px-3 py-1.5 rounded-lg bg-emerald-500 text-black text-xs font-semibold"
                                    >
                                        Check in
                                    </button>
                                )}
                            </div>
                        </div>
                        {lookupTicket.idCardPhotoUrl ? (
                            <div>
                                <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">College ID</p>
                                <img
                                    src={lookupTicket.idCardPhotoUrl}
                                    alt="ID card"
                                    className="w-full max-h-40 object-contain rounded-lg bg-black/40 border border-white/10"
                                />
                            </div>
                        ) : null}
                    </div>
                ) : null}
            </section>
        </div>
    );
}
