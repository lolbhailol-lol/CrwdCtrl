import { useState } from 'react';
import { CheckCircle2, IdCard, QrCode, ScanLine, ShieldCheck, UserCheck, Smartphone } from 'lucide-react';
import { PRN_BRANCHES, PRN_ENTRY_TYPES, cleanPrnInput, parsePrn } from '../../utils/prnCode';

const SEGMENTS = [
    { from: 0, to: 2, label: 'Admission year', hint: '26 = 2026', tone: 'bg-sky-500/20 border-sky-400/40 text-sky-200' },
    { from: 2, to: 4, label: 'Degree + entry', hint: '11 after 12th · 21 Diploma (DSY)', tone: 'bg-amber-500/20 border-amber-400/40 text-amber-200' },
    { from: 4, to: 5, label: 'Common code', hint: 'Always 0', tone: 'bg-white/10 border-white/20 text-gray-300' },
    { from: 5, to: 7, label: 'Branch', hint: '01–09', tone: 'bg-emerald-500/20 border-emerald-400/40 text-emerald-200' },
    { from: 7, to: 10, label: 'Serial', hint: '001–999', tone: 'bg-rose-500/20 border-rose-400/40 text-rose-200' },
];

const FLOW = [
    { icon: Smartphone, title: 'Student applies', text: 'Opens the pass link and enters name, mobile and PRN. The PRN is checked instantly.' },
    { icon: IdCard, title: 'Uploads photos', text: 'A clear photo of the college ID card and a live face photo.' },
    { icon: UserCheck, title: 'Organizer reviews', text: 'Face matches ID, name and PRN match the ID, and the year from the PRN matches. Approve or decline.' },
    { icon: QrCode, title: 'QR pass sent', text: 'Approved students get their QR pass by email and in the CrwdCtrl app.' },
    { icon: ScanLine, title: 'Gate scan', text: 'Volunteer scans the QR, sees face, ID and PRN, confirms, and lets them in. One entry per pass.' },
];

export const REVIEW_CHECKS = [
    'Face photo is the same person as the photo on the ID card',
    'Name on the ID card matches the name on the request',
    'PRN on the ID card matches the PRN typed in',
    'Year worked out from the PRN matches the year picked',
];

export function DecodedPrn({ info, compact = false }) {
    if (!info) return null;
    if (!info.valid) return <p className="text-xs text-rose-300">{info.error}</p>;
    const rows = [
        ['Admitted', String(info.admissionYear)],
        ['Entry', info.entryLabel],
        ['Branch', compact ? info.branchName : `${info.branchCode} · ${info.branchName}`],
        ...(compact ? [] : [['Serial', info.serial]]),
        ['Year now', info.studyYearLabel],
    ];
    return (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[11px]">
            {rows.map(([k, v]) => (
                <div key={k} className="contents">
                    <dt className="text-gray-500">{k}</dt>
                    <dd className="text-gray-200">{v}</dd>
                </div>
            ))}
        </dl>
    );
}

