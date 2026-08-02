import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Loader, CheckCircle2, PartyPopper } from 'lucide-react';
import { getApiBaseUrl } from '../../config/apiBase';

const INTERESTS = [
    { id: 'volunteer', label: 'Volunteer', hint: 'Help run Aarohan' },
    { id: 'participate', label: 'Participate', hint: 'Join competitions' },
    { id: 'both', label: 'Both', hint: 'Volunteer + compete' },
];

const DEFAULT_TEAMS = [
    { id: 'team', label: 'Core team' },
    { id: 'competition', label: 'Competitions' },
    { id: 'pr', label: 'PR' },
    { id: 'sponsorship', label: 'Sponsorship' },
    { id: 'marathon', label: 'Marathon' },
];

const YEARS = ['1st', '2nd', '3rd', '4th'];
const BRANCHES = ['CSE', 'ECE', 'EEE', 'ME', 'CE', 'IT', 'Other'];

function digitsOnly(v) {
    return String(v || '').replace(/\D/g, '').slice(0, 10);
}

function toggleInList(list, id) {
    return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

export default function FestStallInterestPage() {
    const { festSlugOrId } = useParams();
    const nameRef = useRef(null);
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
                const res = await fetch(`${getApiBaseUrl()}/fests/${encodeURIComponent(festSlugOrId)}/stall`);
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data.message || 'Fest not found');
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
        e.preventDefault();
        if (!form.interest) {
            setError('Pick Volunteer, Participate, or Both');
            return;
        }
        if (wantsVolunteer && !form.volunteerTeams.length) {
            setError('Pick at least one volunteer team');
            return;
        }
        if (wantsParticipate && competitions.length && !form.competitionIds.length) {
            setError('Pick at least one competition');
            return;
        }
        const phone = digitsOnly(form.phone);
        if (phone.length !== 10) {
            setError('Enter a valid 10-digit phone number');
            return;
        }
        setSubmitting(true);
        setError('');
        try {
            const res = await fetch(`${getApiBaseUrl()}/fests/${encodeURIComponent(festSlugOrId)}/stall-leads`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: form.name.trim(),
                    phone,
                    year: form.year.trim(),
                    branch: form.branch.trim(),
                    interest: form.interest,
                    volunteerTeams: wantsVolunteer ? form.volunteerTeams : [],
                    competitionIds: wantsParticipate ? form.competitionIds : [],
                    source: 'shubharam_stall',
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.message || 'Submit failed');
            setDoneMessage(data.message || 'Thanks! We saved your interest.');
            setDone(true);
        } catch (err) {
            setError(err.message || 'Submit failed');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-dvh bg-[#0f1011] text-white flex items-center justify-center gap-2">
                <Loader className="animate-spin text-[#0ECCEE]" size={20} /> Loading…
            </div>
        );
    }

    if (!fest) {
        return (
            <div className="min-h-dvh bg-[#0f1011] text-white flex flex-col items-center justify-center px-6 text-center gap-3">
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
            <div className="min-h-dvh bg-[#0f1011] text-white flex items-center justify-center px-5">
                <div className="w-full max-w-sm text-center space-y-4">
                    <div className="mx-auto size-14 rounded-2xl bg-emerald-500/15 flex items-center justify-center">
                        <CheckCircle2 className="text-emerald-400" size={28} />
                    </div>
                    <h1 className="text-2xl font-bold">You&apos;re on the list</h1>
                    <p className="text-sm text-gray-400">
                        {doneMessage || `Thanks for your interest in ${fest.festName}. The team will reach out.`}
                    </p>
                    <Link
                        to={publicUrl}
                        className="inline-flex w-full justify-center py-3 rounded-xl bg-[#0ECCEE] text-black font-semibold text-sm"
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
                </div>
            </div>
        );
    }

    const fieldClass =
        'w-full px-0 py-3 bg-transparent border-0 border-b border-white/15 text-white text-base placeholder:text-gray-600 focus:outline-none focus:border-[#0ECCEE]';

    const chipClass = (active) =>
        `px-3 py-2 rounded-xl text-sm border transition ${
            active
                ? 'border-[#0ECCEE] bg-[#0ECCEE]/15 text-[#0ECCEE]'
                : 'border-white/10 bg-[#161718] text-gray-400'
        }`;

    return (
        <div className="min-h-dvh bg-[#0f1011] text-white px-5 py-8 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
            <div className="max-w-sm mx-auto space-y-6">
                <div className="flex items-start gap-3">
                    <div className="size-12 rounded-2xl bg-[#0ECCEE]/15 flex items-center justify-center shrink-0">
                        <PartyPopper className="text-[#0ECCEE]" size={22} />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[11px] uppercase tracking-wider text-gray-500">Shubharam stall</p>
                        <h1 className="text-xl font-bold leading-tight">{fest.festName}</h1>
                        <p className="text-xs text-gray-500 mt-1">
                            {[fest.collegeName, fest.city].filter(Boolean).join(' · ') || 'Leave your interest in 30 seconds'}
                        </p>
                    </div>
                </div>

                <form onSubmit={submit} className="space-y-5">
                    <div className="space-y-1">
                        <p className="text-xs text-gray-500 mb-2">I want to</p>
                        <div className="grid gap-2">
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
                                        }}
                                        className={`w-full text-left rounded-2xl border px-4 py-3.5 transition ${
                                            active
                                                ? 'border-[#0ECCEE] bg-[#0ECCEE]/15'
                                                : 'border-white/10 bg-[#161718]'
                                        }`}
                                    >
                                        <p className={`font-semibold ${active ? 'text-[#0ECCEE]' : 'text-white'}`}>{opt.label}</p>
                                        <p className="text-xs text-gray-500 mt-0.5">{opt.hint}</p>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {wantsVolunteer ? (
                        <div>
                            <p className="text-xs text-gray-500 mb-2">Volunteer team</p>
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
                        </div>
                    ) : null}

                    {wantsParticipate ? (
                        <div>
                            <p className="text-xs text-gray-500 mb-2">
                                {competitions.length ? 'Which competition?' : 'Competitions'}
                            </p>
                            {competitions.length ? (
                                <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
                                    {competitions.map((c) => {
                                        const id = String(c.id);
                                        return (
                                            <button
                                                key={id}
                                                type="button"
                                                onClick={() => setForm({
                                                    ...form,
                                                    competitionIds: toggleInList(form.competitionIds, id),
                                                })}
                                                className={chipClass(form.competitionIds.includes(id))}
                                            >
                                                {c.name}
                                            </button>
                                        );
                                    })}
                                </div>
                            ) : (
                                <p className="text-xs text-gray-600">Competition list will be updated soon — you can still submit.</p>
                            )}
                        </div>
                    ) : null}

                    <input
                        ref={nameRef}
                        required
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder="Your name"
                        autoComplete="name"
                        className={fieldClass}
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
                            className={fieldClass}
                        />
                        {form.phone && form.phone.length < 10 ? (
                            <p className="text-[11px] text-gray-600 mt-1">{10 - form.phone.length} more digits</p>
                        ) : null}
                    </div>

                    <div>
                        <p className="text-xs text-gray-500 mb-2">Year (optional)</p>
                        <div className="flex flex-wrap gap-2">
                            {YEARS.map((y) => (
                                <button
                                    key={y}
                                    type="button"
                                    onClick={() => setForm({ ...form, year: form.year === y ? '' : y })}
                                    className={chipClass(form.year === y)}
                                >
                                    {y}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <p className="text-xs text-gray-500 mb-2">Branch (optional)</p>
                        <div className="flex flex-wrap gap-2">
                            {BRANCHES.map((b) => (
                                <button
                                    key={b}
                                    type="button"
                                    onClick={() => setForm({ ...form, branch: form.branch === b ? '' : b })}
                                    className={chipClass(form.branch === b)}
                                >
                                    {b}
                                </button>
                            ))}
                        </div>
                    </div>

                    {error ? <p className="text-sm text-red-400">{error}</p> : null}

                    <button
                        type="submit"
                        disabled={submitting}
                        className="w-full py-3.5 rounded-xl bg-[#0ECCEE] text-black font-semibold text-sm disabled:opacity-50 inline-flex items-center justify-center gap-2"
                    >
                        {submitting ? <Loader className="animate-spin" size={16} /> : null}
                        Submit
                    </button>
                </form>

                <p className="text-[11px] text-gray-600 text-center">
                    No login needed · Powered by CrwdCtrl
                </p>
            </div>
        </div>
    );
}
