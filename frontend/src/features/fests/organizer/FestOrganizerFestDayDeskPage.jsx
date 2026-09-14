import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
    CheckCircle2, Clipboard, Download, ExternalLink, Loader, MessageCircle,
    Printer, RefreshCw, Search, WifiOff, X, QrCode,
} from 'lucide-react';
import {
    fetchFestDayDesk,
    refundFestDayDeskOrder,
    refreshFestDayDeskOrder,
} from '../../../services/api/festOrganizer.api';
import {
    buildBrandedCompetitionQrDataUrl,
    competitionRegistrationUrl,
    downloadDataUrl,
} from '../../../utils/competitionPublicQr';
import { organizerCompetitionFeeLabel } from '../../../utils/competitionFeeTiers';
import { useDialog } from '../../../context/DialogContext';
import { getFestOrganizerSession } from '../../../utils/festOrganizerSession';

const statusLabels = {
    form_started: 'Form started',
    payment_pending: 'Payment pending',
    confirming: 'Confirming payment',
    paid: 'Paid',
    failed: 'Failed',
    expired: 'Expired',
    refund_pending: 'Refund pending',
    refunded: 'Refunded',
    refund_failed: 'Refund failed',
};

const statusClasses = {
    form_started: 'bg-blue-500/15 text-blue-300 border-blue-400/20',
    payment_pending: 'bg-amber-500/15 text-amber-300 border-amber-400/20',
    confirming: 'bg-cyan-500/15 text-cyan-300 border-cyan-400/20',
    paid: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/20',
    failed: 'bg-red-500/15 text-red-300 border-red-400/20',
    expired: 'bg-white/5 text-gray-400 border-white/10',
    refund_pending: 'bg-violet-500/15 text-violet-300 border-violet-400/20',
    refunded: 'bg-gray-500/15 text-gray-300 border-gray-400/20',
    refund_failed: 'bg-red-500/15 text-red-300 border-red-400/20',
};

function formatWhen(value) {
    if (!value) return '';
    return new Date(value).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' });
}

function safeFilename(value) {
    return String(value || 'competition').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
}

function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[char]);
}

function DeskQrModal({ festId, competition, onClose, toast }) {
    const [qr, setQr] = useState('');
    const [busy, setBusy] = useState(true);
    const url = competitionRegistrationUrl(festId, competition);

    useEffect(() => {
        let active = true;
        setBusy(true);
        buildBrandedCompetitionQrDataUrl(url, { size: 900 })
            .then((value) => { if (active) setQr(value); })
            .catch(() => toast('Could not generate QR'))
            .finally(() => { if (active) setBusy(false); });
        return () => { active = false; };
    }, [url, toast]);

    const copy = async () => {
        await navigator.clipboard.writeText(url);
        toast('Registration link copied');
    };

    const print = () => {
        const popup = window.open('', '_blank', 'width=900,height=1000');
        if (!popup || !qr) return toast('Allow pop-ups to print this QR');
        const safeName = escapeHtml(competition.name);
        popup.document.write(`<!doctype html><html><head><title>${safeName}</title><style>body{font-family:Arial;text-align:center;padding:48px}img{width:min(78vw,680px)}h1{font-size:38px;margin:0 0 8px}p{font-size:20px;color:#444}</style></head><body><h1>${safeName}</h1><p>Scan to register and pay on CrwdCtrl</p><img src="${qr}"/><script>window.onload=()=>setTimeout(()=>window.print(),200)</script></body></html>`);
        popup.document.close();
    };

    const whatsapp = `https://wa.me/?text=${encodeURIComponent(`Register for ${competition.name} at MindSpark: ${url}`)}`;

    return (
        <div className="fixed inset-0 z-50 bg-black/90 p-3 sm:p-6 flex items-center justify-center">
            <div className="w-full max-w-4xl max-h-[96dvh] overflow-y-auto rounded-3xl border border-white/10 bg-[#121314] p-4 sm:p-6">
                <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                        <p className="text-xs uppercase tracking-wider text-[#0ECCEE]">Fest Day Registration</p>
                        <h2 className="text-xl sm:text-3xl font-bold text-white mt-1">{competition.name}</h2>
                        <p className="text-sm text-gray-400 mt-1">{organizerCompetitionFeeLabel(competition)} · Scan, log in, register and pay</p>
                    </div>
                    <button type="button" onClick={onClose} className="p-2 rounded-xl border border-white/10 text-gray-400"><X /></button>
                </div>
                <div className="rounded-3xl bg-white p-4 sm:p-6 flex items-center justify-center min-h-[320px]">
                    {busy ? <Loader className="animate-spin text-black" size={36} /> : <img src={qr} alt={`Register for ${competition.name}`} className="w-full max-w-[560px] aspect-square" />}
                </div>
                <p className="text-xs text-gray-500 mt-3 text-center break-all">{url}</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
                    <button type="button" onClick={copy} className="desk-action"><Clipboard size={16} />Copy link</button>
                    <button type="button" disabled={!qr} onClick={() => downloadDataUrl(qr, `mindspark-${safeFilename(competition.name)}-registration.png`)} className="desk-action"><Download size={16} />Download</button>
                    <button type="button" disabled={!qr} onClick={print} className="desk-action"><Printer size={16} />Print</button>
                    <a href={whatsapp} target="_blank" rel="noreferrer" className="desk-action"><MessageCircle size={16} />WhatsApp</a>
                </div>
            </div>
        </div>
    );
}

