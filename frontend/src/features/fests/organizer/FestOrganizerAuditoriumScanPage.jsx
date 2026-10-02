import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Search } from 'lucide-react';
import CheckinScannerPage from '../../../components/admin/CheckinScannerPage';
import { getApiBaseUrl } from '../../../config/apiBase';
import { getFestOrganizerSession, getFestOrganizerToken } from '../../../utils/festOrganizerSession';
import {
    fetchFestOrganizerAuditoriumGate,
    lookupFestOrganizerAuditoriumPhone,
    festOrganizerCheckin,
} from '../../../services/api/festOrganizer.api';
import { useDialog } from '../../../context/DialogContext';
import { getFestPlugin } from '../plugins/registry';
import { organizerHasPage } from './festOrganizerPages';

export default function FestOrganizerAuditoriumScanPage() {
    const { festId } = useParams();
    const navigate = useNavigate();
    const api = getApiBaseUrl();
    const { toast } = useDialog();
    const canOpenAuditorium = organizerHasPage(getFestOrganizerSession(), 'auditorium');
    const [competitionId, setCompetitionId] = useState('');
    const [categories, setCategories] = useState([]);
    const [phone, setPhone] = useState('');
    const [lookupBusy, setLookupBusy] = useState(false);
    const [lookupTickets, setLookupTickets] = useState([]);
    const [checkingId, setCheckingId] = useState('');
    const phoneInputRef = useRef(null);

    const loadGate = useCallback(() => {
        if (getFestPlugin(festId).id !== 'mindspark') return;
        fetchFestOrganizerAuditoriumGate(festId)
            .then((res) => {
                setCompetitionId(res?.competitionId || '');
                setCategories(Array.isArray(res?.categories) ? res.categories : []);
            })
            .catch((e) => toast(e.message || 'Failed to load auditorium gate'));
    }, [festId, toast]);

    useEffect(() => {
        loadGate();
    }, [loadGate]);

    const countsTimerRef = useRef(null);
    const refreshCountsSoon = useCallback(() => {
        if (countsTimerRef.current) return;
        countsTimerRef.current = setTimeout(() => {
            countsTimerRef.current = null;
            loadGate();
        }, 3000);
    }, [loadGate]);

    useEffect(() => () => clearTimeout(countsTimerRef.current), []);

    const manualCheckin = useCallback(async (ticket) => {
        const registrationId = ticket?.registrationId || ticket?.id;
        if (!registrationId || !competitionId || checkingId) return;
        setCheckingId(registrationId);
        const markInside = (inside, at = null) => setLookupTickets((list) => list.map((t) => (
            (t.registrationId || t.id) === registrationId ? { ...t, checkedIn: inside, checkedInAt: at } : t
        )));
        markInside(true, new Date().toISOString());
        try {
            const res = await festOrganizerCheckin(festId, { registrationId, competitionId });
            if (res?.status === 'already_checked_in') {
                markInside(true, res?.data?.checkedInAt || null);
                toast('Already inside');
            } else {
                toast('Checked in');
            }
            refreshCountsSoon();
        } catch (e) {
            markInside(false);
            toast(e.message || 'Check-in failed');
        } finally {
            setCheckingId('');
        }
    }, [competitionId, festId, toast, checkingId, refreshCountsSoon]);

    const doLookup = async (value = phone) => {
        const digits = String(value || '').replace(/\D/g, '').slice(-10);
        if (digits.length !== 10) return;
        setLookupBusy(true);
        setLookupTickets([]);
        try {
            const res = await lookupFestOrganizerAuditoriumPhone(festId, digits);
            setLookupTickets(Array.isArray(res?.tickets) ? res.tickets : (res?.ticket ? [res.ticket] : []));
        } catch (e) {
            toast(e.message || 'Not found');
        } finally {
            setLookupBusy(false);
        }
    };

    const onPhoneChange = (e) => {
        const next = e.target.value.replace(/\D/g, '').slice(0, 10);
        setPhone(next);
        if (next.length === 10) doLookup(next);
        else if (lookupTickets.length) setLookupTickets([]);
    };

    const clearLookup = () => {
        setPhone('');
        setLookupTickets([]);
        phoneInputRef.current?.focus();
    };

    const formatTime = (value) => {
        if (!value) return '';
        const d = new Date(value);
        return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
            {canOpenAuditorium ? (
                <div className="flex items-center justify-between gap-2">
                    <button
                        type="button"
                        onClick={() => navigate(`/fest-organizer/fests/${festId}/auditorium`)}
                        className="inline-flex items-center gap-1.5 text-sm text-gray-400"
                    >
                        <ArrowLeft size={16} /> Auditorium
                    </button>
                </div>
            ) : null}

            <div>
                <h1 className="text-xl font-bold text-white">Auditorium gate</h1>
                <p className="text-sm text-gray-500 mt-1">
                    Photo ticket check-in only. Other competition QRs will be rejected.
                </p>
                {categories.length ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3">
                        {categories.map((c) => (
                            <div key={c.id} className="rounded-xl border border-white/10 bg-[#161718] px-3 py-2">
                                <p className="text-[11px] font-semibold text-[#0ECCEE] truncate">{c.label}</p>
                                <p className="text-xs mt-0.5 tabular-nums">
                                    <span className="text-emerald-400">{c.inside || 0} in</span>
                                    <span className="text-gray-600"> · </span>
                                    <span className="text-amber-300">{c.outside || 0} outside</span>
                                </p>
                            </div>
                        ))}
                    </div>
                ) : null}
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
                    onCheckinSuccess={refreshCountsSoon}
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
                <form
                    className="flex gap-2"
                    onSubmit={(e) => {
                        e.preventDefault();
                        doLookup();
                    }}
                >
                    <input
                        ref={phoneInputRef}
                        value={phone}
                        onChange={onPhoneChange}
                        inputMode="numeric"
                        autoComplete="off"
                        placeholder="10-digit phone"
                        className="flex-1 px-3 py-2.5 rounded-xl bg-[#121314] border border-white/10 text-sm text-white"
                    />
                    <button
                        type="submit"
                        disabled={lookupBusy || phone.length !== 10}
                        className="px-3 py-2.5 rounded-xl bg-[#0ECCEE] text-black disabled:opacity-50"
                    >
                        <Search size={16} />
                    </button>
                </form>
                {lookupBusy ? <p className="text-xs text-gray-500">Searching…</p> : null}
                {lookupTickets.map((ticket) => {
                    const id = ticket.registrationId || ticket.id;
                    const inside = Boolean(ticket.checkedIn);
                    return (
                        <div
                            key={id}
                            className={`space-y-3 rounded-xl border p-3 ${inside ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-amber-500/40 bg-amber-500/5'}`}
                        >
                            <div className="flex gap-3 items-start">
                                {ticket.ticketPhotoUrl ? (
                                    <img
                                        src={ticket.ticketPhotoUrl}
                                        alt=""
                                        className="w-24 h-24 rounded-xl object-cover shrink-0"
                                    />
                                ) : null}
                                <div className="min-w-0 flex-1 space-y-1">
                                    <span className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-md ${inside ? 'bg-emerald-500 text-black' : 'bg-amber-400 text-black'}`}>
                                        {inside ? `INSIDE${ticket.checkedInAt ? ` · ${formatTime(ticket.checkedInAt)}` : ''}` : 'OUTSIDE'}
                                    </span>
                                    <p className="text-sm font-semibold text-white">{ticket.fullName}</p>
                                    <p className="text-[11px] font-semibold text-[#0ECCEE]">{ticket.categoryLabel}</p>
                                    <p className="text-[11px] text-gray-500">{ticket.phone} · {ticket.email}</p>
                                    {!inside ? (
                                        <button
                                            type="button"
                                            disabled={Boolean(checkingId)}
                                            onClick={() => manualCheckin(ticket)}
                                            className="mt-1 w-full min-h-[44px] px-3 py-2 rounded-lg bg-emerald-500 text-black text-sm font-bold disabled:opacity-60"
                                        >
                                            Check in
                                        </button>
                                    ) : null}
                                </div>
                            </div>
                            {ticket.idCardPhotoUrl ? (
                                <div>
                                    <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">College ID</p>
                                    <img
                                        src={ticket.idCardPhotoUrl}
                                        alt="ID card"
                                        className="w-full max-h-40 object-contain rounded-lg bg-black/40 border border-white/10"
                                    />
                                </div>
                            ) : null}
                        </div>
                    );
                })}
                {lookupTickets.length ? (
                    <button
                        type="button"
                        onClick={clearLookup}
                        className="w-full min-h-[44px] rounded-xl border border-white/10 text-sm text-gray-300"
                    >
                        Next person
                    </button>
                ) : null}
            </section>
        </div>
    );
}
