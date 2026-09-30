import { useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    AlertTriangle, BookOpen, Check, CheckCircle2, IdCard, QrCode, ScanLine, Smartphone, Ticket, Upload, Users, X,
} from 'lucide-react';
import Seo from '../../components/Seo';
import LocalQRCode from '../../components/LocalQRCode';
import { cleanPrnInput, parsePrn } from '../../utils/prnCode';
import { SampleFace, SampleIdCard } from './passDemoArt';
import PassGuide, { DecodedPrn, REVIEW_CHECKS } from './PassGuide';
import { DEMO_YEARS, MOCK_PASSES } from './mockPasses';

/** Sample data is dated to this academic year so the year checks stay stable in any month. */
const DEMO_NOW = new Date('2026-10-01T10:00:00+05:30');

const TABS = [
    { key: 'requests', label: 'Requests', icon: Users },
    { key: 'scan', label: 'Gate scanner', icon: ScanLine },
    { key: 'student', label: 'Student view', icon: Smartphone },
    { key: 'guide', label: 'How it works', icon: BookOpen },
];

const FILTERS = [
    { key: 'pending', label: 'Waiting review' },
    { key: 'approved', label: 'Approved' },
    { key: 'checked', label: 'Checked in' },
    { key: 'all', label: 'All' },
];

const NEW_LOOKS = [
    { skin: '#d8a47f', hair: '#20140e', shirt: '#38bdf8', longHair: true },
    { skin: '#bf865d', hair: '#121212', shirt: '#facc15' },
    { skin: '#e6b995', hair: '#3a2215', shirt: '#f472b6', longHair: true, glasses: true },
];

function clip(value, fallback, max = 60) {
    const text = String(value || '').trim().slice(0, max);
    return text || fallback;
}

function yearLabel(id) {
    return DEMO_YEARS.find((y) => y.id === id)?.label || id;
}

function timeAgo(iso) {
    const minutes = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.round(minutes / 60);
    return hours < 24 ? `${hours} h ago` : `${Math.round(hours / 24)} d ago`;
}

function enrich(pass) {
    const info = parsePrn(pass.prn, DEMO_NOW);
    return {
        ...pass,
        info,
        yearMismatch: Boolean(info.valid && info.categoryId !== pass.yearId),
    };
}

