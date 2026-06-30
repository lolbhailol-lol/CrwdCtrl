import { useState, useEffect, useMemo } from 'react';
import { X, Upload } from 'lucide-react';
import { normalizeImageList, normalizeImageUrl, parseUploadedUrls } from '../../utils/uploadUrls';
import { RUN_CATEGORY_OPTIONS } from '../../constants/runClubCategories';
import { adminFetch, adminFetchJSON } from '../../utils/adminApi';
const GALLERY_PREVIEW_COUNT = 4;

const EMPTY = {
    name: '',
    basedIn: '',
    organizer: '',
    aboutUs: '',
    runCategories: [],
    coverImage: '',
    galleryImages: [],
    registrationLink: '',
    registration: { status: 'open', mode: 'internal_form' },
    contactPhone: '',
    contactInstagram: '',
    status: 'published',
};

function pickClubFormFields(source = {}) {
    return {
        name: source.name || '',
        basedIn: source.basedIn || '',
        organizer: source.organizer || '',
        aboutUs: source.aboutUs || '',
        runCategories: Array.isArray(source.runCategories) ? source.runCategories : [],
        coverImage: normalizeImageUrl(source.coverImage),
        galleryImages: normalizeImageList(source.galleryImages),
        registrationLink: source.registrationLink || '',
        registration: { ...EMPTY.registration, ...(source.registration || {}) },
        contactPhone: source.contactPhone || '',
        contactInstagram: source.contactInstagram || '',
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
            <p className="text-xs text-gray-500 mb-2">Preview — matches the public run club detail page</p>
            <div className="grid grid-cols-4 gap-2 max-w-sm">
                {images.slice(0, GALLERY_PREVIEW_COUNT).map((url, i) => {
                    const isOverflowTile = images.length > GALLERY_PREVIEW_COUNT && i === GALLERY_PREVIEW_COUNT - 1;
                    const remainingCount = images.length - GALLERY_PREVIEW_COUNT;
                    return (
                        <div
                            key={`${url}-${i}`}
                            className="relative aspect-square rounded-xl overflow-hidden bg-[#1D1E20] border border-gray-700"
                        >
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
            <p className="text-[11px] text-gray-600 mt-2">
                {images.length} image{images.length !== 1 ? 's' : ''} total · cover is always included first
            </p>
        </div>
    );
}

export default function RunClubFormModal({ club, onClose, onSaved }) {
    const [form, setForm] = useState(EMPTY);
    const [uploading, setUploading] = useState(false);
    const [uploadingGallery, setUploadingGallery] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!club) {
            setForm(EMPTY);
            return;
        }
        setForm(pickClubFormFields(club));
    }, [club]);

    const galleryPreview = useMemo(
        () => buildGalleryPreview(form.coverImage, form.galleryImages),
        [form.coverImage, form.galleryImages],
    );

    const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

    const toggleCategory = (cat) => {
        set(
            'runCategories',
            form.runCategories.includes(cat)
                ? form.runCategories.filter((c) => c !== cat)
                : [...form.runCategories, cat],
        );
    };

    const uploadImages = async (files, field) => {
        const isGallery = field === 'galleryImages';
        isGallery ? setUploadingGallery(true) : setUploading(true);
        setError('');
        try {
            const fd = new FormData();
            files.forEach((f) => fd.append('images', f));
            const res = await adminFetch('/admin/upload/images', { method: 'POST', body: fd });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || data.error || 'Upload failed');
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
        if (!form.name.trim()) {
            setError('Run club name is required.');
            return;
        }
        if (uploading || uploadingGallery) {
            setError('Please wait for image upload to finish.');
            return;
        }
        setSaving(true);
        try {
            const path = club ? `/admin/run-clubs/${club._id}` : '/admin/run-clubs';
            const data = await adminFetchJSON(path, {
                method: club ? 'PUT' : 'POST',
                body: JSON.stringify({
                    ...pickClubFormFields(form),
                    ...(club ? {} : { showOnSportsPage: true, showInRunClubs: true }),
                }),
            });
            localStorage.setItem('admin_data_updated', Date.now().toString());
            setTimeout(() => localStorage.removeItem('admin_data_updated'), 1000);
            onSaved(data.club);
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const inp =
        'w-full bg-[#1D1E20] border border-gray-600 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#0ECCEE]';

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 py-8 px-4">
            <div className="w-full max-w-2xl bg-[#111213] rounded-xl border border-gray-700 shadow-2xl">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
                    <div>
                        <h2 className="text-lg font-bold text-white">{club ? 'Edit Run Club' : 'Add Run Club'}</h2>
                        <p className="text-xs text-gray-500 mt-0.5">Fields map to the public run club detail page</p>
                    </div>
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
                                {uploading ? (
                                    <span className="text-[#0ECCEE]">Uploading...</span>
                                ) : (
                                    <>
                                        <Upload size={14} />
                                        <span>Upload cover image</span>
                                    </>
                                )}
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => {
                                        const f = Array.from(e.target.files);
                                        if (f.length) uploadImages(f, 'coverImage');
                                        e.target.value = '';
                                    }}
                                    disabled={uploading}
                                    className="hidden"
                                />
                            </label>
                            <p className="text-xs text-gray-500 mt-1">
                                Full-width hero image. Also appears first in the Gallery section.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    Club Name <span className="text-red-400">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={form.name}
                                    onChange={(e) => set('name', e.target.value)}
                                    className={inp}
                                    placeholder="e.g. Mumbai Runners"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Based In</label>
                                <input
                                    type="text"
                                    value={form.basedIn}
                                    onChange={(e) => set('basedIn', e.target.value)}
                                    className={inp}
                                    placeholder="e.g. Mumbai"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Organizer</label>
                            <input
                                type="text"
                                value={form.organizer}
                                onChange={(e) => set('organizer', e.target.value)}
                                className={inp}
                                placeholder="Club organizer"
                            />
                        </div>
                    </AdminFormSection>

                    <AdminFormSection title="About Us" hint="Description block below the club name">
                        <textarea
                            value={form.aboutUs}
                            onChange={(e) => set('aboutUs', e.target.value)}
                            rows={4}
                            className={`${inp} resize-none`}
                            placeholder="About this run club..."
                        />
                    </AdminFormSection>

                    <AdminFormSection
                        title="Upcoming Runs categories"
                        hint="Filter chips on the detail page — runs must use a matching category to appear under each chip"
                    >
                        <div className="flex flex-wrap gap-2">
                            {RUN_CATEGORY_OPTIONS.map((cat) => (
                                <button
                                    key={cat}
                                    type="button"
                                    onClick={() => toggleCategory(cat)}
                                    className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all duration-150
                                        ${
                                            form.runCategories.includes(cat)
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
                        hint="Photo row at the bottom of the detail page — tap opens full-screen viewer"
                    >
                        {form.galleryImages.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {form.galleryImages.map((url, i) => (
                                    <div key={i} className="relative w-20 h-20">
                                        <img
                                            src={url}
                                            alt=""
                                            className="w-full h-full object-cover rounded-lg border border-gray-600"
                                        />
                                        <button
                                            type="button"
                                            onClick={() =>
                                                set(
                                                    'galleryImages',
                                                    form.galleryImages.filter((_, j) => j !== i),
                                                )
                                            }
                                            className="absolute -top-1.5 -right-1.5 bg-red-600 rounded-full p-0.5 hover:bg-red-700"
                                        >
                                            <X size={10} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                        <label className="flex items-center gap-2 cursor-pointer w-fit bg-[#1D1E20] border border-dashed border-gray-500 hover:border-[#0ECCEE] rounded-lg px-4 py-2 text-sm text-gray-400 transition-colors">
                            {uploadingGallery ? (
                                <span className="text-[#0ECCEE]">Uploading...</span>
                            ) : (
                                <>
                                    <Upload size={14} />
                                    <span>Upload gallery images</span>
                                </>
                            )}
                            <input
                                type="file"
                                accept="image/*"
                                multiple
                                onChange={(e) => {
                                    const f = Array.from(e.target.files);
                                    if (f.length) uploadImages(f, 'galleryImages');
                                    e.target.value = '';
                                }}
                                disabled={uploadingGallery}
                                className="hidden"
                            />
                        </label>
                        <GalleryPreviewRow images={galleryPreview} />
                    </AdminFormSection>

                    <AdminFormSection
                        title="Contact Details"
                        hint="Phone enables the call button next to the club name and the contact cards below"
                    >
                        <div className="space-y-3">
                            <div className="flex items-center gap-3">
                                <span className="text-gray-400 text-sm w-24 shrink-0">Phone</span>
                                <input
                                    type="tel"
                                    value={form.contactPhone}
                                    onChange={(e) => set('contactPhone', e.target.value)}
                                    className={inp}
                                    placeholder="+91 98765 43210"
                                />
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-gray-400 text-sm w-24 shrink-0">Instagram</span>
                                <input
                                    type="text"
                                    value={form.contactInstagram}
                                    onChange={(e) => set('contactInstagram', e.target.value)}
                                    className={inp}
                                    placeholder="@handle"
                                />
                            </div>
                        </div>
                    </AdminFormSection>

                    <AdminFormSection title="Registration" hint="Choose how members join — an in-app form, or an external link (WhatsApp / website / Google form)">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1">Registration Status</label>
                                <select
                                    value={form.registration?.status || 'open'}
                                    onChange={(e) => set('registration', { ...form.registration, status: e.target.value })}
                                    className={inp}
                                >
                                    <option value="open">Open</option>
                                    <option value="closed">Closed</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1">Registration Type</label>
                                <select
                                    value={form.registration?.mode || 'internal_form'}
                                    onChange={(e) => set('registration', { ...form.registration, mode: e.target.value })}
                                    className={inp}
                                >
                                    <option value="internal_form">Internal Form</option>
                                    <option value="external_link">External Link</option>
                                </select>
                            </div>
                        </div>
                        {(form.registration?.mode || 'internal_form') === 'external_link' && (
                            <div className="mt-3">
                                <label className="block text-xs font-medium text-gray-400 mb-1">External Link</label>
                                <input
                                    type="url"
                                    value={form.registrationLink}
                                    onChange={(e) => set('registrationLink', e.target.value)}
                                    className={inp}
                                    placeholder="https://wa.me/... or website / form link"
                                />
                                <p className="text-[11px] text-gray-600 mt-1">When set, the public page shows a “Book Now” button that opens this link.</p>
                            </div>
                        )}
                    </AdminFormSection>

                    <p className="text-[11px] text-gray-600 px-1">
                        Visibility, carousel order &amp; home page placement → <span className="text-gray-500">Home &amp; Sections → Run Clubs</span>
                    </p>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Status</label>
                        <div className="flex gap-4">
                            {['published', 'draft'].map((s) => (
                                <label key={s} className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="club_status"
                                        value={s}
                                        checked={form.status === s}
                                        onChange={() => set('status', s)}
                                        className="accent-[#0ECCEE]"
                                    />
                                    <span className="text-sm text-gray-300 capitalize">{s}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving || uploading || uploadingGallery}
                            className="flex-1 px-4 py-2.5 bg-[#0ECCEE] hover:bg-[#0ECCEE]/80 text-black rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
                        >
                            {saving ? 'Saving...' : club ? 'Update Run Club' : 'Add Run Club'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
