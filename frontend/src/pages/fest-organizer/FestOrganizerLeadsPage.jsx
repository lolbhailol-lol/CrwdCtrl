import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
    ClipboardList, Download, Loader, RefreshCw, QrCode, Users,
    Phone, MessageCircle, Check, Maximize2, X, Trash2, Filter,
} from 'lucide-react';
import {
    createFestOrganizerLead,
    deleteFestOrganizerLead,
    exportFestOrganizerLeads,
    fetchFestOrganizerLeadStats,
    fetchFestOrganizerLeads,
    updateFestOrganizerLead,
} from '../../services/api/festOrganizer.api';
import { useDialog } from '../../context/DialogContext';
import { getFestOrganizerSession } from '../../utils/festOrganizerSession';
import { openWhatsApp } from '../../utils/whatsappDeepLink';

const INTERESTS = [
    { id: 'volunteer', label: 'Volunteer' },
    { id: 'participate', label: 'Participate' },
    { id: 'both', label: 'Both' },
];

const DEFAULT_TEAMS = [
    { id: 'creatives', label: 'Creatives' },
    { id: 'competition', label: 'Competitions' },
    { id: 'pr', label: 'PR' },
    { id: 'sponsorship', label: 'Sponsorship' },
    { id: 'marathon', label: 'Marathon' },
];

function interestLabel(id) {
    return INTERESTS.find((i) => i.id === id)?.label || id;
}

function teamLabel(id, teams = DEFAULT_TEAMS) {
    if (id === 'team') return 'Creatives';
    return teams.find((t) => t.id === id)?.label || id;
}