function Tag({ tone, children }) {
    const tones = {
        cyan: 'bg-[#0ECCEE]/10 text-[#7DE8F7]',
        amber: 'bg-amber-500/15 text-amber-200',
        rose: 'bg-rose-500/15 text-rose-200',
        emerald: 'bg-emerald-500/15 text-emerald-300',
        gray: 'bg-white/10 text-gray-300',
    };
    return (
        <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${tones[tone]}`}>
            {children}
        </span>
    );
}

function Stat({ label, value, tone = 'text-white' }) {
    return (
        <div className="rounded-xl border border-white/10 bg-white/4 px-3 py-2.5">
            <p className={`text-lg font-bold tabular-nums leading-none ${tone}`}>{value}</p>
            <p className="text-[10px] uppercase tracking-wide text-gray-500 mt-1">{label}</p>
        </div>
    );
}

function PassPhotos({ pass, college, onPreview, tall = false }) {
    const h = tall ? 'h-44' : 'h-32';
    return (
        <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => onPreview?.({ kind: 'face', pass })} className="text-left">
                <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">Face</p>
                <div className={`${h} rounded-lg overflow-hidden`}><SampleFace look={pass.look} /></div>
            </button>
            <button
                type="button"
                onClick={() => !pass.noIdCard && onPreview?.({ kind: 'id', pass })}
                className="text-left"
            >
                <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">College ID</p>
                <div className={h}>
                    {pass.noIdCard ? (
                        <div className="h-full rounded-lg bg-white/8 flex items-center justify-center text-[11px] text-rose-300">
                            No ID card uploaded
                        </div>
                    ) : (
                        <SampleIdCard
                            college={college}
                            name={pass.name}
                            prn={pass.prn}
                            branch={pass.info.branchName || ''}
                            look={pass.look}
                            blurry={pass.blurryId}
                        />
                    )}
                </div>
            </button>
        </div>
    );
}

function PassFlags({ pass }) {
    return (
        <div className="flex flex-wrap justify-end gap-1">
            <Tag tone="cyan">{yearLabel(pass.yearId)}</Tag>
            {pass.yearMismatch ? <Tag tone="amber">Year mismatch</Tag> : null}
            {pass.noIdCard ? <Tag tone="rose">No ID</Tag> : null}
            {pass.blurryId ? <Tag tone="amber">ID unclear</Tag> : null}
            {pass.status === 'approved' ? (
                <Tag tone={pass.checkedIn ? 'emerald' : 'gray'}>{pass.checkedIn ? 'Checked in' : 'Approved'}</Tag>
            ) : null}
            {pass.status === 'declined' ? <Tag tone="rose">Declined</Tag> : null}
        </div>
    );
}

function RequestCard({ pass, college, onPreview, onApprove, onDecline, onViewPass }) {
    return (
        <div className="rounded-2xl border border-white/10 bg-[#161718] p-3 space-y-3">
            <PassPhotos pass={pass} college={college} onPreview={onPreview} />
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{pass.name}</p>
                    <p className="text-[11px] text-gray-500">{pass.phone} · {timeAgo(pass.submittedAt)}</p>
                    <p className="text-[11px] font-mono text-[#7DE8F7] mt-1">PRN {pass.prn}</p>
                </div>
                <PassFlags pass={pass} />
            </div>
            <DecodedPrn info={pass.info} compact />
            {pass.yearMismatch ? (
                <p className="text-[11px] text-amber-300">
                    PRN shows {pass.info.studyYearLabel}, but {yearLabel(pass.yearId)} was picked. Check the year on the ID card.
                </p>
            ) : null}
            {pass.status === 'pending' ? (
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={onApprove}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-400 px-3 py-2.5 text-sm font-bold text-black"
                    >
                        <Check size={14} /> Approve
                    </button>
                    <button
                        type="button"
                        onClick={onDecline}
                        className="inline-flex items-center justify-center rounded-xl border border-white/10 px-4 py-2.5 text-sm text-rose-200"
                    >
                        Decline
                    </button>
                </div>
            ) : null}
            {pass.status === 'approved' ? (
                <button
                    type="button"
                    onClick={onViewPass}
                    className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#0ECCEE]/30 px-3 py-2 text-sm text-[#7DE8F7]"
                >
                    <QrCode size={14} /> View pass sent to student
                </button>
            ) : null}
        </div>
    );
}

function Modal({ onClose, children }) {
    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 p-3" onClick={onClose}>
            <div
                className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-[#121314] p-4 max-h-[92dvh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                <button type="button" onClick={onClose} className="absolute right-3 top-3 text-gray-400 hover:text-white" aria-label="Close">
                    <X size={18} />
                </button>
                {children}
            </div>
        </div>
    );
}

function PassTicket({ pass, college, event }) {
    return (
        <div className="rounded-2xl overflow-hidden border border-[#0ECCEE]/30 bg-gradient-to-b from-[#0b2a31] to-[#0c0d0e]">
            <div className="px-4 pt-4 pb-3 text-center">
                <p className="text-[10px] uppercase tracking-[0.2em] text-[#7DE8F7]">{college}</p>
                <p className="text-lg font-bold text-white">{event}</p>
                <p className="text-[11px] text-gray-400">Entry pass · {yearLabel(pass.yearId)}</p>
            </div>
            <div className="flex items-center gap-3 px-4 pb-3">
                <div className="w-16 h-20 rounded-lg overflow-hidden shrink-0"><SampleFace look={pass.look} /></div>
                <div className="min-w-0">
                    <p className="font-semibold text-white truncate">{pass.name}</p>
                    <p className="text-[11px] font-mono text-[#7DE8F7]">PRN {pass.prn}</p>
                    <p className="text-[11px] text-gray-400 truncate">{pass.info.branchName}</p>
                </div>
            </div>
            <div className="bg-white mx-4 mb-4 rounded-xl p-3 flex justify-center">
                <LocalQRCode data={`CRWDCTRL-DEMO-${pass.id}-${pass.prn}`} size={170} printSafe />
            </div>
        </div>
    );
}

function ScanTab({ passes, college, onCheckIn }) {
    const [query, setQuery] = useState('');
    const [selectedId, setSelectedId] = useState('');
    const resultRef = useRef(null);
    const approved = passes.filter((p) => p.status === 'approved');
    const selected = passes.find((p) => p.id === selectedId) || null;

    const scan = (id) => {
        setSelectedId(id);
        if (window.innerWidth < 1024) {
            requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
        }
    };

    const lookup = () => {
        const q = query.trim().toLowerCase();
        if (!q) return;
        const prn = cleanPrnInput(q);
        const found = passes.find((p) => (prn.length === 10 && p.prn === prn) || p.name.toLowerCase().includes(q));
        scan(found ? found.id : 'none');
    };

    let verdict = null;
    if (selectedId === 'none') verdict = { tone: 'bg-rose-600/90', text: 'No pass found for this PRN or name' };
    else if (selected && selected.status !== 'approved') verdict = { tone: 'bg-rose-600/90', text: 'Pass not approved — entry not allowed' };
    else if (selected?.checkedIn) verdict = { tone: 'bg-amber-500/90', text: 'Already checked in — pass already used' };
    else if (selected) verdict = { tone: 'bg-sky-600/90', text: 'Match face and ID, then allow entry' };

    return (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <div className="space-y-3">
                <div className="rounded-2xl border border-white/10 bg-[#161718] p-4 space-y-3">
                    <div className="aspect-square max-h-56 mx-auto rounded-2xl border-2 border-dashed border-[#0ECCEE]/40 flex flex-col items-center justify-center text-center p-4">
                        <ScanLine size={36} className="text-[#0ECCEE]" />
                        <p className="text-sm text-white mt-2 font-medium">Camera scanner</p>
                        <p className="text-[11px] text-gray-500">On the day, volunteers point the phone at the student's QR. Tap a sample pass below to simulate a scan.</p>
                    </div>
                    <div className="flex gap-2">
                        <input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && lookup()}
                            placeholder="Or search PRN / name"
                            className="flex-1 min-w-0 bg-[#0c0d0e] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#0ECCEE]/50"
                        />
                        <button type="button" onClick={lookup} className="rounded-xl bg-[#0ECCEE] px-4 text-sm font-semibold text-black">Find</button>
                    </div>
                </div>
                <div className="space-y-1.5">
                    <p className="text-[11px] uppercase tracking-wide text-gray-500 px-1">Sample passes to scan</p>
                    {approved.map((p) => (
                        <button
                            key={p.id}
                            type="button"
                            onClick={() => scan(p.id)}
                            className={`w-full flex items-center gap-3 rounded-xl border px-3 py-2 text-left ${
                                selectedId === p.id ? 'border-[#0ECCEE]/50 bg-[#0ECCEE]/10' : 'border-white/10 bg-white/3'
                            }`}
                        >
                            <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0"><SampleFace look={p.look} /></div>
                            <div className="min-w-0 flex-1">
                                <p className="text-sm text-white truncate">{p.name}</p>
                                <p className="text-[11px] font-mono text-gray-500">{p.prn}</p>
                            </div>
                            {p.checkedIn ? <Tag tone="emerald">In</Tag> : <QrCode size={16} className="text-[#7DE8F7]" />}
                        </button>
                    ))}
                    {!approved.length ? <p className="text-xs text-gray-500 px-1">Approve a request first.</p> : null}
                </div>
            </div>

            <div ref={resultRef} className="rounded-2xl border border-white/10 bg-[#161718] overflow-hidden scroll-mt-4">
                {verdict ? (
                    <>
                        <div className={`${verdict.tone} px-4 py-3`}>
                            <p className="text-sm font-bold text-white">{verdict.text}</p>
                        </div>
                        {selected ? (
                            <div className="p-4 space-y-3">
                                <PassPhotos pass={selected} college={college} tall />
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <p className="text-base font-semibold text-white">{selected.name}</p>
                                        <p className="text-xs font-mono text-[#7DE8F7]">PRN {selected.prn}</p>
                                    </div>
                                    <PassFlags pass={selected} />
                                </div>
                                <DecodedPrn info={selected.info} compact />
                                {selected.status === 'approved' && !selected.checkedIn ? (
                                    <button
                                        type="button"
                                        onClick={() => onCheckIn(selected.id)}
                                        className="w-full min-h-[48px] rounded-xl bg-white text-sky-900 text-sm font-bold"
                                    >
                                        Face and ID match — allow entry
                                    </button>
                                ) : null}
                                {selected.checkedIn ? (
                                    <p className="text-xs text-emerald-300 flex items-center gap-1.5">
                                        <CheckCircle2 size={14} /> Entered. Scanning this QR again shows "Already checked in".
                                    </p>
                                ) : null}
                            </div>
                        ) : null}
                    </>
                ) : (
                    <div className="h-full min-h-64 flex flex-col items-center justify-center text-center p-6">
                        <Ticket size={32} className="text-gray-600" />
                        <p className="text-sm text-gray-400 mt-2">Scan result appears here</p>
                        <p className="text-[11px] text-gray-600">Face photo, ID card and PRN, side by side</p>
                    </div>
                )}
            </div>
        </div>
    );
}

function StudentTab({ college, onSubmit }) {
    const [form, setForm] = useState({ name: '', phone: '', prn: '', yearId: 'first_year', id: false, face: false });
    const [done, setDone] = useState(false);
    const info = form.prn.length === 10 ? parsePrn(form.prn, DEMO_NOW) : null;
    const mismatch = Boolean(info?.valid && info.categoryId !== form.yearId);
    const ready = form.name.trim().length >= 2 && form.phone.length === 10 && info?.valid && form.id && form.face;
    const field = 'w-full bg-[#0c0d0e] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#0ECCEE]/50';

    const submit = () => {
        onSubmit({ name: form.name.trim(), phone: `${form.phone.slice(0, 5)} ${form.phone.slice(5, 7)}xxx`, prn: form.prn, yearId: form.yearId });
        setDone(true);
    };

    return (
        <div className="grid gap-5 md:grid-cols-[320px_minmax(0,1fr)] items-start">
            <div className="mx-auto w-full max-w-[320px] rounded-[2rem] border-4 border-white/10 bg-[#0c0d0e] p-4 space-y-3 shadow-2xl">
                <div className="text-center">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-[#7DE8F7]">{college}</p>
                    <p className="text-base font-bold text-white">Get your entry pass</p>
                </div>
                {done ? (
                    <div className="text-center space-y-3 py-6">
                        <CheckCircle2 size={40} className="mx-auto text-emerald-400" />
                        <p className="text-sm text-white font-semibold">Request sent</p>
                        <p className="text-[11px] text-gray-400">Organizers review it. Once approved, the QR pass arrives by email and in the app.</p>
                        <p className="text-[11px] text-[#7DE8F7]">Open the Requests tab to see it waiting.</p>
                        <button type="button" onClick={() => { setDone(false); setForm({ name: '', phone: '', prn: '', yearId: 'first_year', id: false, face: false }); }} className="text-xs text-gray-400 underline">
                            Fill another
                        </button>
                    </div>
                ) : (
                    <>
                        <input className={field} placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value.slice(0, 60) })} />
                        <input className={field} placeholder="Mobile (10 digits)" inputMode="numeric" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })} />
                        <select className={field} value={form.yearId} onChange={(e) => setForm({ ...form, yearId: e.target.value })}>
                            {DEMO_YEARS.map((y) => <option key={y.id} value={y.id}>{y.label}</option>)}
                        </select>
                        <input className={`${field} font-mono`} placeholder="PRN (e.g. 2611001001)" inputMode="numeric" value={form.prn} onChange={(e) => setForm({ ...form, prn: cleanPrnInput(e.target.value) })} />
                        {info ? (
                            info.valid ? (
                                <div className="-mt-1 space-y-0.5">
                                    <p className="text-[11px] text-emerald-300">{info.branchName} · {info.entryLabel} · Admitted {info.admissionYear}</p>
                                    {mismatch ? <p className="text-[11px] text-amber-300">PRN looks like {info.studyYearLabel}. Organizers will check this.</p> : null}
                                </div>
                            ) : <p className="text-[11px] text-rose-300 -mt-1">{info.error}</p>
                        ) : <p className="text-[11px] text-gray-500 -mt-1">Your PRN is printed on your college ID card.</p>}
                        <div className="grid grid-cols-2 gap-2">
                            {[
                                { key: 'id', label: 'College ID photo', icon: IdCard },
                                { key: 'face', label: 'Face photo', icon: Upload },
                            ].map((box) => (
                                <button
                                    key={box.key}
                                    type="button"
                                    onClick={() => setForm({ ...form, [box.key]: true })}
                                    className={`rounded-xl border px-2 py-3 text-[11px] flex flex-col items-center gap-1 ${
                                        form[box.key] ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200' : 'border-dashed border-white/15 text-gray-400'
                                    }`}
                                >
                                    {form[box.key] ? <CheckCircle2 size={16} /> : <box.icon size={16} />}
                                    {form[box.key] ? 'Added (sample)' : box.label}
                                </button>
                            ))}
                        </div>
                        <button
                            type="button"
                            disabled={!ready}
                            onClick={submit}
                            className="w-full py-3 rounded-xl bg-[#0ECCEE] text-black text-sm font-bold disabled:opacity-40"
                        >
                            Request pass
                        </button>
                    </>
                )}
            </div>
            <div className="space-y-3 text-sm text-gray-300">
                <p className="text-white font-semibold">What the student sees</p>
                <p className="text-xs text-gray-400 leading-relaxed">
                    Try it: type a name, a 10-digit mobile and a PRN such as <span className="font-mono text-[#7DE8F7]">2611005021</span>.
                    The PRN is checked while typing, so wrong numbers are caught before they reach organizers. Tap both photo boxes, then request the pass.
                    It appears instantly in the Requests tab for review.
                </p>
                <ul className="space-y-1.5">
                    {['No app install needed, works from a link or QR poster', 'One pass per PRN and per mobile number', 'Pass arrives by email and in the CrwdCtrl app after approval'].map((t) => (
                        <li key={t} className="flex items-start gap-2 text-xs"><CheckCircle2 size={14} className="text-emerald-400 mt-0.5 shrink-0" />{t}</li>
                    ))}
                </ul>
            </div>
        </div>
    );
}

export default function PassDemoDashboardPage() {
    const [searchParams] = useSearchParams();
    const college = clip(searchParams.get('college'), 'Sample Institute of Technology');
    const event = clip(searchParams.get('event'), 'Annual Fest 2026');
    const [tab, setTab] = useState('requests');
    const [filter, setFilter] = useState('pending');
    const [yearFilter, setYearFilter] = useState('');
    const [passes, setPasses] = useState(() => MOCK_PASSES.map(enrich));
    const [preview, setPreview] = useState(null);
    const [ticketFor, setTicketFor] = useState(null);

    const update = (id, patch) => setPasses((list) => list.map((p) => (p.id === id ? { ...p, ...patch } : p)));

    const stats = useMemo(() => ({
        total: passes.length,
        pending: passes.filter((p) => p.status === 'pending').length,
        approved: passes.filter((p) => p.status === 'approved').length,
        checked: passes.filter((p) => p.checkedIn).length,
        flagged: passes.filter((p) => p.status === 'pending' && (p.yearMismatch || p.noIdCard || p.blurryId)).length,
    }), [passes]);

    const visible = passes.filter((p) => {
        if (yearFilter && p.yearId !== yearFilter) return false;
        if (filter === 'pending') return p.status === 'pending';
        if (filter === 'approved') return p.status === 'approved' && !p.checkedIn;
        if (filter === 'checked') return p.checkedIn;
        return true;
    });

    const addStudentRequest = (data) => {
        const id = `new-${Date.now()}`;
        setPasses((list) => [
            enrich({ id, ...data, status: 'pending', submittedAt: new Date().toISOString(), look: NEW_LOOKS[list.length % NEW_LOOKS.length] }),
            ...list,
        ]);
        setFilter('pending');
    };

    return (
        <div className="min-h-screen bg-[#0c0d0e] text-white">
            <Seo title={`${event} pass dashboard (demo)`} noindex />
            <div className="bg-amber-400 text-black text-center text-xs font-semibold px-3 py-1.5">
                Demo with sample data. Nothing here is saved or sent.
            </div>
            <div className="max-w-6xl mx-auto px-4 py-5 space-y-5">
                <header className="rounded-3xl border border-[#0ECCEE]/25 bg-[#121314] p-5 space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <p className="text-[11px] uppercase tracking-wide text-[#0ECCEE] font-semibold">{college}</p>
                            <h1 className="text-2xl font-bold flex items-center gap-2 mt-0.5">
                                <Ticket size={22} className="text-[#0ECCEE]" /> {event} · Entry passes
                            </h1>
                            <p className="text-sm text-gray-400 mt-1">
                                Students request a pass with their PRN, college ID and face photo. Organizers approve, and volunteers scan at the gate.
                            </p>
                        </div>
                        <p className="text-[11px] text-gray-500">Powered by <span className="text-white font-semibold">CrwdCtrl</span></p>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                        <Stat label="Requests" value={stats.total} />
                        <Stat label="Waiting review" value={stats.pending} tone="text-amber-200" />
                        <Stat label="Approved" value={stats.approved} tone="text-[#7DE8F7]" />
                        <Stat label="Checked in" value={stats.checked} tone="text-emerald-300" />
                        <Stat label="Need a closer look" value={stats.flagged} tone={stats.flagged ? 'text-rose-200' : 'text-white'} />
                    </div>
                </header>

                <nav className="flex gap-1.5 overflow-x-auto pb-1">
                    {TABS.map((item) => (
                        <button
                            key={item.key}
                            type="button"
                            onClick={() => setTab(item.key)}
                            className={`shrink-0 inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm ${
                                tab === item.key ? 'bg-[#0ECCEE] text-black font-semibold' : 'border border-white/10 text-gray-300'
                            }`}
                        >
                            <item.icon size={15} /> {item.label}
                        </button>
                    ))}
                </nav>

                {tab === 'requests' ? (
                    <section className="space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap gap-1.5">
                                {FILTERS.map((f) => (
                                    <button
                                        key={f.key}
                                        type="button"
                                        onClick={() => setFilter(f.key)}
                                        className={`text-xs px-3 py-1.5 rounded-lg border ${
                                            filter === f.key ? 'border-[#0ECCEE]/40 bg-[#0ECCEE]/15 text-[#0ECCEE]' : 'border-white/10 text-gray-400'
                                        }`}
                                    >
                                        {f.label}
                                    </button>
                                ))}
                            </div>
                            <select
                                value={yearFilter}
                                onChange={(e) => setYearFilter(e.target.value)}
                                className="bg-[#121314] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-gray-300"
                            >
                                <option value="">All years</option>
                                {DEMO_YEARS.map((y) => <option key={y.id} value={y.id}>{y.label}</option>)}
                            </select>
                        </div>
                        {filter === 'pending' ? (
                            <div className="rounded-xl border border-white/10 bg-white/3 px-3 py-2 flex flex-wrap gap-x-4 gap-y-1">
                                {REVIEW_CHECKS.map((c) => (
                                    <span key={c} className="text-[11px] text-gray-400 inline-flex items-center gap-1">
                                        <CheckCircle2 size={12} className="text-emerald-400" /> {c}
                                    </span>
                                ))}
                            </div>
                        ) : null}
                        {visible.length ? (
                            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                {visible.map((pass) => (
                                    <RequestCard
                                        key={pass.id}
                                        pass={pass}
                                        college={college}
                                        onPreview={setPreview}
                                        onApprove={() => update(pass.id, { status: 'approved' })}
                                        onDecline={() => update(pass.id, { status: 'declined' })}
                                        onViewPass={() => setTicketFor(pass)}
                                    />
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500 rounded-2xl border border-white/10 bg-[#161718] px-4 py-8 text-center">
                                Nothing here. Try another filter, or submit a request from the Student view tab.
                            </p>
                        )}
                    </section>
                ) : null}

                {tab === 'scan' ? (
                    <ScanTab passes={passes} college={college} onCheckIn={(id) => update(id, { checkedIn: true })} />
                ) : null}

                {tab === 'student' ? (
                    <StudentTab college={college} onSubmit={addStudentRequest} />
                ) : null}

                {tab === 'guide' ? <PassGuide /> : null}

                {stats.flagged && tab === 'requests' && filter === 'pending' ? (
                    <p className="text-[11px] text-gray-500 flex items-start gap-1.5">
                        <AlertTriangle size={13} className="text-amber-300 mt-0.5 shrink-0" />
                        Flagged requests (year mismatch, missing or unclear ID) are marked so reviewers slow down on those.
                    </p>
                ) : null}
            </div>

            {preview ? (
                <Modal onClose={() => setPreview(null)}>
                    <p className="text-sm font-semibold mb-3">{preview.pass.name} · {preview.kind === 'face' ? 'Face photo' : 'College ID'}</p>
                    <div className={preview.kind === 'face' ? 'h-80 rounded-xl overflow-hidden' : 'h-52'}>
                        {preview.kind === 'face' ? (
                            <SampleFace look={preview.pass.look} />
                        ) : (
                            <SampleIdCard
                                college={college}
                                name={preview.pass.name}
                                prn={preview.pass.prn}
                                branch={preview.pass.info.branchName || ''}
                                look={preview.pass.look}
                                blurry={preview.pass.blurryId}
                            />
                        )}
                    </div>
                </Modal>
            ) : null}

            {ticketFor ? (
                <Modal onClose={() => setTicketFor(null)}>
                    <p className="text-sm font-semibold mb-3">Pass emailed to {ticketFor.name}</p>
                    <PassTicket pass={ticketFor} college={college} event={event} />
                </Modal>
            ) : null}
        </div>
    );
}
