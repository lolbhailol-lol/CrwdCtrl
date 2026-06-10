import { useState, useEffect } from 'react';
import { X, Upload } from 'lucide-react';
import { normalizeImageUrl, parseUploadedUrls } from '../../utils/uploadUrls';
const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

const EMPTY = {
    name: '',
    basedIn: '',
    organizer: '',
    aboutUs: '',
    coverImage: '',
    registrationLink: '',
    contactPhone: '',
    contactInstagram: '',
    showOnSportsPage: true,
    showInRunClubs: true,
    runClubPriority: 999,
    status: 'published',
};

export default function RunClubFormModal({ club, onClose, onSaved }) {
    const [form, setForm] = useState(EMPTY);
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (club) {
            setForm({
                ...EMPTY,
                ...club,
                coverImage: normalizeImageUrl(club.coverImage),
            });
        } else {
            setForm(EMPTY);
        }
    }, [club]);

    const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

    const getToken = () => localStorage.getItem('admin_token');

    const uploadCover = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        setError('');
        try {
            const fd = new FormData();
            fd.append('images', file);
            const res = await fetch(`${API}/admin/upload/images`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${getToken()}` },
                body: fd,
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || data.error || 'Upload failed');
            const urls = parseUploadedUrls(data);
            if (!urls[0]) throw new Error('Upload succeeded but no image URL was returned');
            set('coverImage', urls[0]);
        } catch (err) {
            setError(`Upload failed: ${err.message}`);
        } finally {
            setUploading(false);
            e.target.value = '';
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (!form.name.trim()) {
            setError('Run club name is required.');
            return;
        }
        setSaving(true);
        try {
            const url = club ? `${API}/admin/run-clubs/${club._id}` : `${API}/admin/run-clubs`;
            const res = await fetch(url, {
                method: club ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
                body: JSON.stringify({
                    ...form,
                    coverImage: normalizeImageUrl(form.coverImage),
                    runClubPriority: Number(form.runClubPriority) || 999,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Save failed');
            localStorage.setItem('admin_data_updated', Date.now().toString());
            setTimeout(() => localStorage.removeItem('admin_data_updated'), 1000);
            onSaved(data.club);
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const inp = 'w-full bg-[#1D1E20] border border-gray-600 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#0ECCEE]';

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 py-8 px-4">
            <div className="w-full max-w-2xl bg-[#111213] rounded-xl border border-gray-700 shadow-2xl">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
                    <h2 className="text-lg font-bold text-white">{club ? 'Edit Run Club' : 'Add Run Club'}</h2>
                    <button type="button" onClick={onClose} className="text-gray-400 hover:text-white">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {error && (
                        <div className="bg-red-900/30 border border-red-700 text-red-300 text-sm rounded-lg px-4 py-3">
                            {error}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Cover Image</label>
                        {form.coverImage && (
                            <div className="relative w-full h-36 mb-2 rounded-xl overflow-hidden">
                                <img src={form.coverImage} alt="Cover" className="w-full h-full object-cover" />
                                <button
                                    type="button"
                                    onClick={() => set('coverImage', '')}
                                    className="absolute top-2 right-2 bg-red-600 rounded-full p-1 hover:bg-red-700"
                                >
                                    <X size={12} />
                                </button>
                            </div>
                        )}
                        <label className="flex items-center gap-2 cursor-pointer w-fit bg-[#1D1E20] border border-dashed border-gray-500 hover:border-[#0ECCEE] rounded-lg px-4 py-2 text-sm text-gray-400 transition-colors">
                            {uploading ? (
                                <span className="text-[#0ECCEE]">Uploading...</span>
                            ) : (
                                <>
                                    <Upload size={14} />
                                    <span>Upload cover image</span>
                                </>
                            )}
                            <input type="file" accept="image/*" onChange={uploadCover} disabled={uploading} className="hidden" />
                        </label>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">
                                Club Name <span className="text-red-400">*</span>
                            </label>
                            <input type="text" value={form.name} onChange={(e) => set('name', e.target.value)} className={inp} placeholder="e.g. Mumbai Runners" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Based In</label>
                            <input type="text" value={form.basedIn} onChange={(e) => set('basedIn', e.target.value)} className={inp} placeholder="e.g. Mumbai" />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Organizer</label>
                        <input type="text" value={form.organizer} onChange={(e) => set('organizer', e.target.value)} className={inp} placeholder="Club organizer" />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">About</label>
                        <textarea value={form.aboutUs} onChange={(e) => set('aboutUs', e.target.value)} rows={3} className={`${inp} resize-none`} placeholder="About this run club..." />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Registration / Join Link</label>
                        <input type="url" value={form.registrationLink} onChange={(e) => set('registrationLink', e.target.value)} className={inp} placeholder="https://..." />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Phone</label>
                            <input type="tel" value={form.contactPhone} onChange={(e) => set('contactPhone', e.target.value)} className={inp} placeholder="+91..." />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Instagram</label>
                            <input type="text" value={form.contactInstagram} onChange={(e) => set('contactInstagram', e.target.value)} className={inp} placeholder="@handle" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Run Clubs Priority</label>
                            <input
                                type="number"
                                min="1"
                                max="999"
                                value={form.runClubPriority}
                                onChange={(e) => set('runClubPriority', e.target.value)}
                                className={inp}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Status</label>
                            <div className="flex gap-4 pt-2">
                                {['published', 'draft'].map((s) => (
                                    <label key={s} className="flex items-center gap-2 cursor-pointer">
                                        <input type="radio" name="club_status" value={s} checked={form.status === s} onChange={() => set('status', s)} className="accent-[#0ECCEE]" />
                                        <span className="text-sm text-gray-300 capitalize">{s}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>

                    <label className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer ${form.showInRunClubs ? 'border-[#0ECCEE] bg-[#0ECCEE]/5' : 'border-gray-600 bg-[#1D1E20]'}`}>
                        <div>
                            <p className="text-sm font-medium text-gray-200">Show in Explore Run Clubs</p>
                            <p className="text-xs text-gray-500 mt-0.5">Visible on /sports Run Clubs row</p>
                        </div>
                        <input type="checkbox" checked={form.showInRunClubs} onChange={(e) => set('showInRunClubs', e.target.checked)} className="accent-[#0ECCEE] w-4 h-4" />
                    </label>

                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors">
                            Cancel
                        </button>
                        <button type="submit" disabled={saving || uploading} className="flex-1 px-4 py-2.5 bg-[#0ECCEE] hover:bg-[#0ECCEE]/80 text-black rounded-lg text-sm font-bold transition-colors disabled:opacity-50">
                            {saving ? 'Saving...' : club ? 'Update Run Club' : 'Add Run Club'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
