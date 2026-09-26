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

const GRANTABLE = FEST_ORG_PAGE_CATALOG.filter((p) => p.key !== 'access');

const EMPTY_INVITE = {
    name: '',
    username: '',
    email: '',
    phone: '',
    pages: ['fest-day-desk'],
};

function inputClass() {
    return 'w-full bg-[#121314] border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#0ECCEE]/50';
}

export default function FestOrganizerAccessPage() {
    const { festId } = useParams();
    const { toast, confirm } = useDialog();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [members, setMembers] = useState([]);
    const [pages, setPages] = useState(GRANTABLE);
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

    const submitInvite = async (e) => {
        e.preventDefault();
        if (!invite.name.trim() || !invite.username.trim()) {
            toast('Name and username are required');
            return;
        }
        if (!invite.pages.length) {
            toast('Select at least one page');
            return;
        }
        setSaving(true);
        try {
            const data = await inviteFestOrganizerAccess(festId, {
                name: invite.name.trim(),
                username: invite.username.trim(),
                email: invite.email.trim(),
                phone: invite.phone.trim(),
                allowedPages: invite.pages,
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
                        Invite co-heads and choose which pages they can open. Desk accounts stay Fest Day Desk only.
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
                            <div className="flex flex-wrap gap-2">
                                {pages.map((page) => {
                                    const on = (member.allowedPages || []).includes(page.key);
                                    return (
                                        <button
                                            key={page.key}
                                            type="button"
                                            onClick={() => toggleMemberPage(member, page.key)}
                                            className={`text-[11px] px-2.5 py-1.5 rounded-lg border transition-colors ${
                                                on
                                                    ? 'border-[#0ECCEE]/40 bg-[#0ECCEE]/15 text-[#0ECCEE]'
                                                    : 'border-white/10 text-gray-500 hover:border-white/20'
                                            }`}
                                        >
                                            {page.label}
                                        </button>
                                    );
                                })}
                            </div>
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
                        <div>
                            <p className="text-xs text-gray-400 mb-2">Pages</p>
                            <div className="flex flex-wrap gap-2">
                                {pages.map((page) => {
                                    const on = invite.pages.includes(page.key);
                                    return (
                                        <button
                                            key={page.key}
                                            type="button"
                                            onClick={() => toggleInvitePage(page.key)}
                                            className={`text-[11px] px-2.5 py-1.5 rounded-lg border ${
                                                on
                                                    ? 'border-[#0ECCEE]/40 bg-[#0ECCEE]/15 text-[#0ECCEE]'
                                                    : 'border-white/10 text-gray-500'
                                            }`}
                                        >
                                            {page.label}
                                        </button>
                                    );
                                })}
                            </div>
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
