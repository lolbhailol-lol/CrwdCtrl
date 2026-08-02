import { useEffect, useMemo, useState } from 'react';
import { PartyPopper, Plus, Loader, Pencil, Trash2, Search, Check, X } from 'lucide-react';
import { adminFetchJSON } from '../../services/api/admin.api.js';
import { useDialog } from '../../context/DialogContext';

const emptyForm = {
    name: '',
    username: '',
    password: '',
    phone: '',
    email: '',
    assignedFestIds: [],
    isActive: true,
};

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

export default function FestOrganizersPage() {
    const { confirm, toast } = useDialog();
    const [organizers, setOrganizers] = useState([]);
    const [pendingCount, setPendingCount] = useState(0);
    const [fests, setFests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [section, setSection] = useState('accounts');
    const [tab, setTab] = useState('all');
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);
    const [actionBusy, setActionBusy] = useState('');
    const [invites, setInvites] = useState([]);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteNote, setInviteNote] = useState('');
    const [inviteSaving, setInviteSaving] = useState(false);

    const organizerLoginUrl = typeof window !== 'undefined'
        ? `${window.location.origin}/fest-organizer/login`
        : '/fest-organizer/login';
    const organizerSignupUrl = typeof window !== 'undefined'
        ? `${window.location.origin}/fest-organizer/signup`
        : '/fest-organizer/signup';

    const copyUrl = async (url, label) => {
        try {
            await navigator.clipboard.writeText(url);
            toast(`${label} copied`);
        } catch {
            toast('Could not copy URL');
        }
    };

    const load = async () => {
        setLoading(true);
        try {
            const statusParam = tab === 'all' ? '' : `?status=${tab}`;
            const [orgData, festData, inviteData] = await Promise.all([
                adminFetchJSON(`/admin/fest-organizers${statusParam}`),
                adminFetchJSON('/admin/fests?limit=500'),
                adminFetchJSON('/admin/fest-organizers/profile-invites').catch(() => ({ invites: [] })),
            ]);
            setOrganizers(orgData.organizers || []);
            setPendingCount(orgData.pendingCount ?? 0);
            setFests(festData.fests || festData.data || []);
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

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return organizers;
        return organizers.filter((o) =>
            [o.name, o.username, o.email, o.phone]
                .filter(Boolean)
                .some((v) => String(v).toLowerCase().includes(q)));
    }, [organizers, search]);

    const openCreate = () => {
        setEditing(null);
        setForm(emptyForm);
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
            assignedFestIds: (org.assignedFestIds || []).map((f) => String(f._id || f)),
            isActive: org.isActive !== false,
        });
        setModalOpen(true);
    };

    const toggleFest = (festId) => {
        setForm((prev) => {
            const set = new Set(prev.assignedFestIds.map(String));
            const id = String(festId);
            if (set.has(id)) set.delete(id);
            else set.add(id);
            return { ...prev, assignedFestIds: [...set] };
        });
    };

    const save = async (e) => {
        e.preventDefault();
        if (!form.assignedFestIds.length) {
            toast('Assign at least one fest');
            return;
        }
        setSaving(true);
        try {
            const body = {
                name: form.name.trim(),
                username: form.username.trim(),
                phone: form.phone.trim(),
                email: form.email.trim(),
                assignedFestIds: form.assignedFestIds,
                isActive: form.isActive,
            };
            if (form.password) body.password = form.password;
            if (editing) {
                await adminFetchJSON(`/admin/fest-organizers/${editing._id}`, {
                    method: 'PUT',
                    body: JSON.stringify(body),
                });
                toast('Organizer updated');
            } else {
                if (!form.password) {
                    toast('Password required');
                    setSaving(false);
                    return;
                }
                body.password = form.password;
                await adminFetchJSON('/admin/fest-organizers', {
                    method: 'POST',
                    body: JSON.stringify(body),
                });
                toast('Organizer created');
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
        const festIds = (org.assignedFestIds || []).map((f) => String(f._id || f));
        if (!festIds.length) {
            toast('Edit the account and assign fests before approving');
            return;
        }
        setActionBusy(org._id);
        try {
            await adminFetchJSON(`/admin/fest-organizers/${org._id}/approve`, {
                method: 'POST',
                body: JSON.stringify({ assignedFestIds: festIds }),
            });
            toast('Approved');
            load();
        } catch (err) {
            toast(err.message || 'Approve failed');
        } finally {
            setActionBusy('');
        }
    };

    const reject = async (org) => {
        const ok = await confirm({
            title: 'Reject organizer?',
            message: `${org.name} (@${org.username}) will not be able to sign in.`,
        });
        if (!ok) return;
        setActionBusy(org._id);
        try {
            await adminFetchJSON(`/admin/fest-organizers/${org._id}/reject`, {
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
        const ok = await confirm({
            title: 'Delete organizer?',
            message: `Permanently delete ${org.name}?`,
        });
        if (!ok) return;
        setActionBusy(org._id);
        try {
            await adminFetchJSON(`/admin/fest-organizers/${org._id}`, { method: 'DELETE' });
            toast('Deleted');
            load();
        } catch (err) {
            toast(err.message || 'Delete failed');
        } finally {
            setActionBusy('');
        }
    };

    const addInvite = async (e) => {
        e.preventDefault();
        const email = inviteEmail.trim().toLowerCase();
        if (!email || !email.includes('@')) {
            toast('Enter a valid email');
            return;
        }
        setInviteSaving(true);
        try {
            await adminFetchJSON('/admin/fest-organizers/profile-invites', {
                method: 'POST',
                body: JSON.stringify({ email, note: inviteNote.trim() }),
            });
            setInviteEmail('');
            setInviteNote('');
            toast('Invite added');
            load();
        } catch (err) {
            toast(err.message || 'Failed to add invite');
        } finally {
            setInviteSaving(false);
        }
    };

    const removeInvite = async (invite) => {
        try {
            await adminFetchJSON(`/admin/fest-organizers/profile-invites/${invite._id}`, { method: 'DELETE' });
            toast('Invite removed');
            load();
        } catch (err) {
            toast(err.message || 'Failed to remove invite');
        }
    };

    return (
        <div className="p-4 sm:p-6 max-w-6xl mx-auto">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <PartyPopper className="text-[#0ECCEE]" size={22} />
                        Fest Organizers
                    </h1>
                    <p className="text-sm text-gray-400 mt-1">
                        Dedicated portal accounts · {pendingCount} pending
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => copyUrl(organizerLoginUrl, 'Login URL')} className="px-3 py-2 rounded-lg border border-gray-700 text-sm text-gray-300 hover:border-[#0ECCEE]/50">
                        Copy login URL
                    </button>
                    <button type="button" onClick={() => copyUrl(organizerSignupUrl, 'Signup URL')} className="px-3 py-2 rounded-lg border border-gray-700 text-sm text-gray-300 hover:border-[#0ECCEE]/50">
                        Copy signup URL
                    </button>
                    <button type="button" onClick={openCreate} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#0ECCEE] text-black text-sm font-semibold">
                        <Plus size={16} /> New account
                    </button>
                </div>
            </div>

            <div className="flex gap-2 mb-4">
                {['accounts', 'profile_emails'].map((s) => (
                    <button
                        key={s}
                        type="button"
                        onClick={() => setSection(s)}
                        className={`px-3 py-1.5 rounded-lg text-sm ${section === s ? 'bg-[#0ECCEE]/15 text-[#0ECCEE]' : 'text-gray-400 hover:text-white'}`}
                    >
                        {s === 'accounts' ? 'Accounts' : 'Profile emails'}
                    </button>
                ))}
            </div>

            {section === 'profile_emails' ? (
                <div className="rounded-xl border border-gray-800 bg-[#161718] p-4 space-y-4">
                    <form onSubmit={addInvite} className="flex flex-wrap gap-2">
                        <input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="email@college.edu" className="flex-1 min-w-[200px] px-3 py-2 rounded-lg bg-[#1D1E20] border border-gray-700 text-white text-sm" />
                        <input value={inviteNote} onChange={(e) => setInviteNote(e.target.value)} placeholder="Note (optional)" className="flex-1 min-w-[140px] px-3 py-2 rounded-lg bg-[#1D1E20] border border-gray-700 text-white text-sm" />
                        <button type="submit" disabled={inviteSaving} className="px-4 py-2 rounded-lg bg-[#0ECCEE] text-black text-sm font-semibold disabled:opacity-50">
                            {inviteSaving ? 'Saving…' : 'Add email'}
                        </button>
                    </form>
                    <ul className="space-y-2">
                        {invites.map((inv) => (
                            <li key={inv._id} className="flex items-center justify-between gap-2 text-sm border border-gray-800 rounded-lg px-3 py-2">
                                <div>
                                    <p className="text-white">{inv.email}</p>
                                    {inv.note ? <p className="text-xs text-gray-500">{inv.note}</p> : null}
                                </div>
                                <button type="button" onClick={() => removeInvite(inv)} className="text-red-400 hover:text-red-300">
                                    <Trash2 size={16} />
                                </button>
                            </li>
                        ))}
                        {!invites.length ? <p className="text-sm text-gray-500">No invite emails yet.</p> : null}
                    </ul>
                </div>
            ) : (
                <>
                    <div className="flex flex-wrap gap-2 mb-4 items-center">
                        {['all', 'pending', 'approved', 'rejected'].map((t) => (
                            <button
                                key={t}
                                type="button"
                                onClick={() => setTab(t)}
                                className={`px-3 py-1.5 rounded-lg text-sm capitalize ${tab === t ? 'bg-white/10 text-white' : 'text-gray-500'}`}
                            >
                                {t}
                            </button>
                        ))}
                        <div className="relative ml-auto">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="pl-8 pr-3 py-1.5 rounded-lg bg-[#1D1E20] border border-gray-700 text-sm text-white" />
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex items-center gap-2 text-gray-400 py-12 justify-center">
                            <Loader className="animate-spin" size={18} /> Loading…
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {filtered.map((org) => (
                                <div key={org._id} className="rounded-xl border border-gray-800 bg-[#161718] px-4 py-3 flex flex-wrap items-center gap-3">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <p className="font-medium text-white">{org.name}</p>
                                            {statusBadge(org)}
                                        </div>
                                        <p className="text-xs text-gray-500">@{org.username}{org.email ? ` · ${org.email}` : ''}</p>
                                        <p className="text-xs text-gray-400 mt-1">
                                            {(org.assignedFestIds || []).map((f) => f.festName || f).join(', ') || 'No fests assigned'}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        {org.status === 'pending' ? (
                                            <>
                                                <button type="button" disabled={actionBusy === org._id} onClick={() => approve(org)} className="p-2 rounded-lg text-emerald-400 hover:bg-emerald-500/10" title="Approve">
                                                    <Check size={16} />
                                                </button>
                                                <button type="button" disabled={actionBusy === org._id} onClick={() => reject(org)} className="p-2 rounded-lg text-red-400 hover:bg-red-500/10" title="Reject">
                                                    <X size={16} />
                                                </button>
                                            </>
                                        ) : null}
                                        <button type="button" onClick={() => openEdit(org)} className="p-2 rounded-lg text-gray-400 hover:bg-white/5">
                                            <Pencil size={16} />
                                        </button>
                                        <button type="button" onClick={() => remove(org)} className="p-2 rounded-lg text-red-400 hover:bg-red-500/10">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {!filtered.length ? <p className="text-center text-gray-500 py-10">No organizers found.</p> : null}
                        </div>
                    )}
                </>
            )}

            {modalOpen ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
                    <form onSubmit={save} className="w-full max-w-lg rounded-2xl border border-gray-700 bg-[#161718] p-5 space-y-3 max-h-[90vh] overflow-y-auto">
                        <h2 className="text-lg font-semibold text-white">{editing ? 'Edit organizer' : 'New organizer'}</h2>
                        <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Name" className="w-full px-3 py-2 rounded-lg bg-[#1D1E20] border border-gray-700 text-white text-sm" />
                        <input required disabled={Boolean(editing)} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="Username" className="w-full px-3 py-2 rounded-lg bg-[#1D1E20] border border-gray-700 text-white text-sm disabled:opacity-60" />
                        <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder={editing ? 'New password (optional)' : 'Password'} className="w-full px-3 py-2 rounded-lg bg-[#1D1E20] border border-gray-700 text-white text-sm" />
                        <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email (optional)" className="w-full px-3 py-2 rounded-lg bg-[#1D1E20] border border-gray-700 text-white text-sm" />
                        <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone" className="w-full px-3 py-2 rounded-lg bg-[#1D1E20] border border-gray-700 text-white text-sm" />
                        <div>
                            <p className="text-xs text-gray-400 mb-2">Assigned fests</p>
                            <div className="max-h-40 overflow-y-auto space-y-1 border border-gray-800 rounded-lg p-2">
                                {fests.map((fest) => {
                                    const id = String(fest._id || fest.id);
                                    const checked = form.assignedFestIds.includes(id);
                                    return (
                                        <label key={id} className="flex items-center gap-2 text-sm text-gray-300 px-1 py-1 hover:bg-white/5 rounded">
                                            <input type="checkbox" checked={checked} onChange={() => toggleFest(id)} />
                                            {fest.festName || fest.name || id}
                                        </label>
                                    );
                                })}
                                {!fests.length ? <p className="text-xs text-gray-500 p-2">No fests in admin list.</p> : null}
                            </div>
                        </div>
                        <label className="flex items-center gap-2 text-sm text-gray-300">
                            <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
                            Active
                        </label>
                        <div className="flex justify-end gap-2 pt-2">
                            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-lg border border-gray-700 text-sm text-gray-300">Cancel</button>
                            <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-[#0ECCEE] text-black text-sm font-semibold disabled:opacity-50">
                                {saving ? 'Saving…' : 'Save'}
                            </button>
                        </div>
                    </form>
                </div>
            ) : null}
        </div>
    );
}