function toggleInList(list, id) {
    return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

function formatTime(d) {
    if (!d) return '';
    return new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

/** Local calendar date as YYYY-MM-DD (India-facing UI; backend filters in IST). */
function localDateInputValue(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function formatDayLabel(dateStr) {
    if (!dateStr) return 'All dates';
    try {
        const [y, m, d] = dateStr.split('-').map(Number);
        return new Date(y, m - 1, d).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });
    } catch {
        return dateStr;
    }
}

function firstName(name = '') {
    return String(name || '').trim().split(/\s+/)[0] || '';
}

function telHref(phone) {
    const digits = String(phone || '').replace(/\D/g, '');
    if (!digits) return '';
    return `tel:+${digits.length === 10 ? `91${digits}` : digits}`;
}

export default function FestOrganizerLeadsPage() {
    const { festId } = useParams();
    const { toast, confirm } = useDialog();
    const [stats, setStats] = useState(null);
    const [leads, setLeads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    /** YYYY-MM-DD or '' for all dates */
    const [selectedDate, setSelectedDate] = useState(() => localDateInputValue());
    /** '' | volunteer | participate */
    const [interestFilter, setInterestFilter] = useState('');
    /** volunteer team id or '' */
    const [teamFilter, setTeamFilter] = useState('');
    /** competition id or '' */
    const [competitionFilter, setCompetitionFilter] = useState('');
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [qrFullscreen, setQrFullscreen] = useState(false);
    const [volunteerTeams, setVolunteerTeams] = useState(DEFAULT_TEAMS);
    const [festCompetitions, setFestCompetitions] = useState([]);
    const [form, setForm] = useState({
        name: '',
        phone: '',
        year: '',
        branch: '',
        interest: 'volunteer',
        volunteerTeams: [],
        competitionIds: [],
        note: '',
    });

    const sessionFest = useMemo(() => {
        const session = getFestOrganizerSession();
        return session?.fests?.find((f) => String(f._id) === String(festId)) || null;
    }, [festId]);

    const festName = sessionFest?.festName || 'Fest';
    const stallKey = sessionFest?.slug || festId;
    const stallPath = `/stall/${stallKey}`;
    const stallUrl = typeof window !== 'undefined'
        ? `${window.location.origin}${stallPath}`
        : stallPath;
    const qrImg = `https://api.qrserver.com/v1/create-qr-code/?size=480x480&data=${encodeURIComponent(stallUrl)}`;

    const load = useCallback(async ({ silent = false } = {}) => {
        if (!silent) setLoading(true);
        try {
            const params = { limit: 80 };
            if (selectedDate) params.date = selectedDate;
            if (interestFilter) params.interest = interestFilter;
            if (teamFilter) params.team = teamFilter;
            if (competitionFilter) params.competitionId = competitionFilter;
            if (search.trim()) params.search = search.trim();
            const statsParams = selectedDate ? { date: selectedDate } : {};
            const [listData, statsData] = await Promise.all([
                fetchFestOrganizerLeads(festId, params),
                fetchFestOrganizerLeadStats(festId, statsParams),
            ]);
            setLeads(listData.leads || []);
            setStats(statsData.stats || null);
            if (Array.isArray(listData.volunteerTeams) && listData.volunteerTeams.length) {
                setVolunteerTeams(listData.volunteerTeams);
            }
            if (Array.isArray(listData.competitions)) {
                setFestCompetitions(listData.competitions);
            }
        } catch (e) {
            if (!silent) toast(e.message || 'Failed to load leads');
        } finally {
            if (!silent) setLoading(false);
        }
    }, [festId, interestFilter, teamFilter, competitionFilter, search, selectedDate, toast]);

    useEffect(() => {
        load({ silent: false });

        const poll = () => {
            if (typeof document !== 'undefined' && document.hidden) return;
            load({ silent: true });
        };

        const t = setInterval(poll, 3000);
        const onVisible = () => {
            if (!document.hidden) load({ silent: true });
        };
        const onFocus = () => load({ silent: true });

        document.addEventListener('visibilitychange', onVisible);
        window.addEventListener('focus', onFocus);
        return () => {
            clearInterval(t);
            document.removeEventListener('visibilitychange', onVisible);
            window.removeEventListener('focus', onFocus);
        };
    }, [load]);

    useEffect(() => {
        if (!qrFullscreen) return undefined;
        const onKey = (e) => {
            if (e.key === 'Escape') setQrFullscreen(false);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [qrFullscreen]);

    const saveKiosk = async (e) => {
        e.preventDefault();
        const phone = String(form.phone || '').replace(/\D/g, '');
        if (phone.length !== 10) {
            toast('Enter a valid 10-digit phone');
            return;
        }
        if (!form.name.trim() || form.name.trim().length < 2) {
            toast('Enter name');
            return;
        }
        setSaving(true);
        try {
            const wantsVolunteer = form.interest === 'volunteer' || form.interest === 'both';
            const wantsParticipate = form.interest === 'participate' || form.interest === 'both';
            const data = await createFestOrganizerLead(festId, {
                name: form.name.trim(),
                phone,
                year: form.year.trim(),
                branch: form.branch.trim(),
                interest: form.interest,
                volunteerTeams: wantsVolunteer ? form.volunteerTeams : [],
                competitionIds: wantsParticipate ? form.competitionIds : [],
                note: form.note.trim(),
                source: 'organizer_kiosk',
            });
            toast('Saved');
            setForm({
                name: '',
                phone: '',
                year: '',
                branch: '',
                interest: form.interest,
                volunteerTeams: [],
                competitionIds: [],
                note: '',
            });
            const today = localDateInputValue();
            setSelectedDate(today);
            if (data.lead) {
                setLeads((prev) => {
                    const without = prev.filter((l) => l.id !== data.lead.id && l.phone !== data.lead.phone);
                    return [data.lead, ...without];
                });
            }
            await load({ silent: true });
        } catch (err) {
            toast(err.message || 'Save failed');
        } finally {
            setSaving(false);
        }
    };

    const exportExcel = async () => {
        try {
            const blob = await exportFestOrganizerLeads(festId, {
                date: selectedDate || undefined,
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `stall_leads${selectedDate ? `_${selectedDate}` : ''}.xlsx`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            toast(e.message || 'Export failed');
        }
    };

    const copyLink = async () => {
        try {
            await navigator.clipboard.writeText(stallUrl);
            toast('Stall link copied');
        } catch {
            toast(stallUrl);
        }
    };

    const toggleContacted = async (lead) => {
        const next = !lead.contacted;
        setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, contacted: next } : l)));
        try {
            const data = await updateFestOrganizerLead(festId, lead.id, { contacted: next });
            if (data.lead) {
                setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, ...data.lead } : l)));
            }
        } catch (e) {
            setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, contacted: lead.contacted } : l)));
            toast(e.message || 'Could not update');
        }
    };

    const deleteLead = async (lead) => {
        const ok = await confirm({
            title: 'Delete lead?',
            message: `Remove ${lead.name || 'this entry'} (${lead.phone || 'no phone'})? This cannot be undone.`,
            confirmText: 'Delete',
            tone: 'danger',
        });
        if (!ok) return;
        try {
            await deleteFestOrganizerLead(festId, lead.id);
            setLeads((prev) => prev.filter((l) => l.id !== lead.id));
            toast('Lead deleted');
            load({ silent: true });
        } catch (e) {
            toast(e.message || 'Delete failed');
        }
    };

    const messageForLead = (lead) => {
        const who = firstName(lead.name);
        const interest = interestLabel(lead.interest).toLowerCase();
        return `Hi${who ? ` ${who}` : ''}! Thanks for signing up to ${interest} at ${festName}. Quick follow-up from the team.`;
    };

    const todayStr = localDateInputValue();
    const activeFilterCount = [
        selectedDate && selectedDate !== todayStr ? selectedDate : null,
        !selectedDate ? 'all' : null,
        interestFilter,
        teamFilter,
        competitionFilter,
    ].filter(Boolean).length;

    const clearFilters = () => {
        setSelectedDate(todayStr);
        setInterestFilter('');
        setTeamFilter('');
        setCompetitionFilter('');
    };

    const chipBtn = (active) =>
        `px-2.5 py-1.5 rounded-lg text-[11px] border transition ${
            active
                ? 'border-[#0ECCEE] bg-[#0ECCEE]/15 text-[#0ECCEE]'
                : 'border-white/10 text-gray-400'
        }`;

    const filterSummary = [
        formatDayLabel(selectedDate),
        interestFilter ? interestLabel(interestFilter) : null,
        teamFilter ? teamLabel(teamFilter, volunteerTeams) : null,
        competitionFilter
            ? festCompetitions.find((c) => String(c.id) === competitionFilter)?.name
            : null,
    ].filter(Boolean).join(' · ');

    return (
        <div className="max-w-5xl mx-auto space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="text-xl font-bold flex items-center gap-2">
                        <ClipboardList className="text-[#0ECCEE]" size={20} /> Stall / Leads
                    </h1>
                    <p className="text-xs text-gray-500 mt-1">Add at kiosk or scan QR — list updates live</p>
                </div>
                <div className="flex gap-2">
                    <button type="button" onClick={exportExcel} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/10 text-sm text-gray-300">
                        <Download size={14} /> Export Excel
                    </button>
                    <button type="button" onClick={() => load({ silent: false })} className="p-2 rounded-xl border border-white/10 text-gray-400">
                        <RefreshCw size={16} />
                    </button>
                </div>
            </div>

            {stats ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                        [formatDayLabel(selectedDate), stats.day ?? stats.today ?? stats.allTime],
                        ['Volunteer', stats.volunteer],
                        ['Participate', stats.participate],
                        ['Both', stats.both],
                    ].map(([label, value]) => (
                        <div key={label} className="rounded-2xl border border-white/10 bg-[#161718] p-4 text-center">
                            <p className="text-2xl font-semibold tabular-nums">{value}</p>
                            <p className="text-[11px] text-gray-500 mt-1">{label}</p>
                        </div>
                    ))}
                </div>
            ) : null}

            <div className="grid lg:grid-cols-2 gap-4">
                <form onSubmit={saveKiosk} className="rounded-2xl border border-white/10 bg-[#161718] p-4 space-y-3">
                    <p className="text-sm font-semibold flex items-center gap-2">
                        <Users size={14} className="text-[#0ECCEE]" /> Quick add
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                        {INTERESTS.map((opt) => (
                            <button
                                key={opt.id}
                                type="button"
                                onClick={() => setForm({
                                    ...form,
                                    interest: opt.id,
                                    volunteerTeams: opt.id === 'participate' ? [] : form.volunteerTeams,
                                    competitionIds: opt.id === 'volunteer' ? [] : form.competitionIds,
                                })}
                                className={`py-2.5 rounded-xl text-xs font-semibold border ${
                                    form.interest === opt.id
                                        ? 'border-[#0ECCEE] bg-[#0ECCEE]/15 text-[#0ECCEE]'
                                        : 'border-white/10 text-gray-400'
                                }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                    {(form.interest === 'volunteer' || form.interest === 'both') ? (
                        <div>
                            <p className="text-[10px] text-gray-500 mb-1.5 uppercase tracking-wider">Team (optional)</p>
                            <div className="flex flex-wrap gap-1.5">
                                {volunteerTeams.map((t) => (
                                    <button
                                        key={t.id}
                                        type="button"
                                        onClick={() => setForm({
                                            ...form,
                                            volunteerTeams: toggleInList(form.volunteerTeams, t.id),
                                        })}
                                        className={`px-2.5 py-1.5 rounded-lg text-[11px] border ${
                                            form.volunteerTeams.includes(t.id)
                                                ? 'border-[#0ECCEE] bg-[#0ECCEE]/15 text-[#0ECCEE]'
                                                : 'border-white/10 text-gray-500'
                                        }`}
                                    >
                                        {t.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : null}
                    {(form.interest === 'participate' || form.interest === 'both') && festCompetitions.length ? (
                        <div>
                            <p className="text-[10px] text-gray-500 mb-1.5 uppercase tracking-wider">Competition (optional)</p>
                            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                                {festCompetitions.map((c) => {
                                    const id = String(c.id);
                                    return (
                                        <button
                                            key={id}
                                            type="button"
                                            onClick={() => setForm({
                                                ...form,
                                                competitionIds: toggleInList(form.competitionIds, id),
                                            })}
                                            className={`px-2.5 py-1.5 rounded-lg text-[11px] border ${
                                                form.competitionIds.includes(id)
                                                    ? 'border-[#0ECCEE] bg-[#0ECCEE]/15 text-[#0ECCEE]'
                                                    : 'border-white/10 text-gray-500'
                                            }`}
                                        >
                                            {c.name}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ) : null}
                    <input
                        required
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder="Name"
                        className="w-full px-3 py-2.5 rounded-xl bg-[#111213] border border-white/10 text-sm text-white"
                    />
                    <input
                        required
                        type="tel"
                        inputMode="numeric"
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                        placeholder="10-digit phone"
                        maxLength={10}
                        className="w-full px-3 py-2.5 rounded-xl bg-[#111213] border border-white/10 text-sm text-white"
                    />
                    <div className="grid grid-cols-2 gap-2">
                        <input
                            value={form.year}
                            onChange={(e) => setForm({ ...form, year: e.target.value })}
                            placeholder="Year (opt)"
                            className="w-full px-3 py-2.5 rounded-xl bg-[#111213] border border-white/10 text-sm text-white"
                        />
                        <input
                            value={form.branch}
                            onChange={(e) => setForm({ ...form, branch: e.target.value })}
                            placeholder="Branch (opt)"
                            className="w-full px-3 py-2.5 rounded-xl bg-[#111213] border border-white/10 text-sm text-white"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={saving}
                        className="w-full py-3 rounded-xl bg-[#0ECCEE] text-black font-semibold text-sm disabled:opacity-50 inline-flex items-center justify-center gap-2"
                    >
                        {saving ? <Loader className="animate-spin" size={16} /> : null}
                        Save & next
                    </button>
                </form>

                <div className="rounded-2xl border border-white/10 bg-[#161718] p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold flex items-center gap-2">
                            <QrCode size={14} className="text-[#0ECCEE]" /> Student QR
                        </p>
                        <button
                            type="button"
                            onClick={() => setQrFullscreen(true)}
                            className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-white"
                        >
                            <Maximize2 size={12} /> Fullscreen
                        </button>
                    </div>
                    <p className="text-xs text-gray-500">Show on tablet or print for the stall.</p>
                    <div className="flex justify-center bg-white rounded-xl p-3">
                        <img src={qrImg} alt="Stall QR" width={200} height={200} className="rounded-lg" />
                    </div>
                    <p className="text-[11px] text-gray-500 break-all text-center">{stallUrl}</p>
                    <button type="button" onClick={copyLink} className="w-full py-2.5 rounded-xl border border-white/10 text-sm text-gray-300">
                        Copy link
                    </button>
                </div>
            </div>

            <div className="space-y-3">
                <div className="flex gap-2 items-center">
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search name or phone…"
                        className="min-w-0 flex-1 px-3 py-2.5 rounded-xl bg-[#161718] border border-white/10 text-sm text-white"
                    />
                    <button
                        type="button"
                        onClick={() => setFiltersOpen((v) => !v)}
                        className={`relative shrink-0 p-2.5 rounded-xl border transition ${
                            filtersOpen || activeFilterCount
                                ? 'border-[#0ECCEE] bg-[#0ECCEE]/15 text-[#0ECCEE]'
                                : 'border-white/10 text-gray-400'
                        }`}
                        aria-label="Filters"
                        title="Filters"
                    >
                        <Filter size={18} />
                        {activeFilterCount ? (
                            <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-[#0ECCEE] text-black text-[10px] font-bold flex items-center justify-center">
                                {activeFilterCount}
                            </span>
                        ) : null}
                    </button>
                </div>

                <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] text-gray-500 truncate">
                        {filterSummary}
                        {stats?.allTime != null ? ` · ${stats.allTime} total` : ''}
                        {` · ${leads.length} shown`}
                    </p>
                    {activeFilterCount ? (
                        <button
                            type="button"
                            onClick={clearFilters}
                            className="text-[11px] text-gray-500 hover:text-[#0ECCEE] shrink-0"
                        >
                            Reset
                        </button>
                    ) : null}
                </div>

                {filtersOpen ? (
                    <div className="rounded-2xl border border-white/10 bg-[#161718] p-4 space-y-4">
                        <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold text-white">Filters</p>
                            <button
                                type="button"
                                onClick={() => setFiltersOpen(false)}
                                className="p-1.5 rounded-lg text-gray-500 hover:text-white"
                                aria-label="Close filters"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div className="space-y-2">
                            <p className="text-[10px] uppercase tracking-wider text-gray-500">Date</p>
                            <div className="flex flex-wrap gap-2 items-center">
                                <input
                                    type="date"
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    className="px-3 py-2 rounded-xl bg-[#111213] border border-white/10 text-sm text-white"
                                />
                                <button
                                    type="button"
                                    onClick={() => setSelectedDate(todayStr)}
                                    className={chipBtn(selectedDate === todayStr)}
                                >
                                    Today
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSelectedDate('')}
                                    className={chipBtn(!selectedDate)}
                                >
                                    All
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <p className="text-[10px] uppercase tracking-wider text-gray-500">Type</p>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setInterestFilter('');
                                        setTeamFilter('');
                                        setCompetitionFilter('');
                                    }}
                                    className={chipBtn(!interestFilter && !teamFilter && !competitionFilter)}
                                >
                                    Any
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setInterestFilter('volunteer');
                                        setCompetitionFilter('');
                                    }}
                                    className={chipBtn(interestFilter === 'volunteer')}
                                >
                                    Volunteer
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setInterestFilter('participate');
                                        setTeamFilter('');
                                    }}
                                    className={chipBtn(interestFilter === 'participate')}
                                >
                                    Participate
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <p className="text-[10px] uppercase tracking-wider text-gray-500">Volunteer team</p>
                            <div className="flex flex-wrap gap-1.5">
                                {volunteerTeams.map((t) => (
                                    <button
                                        key={t.id}
                                        type="button"
                                        onClick={() => {
                                            const next = teamFilter === t.id ? '' : t.id;
                                            setTeamFilter(next);
                                            if (next) {
                                                setInterestFilter('volunteer');
                                                setCompetitionFilter('');
                                            }
                                        }}
                                        className={chipBtn(teamFilter === t.id)}
                                    >
                                        {t.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {festCompetitions.length ? (
                            <div className="space-y-2">
                                <p className="text-[10px] uppercase tracking-wider text-gray-500">Competition</p>
                                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                                    {festCompetitions.map((c) => {
                                        const id = String(c.id);
                                        return (
                                            <button
                                                key={id}
                                                type="button"
                                                onClick={() => {
                                                    const next = competitionFilter === id ? '' : id;
                                                    setCompetitionFilter(next);
                                                    if (next) {
                                                        setInterestFilter('participate');
                                                        setTeamFilter('');
                                                    }
                                                }}
                                                className={chipBtn(competitionFilter === id)}
                                            >
                                                {c.name}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : null}

                        <button
                            type="button"
                            onClick={() => setFiltersOpen(false)}
                            className="w-full py-2.5 rounded-xl bg-[#0ECCEE] text-black text-sm font-semibold"
                        >
                            Done
                        </button>
                    </div>
                ) : null}

                {loading ? (
                    <div className="flex justify-center py-12 text-gray-400 gap-2">
                        <Loader className="animate-spin" size={18} /> Loading…
                    </div>
                ) : (
                    <div className="space-y-2">
                        {leads.map((lead) => {
                            const callHref = telHref(lead.phone);
                            return (
                                <div
                                    key={lead.id}
                                    className={`rounded-xl border bg-[#161718] px-4 py-3 flex flex-wrap items-center gap-3 ${
                                        lead.contacted ? 'border-emerald-500/20 opacity-80' : 'border-white/10'
                                    }`}
                                >
                                    <div className="min-w-0 flex-1">
                                        <p className="font-medium text-white truncate">{lead.name}</p>
                                        <p className="text-xs text-gray-500 truncate">
                                            {lead.phone}
                                            {lead.year ? ` · ${lead.year}` : ''}
                                            {lead.branch ? ` · ${lead.branch}` : ''}
                                        </p>
                                        {(lead.volunteerTeams?.length || lead.competitions?.length) ? (
                                            <p className="text-[11px] text-gray-400 mt-1 truncate">
                                                {[
                                                    ...(lead.volunteerTeams || []).map((t) => teamLabel(t, volunteerTeams)),
                                                    ...(lead.competitions || []).map((c) => c.name).filter(Boolean),
                                                ].join(' · ')}
                                            </p>
                                        ) : null}
                                    </div>
                                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#0ECCEE]/15 text-[#0ECCEE]">
                                        {interestLabel(lead.interest)}
                                    </span>
                                    <span className="text-[11px] text-gray-600 tabular-nums">
                                        {selectedDate
                                            ? formatTime(lead.createdAt)
                                            : new Date(lead.createdAt).toLocaleString('en-IN', {
                                                day: 'numeric',
                                                month: 'short',
                                                hour: '2-digit',
                                                minute: '2-digit',
                                            })}
                                    </span>
                                    <div className="flex items-center gap-1.5">
                                        {callHref ? (
                                            <a
                                                href={callHref}
                                                className="p-2 rounded-lg border border-white/10 text-gray-300 hover:text-white"
                                                title="Call"
                                                aria-label={`Call ${lead.name}`}
                                            >
                                                <Phone size={14} />
                                            </a>
                                        ) : null}
                                        <button
                                            type="button"
                                            onClick={() => openWhatsApp(lead.phone, messageForLead(lead))}
                                            className="p-2 rounded-lg border border-white/10 text-emerald-400 hover:bg-emerald-500/10"
                                            title="WhatsApp"
                                            aria-label={`WhatsApp ${lead.name}`}
                                        >
                                            <MessageCircle size={14} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => toggleContacted(lead)}
                                            className={`p-2 rounded-lg border ${
                                                lead.contacted
                                                    ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400'
                                                    : 'border-white/10 text-gray-500 hover:text-white'
                                            }`}
                                            title={lead.contacted ? 'Marked contacted' : 'Mark contacted'}
                                            aria-label={lead.contacted ? 'Unmark contacted' : 'Mark contacted'}
                                        >
                                            <Check size={14} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => deleteLead(lead)}
                                            className="p-2 rounded-lg border border-white/10 text-red-400 hover:bg-red-500/10"
                                            title="Delete"
                                            aria-label={`Delete ${lead.name}`}
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                        {!leads.length ? (
                            <p className="text-center text-gray-500 py-10 text-sm">
                                {selectedDate
                                    ? `No leads for ${formatDayLabel(selectedDate)} — try All, or add via Quick add / QR.`
                                    : 'No leads yet — use Quick add or QR.'}
                            </p>
                        ) : null}
                    </div>
                )}
            </div>

            {qrFullscreen ? (
                <div className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center p-6">
                    <button
                        type="button"
                        onClick={() => setQrFullscreen(false)}
                        className="absolute top-4 right-4 p-2 rounded-full bg-black/5 text-black"
                        aria-label="Close fullscreen QR"
                    >
                        <X size={20} />
                    </button>
                    <p className="text-black font-bold text-xl mb-2 text-center">{festName}</p>
                    <p className="text-gray-500 text-sm mb-6 text-center">Scan to leave your interest</p>
                    <img src={qrImg} alt="Stall QR fullscreen" className="w-[min(70vw,420px)] h-auto" />
                    <p className="mt-6 text-xs text-gray-400 break-all text-center max-w-md">{stallUrl}</p>
                </div>
            ) : null}
        </div>
    );
}
