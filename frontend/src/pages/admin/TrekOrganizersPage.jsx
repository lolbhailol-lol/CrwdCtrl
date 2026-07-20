import { useEffect, useMemo, useState } from 'react';
import { Mountain, Plus, Loader, Pencil, Trash2, Search } from 'lucide-react';
import { adminFetchJSON } from '../../services/api/admin.api.js';
import { useDialog } from '../../context/DialogContext';

const emptyForm = {
    name: '',
    username: '',
    password: '',
    phone: '',
    email: '',
    communityId: '',
    isActive: true,
};

export default function TrekOrganizersPage() {
    const { confirm, toast } = useDialog();
    const [organizers, setOrganizers] = useState([]);
    const [communities, setCommunities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);

    const organizerLoginUrl = typeof window !== 'undefined'
        ? `${window.location.origin}/trek-organizer/login`
        : '/trek-organizer/login';

    const copyLoginUrl = async () => {
        try {
            await navigator.clipboard.writeText(organizerLoginUrl);
            toast('Login URL copied');
        } catch {
            toast('Could not copy URL');
        }
    };

    const load = async () => {
        setLoading(true);
        try {
            const [orgData, communityData] = await Promise.all([
                adminFetchJSON('/admin/trek-organizers'),
                adminFetchJSON('/admin/trek-communities?limit=500'),
            ]);
            setOrganizers(orgData.organizers || []);
            setCommunities(communityData.communities || []);
        } catch (e) {
            toast(e.message || 'Failed to load organizers');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return organizers;
        return organizers.filter(
            (o) =>
                o.name?.toLowerCase().includes(q) ||
                o.username?.toLowerCase().includes(q) ||
                o.communityId?.name?.toLowerCase().includes(q) ||
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
            // Explicitly clear email on edit when blank
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

    const communityLabel = (org) => {
        if (org.communityId?.name) return org.communityId.name;
        const found = communities.find((c) => String(c._id) === String(org.communityId));
        return found?.name || '—';
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold">Community Organizers</h1>
                    <p className="text-sm text-gray-500">Super admin assigns username + password per trek community. Organizers cannot pick their own username.</p>
                </div>
                <button
                    type="button"
                    onClick={openCreate}
                    disabled={communities.length === 0}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0ECCEE] text-black text-sm font-bold disabled:opacity-50"
                >
                    <Plus size={16} /> Add organizer
                </button>
            </div>

            {communities.length === 0 && !loading ? (
                <div className="rounded-xl border border-amber-800/60 bg-amber-900/15 px-4 py-3 text-sm text-amber-200">
                    Create a trek community under Admin → Treks / Communities first, then you can add a community organizer.
                </div>
            ) : null}

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
                    <div className="py-16 flex justify-center"><Loader className="animate-spin text-[#0ECCEE]" /></div>
                ) : (
                    <table className="w-full text-sm">
                        <thead className="bg-[#111213] text-gray-500 text-[11px] uppercase">
                            <tr>
                                <th className="text-left px-4 py-3">Name</th>
                                <th className="text-left px-4 py-3">Assigned username</th>
                                <th className="text-left px-4 py-3 hidden md:table-cell">Community</th>
                                <th className="text-left px-4 py-3">Status</th>
                                <th className="text-right px-4 py-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr><td colSpan={5} className="px-4 py-12 text-center text-gray-500">No organizers</td></tr>
                            ) : filtered.map((org) => (
                                <tr key={org._id} className="border-t border-gray-800">
                                    <td className="px-4 py-3 font-medium">{org.name}</td>
                                    <td className="px-4 py-3 text-gray-400 font-mono text-xs">@{org.username}</td>
                                    <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{communityLabel(org)}</td>
                                    <td className="px-4 py-3">
                                        <span className={`text-xs px-2 py-0.5 rounded-full ${org.isActive !== false ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                                            {org.isActive !== false ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <button type="button" onClick={() => openEdit(org)} className="p-2 rounded-lg hover:bg-gray-800 text-gray-400"><Pencil size={14} /></button>
                                        <button type="button" onClick={() => remove(org)} className="p-2 rounded-lg hover:bg-red-900/30 text-red-400"><Trash2 size={14} /></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs text-gray-600">
                <span>
                    Organizer login: <span className="text-[#0ECCEE]">{organizerLoginUrl}</span>
                </span>
                <button type="button" onClick={copyLoginUrl} className="shrink-0 px-3 py-2 rounded-lg border border-gray-700 text-gray-300 hover:border-[#0ECCEE]/40 text-xs font-medium min-h-[36px]">
                    Copy URL
                </button>
            </div>

            {modalOpen ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <button type="button" className="absolute inset-0 bg-black/60" onClick={() => setModalOpen(false)} aria-label="Close" />
                    <form onSubmit={save} className="relative w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-2xl border border-gray-800 bg-[#161718] p-5 space-y-4">
                        <h2 className="text-lg font-bold flex items-center gap-2"><Mountain size={18} className="text-[#0ECCEE]" />{editing ? 'Edit organizer' : 'New organizer'}</h2>
                        <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Display name (e.g. Rahul Sharma)" className="w-full px-3 py-2.5 rounded-xl bg-[#111213] border border-gray-800 text-sm" />
                        <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1">Assign username</label>
                            <input
                                required
                                value={form.username}
                                onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                                placeholder="e.g. himalaya_organizer"
                                className="w-full px-3 py-2.5 rounded-xl bg-[#111213] border border-gray-800 text-sm font-mono"
                            />
                            <p className="text-[10px] text-gray-600 mt-1">Organizer signs in with this username. Letters, numbers and underscore only.</p>
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
                            <label className="block text-xs font-medium text-gray-400 mb-1">{editing ? 'New password (optional)' : 'Assign password'}</label>
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
                            <label className="block text-xs font-medium text-gray-400 mb-1">Email (optional)</label>
                            <input
                                type="email"
                                value={form.email}
                                onChange={(e) => setForm({ ...form, email: e.target.value })}
                                placeholder="Leave blank if not needed"
                                className="w-full px-3 py-2.5 rounded-xl bg-[#111213] border border-gray-800 text-sm"
                            />
                        </div>
                        <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Organizer phone (optional)" className="w-full px-3 py-2.5 rounded-xl bg-[#111213] border border-gray-800 text-sm" />
                        {editing ? (
                            <label className="flex items-center gap-2 text-sm">
                                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
                                Account active
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
