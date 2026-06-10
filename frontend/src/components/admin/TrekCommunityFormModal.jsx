import { useState, useEffect, useMemo } from 'react';
import { X, Upload } from 'lucide-react';
import { normalizeImageList, normalizeImageUrl, parseUploadedUrls } from '../../utils/uploadUrls';

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

const CATEGORY_OPTIONS = ['Camping', 'Trail Walks', 'Hiking', 'Backpacking', 'Adventure'];
const GALLERY_PREVIEW_COUNT = 4;

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
    trekPageSection: 'communities',
    trekPagePriority: 999,
};

const buildGalleryPreview = (coverImage, galleryImages) => {
    const seen = new Set();
    const out = [];
    const add = (url) => {
        const normalized = normalizeImageUrl(url);
        if (normalized && !seen.has(normalized)) {
            seen.add(normalized);
            out.push(normalized);
        }
    };
    add(coverImage);
    normalizeImageList(galleryImages).forEach(add);
    return out;
};

function AdminFormSection({ title, hint, children }) {
    return (
        <div className="border border-gray-700/60 rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-[#1D1E20] border-b border-gray-700/60">
                <p className="text-sm font-semibold text-white">{title}</p>
                {hint ? <p className="text-xs text-gray-500 mt-0.5">{hint}</p> : null}
            </div>
            <div className="p-4 space-y-4">{children}</div>
        </div>
    );
}

function GalleryPreviewRow({ images }) {
    if (!images.length) {
        return (
            <p className="text-xs text-gray-500 rounded-lg border border-dashed border-gray-600 px-3 py-2">
                Upload a cover image or gallery images to preview the public Gallery row.
            </p>
        );
    }

    return (
        <div>
            <p className="text-xs text-gray-500 mb-2">Preview — matches the public community detail page</p>
            <div className="grid grid-cols-4 gap-2 max-w-sm">
                {images.slice(0, GALLERY_PREVIEW_COUNT).map((url, i) => {
                    const isOverflowTile = images.length > GALLERY_PREVIEW_COUNT && i === GALLERY_PREVIEW_COUNT - 1;
                    const remainingCount = images.length - GALLERY_PREVIEW_COUNT;
                    return (
                        <div key={`${url}-${i}`} className="relative aspect-square rounded-xl overflow-hidden bg-[#1D1E20] border border-gray-700">
                            <img src={url} alt="" className="absolute inset-0 w-full h-full object-cover" />
                            {isOverflowTile ? (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/55">
                                    <span className="text-white text-sm font-semibold">{remainingCount}+</span>
                                </div>
                            ) : null}
                        </div>
                    );
                })}
            </div>
            <p className="text-[11px] text-gray-600 mt-2">{images.length} image{images.length !== 1 ? 's' : ''} total · cover is always included first</p>
        </div>
    );
}

