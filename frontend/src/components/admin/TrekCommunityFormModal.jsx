import { useState, useEffect, useMemo } from 'react';
import { X, Upload } from 'lucide-react';
import { normalizeImageList, normalizeImageUrl, parseUploadedUrls } from '../../utils/uploadUrls';
import { adminFetch, adminFetchJSON } from '../../utils/adminApi';

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
    contacts: [],
    status: 'published',
};

const normalizeContacts = (list) =>
    Array.isArray(list)
        ? list.map((c) => ({
            name: c?.name || '',
            role: c?.role || '',
            phone: c?.phone || '',
        }))
        : [];

function pickCommunityFormFields(source = {}) {
    return {
        name: source.name || '',
        basedIn: source.basedIn || '',
        aboutUs: source.aboutUs || '',
        trekCategories: Array.isArray(source.trekCategories) ? source.trekCategories : [],
        coverImage: normalizeImageUrl(source.coverImage),
        galleryImages: normalizeImageList(source.galleryImages),
        contactPhone: source.contactPhone || '',
        contactInstagram: source.contactInstagram || '',
        contacts: normalizeContacts(source.contacts),
        status: source.status || 'published',
    };
}

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
        setForm(pickCommunityFormFields(community));
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

    const [customCategory, setCustomCategory] = useState('');
    const addCustomCategory = () => {
        const value = customCategory.trim();
        if (!value) return;
        if (!form.trekCategories.some(c => c.toLowerCase() === value.toLowerCase())) {
            set('trekCategories', [...form.trekCategories, value]);
        }
        setCustomCategory('');
    };

    const addContact = () => set('contacts', [...form.contacts, { name: '', role: '', phone: '' }]);
    const updateContact = (idx, field, value) =>
        set('contacts', form.contacts.map((c, i) => (i === idx ? { ...c, [field]: value } : c)));
    const removeContact = (idx) => set('contacts', form.contacts.filter((_, i) => i !== idx));

    const uploadImages = async (files, field) => {
        const isGallery = field === 'galleryImages';
        isGallery ? setUploadingGallery(true) : setUploading(true);
        try {
            const fd = new FormData();
            files.forEach(f => fd.append('images', f));
            const res = await adminFetch('/admin/upload/images', { method: 'POST', body: fd });
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
            const path = community ? `/admin/trek-communities/${community._id}` : '/admin/trek-communities';
            const fields = pickCommunityFormFields(form);
            const payload = {
                ...fields,
                contacts: fields.contacts.filter(c => (c.name || c.role || c.phone || '').trim()),
                ...(community ? {} : { showOnTreks: true, trekPageSection: 'communities' }),
            };
            const data = await adminFetchJSON(path, {
                method: community ? 'PUT' : 'POST',
                body: JSON.stringify(payload),
            });
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
                            {[...CATEGORY_OPTIONS, ...form.trekCategories.filter(c => !CATEGORY_OPTIONS.includes(c))].map(cat => (
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
                        <div className="flex items-center gap-2 mt-3">
                            <input
                                type="text"
                                value={customCategory}
                                onChange={e => setCustomCategory(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomCategory(); } }}
                                className={inp}
                                placeholder="Add a custom category (e.g. Waterfall Treks)"
                            />
                            <button
                                type="button"
                                onClick={addCustomCategory}
                                className="shrink-0 px-4 py-2.5 rounded-lg bg-[#1D1E20] border border-gray-600 hover:border-[#0ECCEE] text-sm text-gray-200 font-medium transition-colors"
                            >
                                Add
                            </button>
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

                        <div className="pt-2 border-t border-gray-700/60">
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-sm font-medium text-gray-300">People to contact</p>
                                <button
                                    type="button"
                                    onClick={addContact}
                                    className="text-xs font-semibold text-[#0ECCEE] hover:underline"
                                >
                                    + Add contact
                                </button>
                            </div>
                            <p className="text-xs text-gray-500 mb-3">Add one or more people with their name, role and phone number. These appear as contact cards on the community page.</p>

                            {form.contacts.length === 0 ? (
                                <p className="text-xs text-gray-600 rounded-lg border border-dashed border-gray-600 px-3 py-3">
                                    No contacts added yet. Tap “Add contact” to add a person.
                                </p>
                            ) : (
                                <div className="space-y-3">
                                    {form.contacts.map((c, idx) => (
                                        <div key={idx} className="rounded-xl border border-gray-700 bg-[#1D1E20] p-3 space-y-2.5">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-semibold text-gray-400">Contact {idx + 1}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => removeContact(idx)}
                                                    className="text-gray-500 hover:text-red-400"
                                                    aria-label="Remove contact"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2.5">
                                                <input type="text" value={c.name} onChange={e => updateContact(idx, 'name', e.target.value)} className={inp} placeholder="Name (e.g. Rahul)" />
                                                <input type="text" value={c.role} onChange={e => updateContact(idx, 'role', e.target.value)} className={inp} placeholder="Role (e.g. Lead Organizer)" />
                                            </div>
                                            <input type="tel" value={c.phone} onChange={e => updateContact(idx, 'phone', e.target.value)} className={inp} placeholder="Phone (+91 98765 43210)" />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </AdminFormSection>

                    <p className="text-[11px] text-gray-600 px-1">
                        Visibility, carousel order &amp; home page placement → <span className="text-gray-500">Home &amp; Sections → Communities</span>
                    </p>

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