export default function FestOrganizerFestDayDeskPage() {
    const { festId } = useParams();
    const { toast, confirm } = useDialog();
    const organizerSession = getFestOrganizerSession();
    const canRefund = organizerSession?.organizer?.portalRole !== 'desk';
    const [competitions, setCompetitions] = useState([]);
    const [activity, setActivity] = useState([]);
    const [query, setQuery] = useState('');
    const [activityQuery, setActivityQuery] = useState('');
    const [selected, setSelected] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [busyOrder, setBusyOrder] = useState('');
    const [online, setOnline] = useState(() => navigator.onLine);

    const load = useCallback(async ({ quiet = false } = {}) => {
        if (!navigator.onLine) return;
        if (!quiet) setLoading(true);
        else setRefreshing(true);
        try {
            const data = await fetchFestDayDesk(festId, activityQuery ? { search: activityQuery } : {});
            setCompetitions(data.competitions || []);
            setActivity(data.activity || []);
        } catch (error) {
            if (!quiet) toast(error.message || 'Could not load Fest Day Desk');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [festId, activityQuery, toast]);

    useEffect(() => { load(); }, [load]);
    useEffect(() => {
        const timer = window.setInterval(() => load({ quiet: true }), 3000);
        return () => window.clearInterval(timer);
    }, [load]);
    useEffect(() => {
        const update = () => setOnline(navigator.onLine);
        window.addEventListener('online', update);
        window.addEventListener('offline', update);
        return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
    }, []);
    useEffect(() => { if (online) load({ quiet: true }); }, [online, load]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return competitions.filter((competition) => !q || `${competition.name} ${competition.category || ''} ${competition.module || ''}`.toLowerCase().includes(q));
    }, [competitions, query]);

    const refreshOrder = async (orderId) => {
        if (!online) return toast('Internet is required to verify a Cashfree payment');
        setBusyOrder(orderId);
        try {
            const result = await refreshFestDayDeskOrder(festId, orderId);
            toast(result.verified ? 'Payment verified and registration issued' : (result.message || 'Latest payment status loaded'));
            await load({ quiet: true });
        } catch (error) {
            toast(error.message || 'Could not refresh payment');
        } finally {
            setBusyOrder('');
        }
    };

    const refundOrder = async (row) => {
        const approved = await confirm({
            title: 'Refund this registration?',
            message: `Refund ₹${Number(row.amount).toLocaleString('en-IN')} for ${row.participantName}. Their ticket will be blocked immediately.`,
            confirmLabel: 'Start refund',
            danger: true,
        });
        if (!approved) return;
        setBusyOrder(row.orderId);
        try {
            await refundFestDayDeskOrder(festId, row.orderId);
            toast('Refund started; Cashfree confirmation is pending');
            await load({ quiet: true });
        } catch (error) {
            toast(error.message || 'Could not start refund');
        } finally {
            setBusyOrder('');
        }
    };

    if (loading) return <div className="min-h-[55vh] flex items-center justify-center"><Loader className="animate-spin text-[#0ECCEE]" size={30} /></div>;

    return (
        <div className="space-y-5 fest-day-desk">
            <style>{`.desk-action{display:flex;align-items:center;justify-content:center;gap:.45rem;border:1px solid rgba(255,255,255,.12);border-radius:.8rem;padding:.7rem;color:#e5e7eb;font-size:.8rem;font-weight:600;background:rgba(255,255,255,.04)}.desk-action:disabled{opacity:.4}`}</style>
            {!online ? <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200 flex gap-2"><WifiOff size={18} />Offline — existing QRs remain usable, but live status and payment verification will resume when connected.</div> : null}
            <section className="rounded-3xl border border-[#0ECCEE]/25 bg-linear-to-br from-[#0ECCEE]/15 to-[#161718] p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                    <div><p className="text-xs uppercase tracking-wider text-[#0ECCEE]">MindSpark operations</p><h1 className="text-2xl sm:text-3xl font-bold mt-1">Fest Day Desk</h1><p className="text-sm text-gray-400 mt-2">Pick a competition, display its QR, and watch Cashfree registrations arrive.</p></div>
                    <button type="button" onClick={() => load({ quiet: true })} disabled={refreshing || !online} className="desk-action self-start"><RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />Refresh</button>
                </div>
            </section>

            <div className="grid xl:grid-cols-[1.05fr_.95fr] gap-5">
                <section className="rounded-2xl border border-white/10 bg-[#121314] p-4">
                    <div className="flex items-center justify-between mb-3"><div><h2 className="font-semibold">Competition QR</h2><p className="text-xs text-gray-500">One registration and payment at a time</p></div><QrCode className="text-[#0ECCEE]" /></div>
                    <div className="relative mb-3"><Search size={16} className="absolute left-3 top-3 text-gray-500" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search competition" className="w-full rounded-xl border border-white/10 bg-[#1D1E20] py-2.5 pl-9 pr-3 text-sm" /></div>
                    <div className="grid sm:grid-cols-2 gap-2 max-h-[58vh] overflow-y-auto">
                        {filtered.map((competition) => {
                            const closed = competition.registrationsOpen === false || competition.slotsLeft === 0;
                            const slots = Number(competition.slotsAllotted) || 0;
                            return <button key={competition._id} type="button" disabled={closed} onClick={() => setSelected({ ...competition, id: competition._id })} className="rounded-2xl border border-white/10 bg-[#1A1B1D] p-4 text-left hover:border-[#0ECCEE]/50 disabled:opacity-45 transition"><div className="flex justify-between gap-3"><p className="font-semibold text-white">{competition.name}</p><ExternalLink size={15} className="text-[#0ECCEE] shrink-0" /></div><p className="text-sm text-[#0ECCEE] mt-2">{organizerCompetitionFeeLabel(competition)}</p><p className="text-xs text-gray-500 mt-1">{competition.registrationsOpen === false ? 'Registration closed' : competition.slotsLeft === 0 ? 'Sold out' : slots > 0 ? `${competition.slotsLeft} of ${slots} slots left` : 'Registration open'}</p></button>;
                        })}
                    </div>
                </section>

                <section className="rounded-2xl border border-white/10 bg-[#121314] p-4">
                    <div className="flex items-center justify-between mb-3"><div><h2 className="font-semibold">Live payment activity</h2><p className="text-xs text-gray-500">Auto-refreshes every 3 seconds</p></div>{refreshing ? <Loader size={16} className="animate-spin text-[#0ECCEE]" /> : <CheckCircle2 size={18} className="text-emerald-400" />}</div>
                    <form onSubmit={(event) => { event.preventDefault(); load(); }} className="flex gap-2 mb-3"><div className="relative flex-1"><Search size={16} className="absolute left-3 top-3 text-gray-500" /><input value={activityQuery} onChange={(event) => setActivityQuery(event.target.value)} placeholder="Name, phone, registration or order ID" className="w-full rounded-xl border border-white/10 bg-[#1D1E20] py-2.5 pl-9 pr-3 text-sm" /></div><button className="desk-action" type="submit">Search</button></form>
                    <div className="space-y-2 max-h-[58vh] overflow-y-auto">
                        {activity.length ? activity.map((row) => {
                            const registrationUrl = row.resumeUrl || competitionRegistrationUrl(festId, { id: row.competitionId, name: row.competitionName });
                            const displayStatus = row.refundStatus === 'success'
                                ? 'refunded'
                                : ['failed', 'cancelled'].includes(row.refundStatus)
                                    ? 'refund_failed'
                                    : row.refundStatus ? 'refund_pending' : row.status;
                            return <article key={row.orderId} className="rounded-xl border border-white/10 bg-[#1A1B1D] p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-sm font-semibold truncate">{row.participantName}</p><p className="text-xs text-gray-400 truncate">{row.competitionName}{row.teamName ? ` · ${row.teamName}` : ''}</p></div><span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-semibold ${statusClasses[displayStatus] || statusClasses.expired}`}>{statusLabels[displayStatus] || displayStatus}</span></div><div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[11px] text-gray-500"><span>{row.status === 'form_started' ? 'Form in progress' : `₹${Number(row.amount).toLocaleString('en-IN')}`}</span><span>{formatWhen(row.createdAt)}</span>{row.status !== 'form_started' ? <span className="font-mono">{row.orderId}</span> : null}</div><div className="flex flex-wrap gap-2 mt-3"><button type="button" onClick={() => refreshOrder(row.orderId)} disabled={busyOrder === row.orderId || !online || row.status === 'form_started'} className="desk-action flex-1">{busyOrder === row.orderId ? <Loader size={14} className="animate-spin" /> : <RefreshCw size={14} />}{row.status === 'form_started' ? 'Awaiting payment' : 'Check payment'}</button>{row.registrationId ? <Link to={`/fest-organizer/fests/${festId}/participants?q=${encodeURIComponent(row.registrationId)}`} className="desk-action flex-1"><ExternalLink size={14} />Open entry</Link> : <a href={`https://wa.me/${String(row.phone || '').replace(/\D/g, '').replace(/^(\d{10})$/, '91$1')}?text=${encodeURIComponent(`${row.status === 'form_started' ? 'Continue' : 'Resume'} your MindSpark registration here: ${registrationUrl}`)}`} target="_blank" rel="noreferrer" className={`desk-action flex-1 ${row.phone ? '' : 'pointer-events-none opacity-40'}`}><MessageCircle size={14} />Send link</a>}{canRefund && row.status === 'paid' && !row.refundStatus ? <button type="button" onClick={() => refundOrder(row)} disabled={busyOrder === row.orderId || !online} className="desk-action text-red-300"><span>Refund</span></button> : null}</div></article>;
                        }) : <div className="py-14 text-center text-sm text-gray-500">No matching Cashfree attempts yet.</div>}
                    </div>
                </section>
            </div>
            <p className="rounded-xl border border-white/10 bg-white/3 px-4 py-3 text-xs text-gray-400"><strong className="text-gray-200">Walk-in / VIP entries:</strong> use the existing competition workspace manual form only for cash, complimentary, or exceptional entries. Cashfree payments must appear as verified here—never mark them manually paid.</p>
            {selected ? <DeskQrModal festId={festId} competition={selected} onClose={() => setSelected(null)} toast={toast} /> : null}
        </div>
    );
}