function PrnBoxes({ prn }) {
    const digits = prn.padEnd(10, '·').split('');
    return (
        <div className="space-y-2">
            <div className="flex flex-wrap gap-1">
                {SEGMENTS.map((seg) => (
                    <div key={seg.label} className="flex gap-0.5">
                        {digits.slice(seg.from, seg.to).map((d, i) => (
                            <span
                                key={`${seg.label}-${i}`}
                                className={`w-7 h-9 sm:w-8 sm:h-10 rounded-md border flex items-center justify-center font-mono text-base font-bold ${seg.tone}`}
                            >
                                {d}
                            </span>
                        ))}
                    </div>
                ))}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {SEGMENTS.map((seg) => (
                    <div key={seg.label} className={`rounded-lg border px-2 py-1.5 ${seg.tone}`}>
                        <p className="text-[11px] font-semibold">
                            {seg.to - seg.from > 1 ? `Digits ${seg.from + 1}–${seg.to}` : `Digit ${seg.from + 1}`} · {seg.label}
                        </p>
                        <p className="text-[10px] opacity-80">{seg.hint}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function PassGuide() {
    const [tryPrn, setTryPrn] = useState('2611001001');
    const tried = tryPrn.length === 10 ? parsePrn(tryPrn) : null;

    return (
        <div className="space-y-6">
            <section>
                <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-2">Flow</p>
                <ol className="grid gap-2 sm:grid-cols-5">
                    {FLOW.map((step, index) => (
                        <li key={step.title} className="rounded-2xl border border-white/10 bg-white/3 p-3">
                            <div className="flex items-center gap-2">
                                <span className="w-6 h-6 rounded-full bg-[#0ECCEE]/15 text-[#0ECCEE] text-[11px] font-bold flex items-center justify-center">
                                    {index + 1}
                                </span>
                                <step.icon size={15} className="text-[#7DE8F7]" />
                            </div>
                            <p className="text-sm font-semibold text-white mt-2">{step.title}</p>
                            <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">{step.text}</p>
                        </li>
                    ))}
                </ol>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/3 p-4">
                <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-2">What organizers check before approving</p>
                <ul className="grid gap-1.5 sm:grid-cols-2">
                    {REVIEW_CHECKS.map((check) => (
                        <li key={check} className="flex items-start gap-2 text-xs text-gray-300">
                            <CheckCircle2 size={14} className="text-emerald-400 mt-0.5 shrink-0" /> {check}
                        </li>
                    ))}
                </ul>
                <p className="text-[11px] text-gray-500 mt-3 flex items-start gap-1.5">
                    <ShieldCheck size={13} className="text-[#0ECCEE] mt-0.5 shrink-0" />
                    Decline if the ID is blurry, the face and ID photo are different people, or the PRN on the ID does not match.
                    Each PRN can hold only one pass.
                </p>
            </section>

            <div className="grid gap-5 lg:grid-cols-2">
                <section className="space-y-2">
                    <p className="text-[11px] uppercase tracking-wide text-gray-500">PRN structure (10 digits)</p>
                    <PrnBoxes prn="2611001001" />
                    <p className="text-[11px] text-gray-500">
                        PRN = Admission year + Degree + Entry type + Common code + Branch + Serial
                    </p>
                </section>
                <section className="space-y-2">
                    <p className="text-[11px] uppercase tracking-wide text-gray-500">Check a PRN</p>
                    <input
                        value={tryPrn}
                        onChange={(e) => setTryPrn(cleanPrnInput(e.target.value))}
                        inputMode="numeric"
                        placeholder="Type a 10-digit PRN"
                        className="w-full bg-[#0c0d0e] border border-white/10 rounded-xl px-3 py-2 font-mono text-sm text-white focus:outline-none focus:border-[#0ECCEE]/50"
                    />
                    <div className="flex flex-wrap gap-1.5">
                        {['2611001001', '2621001001', '2410009125'].map((example) => (
                            <button
                                key={example}
                                type="button"
                                onClick={() => setTryPrn(example)}
                                className="text-[11px] font-mono px-2 py-1 rounded-lg border border-white/10 text-gray-300 hover:border-[#0ECCEE]/40"
                            >
                                {example}
                            </button>
                        ))}
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                        {tried ? <DecodedPrn info={tried} /> : <p className="text-xs text-gray-500">Enter all 10 digits.</p>}
                    </div>
                </section>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
                <section>
                    <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-2">Branch codes (digits 6–7)</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {Object.entries(PRN_BRANCHES).map(([code, name]) => (
                            <div key={code} className="flex items-center gap-2 rounded-lg border border-white/8 bg-white/3 px-2 py-1.5">
                                <span className="font-mono text-xs font-bold text-emerald-300">{code}</span>
                                <span className="text-[11px] text-gray-300">{name}</span>
                            </div>
                        ))}
                    </div>
                </section>
                <section>
                    <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-2">Degree + entry type (digits 3–4) and year</p>
                    <div className="space-y-1.5">
                        {Object.entries(PRN_ENTRY_TYPES).map(([code, label]) => (
                            <div key={code} className="flex items-center gap-2 rounded-lg border border-white/8 bg-white/3 px-2 py-1.5">
                                <span className="font-mono text-xs font-bold text-amber-300">{code === '1' ? '11' : '21'}</span>
                                <span className="text-[11px] text-gray-300">Engineering · {label}</span>
                            </div>
                        ))}
                    </div>
                    <p className="text-[11px] text-gray-500 mt-2 leading-relaxed">
                        Current year = years since admission + 1, or + 2 for direct second year. In 2026–27,
                        2611… is First Year, 2621… is Second Year, and 2511… is Second Year.
                    </p>
                </section>
            </div>
        </div>
    );
}