export default function TrekCommunityFormModal({ community, onClose, onSaved }) {
    const [form, setForm] = useState(EMPTY);
    const [uploading, setUploading] = useState(false);
    const [uploadingGallery, setUploadingGallery] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!community) {
            setForm(EMPTY);
            return;
        }
        setForm({
            ...EMPTY,
            ...community,
            coverImage: normalizeImageUrl(community.coverImage),
            galleryImages: normalizeImageList(community.galleryImages),
            trekPageSection: community.trekPageSection || 'communities',
            trekPagePriority: community.trekPagePriority ?? 999,
            priority: community.priority ?? 999,
        });
    }, [community]);

    const galleryPreview = useMemo(
        () => buildGalleryPreview(form.coverImage, form.galleryImages),
        [form.coverImage, form.galleryImages],
    );

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
            const urls = parseUploadedUrls(data);
            if (!urls.length) throw new Error('Upload succeeded but no image URL was returned');
            if (isGallery) {
                set('galleryImages', [...form.galleryImages, ...urls]);
            } else {
                set('coverImage', urls[0]);
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
            const payload = {
                ...form,
                coverImage: normalizeImageUrl(form.coverImage),
                galleryImages: normalizeImageList(form.galleryImages),
                trekPagePriority: Number(form.trekPagePriority) || 999,
                priority: Number(form.priority) || 999,
            };
            const res = await fetch(url, {
                method: community ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify(payload),
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
                    <div>
                        <h2 className="text-lg font-bold text-white">
                            {community ? 'Edit Community' : 'Add Community'}
                        </h2>
                        <p className="text-xs text-gray-500 mt-0.5">Fields map to the public community detail page</p>
                    </div>
                    <button type="button" onClick={onClose} className="text-gray-400 hover:text-white"><X size={20} /></button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {error && (
                        <div className="bg-red-900/30 border border-red-700 text-red-300 text-sm rounded-lg px-4 py-3">{error}</div>
                    )}

                    <AdminFormSection
                        title="Hero & identity"
                        hint="Cover, name, and location shown at the top of the detail page"
                    >
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
                            <p className="text-xs text-gray-500 mt-1">Full-width hero image. Also appears first in the Gallery section.</p>
                        </div>

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
                    </AdminFormSection>

                    <AdminFormSection title="About Us" hint="Description block below the community name">
                        <textarea
                            value={form.aboutUs}
                            onChange={e => set('aboutUs', e.target.value)}
                            rows={4}
                            className={`${inp} resize-none`}
                            placeholder="Describe your community..."
                        />
                    </AdminFormSection>

                    <AdminFormSection
                        title="Trek Category"
                        hint="Filter chips on the detail page — treks must use a matching category to appear under each chip"
                    >
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
                    </AdminFormSection>

                    <AdminFormSection
                        title="Gallery"
                        hint="Horizontal photo row at the bottom of the detail page — tap opens full-screen viewer"
                    >
                        {form.galleryImages.length > 0 && (
                            <div className="flex flex-wrap gap-2">
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
                        <GalleryPreviewRow images={galleryPreview} />
                    </AdminFormSection>

                    <AdminFormSection title="Contact Details" hint="Phone enables the call button next to the community name and the contact cards below">
                        <div className="space-y-3">
                            <div className="flex items-center gap-3">
                                <span className="text-gray-400 text-sm w-24 shrink-0">Phone</span>
                                <input type="tel" value={form.contactPhone} onChange={e => set('contactPhone', e.target.value)} className={inp} placeholder="+91 98765 43210" />
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-gray-400 text-sm w-24 shrink-0">Instagram</span>
                                <input type="text" value={form.contactInstagram} onChange={e => set('contactInstagram', e.target.value)} className={inp} placeholder="@handle" />
                            </div>
                        </div>
                    </AdminFormSection>

                    <AdminFormSection title="Treks page placement" hint="Where this community appears on /treks">
                        <div className={`flex items-center justify-between p-3 rounded-xl border ${form.showOnTreks ? 'border-[#0ECCEE] bg-[#0ECCEE]/5' : 'border-gray-600 bg-[#1D1E20]'}`}>
                            <div>
                                <p className="text-sm font-medium text-gray-200">Show on Treks Page</p>
                                <p className="text-xs text-gray-500 mt-0.5">Hide completely when turned off</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => set('showOnTreks', !form.showOnTreks)}
                                className={`relative w-12 h-6 rounded-full transition-colors duration-200 shrink-0
                                    ${form.showOnTreks ? 'bg-[#0ECCEE]' : 'bg-gray-600'}`}
                            >
                                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200
                                    ${form.showOnTreks ? 'translate-x-6' : 'translate-x-0.5'}`} />
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Treks Page Section</label>
                                <select
                                    value={form.showOnTreks ? (form.trekPageSection || 'communities') : 'hidden'}
                                    onChange={e => set('trekPageSection', e.target.value)}
                                    className={inp}
                                    disabled={!form.showOnTreks}
                                >
                                    <option value="communities">Explore Communities</option>
                                    <option value="comingSoon">Coming Soon</option>
                                    <option value="both">Both sections</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Treks Page Priority <span className="text-gray-500 font-normal">(1 = top)</span></label>
                                <input
                                    type="number" min="1" max="999"
                                    value={form.trekPagePriority ?? 999}
                                    onChange={e => set('trekPagePriority', e.target.value === '' ? 999 : Math.min(999, Math.max(1, parseInt(e.target.value, 10) || 999)))}
                                    className={inp}
                                    disabled={!form.showOnTreks}
                                />
                            </div>
                        </div>
                        <p className="text-[11px] text-gray-600">To drag-reorder all communities at once, use Home &amp; Sections → Communities.</p>
                    </AdminFormSection>

                    <AdminFormSection title="Home page" hint="Optional placement on the home dashboard">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Home Page Section</label>
                                <select value={form.homeSection || ''} onChange={e => set('homeSection', e.target.value || null)} className={inp}>
                                    <option value="">None</option>
                                    <option value="trending">Trending Now</option>
                                    <option value="happening">Happening Near You</option>
                                    <option value="slide">Home Slide</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Home Priority <span className="text-gray-500 font-normal">(1 = top)</span></label>
                                <input
                                    type="number" min="1" max="999"
                                    value={form.priority ?? 999}
                                    onChange={e => set('priority', e.target.value === '' ? 999 : Math.min(999, Math.max(1, parseInt(e.target.value, 10) || 999)))}
                                    className={inp}
                                    placeholder="999"
                                />
                            </div>
                        </div>
                    </AdminFormSection>

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

                    {community?._id ? (
                        <a
                            href={`/treks/community/${community._id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex text-xs text-[#0ECCEE] hover:underline"
                        >
                            Preview public community page →
                        </a>
                    ) : null}

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
