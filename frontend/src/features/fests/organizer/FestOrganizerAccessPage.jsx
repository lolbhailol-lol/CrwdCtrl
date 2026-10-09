import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Copy, KeyRound, Shield, Trash2, UserPlus, X } from 'lucide-react';
import {
    fetchFestOrganizerAccess,
    inviteFestOrganizerAccess,
    revokeFestOrganizerAccess,
    updateFestOrganizerAccess,
} from '../../../services/api/festOrganizer.api';
import { useDialog } from '../../../context/DialogContext';
import { InlinePageLoader } from '../../../components/DetailPageLoader';
import { FEST_ORG_PAGE_CATALOG } from './festOrganizerPages';

const GRANTABLE = FEST_ORG_PAGE_CATALOG.filter((p) => p.key !== 'access' && p.key !== 'auditorium-gate');

const DEFAULT_SECTIONS = [
    { key: 'participants', label: 'Participants' },
    { key: 'desk', label: 'Desk registration' },
    { key: 'scanner', label: 'Scanner' },
    { key: 'revenue', label: 'Revenue' },
];

const EMPTY_INVITE = {
    name: '',
    username: '',
    email: '',
    phone: '',
    mode: 'pages',
    pages: ['fest-day-desk'],
    competitionAccess: [],
    gateCategories: [],
};

const FINANCE_PAGES = ['revenue', 'receipts'];

function inputClass() {
    return 'w-full bg-[#121314] border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#0ECCEE]/50';
}

function chipClass(on) {
    return `text-[11px] px-2.5 py-1.5 rounded-lg border transition-colors ${
        on
            ? 'border-[#0ECCEE]/40 bg-[#0ECCEE]/15 text-[#0ECCEE]'
            : 'border-white/10 text-gray-500 hover:border-white/20'
    }`;
}

function toggleSection(access, competitionId, sectionKey) {
    const entry = access.find((a) => a.competitionId === competitionId);
    const sections = new Set(entry?.sections || []);
    if (sections.has(sectionKey)) sections.delete(sectionKey);
    else sections.add(sectionKey);
    const rest = access.filter((a) => a.competitionId !== competitionId);
    return sections.size ? [...rest, { competitionId, sections: [...sections] }] : rest;
}

const isGateEntry = (entry) => (entry.sections || []).includes('gate');

/** `categories: []` means every auditorium category. */
const gateAccess = (auditoriumId, categories) => [{ competitionId: auditoriumId, sections: ['gate'], categories }];
const gateCategoriesOf = (access) => (access || []).find(isGateEntry)?.categories || [];
const withoutGate = (access) => (access || []).filter((a) => !isGateEntry(a));

function accessSummary(member, auditorium, competitions, pages) {
    const access = member.competitionAccess || [];
    if (!access.length) {
        const labels = pages.filter((p) => (member.allowedPages || []).includes(p.key)).map((p) => p.label);
        return labels.length ? `Pages: ${labels.join(', ')}` : 'No access';
    }
    return access.map((entry) => {
        if (isGateEntry(entry)) {
            const cats = (auditorium?.categories || []).filter((c) => (entry.categories || []).includes(c.id)).map((c) => c.label);
            return `Auditorium gate: ${cats.length ? cats.join(', ') : 'all categories'}`;
        }
        const name = competitions.find((c) => c.id === entry.competitionId)?.name || 'Competition';
        return `${name} (${entry.sections.join(', ')})`;
    }).join(' · ');
}

function AuditoriumCategoryPicker({ auditorium, value, onChange }) {
    const picked = new Set(value || []);
    const toggle = (id) => {
        const next = new Set(picked);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        const all = next.size === 0 || next.size === auditorium.categories.length;
        onChange(all ? [] : [...next]);
    };
    return (
        <div className="rounded-xl border border-[#0ECCEE]/30 bg-[#0ECCEE]/5 px-3 py-2 space-y-2">
            <p className="text-sm font-medium truncate">{auditorium.name} · gate scanner</p>
            <p className="text-[11px] text-gray-500">Which passes can they admit?</p>
            <div className="flex flex-wrap gap-1.5">
                <button type="button" onClick={() => onChange([])} className={chipClass(picked.size === 0)}>
                    All categories
                </button>
                {auditorium.categories.map((cat) => (
                    <button
                        key={cat.id}
                        type="button"
                        onClick={() => toggle(cat.id)}
                        className={chipClass(picked.has(cat.id))}
                    >
                        {cat.label}
                    </button>
                ))}
            </div>
            <p className="text-[11px] text-gray-500">
                After login only the gate scanner opens. Passes from other categories are rejected. No rosters, invites or other pages.
            </p>
        </div>
    );
}

