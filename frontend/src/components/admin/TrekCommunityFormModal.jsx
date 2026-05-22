import { useState, useEffect } from 'react';
import { X, Upload, Plus, Trash2 } from 'lucide-react';

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

const CATEGORY_OPTIONS = ['Camping', 'Trail Walks', 'Hiking', 'Backpacking', 'Adventure'];

const EMPTY = {
    name: '',
    basedIn: '',
    aboutUs: '',
    trekCategories: [],
    coverImage: '',
    galleryImages: [],
    contactPhone: '',
    contactInstagram: '',
    status: 'published',
    homeSection: null,
    priority: 999,
    showOnTreks: true,
};

export default function TrekCommunityFormModal({ community, onClose, onSaved }) {
    const [form, setForm] = useState(EMPTY);
    const [uploading, setUploading] = useState(false);
    const [uploadingGallery, setUploadingGallery] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        setForm(community ? { ...EMPTY, ...community } : EMPTY);
    }, [community]);

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const toggleCategory = (cat) => {
        set('trekCategories', form.trekCategories.includes(cat)
            ? form.trekCategories.filter(c => c !== cat)
            : [...form.trekCategories, cat]
        );
    };

    const getToken = () => {
        const token = localStorage.getItem('admin_token');
        if (!token) {
            setError('Session expired. Please log in again.');
            setTimeout(() => { window.location.href = '/admin/login'; }, 1500);
            return null;
        }
        return token;
    };

    const uploadImages = async (files, field) => {
        const isGallery = field === 'galleryImages';
        isGallery ? setUploadingGallery(true) : setUploading(true);
        try {
            const token = getToken();
            if (!token) return;
            const fd = new FormData();
            files.forEach(f => fd.append('images', f));
            const res = await fetch(`${API}/admin/upload/images`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: fd,
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Upload failed');
            const urls = (data.urls || data.imageUrls || []).map(item =>
                typeof item === 'string' ? item : item.url
            );
            if (isGallery) {
                set('galleryImages', [...form.galleryImages, ...urls]);
            } else {
                set('coverImage', urls[0] || '');
            }
        } catch (err) {
            setError(`Upload failed: ${err.message}`);
        } finally {
            isGallery ? setUploadingGallery(false) : setUploading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (!form.name.trim()) { setError('Community name is required.'); return; }
        if (uploading || uploadingGallery) {
            setError('Please wait for image upload to finish.');
            return;
        }
        setSaving(true);
        try {
            const token = getToken();
            if (!token) { setSaving(false); return; }
            const url = community ? `${API}/admin/trek-communities/${community._id}` : `${API}/admin/trek-communities`;
            const res = await fetch(url, {
                method: community ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify(form),
            });
            if (res.status === 401 || res.status === 403) {
                localStorage.removeItem('admin_token');
                localStorage.removeItem('admin_refresh_token');
                setError('Session expired. Redirecting to login...');
                setTimeout(() => { window.location.href = '/admin/login'; }, 1500);
                return;
            }
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Save failed');
            localStorage.setItem('admin_data_updated', Date.now().toString());
            setTimeout(() => localStorage.removeItem('admin_data_updated'), 1000);
            onSaved(data.community);
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const inp = "w-full bg-[#1D1E20] border border-gray-600 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#0ECCEE]";

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 py-8 px-4">
            <div className="w-full max-w-2xl bg-[#111213] rounded-xl border border-gray-700 shadow-2xl">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
                    <h2 className="text-lg font-bold text-white">
                        {community ? 'Edit Community' : 'Add Community'}
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={20} /></button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {error && (
                        <div className="bg-red-900/30 border border-red-700 text-red-300 text-sm rounded-lg px-4 py-3">{error}</div>
                    )}

                    {/* Cover Image */}
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
                            {uploading ? <span className="text-[#0ECCEE]">Uploading...</span> : <><Upload size={14} /><span>Upload cover image</span></>}
                            <input type="file" accept="image/*" onChange={e => { const f = Array.from(e.target.files); if (f.length) uploadImages(f, 'coverImage'); e.target.value = ''; }} disabled={uploading} className="hidden" />
                        </label>
                    </div>

                    {/* Name + Based In */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Community Name <span className="text-red-400">*</span></label>
                            <input type="text" value={form.name} onChange={e => set('name', e.target.value)} className={inp} placeholder="e.g. Pune Trekkers" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Based In</label>
                            <input type="text" value={form.basedIn} onChange={e => set('basedIn', e.target.value)} className={inp} placeholder="e.g. Pune, Maharashtra" />
                        </div>
                    </div>

                    {/* About Us */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">About Us</label>
                        <textarea
                            value={form.aboutUs}
                            onChange={e => set('aboutUs', e.target.value)}
                            rows={4}
                            className={`${inp} resize-none`}
                            placeholder="Describe your community..."
                        />
                    </div>

                    {/* Trek Categories */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Trek Categories</label>
                        <div className="flex flex-wrap gap-2">
                            {CATEGORY_OPTIONS.map(cat => (
                                <button
                                    key={cat}
                                    type="button"
                                    onClick={() => toggleCategory(cat)}
                                    className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all duration-150
                                        ${form.trekCategories.includes(cat)
                                            ? 'bg-[#0ECCEE] text-black'
                                            : 'bg-[#1D1E20] text-gray-300 border border-gray-600 hover:border-[#0ECCEE]'
                                        }`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Gallery Images */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Gallery Images (Trek Cards)</label>
                        {form.galleryImages.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-2">
                                {form.galleryImages.map((url, i) => (
                                    <div key={i} className="relative w-20 h-20">
                                        <img src={url} alt="" className="w-full h-full object-cover rounded-lg border border-gray-600" />
                                        <button
                                            type="button"
                                            onClick={() => set('galleryImages', form.galleryImages.filter((_, j) => j !== i))}
                                            className="absolute -top-1.5 -right-1.5 bg-red-600 rounded-full p-0.5 hover:bg-red-700"
                                        >
                                            <X size={10} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                        <label className="flex items-center gap-2 cursor-pointer w-fit bg-[#1D1E20] border border-dashed border-gray-500 hover:border-[#0ECCEE] rounded-lg px-4 py-2 text-sm text-gray-400 transition-colors">
                            {uploadingGallery ? <span className="text-[#0ECCEE]">Uploading...</span> : <><Upload size={14} /><span>Upload gallery images</span></>}
                            <input type="file" accept="image/*" multiple onChange={e => { const f = Array.from(e.target.files); if (f.length) uploadImages(f, 'galleryImages'); e.target.value = ''; }} disabled={uploadingGallery} className="hidden" />
                        </label>
                        <p className="text-xs text-gray-500 mt-1">These appear as trek cards in the community detail page</p>
                    </div>

                    {/* Contact Details */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Contact Details</label>
                        <div className="space-y-3">
                            <div className="flex items-center gap-3">
                                <span className="text-gray-400 text-sm w-24 flex-shrink-0">📞 Phone</span>
                                <input type="tel" value={form.contactPhone} onChange={e => set('contactPhone', e.target.value)} className={inp} placeholder="+91 98765 43210" />
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-gray-400 text-sm w-24 flex-shrink-0">📸 Instagram</span>
                                <input type="text" value={form.contactInstagram} onChange={e => set('contactInstagram', e.target.value)} className={inp} placeholder="@handle" />
                            </div>
                        </div>
                    </div>

                    {/* Home Page Section + Priority */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Home Page Section</label>
                            <select value={form.homeSection || ''} onChange={e => set('homeSection', e.target.value || null)} className={inp}>
                                <option value="">None</option>
                                <option value="trending">🔥 Trending Now</option>
                                <option value="happening">📍 Happening Near You</option>
                                <option value="slide">🎠 Home Slide</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Priority <span className="text-gray-500 font-normal">(1 = top)</span></label>
                            <input
                                type="number" min="1" max="999"
                                value={form.priority ?? 999}
                                onChange={e => set('priority', e.target.value === '' ? 999 : Math.min(999, Math.max(1, parseInt(e.target.value) || 999)))}
                                className={inp}
                                placeholder="999"
                            />
                        </div>
                    </div>

                    {/* Show on Treks Page */}
                    <div className={`flex items-center justify-between p-3 rounded-xl border ${form.showOnTreks ? 'border-[#0ECCEE] bg-[#0ECCEE]/5' : 'border-gray-600 bg-[#1D1E20]'}`}>
                        <div>
                            <p className="text-sm font-medium text-gray-200">🏔️ Show on Treks Page</p>
                            <p className="text-xs text-gray-500 mt-0.5">Displays this community in the Explore Communities section on the treks page</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => set('showOnTreks', !form.showOnTreks)}
                            className={`relative w-12 h-6 rounded-full transition-colors duration-200 flex-shrink-0
                                ${form.showOnTreks ? 'bg-[#0ECCEE]' : 'bg-gray-600'}`}
                        >
                            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200
                                ${form.showOnTreks ? 'translate-x-6' : 'translate-x-0.5'}`} />
                        </button>
                    </div>

                    {/* Status */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Status</label>
                        <div className="flex gap-4">
                            {['published', 'draft'].map(s => (
                                <label key={s} className="flex items-center gap-2 cursor-pointer">
                                    <input type="radio" name="comm_status" value={s} checked={form.status === s} onChange={() => set('status', s)} className="accent-[#0ECCEE]" />
                                    <span className="text-sm text-gray-300 capitalize">{s}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors">
                            Cancel
                        </button>
                        <button type="submit" disabled={saving || uploading || uploadingGallery} className="flex-1 px-4 py-2.5 bg-[#0ECCEE] hover:bg-[#0ECCEE]/80 text-black rounded-lg text-sm font-bold transition-colors disabled:opacity-50">
                            {saving ? 'Saving...' : community ? 'Update Community' : 'Add Community'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
