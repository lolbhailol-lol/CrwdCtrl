import { useEffect, useMemo, useState } from 'react';
import { Mountain, Plus, Pencil, Trash2, Search, Check, X, Copy, Link2 } from 'lucide-react';
import { DetailLoader3DIcon } from '../../components/DetailPageLoader';
import { adminFetchJSON } from '../../services/api/admin.api.js';
import { useDialog } from '../../context/DialogContext';
import { absoluteUrl } from '../../utils/seo';

const emptyForm = {
    name: '',
    username: '',
    password: '',
    phone: '',
    email: '',
    communityId: '',
    isActive: true,
};

const TREK_LOGIN_PATH = '/trek-organizer/login';
const TREK_SIGNUP_PATH = '/trek-organizer/signup';

function trekLoginUrl(username = '') {
    const base = absoluteUrl(TREK_LOGIN_PATH);
    const u = String(username || '').trim().toLowerCase();
    return u ? `${base}?u=${encodeURIComponent(u)}` : base;
}

function trekSignupUrl() {
    return absoluteUrl(TREK_SIGNUP_PATH);
}

function buildShareText({ username, communityName, includePasswordHint = true }) {
    const lines = [
        'Trek organizer login (treks only — not fest / run club / events)',
        '',
        trekLoginUrl(username),
        '',
        `Username: ${username || '—'}`,
    ];
    if (communityName && communityName !== '—') {
        lines.push(`Community: ${communityName}`);
    }
    if (includePasswordHint) {
        lines.push('', 'Use the password shared by CrwdCtrl.');
    }
    return lines.join('\n');
}

function statusBadge(org) {
    const status = org.status || (org.isActive !== false ? 'approved' : 'rejected');
    if (status === 'pending') {
        return <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400">Pending</span>;
    }
    if (status === 'rejected') {
        return <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/15 text-red-400">Rejected</span>;
    }
    if (org.isActive === false) {
        return <span className="text-xs px-2 py-0.5 rounded-full bg-gray-500/20 text-gray-400">Inactive</span>;
    }
    return <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">Approved</span>;
}

