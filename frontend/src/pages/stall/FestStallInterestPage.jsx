import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Loader, CheckCircle2 } from 'lucide-react';
import { InlinePageLoader } from '../../components/DetailPageLoader';
import { publicFetchJSONRetry } from '../../services/api/client';

const INTERESTS = [
    { id: 'volunteer', label: 'Volunteer', hint: 'Help run it' },
    { id: 'participate', label: 'Participate', hint: 'Compete' },
    { id: 'both', label: 'Both', hint: 'Do both' },
];

const DEFAULT_TEAMS = [
    { id: 'competition', label: 'Competitions' },
    { id: 'pr', label: 'PR' },
    { id: 'sponsorship', label: 'Sponsorship' },
    { id: 'marathon', label: 'Marathon' },
];

const YEARS = ['1st', '2nd', '3rd', '4th'];
const DEPTS = ['CSE', 'BBA', 'Design', 'BSc'];

function digitsOnly(v) {
    return String(v || '').replace(/\D/g, '').slice(0, 10);
}

function toggleInList(list, id) {
    return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

export default function FestStallInterestPage() {
    const { festSlugOrId } = useParams();
    const nameRef = useRef(null);
    const formRef = useRef(null);
    const submittingRef = useRef(false);
    const [fest, setFest] = useState(null);
    const [volunteerTeams, setVolunteerTeams] = useState(DEFAULT_TEAMS);
    const [competitions, setCompetitions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [done, setDone] = useState(false);
    const [doneMessage, setDoneMessage] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [form, setForm] = useState({
        name: '',
        phone: '',
        year: '',
        branch: '',
        interest: '',
        volunteerTeams: [],
        competitionIds: [],
    });

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            setError('');
            try {
                const { data } = await publicFetchJSONRetry(
                    `/fests/${encodeURIComponent(festSlugOrId)}/stall`,
                );
                if (!cancelled) {
                    setFest(data.fest);
                    if (Array.isArray(data.volunteerTeams) && data.volunteerTeams.length) {
                        setVolunteerTeams(data.volunteerTeams);
                    }
                    setCompetitions(Array.isArray(data.competitions) ? data.competitions : []);
                }
            } catch (e) {
                if (!cancelled) setError(e.message || 'Could not load stall form');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [festSlugOrId]);

    const wantsVolunteer = form.interest === 'volunteer' || form.interest === 'both';
    const wantsParticipate = form.interest === 'participate' || form.interest === 'both';

    const submit = async (e) => {
        e?.preventDefault?.();
        if (submittingRef.current || submitting || done) return;
        if (!form.interest) {
            setError('Pick Volunteer, Participate, or Both');
            return;
        }
        if (!form.name.trim() || form.name.trim().length < 2) {
            setError('Enter your name');
            nameRef.current?.focus();
            return;
        }
        const phone = digitsOnly(form.phone);
        if (phone.length !== 10) {
            setError('Enter a valid 10-digit phone number');
            return;
        }
        submittingRef.current = true;
        setSubmitting(true);
        setError('');
        try {
            const { data } = await publicFetchJSONRetry(
                `/fests/${encodeURIComponent(festSlugOrId)}/stall-leads`,
                {
                    method: 'POST',
                    retries: 2,
                    timeout: 12000,
                    body: {
                        name: form.name.trim(),
                        phone,
                        year: form.year.trim(),
                        branch: form.branch.trim(),
                        interest: form.interest,
                        volunteerTeams: wantsVolunteer ? form.volunteerTeams : [],
                        competitionIds: wantsParticipate ? form.competitionIds : [],
                        source: 'shubharam_stall',
                    },
                },
            );
            setDoneMessage(data.message || 'Thanks! We saved your interest.');
            setDone(true);
        } catch (err) {
            if (err?.status === 429) {
                setError('Lots of people submitting right now — wait a few seconds and try again');
            } else if (err?.isNetworkError || err?.code === 'ECONNABORTED' || err?.code === 'ERR_NOT_JSON') {
                setError('Connection hiccup — check WiFi and tap Submit again');
            } else {
                setError(err.message || 'Submit failed — check connection and try again');
            }
        } finally {
            submittingRef.current = false;
            setSubmitting(false);
        }
    };

    const submitFromSticky = () => {
        if (submittingRef.current || submitting || done) return;
        if (!form.interest) {
            setError('Pick Volunteer, Participate, or Both');
            return;
        }
        if (formRef.current && !formRef.current.checkValidity()) {
            formRef.current.reportValidity();
            return;
        }
        if (formRef.current) {
            formRef.current.requestSubmit();
            return;
        }
        submit();
    };

    if (loading) {
        return (
            <div className="min-h-dvh bg-[#0c0d0e] text-white">
                <InlinePageLoader label="Loading…" variant="fest" />
            </div>
        );
    }

    if (!fest) {
        return (
            <div className="min-h-dvh bg-[#0c0d0e] text-white flex flex-col items-center justify-center px-6 text-center gap-3">
                <p className="text-red-400">{error || 'Stall not found'}</p>
                <Link to="/" className="text-[#0ECCEE] text-sm">Back to CrwdCtrl</Link>
            </div>
        );
    }

    if (done) {
        const publicUrl = fest.slug
            ? `/view-details/${fest.slug}`
            : `/view-details/${fest.id}`;
        return (
            <div className="min-h-dvh bg-[#0c0d0e] text-white flex items-center justify-center px-5 relative overflow-hidden">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(14,204,238,0.12),_transparent_55%)]" />
                <div className="relative w-full max-w-sm text-center space-y-4">
                    <div className="mx-auto size-14 rounded-full bg-emerald-500/15 flex items-center justify-center">
                        <CheckCircle2 className="text-emerald-400" size={28} />
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight">You&apos;re on the list</h1>
                    <p className="text-sm text-gray-400 leading-relaxed">
                        {doneMessage || `Thanks for your interest in ${fest.festName}. The team will reach out.`}
                    </p>
                    <Link
                        to={publicUrl}
                        className="inline-flex w-full justify-center py-3.5 rounded-2xl bg-[#0ECCEE] text-black font-semibold text-sm"
                    >
                        View fest page
                    </Link>
                    <button
                        type="button"
                        onClick={() => {
                            setDone(false);
                            setDoneMessage('');
                            setForm({
                                name: '',
                                phone: '',
                                year: '',
                                branch: '',
                                interest: '',
                                volunteerTeams: [],
                                competitionIds: [],
                            });
                        }}
                        className="text-xs text-gray-500 hover:text-gray-300"
                    >
                        Submit another
                    </button>
                    <p className="pt-4 text-[11px] text-gray-600">Powered by CrwdCtrl</p>
                </div>
            </div>
        );
    }

    const chipClass = (active) =>
        `min-h-10 px-3 py-2 rounded-full text-[13px] border transition active:scale-[0.98] ${
            active
                ? 'border-[#0ECCEE] bg-[#0ECCEE]/15 text-[#0ECCEE] font-medium'
                : 'border-white/10 bg-white/[0.03] text-gray-300'
        }`;

    return (
        <div className="min-h-dvh bg-[#0c0d0e] text-white relative overflow-hidden">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(14,204,238,0.10),_transparent_50%)]" />
            <div className="relative max-w-md mx-auto px-4 pt-[max(1.25rem,var(--safe-top))] pb-[max(1.25rem,var(--safe-bottom))]">
                <header className="pt-3 pb-5">
                    <h1 className="text-[1.65rem] font-bold tracking-tight leading-none">
                        {fest.festName}
                    </h1>
                    <p className="mt-2 text-xs text-gray-500">
                        {[fest.collegeName, fest.city].filter(Boolean).join(' · ') || 'Leave your interest — takes ~30 sec'}
                    </p>
                </header>

                <form ref={formRef} id="stall-interest-form" onSubmit={submit} className="space-y-5 pb-40">
                    <section>
                        <p className="text-[11px] text-gray-500 mb-2.5 uppercase tracking-wider">I want to</p>
                        <div className="grid grid-cols-3 gap-2">
                            {INTERESTS.map((opt) => {
                                const active = form.interest === opt.id;
                                return (
                                    <button
                                        key={opt.id}
                                        type="button"
                                        onClick={() => {
                                            setForm({
                                                ...form,
                                                interest: opt.id,
                                                volunteerTeams: opt.id === 'participate' ? [] : form.volunteerTeams,
                                                competitionIds: opt.id === 'volunteer' ? [] : form.competitionIds,
                                            });
                                            setError('');
                                            setTimeout(() => nameRef.current?.focus(), 80);
                                        }}
                                        className={`rounded-2xl border px-2 py-3 text-center transition active:scale-[0.98] ${
                                            active
                                                ? 'border-[#0ECCEE] bg-[#0ECCEE]/15'
                                                : 'border-white/10 bg-white/[0.03]'
                                        }`}
                                    >
                                        <p className={`text-[13px] font-semibold leading-tight ${active ? 'text-[#0ECCEE]' : 'text-white'}`}>
                                            {opt.label}
                                        </p>
                                        <p className="text-[10px] text-gray-500 mt-1 leading-tight">{opt.hint}</p>
                                    </button>
                                );
                            })}
                        </div>
                    </section>

                    {wantsVolunteer ? (
                        <section>
                            <div className="flex items-baseline justify-between gap-2 mb-2.5">
                                <p className="text-[11px] text-gray-500 uppercase tracking-wider">
                                    Which team? <span className="normal-case tracking-normal text-gray-600">(optional)</span>
                                </p>
                                {form.volunteerTeams.length ? (
                                    <p className="text-[11px] text-[#0ECCEE] tabular-nums">{form.volunteerTeams.length} selected</p>
                                ) : null}
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {volunteerTeams.map((t) => (
                                    <button
                                        key={t.id}
                                        type="button"
                                        onClick={() => setForm({
                                            ...form,
                                            volunteerTeams: toggleInList(form.volunteerTeams, t.id),
                                        })}
                                        className={chipClass(form.volunteerTeams.includes(t.id))}
                                    >
                                        {t.label}
                                    </button>
                                ))}
                            </div>
                        </section>
                    ) : null}

                    {wantsParticipate ? (
                        <section>
                            <div className="flex items-baseline justify-between gap-2 mb-2.5">
                                <p className="text-[11px] text-gray-500 uppercase tracking-wider">
                                    Which competition? <span className="normal-case tracking-normal text-gray-600">(optional)</span>
                                </p>
                                {form.competitionIds.length ? (
                                    <p className="text-[11px] text-[#0ECCEE] tabular-nums">{form.competitionIds.length} selected</p>
                                ) : null}
                            </div>
                            {competitions.length ? (
                                <div className="grid grid-cols-2 gap-2 max-h-[40vh] overflow-y-auto overscroll-contain pr-0.5">
                                    {competitions.map((c) => {
                                        const id = String(c.id);
                                        const active = form.competitionIds.includes(id);
                                        return (
                                            <button
                                                key={id}
                                                type="button"
                                                onClick={() => setForm({
                                                    ...form,
                                                    competitionIds: toggleInList(form.competitionIds, id),
                                                })}
                                                className={`min-h-11 px-3 py-2.5 rounded-xl text-left text-[13px] border transition active:scale-[0.98] ${
                                                    active
                                                        ? 'border-[#0ECCEE] bg-[#0ECCEE]/15 text-[#0ECCEE] font-medium'
                                                        : 'border-white/10 bg-white/[0.03] text-gray-300'
                                                }`}
                                            >
                                                {c.name}
                                            </button>
                                        );
                                    })}
                                </div>
                            ) : (
                                <p className="text-xs text-gray-600">Competitions coming soon — you can still submit.</p>
                            )}
                        </section>
                    ) : null}

                    <section className="space-y-1">
                        <p className="text-[11px] text-gray-500 mb-1 uppercase tracking-wider">Your details</p>
                        <input
                            ref={nameRef}
                            required
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            placeholder="Your name"
                            autoComplete="name"
                            className="w-full px-0 py-3.5 bg-transparent border-0 border-b border-white/12 text-white text-base placeholder:text-gray-600 focus:outline-none focus:border-[#0ECCEE]"
                        />
                        <div>
                            <input
                                required
                                type="tel"
                                inputMode="numeric"
                                value={form.phone}
                                onChange={(e) => setForm({ ...form, phone: digitsOnly(e.target.value) })}
                                placeholder="10-digit phone"
                                autoComplete="tel"
                                maxLength={10}
                                className="w-full px-0 py-3.5 bg-transparent border-0 border-b border-white/12 text-white text-base placeholder:text-gray-600 focus:outline-none focus:border-[#0ECCEE]"
                            />
                            {form.phone && form.phone.length < 10 ? (
                                <p className="text-[11px] text-gray-600 mt-1.5">{10 - form.phone.length} more digits</p>
                            ) : null}
                        </div>
                    </section>

                    <section>
                        <p className="text-[11px] text-gray-500 mb-2.5 uppercase tracking-wider">Year</p>
                        <div className="grid grid-cols-4 gap-2">
                            {YEARS.map((y) => (
                                <button
                                    key={y}
                                    type="button"
                                    onClick={() => setForm({ ...form, year: form.year === y ? '' : y })}
                                    className={`min-h-10 rounded-xl text-sm border transition ${
                                        form.year === y
                                            ? 'border-[#0ECCEE] bg-[#0ECCEE]/15 text-[#0ECCEE] font-medium'
                                            : 'border-white/10 bg-white/[0.03] text-gray-400'
                                    }`}
                                >
                                    {y}
                                </button>
                            ))}
                        </div>
                    </section>

                    <section>
                        <p className="text-[11px] text-gray-500 mb-2.5 uppercase tracking-wider">Dept</p>
                        <div className="flex flex-wrap gap-2 mb-2">
                            {DEPTS.map((d) => (
                                <button
                                    key={d}
                                    type="button"
                                    onClick={() => setForm({ ...form, branch: form.branch === d ? '' : d })}
                                    className={chipClass(form.branch === d)}
                                >
                                    {d}
                                </button>
                            ))}
                        </div>
                        <input
                            value={DEPTS.includes(form.branch) ? '' : form.branch}
                            onChange={(e) => setForm({ ...form, branch: e.target.value.slice(0, 80) })}
                            placeholder="Or write your dept"
                            autoComplete="organization-title"
                            className="w-full px-0 py-3 bg-transparent border-0 border-b border-white/12 text-white text-base placeholder:text-gray-600 focus:outline-none focus:border-[#0ECCEE]"
                        />
                    </section>
                </form>

                <div className="fixed bottom-0 inset-x-0 z-20 pointer-events-none">
                    <div className="max-w-md mx-auto px-4 pb-[max(0.85rem,var(--safe-bottom))] pt-8 bg-gradient-to-t from-[#0c0d0e] via-[#0c0d0e]/95 to-transparent pointer-events-auto">
                        {error ? <p className="mb-2 text-sm text-red-400 text-center">{error}</p> : null}
                        <button
                            type="button"
                            onClick={submitFromSticky}
                            disabled={submitting}
                            className="w-full py-3.5 rounded-2xl bg-[#0ECCEE] text-black font-semibold text-sm disabled:opacity-50 inline-flex items-center justify-center gap-2 shadow-[0_8px_30px_rgba(14,204,238,0.25)]"
                        >
                            {submitting ? <Loader className="animate-spin" size={16} /> : null}
                            Submit
                        </button>
                        <p className="mt-3 text-[11px] text-gray-600 text-center">Powered by CrwdCtrl</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
