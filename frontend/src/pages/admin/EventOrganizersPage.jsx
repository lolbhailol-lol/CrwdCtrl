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
    const [tab, setTab] = useState('all');
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);
    const [actionBusy, setActionBusy] = useState('');

    const loginUrl = typeof window !== 'undefined'
        ? `${window.location.origin}/event-organizer/login`
        : '/event-organizer/login';

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
        } catch (e) {
            toast(e.message || 'Failed to load organizers');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [tab]);

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
                await adminFetchJSON('/admin/event-organizers', {
                    method: 'POST',
                    body: JSON.stringify(form),
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
        setActionBusy(org._id);
        try {
            await adminFetchJSON(`/admin/event-organizers/${org._id}/approve`, { method: 'POST', body: '{}' });
            toast('Approved');
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

    const copyLogin = async () => {
        try {
            await navigator.clipboard.writeText(loginUrl);
            toast('Login URL copied');
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
