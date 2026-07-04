import { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import MultiCoverImagesUpload from './MultiCoverImagesUpload';
import CommunityHeroBannerField from './CommunityHeroBannerField';
import GalleryImagesUploadField from './GalleryImagesUploadField';
import { normalizeCoverImages, primaryCoverUrl, EMPTY_COVER_IMAGES } from '../../utils/coverImages';
import { normalizeImageList, normalizeImageUrl } from '../../utils/uploadUrls';
import { adminFetchJSON } from '../../utils/adminApi';

const CATEGORY_OPTIONS = ['Camping', 'Trail Walks', 'Hiking', 'Backpacking', 'Adventure'];

const EMPTY = {
    name: '',
    basedIn: '',
    aboutUs: '',
    trekCategories: [],
    coverImage: '',
    coverImages: EMPTY_COVER_IMAGES(),
    galleryImages: [],
    contactPhone: '',
    contactInstagram: '',
    groupLink: '',
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
    const coverImages = normalizeCoverImages(source.coverImages);
    const legacyCover = normalizeImageUrl(source.coverImage);
    if (!coverImages.portrait && legacyCover) coverImages.portrait = legacyCover;
    return {
        name: source.name || '',
        basedIn: source.basedIn || '',
        aboutUs: source.aboutUs || '',
        trekCategories: Array.isArray(source.trekCategories) ? source.trekCategories : [],
        coverImage: legacyCover || primaryCoverUrl(coverImages),
        coverImages,
        galleryImages: normalizeImageList(source.galleryImages),
        contactPhone: source.contactPhone || '',
        contactInstagram: source.contactInstagram || '',
        groupLink: source.groupLink || '',
        contacts: normalizeContacts(source.contacts),
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

export default function TrekCommunityFormModal({ community, onClose, onSaved }) {
    const [form, setForm] = useState(EMPTY);
    const [uploading, setUploading] = useState(false);
    const [uploadingHero, setUploadingHero] = useState(false);
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

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (!form.name.trim()) { setError('Community name is required.'); return; }
        if (uploading || uploadingHero || uploadingGallery) {
            setError('Please wait for image upload to finish.');
            return;
        }
        setSaving(true);
        try {
            const path = community ? `/admin/trek-communities/${community._id}` : '/admin/trek-communities';
            const fields = pickCommunityFormFields(form);
            const coverImages = normalizeCoverImages(fields.coverImages);
            const payload = {
                ...fields,
                coverImages,
                coverImage: primaryCoverUrl(coverImages, fields.coverImage),
                contacts: fields.contacts
                    .map((c) => ({
                        name: (c.name || '').trim(),
                        role: (c.role || '').trim(),
                        phone: (c.phone || '').trim(),
                    }))
                    .filter((c) => c.name || c.role || c.phone),
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

    const heroBannerDisplay =
        form.coverImages?.hero
        || form.coverImages?.portrait
        || form.coverImage
        || '';
    const usingFallbackBanner = !form.coverImages?.hero && Boolean(form.coverImages?.portrait || form.coverImage);

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
                        hint="Name and location shown at the top of the detail page"
                    >
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

                    <AdminFormSection
                        title="Community page banner"
                        hint="393 × 396 crop — matches the mobile header on /treks/community/:id (back, share, stats badges)"
                    >
                        <CommunityHeroBannerField
                            value={heroBannerDisplay}
                            communityName={form.name}
                            onChange={(heroUrl) => {
                                const coverImages = { ...normalizeCoverImages(form.coverImages), hero: heroUrl || '' };
                                set('coverImages', coverImages);
                                set('coverImage', primaryCoverUrl(coverImages, form.coverImage));
                            }}
                            onError={(msg) => setError(`Banner upload failed: ${msg}`)}
                            onUploadingChange={setUploadingHero}
                        />
                        {usingFallbackBanner ? (
                            <p className="text-xs text-amber-500/90 rounded-lg border border-amber-700/40 bg-amber-900/20 px-3 py-2">
                                This community is using a card image as the page banner. Upload above and crop to the 393×396 frame for a proper fit.
                            </p>
                        ) : null}
                    </AdminFormSection>

                    <AdminFormSection
                        title="Card & listing images"
                        hint="Optional — portrait/wide cards on treks page and home sections (banner above is separate)"
                    >
                        <MultiCoverImagesUpload
                            value={form.coverImages}
                            excludeKeys={['hero']}
                            onChange={(coverImages) => {
                                set('coverImages', coverImages);
                                set('coverImage', primaryCoverUrl(coverImages, form.coverImage));
                            }}
                            onError={(msg) => setError(`Cover upload failed: ${msg}`)}
                            onUploadingChange={setUploading}
                            hint="Upload cropped images for trek cards and carousels — not the community page header."
                        />
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
                        hint="Extra photos only — not used as cover or card images"
                    >
                        <GalleryImagesUploadField
                            value={form.galleryImages}
                            onChange={(galleryImages) => set('galleryImages', galleryImages)}
                            onError={(msg) => setError(`Gallery upload failed: ${msg}`)}
                            onUploadingChange={setUploadingGallery}
                        />
                    </AdminFormSection>

                    <AdminFormSection title="Contact Details" hint="Phone enables the call button; Instagram and group link show on the community & trek pages">
                        <div className="space-y-3">
                            <div className="flex items-center gap-3">
                                <span className="text-gray-400 text-sm w-24 shrink-0">Phone</span>
                                <input type="tel" value={form.contactPhone} onChange={e => set('contactPhone', e.target.value)} className={inp} placeholder="+91 98765 43210" />
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-gray-400 text-sm w-24 shrink-0">Instagram</span>
                                <input type="text" value={form.contactInstagram} onChange={e => set('contactInstagram', e.target.value)} className={inp} placeholder="@handle" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Community group link</label>
                                <input
                                    type="url"
                                    value={form.groupLink}
                                    onChange={e => set('groupLink', e.target.value)}
                                    className={inp}
                                    placeholder="https://chat.whatsapp.com/... or Telegram invite link"
                                />
                                <p className="text-[11px] text-gray-600 mt-1.5">
                                    Fallback when a trek has no trek-specific link. Sent only in registration emails and My Bookings → View Details.
                                </p>
                            </div>
                        </div>
                    </AdminFormSection>

                    <AdminFormSection
                        title="People to contact"
                        hint="Name, role and phone for each person — same as the trek form. Shown as contact cards on the community page."
                    >
                        <div className="rounded-lg border border-gray-700/60 p-3">
                            <div className="flex items-center justify-between mb-1">
                                <label className="block text-sm font-medium text-gray-300">Contacts</label>
                                <button type="button" onClick={addContact} className="flex items-center gap-1 text-xs font-semibold text-[#0ECCEE] hover:underline">
                                    <Plus size={13} /> Add contact
                                </button>
                            </div>
                            {(form.contacts || []).length === 0 ? (
                                <p className="text-xs text-gray-600 rounded-lg border border-dashed border-gray-600 px-3 py-2.5">No contacts added yet.</p>
                            ) : (
                                <div className="space-y-3 mt-3">
                                    {(form.contacts || []).map((c, idx) => (
                                        <div key={idx} className="rounded-lg border border-gray-700 bg-[#1D1E20] p-3 space-y-2.5">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-semibold text-gray-400">Contact {idx + 1}</span>
                                                <button type="button" onClick={() => removeContact(idx)} className="text-gray-500 hover:text-red-400" aria-label="Remove contact">
                                                    <Trash2 size={14} />
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
                        <button type="submit" disabled={saving || uploading || uploadingHero || uploadingGallery} className="flex-1 px-4 py-2.5 bg-[#0ECCEE] hover:bg-[#0ECCEE]/80 text-black rounded-lg text-sm font-bold transition-colors disabled:opacity-50">
                            {saving ? 'Saving...' : community ? 'Update Community' : 'Add Community'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