function AccessModeToggle({ mode, onChange, showAuditorium = false }) {
    const modes = [['pages', 'Whole pages'], ['competitions', 'Specific competitions']];
    if (showAuditorium) modes.push(['auditorium', 'Auditorium pass']);
    return (
        <div className="inline-flex flex-wrap rounded-xl border border-white/10 p-0.5 text-[11px]">
            {modes.map(([key, label]) => (
                <button
                    key={key}
                    type="button"
                    onClick={() => onChange(key)}
                    className={`px-2.5 py-1 rounded-lg ${mode === key ? 'bg-[#0ECCEE] text-black font-semibold' : 'text-gray-400'}`}
                >
                    {label}
                </button>
            ))}
        </div>
    );
}

function CompetitionAccessEditor({ competitions, sections, value, onToggle }) {
    const [query, setQuery] = useState('');
    const competitionCount = value.length;
    const granted = useMemo(() => new Map(value.map((a) => [a.competitionId, new Set(a.sections)])), [value]);
    const visible = useMemo(() => {
        const q = query.trim().toLowerCase();
        const list = q ? competitions.filter((c) => c.name.toLowerCase().includes(q)) : competitions;
        return [...list].sort((a, b) => Number(granted.has(b.id)) - Number(granted.has(a.id)));
    }, [competitions, query, granted]);

    if (!competitions.length) {
        return <p className="text-xs text-gray-500">No competitions in this fest yet.</p>;
    }
    return (
        <div className="space-y-2">
            <input
                className={inputClass()}
                placeholder="Search competitions"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
            />
            <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                {visible.map((comp) => {
                    const on = granted.get(comp.id);
                    return (
                        <div
                            key={comp.id}
                            className={`rounded-xl border px-3 py-2 ${on ? 'border-[#0ECCEE]/30 bg-[#0ECCEE]/5' : 'border-white/10'}`}
                        >
                            <p className="text-sm font-medium truncate">{comp.name}</p>
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                                {sections.map((section) => (
                                    <button
                                        key={section.key}
                                        type="button"
                                        onClick={() => onToggle(comp.id, section.key)}
                                        className={chipClass(Boolean(on?.has(section.key)))}
                                    >
                                        {section.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
            <p className="text-[11px] text-gray-500">
                {competitionCount} competition{competitionCount === 1 ? '' : 's'} selected. They only see data for these.
            </p>
        </div>
    );
}

export default function FestOrganizerAccessPage() {
    const { festId } = useParams();
    const { toast, confirm } = useDialog();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [members, setMembers] = useState([]);
    const [pages, setPages] = useState(GRANTABLE);
    const [competitions, setCompetitions] = useState([]);
    const [auditorium, setAuditorium] = useState(null);
    const [sections, setSections] = useState(DEFAULT_SECTIONS);
    const [modeById, setModeById] = useState({});
    const [error, setError] = useState('');
    const [showInvite, setShowInvite] = useState(false);
    const [invite, setInvite] = useState(EMPTY_INVITE);
    const [credentials, setCredentials] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const data = await fetchFestOrganizerAccess(festId);
            setMembers(data.members || []);
            if (Array.isArray(data.pages) && data.pages.length) setPages(data.pages);
            setCompetitions(Array.isArray(data.competitions) ? data.competitions : []);
            setAuditorium(data.auditorium?.id ? data.auditorium : null);
            if (Array.isArray(data.sections) && data.sections.length) setSections(data.sections);
        } catch (e) {
            setError(e.message || 'Failed to load access');
        } finally {
            setLoading(false);
        }
    }, [festId]);

    useEffect(() => { load(); }, [load]);

    const coheads = useMemo(
        () => members.filter((m) => m.portalRole === 'cohead'),
        [members],
    );
    const deskAccounts = useMemo(
        () => members.filter((m) => m.portalRole === 'desk'),
        [members],
    );

    const toggleInvitePage = (key) => {
        setInvite((prev) => {
            const has = prev.pages.includes(key);
            return {
                ...prev,
                pages: has ? prev.pages.filter((p) => p !== key) : [...prev.pages, key],
            };
        });
    };

    const chooseFinanceAccess = () => {
        setInvite((prev) => ({
            ...prev,
            mode: 'pages',
            pages: FINANCE_PAGES,
            competitionAccess: [],
        }));
    };

    const submitInvite = async (e) => {
        e.preventDefault();
        if (!invite.name.trim() || !invite.username.trim()) {
            toast('Name and username are required');
            return;
        }
        const byCompetition = invite.mode === 'competitions';
        const byAuditorium = invite.mode === 'auditorium' && Boolean(auditorium);
        if (!byAuditorium && (byCompetition ? !invite.competitionAccess.length : !invite.pages.length)) {
            toast(byCompetition ? 'Pick at least one competition section' : 'Select at least one page');
            return;
        }
        let grant = { allowedPages: invite.pages };
        if (byCompetition) grant = { competitionAccess: invite.competitionAccess };
        if (byAuditorium) grant = { competitionAccess: gateAccess(auditorium.id, invite.gateCategories) };
        setSaving(true);
        try {
            const data = await inviteFestOrganizerAccess(festId, {
                name: invite.name.trim(),
                username: invite.username.trim(),
                email: invite.email.trim(),
                phone: invite.phone.trim(),
                ...grant,
            });
            setCredentials(data.credentials || null);
            setShowInvite(false);
            setInvite(EMPTY_INVITE);
            toast(data.email?.sent
                ? 'Co-head invited — login email sent'
                : 'Co-head created — copy the password below');
            await load();
        } catch (err) {
            toast(err.message || 'Invite failed');
        } finally {
            setSaving(false);
        }
    };

    const toggleMemberPage = async (member, key) => {
        const current = new Set(member.allowedPages || []);
        if (current.has(key)) current.delete(key);
        else current.add(key);
        const next = [...current];
        if (!next.length) {
            toast('Keep at least one page');
            return;
        }
        try {
            await updateFestOrganizerAccess(festId, member.id, { allowedPages: next });
            setMembers((list) => list.map((m) => (
                m.id === member.id ? { ...m, allowedPages: next } : m
            )));
        } catch (err) {
            toast(err.message || 'Update failed');
        }
    };

    const memberMode = (member) => modeById[member.id] || member.accessMode || 'pages';

    const saveMemberAccess = async (member, payload) => {
        try {
            const data = await updateFestOrganizerAccess(festId, member.id, payload);
            setMembers((list) => list.map((m) => (
                m.id === member.id ? { ...m, ...data.member } : m
            )));
        } catch (err) {
            toast(err.message || 'Update failed');
        }
    };

    const changeMemberMode = async (member, mode) => {
        const current = memberMode(member);
        if (mode === current) return;
        if (mode === 'auditorium' && auditorium) {
            const ok = await confirm({
                title: 'Switch to auditorium pass only?',
                message: `${member.name || member.username} will only get the auditorium gate scanner (all categories). Their other access is removed.`,
                confirmText: 'Switch',
            });
            if (!ok) return;
            setModeById((prev) => ({ ...prev, [member.id]: mode }));
            saveMemberAccess(member, { competitionAccess: gateAccess(auditorium.id, []) });
            return;
        }
        setModeById((prev) => ({ ...prev, [member.id]: mode }));
        if (mode === 'pages' && (member.competitionAccess || []).length) {
            const kept = (member.allowedPages || []).filter((p) => p !== 'auditorium-gate');
            saveMemberAccess(member, { competitionAccess: [], allowedPages: kept.length ? kept : ['fest-day-desk'] });
        }
    };

    const toggleMemberSection = (member, competitionId, sectionKey) => {
        const next = toggleSection(withoutGate(member.competitionAccess), competitionId, sectionKey);
        if (!next.length) {
            toast('Keep at least one competition section, or switch to whole pages');
            return;
        }
        saveMemberAccess(member, { competitionAccess: next });
    };

    const changeMemberGate = (member, categories) => {
        if (!auditorium) return;
        saveMemberAccess(member, { competitionAccess: gateAccess(auditorium.id, categories) });
    };

    const toggleActive = async (member) => {
        try {
            const data = await updateFestOrganizerAccess(festId, member.id, {
                isActive: !member.isActive,
            });
            setMembers((list) => list.map((m) => (
                m.id === member.id ? { ...m, ...data.member } : m
            )));
        } catch (err) {
            toast(err.message || 'Update failed');
        }
    };

    const revoke = async (member) => {
        const ok = await confirm({
            title: 'Revoke access?',
            message: `Remove ${member.name || member.username} from this fest?`,
            confirmText: 'Revoke',
        });
        if (!ok) return;
        try {
            await revokeFestOrganizerAccess(festId, member.id);
            toast('Access revoked');
            await load();
        } catch (err) {
            toast(err.message || 'Revoke failed');
        }
    };

    const copyText = async (text) => {
        try {
            await navigator.clipboard.writeText(text);
            toast('Copied');
        } catch {
            toast('Copy failed');
        }
    };

    if (loading) return <InlinePageLoader label="Loading access…" />;

    return (
        <div className="max-w-3xl mx-auto space-y-5 p-4 sm:p-6">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[#0ECCEE]/20 bg-[#0ECCEE]/10 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#0ECCEE]">
                        <Shield size={11} /> Access
                    </div>
                    <h1 className="text-2xl font-semibold tracking-tight mt-2">Co-head access</h1>
                    <p className="text-sm text-gray-400 mt-1">
                        Invite team members and give them whole pages, specific competitions, or read-only finance access.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => setShowInvite(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#0ECCEE] text-black text-sm font-semibold shrink-0"
                >
                    <UserPlus size={15} /> Invite
                </button>
            </div>

            {error ? (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div>
            ) : null}

            {credentials ? (
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-emerald-200 inline-flex items-center gap-1.5">
                            <KeyRound size={14} /> Share these login details
                        </p>
                        <button type="button" onClick={() => setCredentials(null)} className="text-gray-400 hover:text-white">
                            <X size={16} />
                        </button>
                    </div>
                    <p className="text-xs text-gray-300">Username: <code className="text-white">{credentials.username}</code></p>
                    <p className="text-xs text-gray-300">Password: <code className="text-white">{credentials.password}</code></p>
                    <button
                        type="button"
                        onClick={() => copyText(`${credentials.loginUrl}\n${credentials.username}\n${credentials.password}`)}
                        className="inline-flex items-center gap-1.5 text-xs text-[#0ECCEE]"
                    >
                        <Copy size={12} /> Copy all
                    </button>
                </div>
            ) : null}

            <section className="space-y-3">
                <h2 className="text-sm font-semibold text-gray-300">Co-heads · {coheads.length}</h2>
                {!coheads.length ? (
                    <p className="text-sm text-gray-500 rounded-xl border border-white/10 bg-[#161718] px-4 py-6 text-center">
                        No co-heads yet. Invite someone and grant Fest Day Desk or other pages.
                    </p>
                ) : (
                    coheads.map((member) => (
                        <div key={member.id} className="rounded-2xl border border-white/10 bg-[#161718] p-4 space-y-3">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="font-semibold truncate">{member.name}</p>
                                    <p className="text-xs text-gray-500 truncate">
                                        @{member.username}
                                        {member.email ? ` · ${member.email}` : ''}
                                    </p>
                                    <p className="text-[11px] text-[#0ECCEE]/90 mt-1 break-words">
                                        {accessSummary(member, auditorium, competitions, pages)}
                                    </p>
                                    <p className={`text-[10px] mt-1 ${member.isActive ? 'text-emerald-400' : 'text-amber-400'}`}>
                                        {member.isActive ? 'Active' : 'Inactive'}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => toggleActive(member)}
                                        className="text-[11px] px-2 py-1 rounded-lg border border-white/10 text-gray-300 hover:border-[#0ECCEE]/40"
                                    >
                                        {member.isActive ? 'Deactivate' : 'Activate'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => revoke(member)}
                                        className="p-1.5 rounded-lg border border-red-500/20 text-red-300 hover:bg-red-500/10"
                                        aria-label="Revoke"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                            <AccessModeToggle
                                mode={memberMode(member)}
                                onChange={(mode) => changeMemberMode(member, mode)}
                                showAuditorium={Boolean(auditorium)}
                            />
                            {memberMode(member) === 'auditorium' && auditorium ? (
                                <AuditoriumCategoryPicker
                                    auditorium={auditorium}
                                    value={gateCategoriesOf(member.competitionAccess)}
                                    onChange={(categories) => changeMemberGate(member, categories)}
                                />
                            ) : memberMode(member) === 'competitions' ? (
                                <CompetitionAccessEditor
                                    competitions={competitions}
                                    sections={sections}
                                    value={withoutGate(member.competitionAccess)}
                                    onToggle={(competitionId, key) => toggleMemberSection(member, competitionId, key)}
                                />
                            ) : (
                                <div className="space-y-2">
                                    {pages.some((page) => page.key === 'receipts') ? (
                                        <button
                                            type="button"
                                            onClick={() => saveMemberAccess(member, { competitionAccess: [], allowedPages: FINANCE_PAGES })}
                                            className={chipClass(FINANCE_PAGES.every((key) => (member.allowedPages || []).includes(key)) && (member.allowedPages || []).length === FINANCE_PAGES.length)}
                                        >
                                            Finance team · Revenue + Receipts only
                                        </button>
                                    ) : null}
                                    <div className="flex flex-wrap gap-2">
                                        {pages.map((page) => (
                                            <button
                                                key={page.key}
                                                type="button"
                                                onClick={() => toggleMemberPage(member, page.key)}
                                                className={chipClass((member.allowedPages || []).includes(page.key))}
                                            >
                                                {page.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </section>

            {deskAccounts.length ? (
                <section className="space-y-2">
                    <h2 className="text-sm font-semibold text-gray-300">Desk accounts · {deskAccounts.length}</h2>
                    <p className="text-xs text-gray-500">Managed as Fest Day Desk only (admin-created).</p>
                    {deskAccounts.map((member) => (
                        <div key={member.id} className="rounded-xl border border-white/10 bg-[#161718] px-4 py-3 flex items-center justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{member.name}</p>
                                <p className="text-xs text-gray-500 truncate">@{member.username}</p>
                            </div>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 shrink-0">Desk</span>
                        </div>
                    ))}
                </section>
            ) : null}

            {showInvite ? (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-3">
                    <form
                        onSubmit={submitInvite}
                        className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#121314] p-4 sm:p-5 space-y-3 max-h-[90dvh] overflow-y-auto"
                    >
                        <div className="flex items-center justify-between gap-2">
                            <h3 className="font-semibold">Invite co-head</h3>
                            <button type="button" onClick={() => setShowInvite(false)} className="text-gray-400 hover:text-white">
                                <X size={18} />
                            </button>
                        </div>
                        <input className={inputClass()} placeholder="Full name" value={invite.name} onChange={(e) => setInvite({ ...invite, name: e.target.value })} required />
                        <input className={inputClass()} placeholder="Username" value={invite.username} onChange={(e) => setInvite({ ...invite, username: e.target.value })} required autoCapitalize="none" />
                        <input className={inputClass()} placeholder="Email (optional — sends login)" type="email" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} />
                        <input className={inputClass()} placeholder="Phone (optional)" value={invite.phone} onChange={(e) => setInvite({ ...invite, phone: e.target.value })} />
                        <div className="space-y-2">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                                <p className="text-xs text-gray-400">Access</p>
                                <AccessModeToggle
                                    mode={invite.mode}
                                    onChange={(mode) => setInvite({ ...invite, mode })}
                                    showAuditorium={Boolean(auditorium)}
                                />
                            </div>
                            {pages.some((page) => page.key === 'receipts') ? (
                                <button
                                    type="button"
                                    onClick={chooseFinanceAccess}
                                    className={chipClass(invite.mode === 'pages' && FINANCE_PAGES.every((key) => invite.pages.includes(key)) && invite.pages.length === FINANCE_PAGES.length)}
                                >
                                    Finance team · Revenue + Receipts only
                                </button>
                            ) : null}
                            {invite.mode === 'auditorium' && auditorium ? (
                                <AuditoriumCategoryPicker
                                    auditorium={auditorium}
                                    value={invite.gateCategories}
                                    onChange={(gateCategories) => setInvite((prev) => ({ ...prev, gateCategories }))}
                                />
                            ) : invite.mode === 'competitions' ? (
                                <CompetitionAccessEditor
                                    competitions={competitions}
                                    sections={sections}
                                    value={invite.competitionAccess}
                                    onToggle={(competitionId, key) => setInvite((prev) => ({
                                        ...prev,
                                        competitionAccess: toggleSection(prev.competitionAccess, competitionId, key),
                                    }))}
                                />
                            ) : (
                                <div className="flex flex-wrap gap-2">
                                    {pages.map((page) => (
                                        <button
                                            key={page.key}
                                            type="button"
                                            onClick={() => toggleInvitePage(page.key)}
                                            className={chipClass(invite.pages.includes(page.key))}
                                        >
                                            {page.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <button
                            type="submit"
                            disabled={saving}
                            className="w-full py-2.5 rounded-xl bg-[#0ECCEE] text-black font-semibold text-sm disabled:opacity-60"
                        >
                            {saving ? 'Creating…' : 'Create co-head'}
                        </button>
                    </form>
                </div>
            ) : null}
        </div>
    );
}