export default function TrekOrganizersPage() {
    const { confirm, toast } = useDialog();
    const [organizers, setOrganizers] = useState([]);
    const [pendingCount, setPendingCount] = useState(0);
    const [communities, setCommunities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [section, setSection] = useState('accounts'); // accounts | profile_emails
    const [tab, setTab] = useState('all'); // all | pending | approved | rejected
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);
    const [actionBusy, setActionBusy] = useState('');
    const [invites, setInvites] = useState([]);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteNote, setInviteNote] = useState('');
    const [inviteSaving, setInviteSaving] = useState(false);

    const organizerLoginUrl = trekLoginUrl();
    const organizerSignupUrl = trekSignupUrl();

    const copyText = async (text, label) => {
        try {
            await navigator.clipboard.writeText(text);
            toast(`${label} copied`);
        } catch {
            toast('Could not copy');
        }
    };

    const communityLabel = (org) => {
        if (org.communityId?.name) return org.communityId.name;
        const found = communities.find((c) => String(c._id) === String(org.communityId));
        return found?.name || '—';
    };

    const copyShareFor = (org) => {
        copyText(
            buildShareText({
                username: org.username,
                communityName: communityLabel(org),
            }),
            'Trek login share',
        );
    };

    const load = async () => {
        setLoading(true);
        try {
            const statusParam = tab === 'all' ? '' : `?status=${tab}`;
            const [orgData, communityData, inviteData] = await Promise.all([
                adminFetchJSON(`/admin/trek-organizers${statusParam}`),
                adminFetchJSON('/admin/trek-communities?limit=500'),
                adminFetchJSON('/admin/trek-organizers/profile-invites').catch(() => ({ invites: [] })),
            ]);
            setOrganizers(orgData.organizers || []);
            setPendingCount(orgData.pendingCount ?? 0);
            setCommunities(communityData.communities || []);
            setInvites(inviteData.invites || []);
        } catch (e) {
            toast(e.message || 'Failed to load organizers');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, [tab]);

    const addInvite = async (e) => {
        e.preventDefault();
        const email = inviteEmail.trim().toLowerCase();
        if (!email || !email.includes('@')) {
            toast('Enter a valid email');
            return;
        }
        setInviteSaving(true);
        try {
            await adminFetchJSON('/admin/trek-organizers/profile-invites', {
                method: 'POST',
                body: JSON.stringify({ email, note: inviteNote.trim() }),
            });
            toast('Email approved for Profile → Trek community');
            setInviteEmail('');
            setInviteNote('');
            load();
        } catch (err) {
            toast(err.message || 'Failed to add email');
        } finally {
            setInviteSaving(false);
        }
    };

    const removeInvite = async (invite) => {
        const ok = await confirm(`Remove ${invite.email} from Trek community profile access?`);
        if (!ok) return;
        try {
            await adminFetchJSON(`/admin/trek-organizers/profile-invites/${invite._id}`, {
                method: 'DELETE',
            });
            toast('Email removed');
            load();
        } catch (err) {
            toast(err.message || 'Failed to remove');
        }
    };

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return organizers;
        return organizers.filter(
            (o) =>
                o.name?.toLowerCase().includes(q) ||
                o.username?.toLowerCase().includes(q) ||
                o.communityId?.name?.toLowerCase().includes(q) ||
                o.email?.toLowerCase().includes(q) ||
                o.phone?.includes(q),
        );
    }, [organizers, search]);

    const openCreate = () => {
        setEditing(null);
        setForm({
            ...emptyForm,
            communityId: communities[0]?._id ? String(communities[0]._id) : '',
        });
        setModalOpen(true);
    };

    const openEdit = (org) => {
        setEditing(org);
        setForm({
            name: org.name || '',
            username: org.username || '',
            password: '',
            phone: org.phone || '',
            email: org.email || '',
            communityId: org.communityId?._id ? String(org.communityId._id) : String(org.communityId || ''),
            isActive: org.isActive !== false,
        });
        setModalOpen(true);
    };

    const save = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const payload = {
                name: form.name.trim(),
                username: form.username.trim().toLowerCase(),
                phone: form.phone.trim(),
                communityId: form.communityId,
                isActive: form.isActive,
            };
            const email = form.email.trim().toLowerCase();
            if (email) payload.email = email;
            if (editing) payload.email = email || '';
            if (form.password.trim()) payload.password = form.password;

            if (editing) {
                await adminFetchJSON(`/admin/trek-organizers/${editing._id}`, {
                    method: 'PUT',
                    body: JSON.stringify(payload),
                });
                toast('Organizer updated');
            } else {
                if (!form.password || form.password.length < 8) {
                    toast('Password must be at least 8 characters');
                    setSaving(false);
                    return;
                }
                if (!form.communityId) {
                    toast('Select a trek community');
                    setSaving(false);
                    return;
                }
                payload.password = form.password;
                await adminFetchJSON('/admin/trek-organizers', {
                    method: 'POST',
                    body: JSON.stringify(payload),
                });
                toast('Organizer created (approved)');
            }
            setModalOpen(false);
            load();
        } catch (err) {
            toast(err.message || 'Save failed');
        } finally {
            setSaving(false);
        }
    };

    const approve = async (org) => {
        setActionBusy(org._id);
        try {
            await adminFetchJSON(`/admin/trek-organizers/${org._id}/approve`, {
                method: 'POST',
                body: JSON.stringify({
                    communityId: org.communityId?._id || org.communityId || undefined,
                }),
            });
            toast('Approved — they can sign in. Trek community also shows in Profile if this email matches their CrwdCtrl login.');
            load();
        } catch (err) {
            toast(err.message || 'Approve failed');
        } finally {
            setActionBusy('');
        }
    };

    const reject = async (org) => {
        const ok = await confirm(`Reject access for ${org.name} (@${org.username})?`);
        if (!ok) return;
        setActionBusy(org._id);
        try {
            await adminFetchJSON(`/admin/trek-organizers/${org._id}/reject`, {
                method: 'POST',
                body: JSON.stringify({ reason: '' }),
            });
            toast('Rejected');
            load();
        } catch (err) {
            toast(err.message || 'Reject failed');
        } finally {
            setActionBusy('');
        }
    };

    const remove = async (org) => {
        const ok = await confirm(`Delete organizer ${org.name}?`);
        if (!ok) return;
        try {
            await adminFetchJSON(`/admin/trek-organizers/${org._id}`, { method: 'DELETE' });
            toast('Organizer deleted');
            load();
        } catch (err) {
            toast(err.message || 'Delete failed');
        }
    };

    const tabs = [
        { id: 'all', label: 'All' },
        { id: 'pending', label: `Pending${pendingCount ? ` (${pendingCount})` : ''}` },
        { id: 'approved', label: 'Approved' },
        { id: 'rejected', label: 'Rejected' },
    ];

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Mountain className="text-[#0ECCEE]" size={22} />
                        Trek Organizers
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Trek portal only — share <span className="text-gray-300 font-mono text-xs">/trek-organizer/login</span>.
                        Not fest, run club, or event community logins.
                    </p>
                </div>
                {section === 'accounts' ? (
                    <button
                        type="button"
                        onClick={openCreate}
                        disabled={communities.length === 0}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0ECCEE] text-black text-sm font-bold disabled:opacity-50"
                    >
                        <Plus size={16} /> Add organizer
                    </button>
                ) : null}
            </div>

            {section === 'accounts' ? (
                <div className="rounded-xl border border-[#0ECCEE]/25 bg-[#0ECCEE]/8 p-3.5 space-y-2.5">
                    <p className="text-xs font-semibold text-[#9BE8F7] uppercase tracking-wide">Share trek login</p>
                    <p className="text-[11px] text-gray-400 break-all font-mono">{organizerLoginUrl}</p>
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => copyText(organizerLoginUrl, 'Trek login URL')}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/15 bg-black/30 text-xs font-medium text-white hover:border-[#0ECCEE]/40"
                        >
                            <Link2 size={13} /> Copy login link
                        </button>
                        <button
                            type="button"
                            onClick={() => copyText(organizerSignupUrl, 'Trek signup URL')}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/15 bg-black/30 text-xs font-medium text-white hover:border-[#0ECCEE]/40"
                        >
                            <Copy size={13} /> Copy signup link
                        </button>
                    </div>
                </div>
            ) : null}

            {section === 'accounts' && communities.length === 0 && !loading ? (
                <div className="rounded-xl border border-amber-800/60 bg-amber-900/15 px-4 py-3 text-sm text-amber-200">
                    Create a trek community under Admin → Treks / Communities first, then you can add a community organizer.
                </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
                {[
                    { id: 'accounts', label: 'Organizer accounts' },
                    { id: 'profile_emails', label: `Profile emails${invites.length ? ` (${invites.length})` : ''}` },
                ].map((s) => (
                    <button
                        key={s.id}
                        type="button"
                        onClick={() => setSection(s.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                            section === s.id
                                ? 'border-[#0ECCEE]/50 bg-[#0ECCEE]/10 text-[#0ECCEE]'
                                : 'border-gray-800 text-gray-400 hover:border-gray-700'
                        }`}
                    >
                        {s.label}
                    </button>
                ))}
            </div>

            {section === 'profile_emails' ? (
                <div className="space-y-4">
                    <div className="rounded-xl border border-gray-800 bg-[#161718] p-4 space-y-3">
                        <div>
                            <h2 className="text-sm font-semibold text-white">Approve Profile → Trek community</h2>
                            <p className="text-xs text-gray-500 mt-1">
                                These CrwdCtrl user emails see Trek community in Profile and can request signup.
                                Separately approve the organizer username under Organizer accounts.
                                Tip: if you already approved an organizer with the same email, Profile shows Trek community without adding them here.
                            </p>
                        </div>
                        <form onSubmit={addInvite} className="flex flex-col sm:flex-row gap-2">
                            <input
                                type="email"
                                required
                                value={inviteEmail}
                                onChange={(e) => setInviteEmail(e.target.value)}
                                placeholder="organizer@community.com"
                                className="flex-1 px-3 py-2.5 rounded-xl bg-[#111213] border border-gray-800 text-sm"
                            />
                            <input
                                value={inviteNote}
                                onChange={(e) => setInviteNote(e.target.value)}
                                placeholder="Note (optional)"
                                className="sm:w-40 px-3 py-2.5 rounded-xl bg-[#111213] border border-gray-800 text-sm"
                            />
                            <button
                                type="submit"
                                disabled={inviteSaving}
                                className="px-4 py-2.5 rounded-xl bg-[#0ECCEE] text-black text-sm font-bold disabled:opacity-60"
                            >
                                {inviteSaving ? 'Adding…' : 'Add email'}
                            </button>
                        </form>
                    </div>

                    <div className="rounded-xl border border-gray-800 overflow-hidden">
                        {loading ? (
                            <div className="py-16 flex justify-center"><DetailLoader3DIcon size="compact" variant="trek" /></div>
                        ) : (
                            <table className="w-full text-sm">
                                <thead className="bg-[#111213] text-gray-500 text-[11px] uppercase">
                                    <tr>
                                        <th className="text-left px-4 py-3">Email</th>
                                        <th className="text-left px-4 py-3 hidden sm:table-cell">Note</th>
                                        <th className="text-left px-4 py-3">Status</th>
                                        <th className="text-right px-4 py-3">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {invites.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="px-4 py-12 text-center text-gray-500">
                                                No emails yet — add a user email to show Trek community in their Profile
                                            </td>
                                        </tr>
                                    ) : invites.map((inv) => (
                                        <tr key={inv._id} className="border-t border-gray-800">
                                            <td className="px-4 py-3 font-mono text-xs text-gray-200">{inv.email}</td>
                                            <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{inv.note || '—'}</td>
                                            <td className="px-4 py-3">
                                                <span className={`text-xs px-2 py-0.5 rounded-full ${
                                                    inv.isActive !== false
                                                        ? 'bg-emerald-500/15 text-emerald-400'
                                                        : 'bg-gray-500/20 text-gray-400'
                                                }`}>
                                                    {inv.isActive !== false ? 'Active' : 'Off'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <button
                                                    type="button"
                                                    onClick={() => removeInvite(inv)}
                                                    className="p-2 rounded-lg hover:bg-red-900/30 text-red-400"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            ) : (
            <>
            <div className="flex flex-wrap gap-2">
                {tabs.map((t) => (
                    <button
                        key={t.id}
                        type="button"
                        onClick={() => setTab(t.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                            tab === t.id
                                ? 'border-[#0ECCEE]/50 bg-[#0ECCEE]/10 text-[#0ECCEE]'
                                : 'border-gray-800 text-gray-400 hover:border-gray-700'
                        }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search organizers…"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#111213] border border-gray-800 text-sm"
                />
            </div>

            <div className="rounded-xl border border-gray-800 overflow-hidden">
                {loading ? (
                    <div className="py-16 flex justify-center"><DetailLoader3DIcon size="compact" variant="trek" /></div>
                ) : (
                    <table className="w-full text-sm">
                        <thead className="bg-[#111213] text-gray-500 text-[11px] uppercase">
                            <tr>
                                <th className="text-left px-4 py-3">Name</th>
                                <th className="text-left px-4 py-3">Username</th>
                                <th className="text-left px-4 py-3 hidden md:table-cell">Community</th>
                                <th className="text-left px-4 py-3">Status</th>
                                <th className="text-right px-4 py-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr><td colSpan={5} className="px-4 py-12 text-center text-gray-500">No organizers</td></tr>
                            ) : filtered.map((org) => {
                                const status = org.status || (org.isActive !== false ? 'approved' : 'rejected');
                                const busy = actionBusy === org._id;
                                return (
                                    <tr key={org._id} className="border-t border-gray-800">
                                        <td className="px-4 py-3 font-medium">{org.name}</td>
                                        <td className="px-4 py-3 text-gray-400 font-mono text-xs">@{org.username}</td>
                                        <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{communityLabel(org)}</td>
                                        <td className="px-4 py-3">{statusBadge(org)}</td>
                                        <td className="px-4 py-3 text-right whitespace-nowrap">
                                            {status === 'pending' ? (
                                                <>
                                                    <button
                                                        type="button"
                                                        disabled={busy}
                                                        onClick={() => approve(org)}
                                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 disabled:opacity-50 mr-1"
                                                    >
                                                        <Check size={12} /> Approve
                                                    </button>
                                                    <button
                                                        type="button"
                                                        disabled={busy}
                                                        onClick={() => reject(org)}
                                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-red-500/15 text-red-400 hover:bg-red-500/25 disabled:opacity-50 mr-1"
                                                    >
                                                        <X size={12} /> Reject
                                                    </button>
                                                </>
                                            ) : null}
                                            {status === 'rejected' ? (
                                                <button
                                                    type="button"
                                                    disabled={busy}
                                                    onClick={() => approve(org)}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 disabled:opacity-50 mr-1"
                                                >
                                                    <Check size={12} /> Approve
                                                </button>
                                            ) : null}
                                            <button
                                                type="button"
                                                onClick={() => copyShareFor(org)}
                                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-white/10 text-gray-300 hover:border-[#0ECCEE]/40 hover:text-[#0ECCEE] mr-1"
                                                title="Copy trek login share text"
                                            >
                                                <Copy size={12} /> Share
                                            </button>
                                            <button type="button" onClick={() => openEdit(org)} className="p-2 rounded-lg hover:bg-gray-800 text-gray-400"><Pencil size={14} /></button>
                                            <button type="button" onClick={() => remove(org)} className="p-2 rounded-lg hover:bg-red-900/30 text-red-400"><Trash2 size={14} /></button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            <div className="rounded-xl border border-gray-800 bg-[#161718] p-3.5 text-xs text-gray-500 space-y-1">
                <p className="text-gray-400 font-medium">Always share the trek portal — never fest or home discover.</p>
                <p>Login: <span className="text-[#0ECCEE] font-mono break-all">{organizerLoginUrl}</span></p>
                <p>Signup: <span className="text-[#0ECCEE] font-mono break-all">{organizerSignupUrl}</span></p>
            </div>
            </>
            )}

            {modalOpen ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <button type="button" className="absolute inset-0 bg-black/60" onClick={() => setModalOpen(false)} aria-label="Close" />
                    <form onSubmit={save} className="relative w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-2xl border border-gray-800 bg-[#161718] p-5 space-y-4">
                        <h2 className="text-lg font-bold flex items-center gap-2"><Mountain size={18} className="text-[#0ECCEE]" />{editing ? 'Edit organizer' : 'New organizer (support)'}</h2>
                        <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Display name" className="w-full px-3 py-2.5 rounded-xl bg-[#111213] border border-gray-800 text-sm" />
                        <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1">Username</label>
                            <input
                                required
                                value={form.username}
                                onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                                placeholder="e.g. himalaya_organizer"
                                className="w-full px-3 py-2.5 rounded-xl bg-[#111213] border border-gray-800 text-sm font-mono"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1">Trek community</label>
                            <select
                                required
                                value={form.communityId}
                                onChange={(e) => setForm({ ...form, communityId: e.target.value })}
                                className="w-full px-3 py-2.5 rounded-xl bg-[#111213] border border-gray-800 text-sm"
                            >
                                <option value="">Select trek community</option>
                                {communities.map((c) => (
                                    <option key={c._id} value={c._id}>{c.name}{c.basedIn ? ` · ${c.basedIn}` : ''}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1">{editing ? 'New password (optional)' : 'Password'}</label>
                            <input
                                type="password"
                                value={form.password}
                                onChange={(e) => setForm({ ...form, password: e.target.value })}
                                placeholder={editing ? 'Leave blank to keep current' : 'Min 8 characters'}
                                className="w-full px-3 py-2.5 rounded-xl bg-[#111213] border border-gray-800 text-sm"
                                required={!editing}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1">Email (matches CrwdCtrl Profile)</label>
                            <input
                                type="email"
                                value={form.email}
                                onChange={(e) => setForm({ ...form, email: e.target.value })}
                                placeholder="Same email as their app login"
                                className="w-full px-3 py-2.5 rounded-xl bg-[#111213] border border-gray-800 text-sm"
                            />
                        </div>
                        <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone (optional)" className="w-full px-3 py-2.5 rounded-xl bg-[#111213] border border-gray-800 text-sm" />
                        {editing ? (
                            <label className="flex items-center gap-2 text-sm">
                                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
                                Account active (can log in)
                            </label>
                        ) : null}
                        <div className="flex gap-2 justify-end">
                            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-xl border border-gray-700 text-sm">Cancel</button>
                            <button type="submit" disabled={saving} className="px-4 py-2 rounded-xl bg-[#0ECCEE] text-black text-sm font-bold disabled:opacity-60">
                                {saving ? 'Saving…' : 'Save'}
                            </button>
                        </div>
                    </form>
                </div>
            ) : null}
        </div>
    );
}
