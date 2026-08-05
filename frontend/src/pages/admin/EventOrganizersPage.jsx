import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Plus, Loader, Pencil, Trash2, Search, Check, X } from 'lucide-react';
import { adminFetchJSON } from '../../services/api/admin.api.js';
import { useDialog } from '../../context/DialogContext';

const emptyForm = {
    name: '',
    username: '',
    password: '',
    phone: '',
    email: '',
    assignedEventShowIds: [],
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

export default function EventOrganizersPage() {
    const { confirm, toast } = useDialog();
    const [organizers, setOrganizers] = useState([]);
    const [pendingCount, setPendingCount] = useState(0);
    const [events, setEvents] = useState([]);
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

    const loginUrl = typeof window !== 'undefined'
        ? `${window.location.origin}/event-organizer/login`
        : '/event-organizer/login';
    const signupUrl = typeof window !== 'undefined'
        ? `${window.location.origin}/event-organizer/signup`
        : '/event-organizer/signup';

    const load = async () => {
        setLoading(true);
        try {
            const statusParam = tab === 'all' ? '' : `?status=${tab}`;
            const [orgData, eventData] = await Promise.all([
                adminFetchJSON(`/admin/event-organizers${statusParam}`),
                adminFetchJSON('/admin/events?limit=500'),
            ]);
            setOrganizers(orgData.organizers || []);
            setPendingCount(orgData.pendingCount ?? 0);
            setEvents(eventData.shows || eventData.events || eventData.data || []);
            const inviteData = await adminFetchJSON('/admin/event-organizers/profile-invites').catch(() => ({ invites: [] }));
            setInvites(inviteData.invites || []);
        } catch (e) {
            toast(e.message || 'Failed to load organizers');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [tab]);

    const addInvite = async (e) => {
        e.preventDefault();
        const email = inviteEmail.trim().toLowerCase();
        if (!email || !email.includes('@')) {
            toast('Enter a valid email');
            return;
        }
        setInviteSaving(true);
        try {
            await adminFetchJSON('/admin/event-organizers/profile-invites', {
                method: 'POST',
                body: JSON.stringify({ email, note: inviteNote.trim() }),
            });
            toast('Email approved for Profile → Event organizer');
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
        const ok = await confirm(`Remove ${invite.email} from Event organizer profile access?`);
        if (!ok) return;
        try {
            await adminFetchJSON(`/admin/event-organizers/profile-invites/${invite._id}`, { method: 'DELETE' });
            toast('Email removed');
            load();
        } catch (err) {
            toast(err.message || 'Failed to remove');
        }
    };

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return organizers;
        return organizers.filter((o) =>
            [o.name, o.username, o.email, o.phone]
                .join(' ')
                .toLowerCase()
                .includes(q),
        );
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
            assignedEventShowIds: (org.assignedEventShowIds || []).map((e) => String(e._id || e)),
            isActive: org.isActive !== false,
        });
        setModalOpen(true);
    };

    const toggleEvent = (id) => {
        setForm((prev) => {
            const set = new Set(prev.assignedEventShowIds.map(String));
            const key = String(id);
            if (set.has(key)) set.delete(key);
            else set.add(key);
            return { ...prev, assignedEventShowIds: [...set] };
        });
    };

    const save = async (e) => {
        e.preventDefault();
        if (!form.assignedEventShowIds.length) {
            toast('Assign at least one event');
            return;
        }
        setSaving(true);
        try {
            if (editing) {
                const payload = {
                    name: form.name,
                    username: form.username,
                    phone: form.phone,
                    email: form.email,
                    assignedEventShowIds: form.assignedEventShowIds,
                    isActive: form.isActive,
                };
                if (form.password) payload.password = form.password;
                await adminFetchJSON(`/admin/event-organizers/${editing._id}`, {
                    method: 'PUT',
                    body: JSON.stringify(payload),
                });
                toast('Organizer updated');
            } else {
                const created = await adminFetchJSON('/admin/event-organizers', {
                    method: 'POST',
                    body: JSON.stringify(form),
                });
                if (created?.emailStatus?.attempted && created?.emailStatus?.sent) {
                    toast('Organizer created + account email sent');
                } else if (created?.emailStatus?.attempted && !created?.emailStatus?.sent) {
                    toast(`Organizer created, but email failed: ${created?.emailStatus?.reason || 'unknown error'}`);
                } else {
                    toast('Organizer created (no email sent — add organizer email)');
                }
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
            const approved = await adminFetchJSON(`/admin/event-organizers/${org._id}/approve`, { method: 'POST', body: '{}' });
            if (approved?.emailStatus?.attempted && approved?.emailStatus?.sent) {
                toast('Approved + approval email sent');
            } else if (approved?.emailStatus?.attempted && !approved?.emailStatus?.sent) {
                toast(`Approved, but email failed: ${approved?.emailStatus?.reason || 'unknown error'}`);
            } else {
                toast('Approved (no email sent — add organizer email)');
            }
            load();
        } catch (e) {
            toast(e.message || 'Approve failed');
        } finally {
            setActionBusy('');
        }
    };

    const reject = async (org) => {
        setActionBusy(org._id);
        try {
            await adminFetchJSON(`/admin/event-organizers/${org._id}/reject`, {
                method: 'POST',
                body: JSON.stringify({ reason: '' }),
            });
            toast('Rejected');
            load();
        } catch (e) {
            toast(e.message || 'Reject failed');
        } finally {
            setActionBusy('');
        }
    };

    const remove = async (org) => {
        const ok = await confirm(`Delete organizer ${org.username}?`);
        if (!ok) return;
        try {
            await adminFetchJSON(`/admin/event-organizers/${org._id}`, { method: 'DELETE' });
            toast('Deleted');
            load();
        } catch (e) {
            toast(e.message || 'Delete failed');
        }
    };

    const copyLogin = async (url = loginUrl, label = 'URL') => {
        try {
            await navigator.clipboard.writeText(url);
            toast(`${label} copied`);
        } catch {
            toast('Could not copy');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <CalendarDays className="text-[#0ECCEE]" size={22} />
                        Event Organizers
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Assign EventShows to organizer accounts. Portal: {loginUrl}
                    </p>
                </div>
                <div className="flex gap-2">
                    <button type="button" onClick={copyLogin} className="px-3 py-2 rounded-xl border border-gray-700 text-sm">
                        Copy login URL
                    </button>
                    <button
                        type="button"
                        onClick={openCreate}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#0ECCEE] text-black text-sm font-bold"
                    >
                        <Plus size={16} /> Add organizer
                    </button>
                </div>
            </div>

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

            {section === 'accounts' ? (
            <>
            <div className="flex flex-wrap gap-2 items-center">
                {['all', 'pending', 'approved', 'rejected'].map((t) => (
                    <button
                        key={t}
                        type="button"
                        onClick={() => setTab(t)}
                        className={`px-3 py-1.5 rounded-full text-xs capitalize border ${
                            tab === t ? 'border-[#0ECCEE] text-[#0ECCEE] bg-[#0ECCEE]/10' : 'border-gray-700 text-gray-400'
                        }`}
                    >
                        {t}{t === 'pending' && pendingCount ? ` (${pendingCount})` : ''}
                    </button>
                ))}
                <div className="relative ml-auto">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search…"
                        className="pl-9 pr-3 py-2 rounded-xl bg-[#161718] border border-gray-800 text-sm"
                    />
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-16"><Loader className="animate-spin text-[#0ECCEE]" /></div>
            ) : filtered.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-700 p-8 text-center text-gray-500 text-sm">
                    No organizers yet.
                </div>
            ) : (
                <div className="space-y-2">
                    {filtered.map((org) => (
                        <div key={org._id} className="rounded-xl border border-gray-800 bg-[#161718] p-4 flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <p className="font-semibold">{org.name}</p>
                                    {statusBadge(org)}
                                </div>
                                <p className="text-xs text-gray-500 mt-0.5">@{org.username} · {org.email || 'no email'}</p>
                                <p className="text-xs text-gray-500 mt-1">
                                    Events: {(org.assignedEventShowIds || [])
                                        .map((e) => (typeof e === 'object' ? (e.displayName || e.title) : e))
                                        .join(', ') || 'None'}
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {org.status === 'pending' ? (
                                    <>
                                        <button type="button" disabled={actionBusy === org._id} onClick={() => approve(org)} className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 text-xs inline-flex items-center gap-1"><Check size={12} /> Approve</button>
                                        <button type="button" disabled={actionBusy === org._id} onClick={() => reject(org)} className="px-2.5 py-1 rounded-lg bg-red-500/15 text-red-300 text-xs inline-flex items-center gap-1"><X size={12} /> Reject</button>
                                    </>
                                ) : null}
                                <button type="button" onClick={() => openEdit(org)} className="px-2.5 py-1 rounded-lg border border-gray-700 text-xs inline-flex items-center gap-1"><Pencil size={12} /> Edit</button>
                                <button type="button" onClick={() => remove(org)} className="px-2.5 py-1 rounded-lg border border-gray-700 text-xs text-red-300 inline-flex items-center gap-1"><Trash2 size={12} /> Delete</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            </>
            ) : (
                <div className="space-y-4">
                    <div className="rounded-xl border border-gray-800 bg-[#161718] p-4 space-y-3">
                        <div>
                            <h2 className="text-sm font-semibold text-white">Approve Profile → Event organizer</h2>
                            <p className="text-xs text-gray-500 mt-1">
                                These CrwdCtrl user emails see Event organizer in Profile and can request signup.
                                Separately approve the organizer username under Organizer accounts.
                            </p>
                        </div>
                        <form onSubmit={addInvite} className="flex flex-col sm:flex-row gap-2">
                            <input
                                type="email"
                                required
                                value={inviteEmail}
                                onChange={(e) => setInviteEmail(e.target.value)}
                                placeholder="organizer@event.com"
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
                            <div className="py-16 flex justify-center"><Loader className="animate-spin text-[#0ECCEE]" /></div>
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
                                                No emails yet — add a user email to show Event organizer in Profile
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
            )}

            <div className="flex flex-col gap-2 text-xs text-gray-600">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <span>Signup: <span className="text-[#0ECCEE]">{signupUrl}</span></span>
                    <button type="button" onClick={() => copyLogin(signupUrl, 'Signup URL')} className="shrink-0 px-3 py-2 rounded-lg border border-gray-700 text-gray-300 hover:border-[#0ECCEE]/40 text-xs font-medium min-h-[36px]">
                        Copy signup
                    </button>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <span>Login: <span className="text-[#0ECCEE]">{loginUrl}</span></span>
                    <button type="button" onClick={() => copyLogin(loginUrl, 'Login URL')} className="shrink-0 px-3 py-2 rounded-lg border border-gray-700 text-gray-300 hover:border-[#0ECCEE]/40 text-xs font-medium min-h-[36px]">
                        Copy login
                    </button>
                </div>
            </div>

            {modalOpen ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
                    <form onSubmit={save} className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-gray-800 bg-[#161718] p-5 space-y-3">
                        <h2 className="text-lg font-bold">{editing ? 'Edit organizer' : 'Add organizer'}</h2>
                        <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Name" className="w-full px-3 py-2.5 rounded-xl bg-[#111213] border border-gray-800 text-sm" />
                        <input required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="Username" className="w-full px-3 py-2.5 rounded-xl bg-[#111213] border border-gray-800 text-sm" />
                        <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder={editing ? 'New password (optional)' : 'Password'} required={!editing} className="w-full px-3 py-2.5 rounded-xl bg-[#111213] border border-gray-800 text-sm" />
                        <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" className="w-full px-3 py-2.5 rounded-xl bg-[#111213] border border-gray-800 text-sm" />
                        <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone" className="w-full px-3 py-2.5 rounded-xl bg-[#111213] border border-gray-800 text-sm" />
                        <div>
                            <p className="text-xs text-gray-400 mb-2">Assigned events</p>
                            <div className="max-h-48 overflow-y-auto space-y-1 rounded-xl border border-gray-800 p-2">
                                {events.length === 0 ? (
                                    <p className="text-xs text-gray-500 p-2">No events found</p>
                                ) : events.map((ev) => {
                                    const id = String(ev._id || ev.id);
                                    const checked = form.assignedEventShowIds.map(String).includes(id);
                                    return (
                                        <label key={id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 text-sm cursor-pointer">
                                            <input type="checkbox" checked={checked} onChange={() => toggleEvent(id)} />
                                            <span className="truncate">{ev.displayName || ev.title || id}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                        {editing ? (
                            <label className="flex items-center gap-2 text-sm text-gray-300">
                                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
                                Active
                            </label>
                        ) : null}
                        <div className="flex justify-end gap-2 pt-2">
                            <button type="button" onClick={() => setModalOpen(false)} className="px-3 py-2 rounded-xl border border-gray-700 text-sm">Cancel</button>
                            <button type="submit" disabled={saving} className="px-3 py-2 rounded-xl bg-[#0ECCEE] text-black text-sm font-bold disabled:opacity-60">
                                {saving ? 'Saving…' : 'Save'}
                            </button>
                        </div>
                    </form>
                </div>
            ) : null}
        </div>
    );
}
