import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import MultiCoverImagesUpload from './MultiCoverImagesUpload';
import GalleryImagesUploadField from './GalleryImagesUploadField';
import CommunityHeroBannerField from './CommunityHeroBannerField';
import { normalizeCoverImages, primaryCoverUrl, EMPTY_COVER_IMAGES } from '../../utils/coverImages';
import { normalizeImageList, normalizeImageUrl } from '../../utils/uploadUrls';
import { RUN_CATEGORY_OPTIONS } from '../../constants/runClubCategories';
import { adminFetchJSON } from '../../utils/adminApi';

const EMPTY = {
    name: '',
    basedIn: '',
    organizer: '',
    aboutUs: '',
    runCategories: [],
    coverImage: '',
    coverImages: EMPTY_COVER_IMAGES(),
    galleryImages: [],
    registrationLink: '',
    registration: { status: 'open', mode: 'internal_form' },
    contactPhone: '',
    contactInstagram: '',
    groupLink: '',
    status: 'published',
};

function pickClubFormFields(source = {}) {
    const coverImages = normalizeCoverImages(source.coverImages);
    const legacyCover = normalizeImageUrl(source.coverImage);
    if (!coverImages.portrait && legacyCover) coverImages.portrait = legacyCover;
    return {
        name: source.name || '',
        basedIn: source.basedIn || '',
        organizer: source.organizer || '',
        aboutUs: source.aboutUs || '',
        runCategories: Array.isArray(source.runCategories) ? source.runCategories : [],
        coverImage: legacyCover || primaryCoverUrl(coverImages),
        coverImages,
        galleryImages: normalizeImageList(source.galleryImages),
        registrationLink: source.registrationLink || '',
        registration: { ...EMPTY.registration, ...(source.registration || {}) },
        contactPhone: source.contactPhone || '',
        contactInstagram: source.contactInstagram || '',
        groupLink: source.groupLink || '',
        status: source.status || 'published',
    };
}

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

    const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

    const toggleCategory = (cat) => {
        set(
            'runCategories',
            form.runCategories.includes(cat)
                ? form.runCategories.filter((c) => c !== cat)
                : [...form.runCategories, cat],
        );
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
            const fields = pickClubFormFields(form);
            const coverImages = normalizeCoverImages(fields.coverImages);
            const data = await adminFetchJSON(path, {
                method: club ? 'PUT' : 'POST',
                body: JSON.stringify({
                    ...fields,
                    coverImages,
                    coverImage: primaryCoverUrl(coverImages, fields.coverImage),
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
                        hint="Name, organizer and location shown at the top of the detail page"
                    >
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

                    <AdminFormSection
                        title="Cover images"
                        hint="Card layouts and hero banner — separate from the gallery below"
                    >
                        <MultiCoverImagesUpload
                            value={form.coverImages}
                            onChange={(coverImages) => {
                                set('coverImages', coverImages);
                                set('coverImage', primaryCoverUrl(coverImages, form.coverImage));
                            }}
                            onError={(msg) => setError(`Cover upload failed: ${msg}`)}
                            onUploadingChange={setUploading}
                            hint="Upload a cropped image per layout (portrait cards, wide cards, hero, etc.)."
                        />
                    </AdminFormSection>

                    <AdminFormSection
                        title="Run Club detail banner (393 × 396)"
                        hint="Separate upload for the Run Club page top banner frame. Use this for exact-fit hero crop."
                    >
                        <CommunityHeroBannerField
                            value={form.coverImages?.hero || ''}
                            onChange={(url) => {
                                const nextCoverImages = normalizeCoverImages({
                                    ...form.coverImages,
                                    hero: url || '',
                                });
                                set('coverImages', nextCoverImages);
                                set('coverImage', primaryCoverUrl(nextCoverImages, form.coverImage));
                            }}
                            onError={(msg) => setError(`Detail banner upload failed: ${msg}`)}
                            onUploadingChange={setUploading}
                            communityName={form.name || 'Run Club'}
                        />
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
                        hint="Extra photos only — not used as cover or card images"
                    >
                        <GalleryImagesUploadField
                            value={form.galleryImages}
                            onChange={(galleryImages) => set('galleryImages', galleryImages)}
                            onError={(msg) => setError(`Gallery upload failed: ${msg}`)}
                            onUploadingChange={setUploadingGallery}
                        />
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
                            <div className="flex items-start gap-3">
                                <span className="text-gray-400 text-sm w-24 shrink-0 pt-2.5">WhatsApp</span>
                                <div className="flex-1 min-w-0">
                                    <input
                                        type="url"
                                        value={form.groupLink}
                                        onChange={(e) => set('groupLink', e.target.value)}
                                        className={inp}
                                        placeholder="https://chat.whatsapp.com/…"
                                    />
                                    <p className="text-[11px] text-gray-500 mt-1">
                                        Sent to runners after payment is approved. Falls back to club phone if empty.
                                    </p>
                                </div>
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
