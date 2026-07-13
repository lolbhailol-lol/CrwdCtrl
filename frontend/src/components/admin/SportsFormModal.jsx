import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import MultiCoverImagesUpload from './MultiCoverImagesUpload';
import GalleryImagesUploadField from './GalleryImagesUploadField';
import { normalizeCoverImages, primaryCoverUrl, EMPTY_COVER_IMAGES } from '../../utils/coverImages';
import { normalizeImageList, normalizeImageUrl } from '../../utils/uploadUrls';
import { RUN_CATEGORY_OPTIONS } from '../../constants/runClubCategories';
import { adminFetch, adminFetchJSON } from '../../utils/adminApi';

const EMPTY = {
    title: '',
    sportType: '',
    displayType: '',
    organizer: '',
    venue: '',
    city: '',
    eventDate: '',
    reportingTime: '',
    registrationFee: 0,
    dressCode: '',
    participationType: 'individual',
    maxParticipants: 0,
    skillLevel: 'all',
    prizes: '',
    routeMap: '',
    coverImage: '',
    coverImages: EMPTY_COVER_IMAGES(),
    images: [],
    sponsors: '',
    registrationLink: '',
    registration: { status: 'open', mode: 'internal_form', googleSheetsUrl: '', organizerEmail: '', formInstructions: '', availableDates: [], timeSlots: [], locationOptions: [], maxPeoplePerBooking: 10, formSchema: [], paymentQR: '', paymentQRMessage: '', paymentUpiId: '' },
    description: '',
    status: 'published',
    runClubId: null,
    runCategory: '',
    distance: '',
    inclusions: '',
    returnTime: '',
    fitnessLevel: '',
    meetingPoint: '',
    ageLimit: '',
    infoSections: [],
    termsAndConditions: '',
    contactPhone: '',
    contactInstagram: '',
};

function SectionBlock({ title, hint, children }) {
    return (
        <div className="border border-[#0ECCEE]/20 rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-[#0ECCEE]/5 border-b border-[#0ECCEE]/15">
                <p className="text-sm font-bold text-[#0ECCEE]">{title}</p>
                {hint && <p className="text-[10px] text-gray-500 mt-0.5">{hint}</p>}
            </div>
            <div className="p-4 space-y-4">{children}</div>
        </div>
    );
}

/** Must live outside SportsFormModal — defining Field inside remounts inputs every keystroke. */
function Field({ label, required, children, hint }) {
    return (
        <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
                {label}
                {required && <span className="text-red-400 ml-1">*</span>}
            </label>
            {hint && <p className="text-[10px] text-gray-600 mb-1.5">{hint}</p>}
            {children}
        </div>
    );
}

const INPUT_CLASS =
    'w-full bg-[#1D1E20] border border-gray-600 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#0ECCEE]';

export default function SportsFormModal({ event, runClubId, clubName, onClose, onSaved }) {
    const [form, setForm] = useState(EMPTY);
    const [uploadingCover, setUploadingCover] = useState(false);
    const [uploadingGallery, setUploadingGallery] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [parentRunCategories, setParentRunCategories] = useState([]);

    useEffect(() => {
        if (event) {
            const coverImages = normalizeCoverImages(event.coverImages);
            const legacyCover = normalizeImageUrl(event.coverImage) || normalizeImageList(event.images)[0] || '';
            if (!coverImages.portrait && legacyCover) coverImages.portrait = legacyCover;
            const galleryOnly = normalizeImageList(event.images).filter((url) => url !== legacyCover);
            setForm({
                ...EMPTY,
                ...event,
                sportType: 'run_club',
                registration: { ...EMPTY.registration, ...(event.registration || {}) },
                eventDate: event.eventDate ? new Date(event.eventDate).toISOString().slice(0, 10) : '',
                sponsors: Array.isArray(event.sponsors) ? event.sponsors.join(', ') : (event.sponsors || ''),
                coverImage: legacyCover || primaryCoverUrl(coverImages),
                coverImages,
                images: galleryOnly,
                displayType: event.displayType || '',
                runClubId: event.runClubId || runClubId || null,
                runCategory: event.runCategory || '',
                distance: event.distance || '',
                inclusions: Array.isArray(event.inclusions)
                    ? event.inclusions.join('\n')
                    : (event.inclusions || ''),
                termsAndConditions: Array.isArray(event.termsAndConditions) ? event.termsAndConditions.join('\n') : '',
                contactPhone: event.contactPhone || '',
                contactInstagram: event.contactInstagram || '',
            });
        } else {
            setForm({
                ...EMPTY,
                runClubId: runClubId || null,
                sportType: 'run_club',
            });
        }
    }, [event, runClubId]);

    useEffect(() => {
        const clubId = form.runClubId || runClubId;
        if (!clubId) {
            setParentRunCategories([]);
            return;
        }
        adminFetchJSON(`/admin/run-clubs/${clubId}`)
            .then((data) => {
                const cats = Array.isArray(data?.club?.runCategories) ? data.club.runCategories : [];
                setParentRunCategories(cats.length ? cats : RUN_CATEGORY_OPTIONS);
            })
            .catch(() => setParentRunCategories(RUN_CATEGORY_OPTIONS));
    }, [form.runClubId, runClubId]);

    const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

    const addInfoSection = () =>
        set('infoSections', [...(form.infoSections || []), { title: '', details: '' }]);
    const updateInfoSection = (idx, key, value) =>
        set('infoSections', (form.infoSections || []).map((s, i) => (i === idx ? { ...s, [key]: value } : s)));
    const removeInfoSection = (idx) =>
        set('infoSections', (form.infoSections || []).filter((_, i) => i !== idx));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (!form.title.trim()) {
            setError('Run title is required.');
            return;
        }
        if (!runClubId && !form.runClubId) {
            setError('Run must belong to a run club.');
            return;
        }
        if (
            (form.registration?.mode || 'internal_form') === 'organizer_qr'
            && Number(form.registrationFee) > 0
            && !String(form.registration?.paymentQR || '').trim()
        ) {
            setError('Upload a payment QR image for Form + QR mode when fee is greater than 0.');
            return;
        }
        setSaving(true);
        try {
            const coverImages = normalizeCoverImages(form.coverImages);
            const payload = {
                title: form.title.trim(),
                sportType: 'run_club',
                runClubId: form.runClubId || runClubId || null,
                displayType: form.displayType?.trim() || '',
                organizer: form.organizer?.trim() || '',
                venue: form.venue?.trim() || '',
                city: form.city?.trim() || '',
                eventDate: form.eventDate || null,
                reportingTime: form.reportingTime?.trim() || '',
                registrationFee: Number(form.registrationFee) || 0,
                dressCode: form.dressCode?.trim() || '',
                participationType: form.participationType,
                maxParticipants: Number(form.maxParticipants) || 0,
                skillLevel: form.skillLevel,
                prizes: form.prizes?.trim() || '',
                routeMap: form.routeMap?.trim() || '',
                coverImages,
                coverImage: primaryCoverUrl(coverImages, form.coverImage),
                images: normalizeImageList(form.images),
                sponsors: form.sponsors ? form.sponsors.split(',').map((s) => s.trim()).filter(Boolean) : [],
                registrationLink: form.registrationLink?.trim() || '',
                registration: {
                    status: form.registration?.status || 'open',
                    mode: form.registration?.mode || 'internal_form',
                    googleSheetsUrl: form.registration?.googleSheetsUrl || '',
                    organizerEmail: form.registration?.organizerEmail || '',
                    formInstructions: form.registration?.formInstructions || '',
                    availableDates: [],
                    timeSlots: [],
                    locationOptions: [],
                    maxPeoplePerBooking: Number(form.registration?.maxPeoplePerBooking) || 10,
                    paymentQR: form.registration?.paymentQR || '',
                    paymentQRMessage: form.registration?.paymentQRMessage || '',
                    paymentUpiId: form.registration?.paymentUpiId || '',
                    formSchema: Array.isArray(form.registration?.formSchema) ? form.registration.formSchema : [],
                },
                description: form.description?.trim() || '',
                runCategory: form.runCategory?.trim() || '',
                distance: form.distance?.trim() || '',
                inclusions: form.inclusions
                    ? form.inclusions.split('\n').map((s) => s.trim()).filter(Boolean)
                    : [],
                returnTime: form.returnTime?.trim() || '',
                fitnessLevel: form.fitnessLevel?.trim() || '',
                meetingPoint: form.meetingPoint?.trim() || '',
                ageLimit: form.ageLimit?.trim() || '',
                infoSections: (form.infoSections || [])
                    .map((s) => ({ title: (s.title || '').trim(), details: (s.details || '').trim() }))
                    .filter((s) => s.title || s.details),
                termsAndConditions: form.termsAndConditions
                    ? form.termsAndConditions.split('\n').map((s) => s.trim()).filter(Boolean)
                    : [],
                contactPhone: form.contactPhone?.trim() || '',
                contactInstagram: form.contactInstagram?.trim() || '',
                status: form.status,
                ...(event ? {} : {
                    showOnSportsPage: true,
                    showInUpcoming: true,
                    showInRunClubs: false,
                    featuredSection: 'upcoming',
                }),
            };
            const path = event ? `/admin/sports/${event._id}` : '/admin/sports';
            const data = await adminFetchJSON(path, {
                method: event ? 'PUT' : 'POST',
                body: JSON.stringify(payload),
            });
            localStorage.setItem('admin_data_updated', Date.now().toString());
            setTimeout(() => localStorage.removeItem('admin_data_updated'), 1000);
            onSaved(data.event);
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const inp = INPUT_CLASS;

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 py-8 px-4">
            <div className="w-full max-w-3xl bg-[#111213] rounded-xl border border-gray-700 shadow-2xl">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 sticky top-0 bg-[#111213] z-10">
                    <div>
                        <h2 className="text-lg font-bold text-white">
                            {event ? 'Edit Run' : 'Add Run'}
                        </h2>
                        <p className="text-xs text-gray-500 mt-0.5">
                            {clubName ? `${clubName} · ` : ''}Shown on run club detail & Upcoming Activities (/sports)
                        </p>
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

                    <SectionBlock title="Basic Info" hint="Run name on club detail page and Upcoming Activities carousel">
                        <Field label="Run Title" required>
                            <input type="text" value={form.title} onChange={(e) => set('title', e.target.value)} className={inp} placeholder="e.g. Sunday Morning Run" />
                        </Field>
                        <Field
                            label="Card Subtitle"
                            hint="Optional label on Upcoming Activities cards (defaults to Run Club)"
                        >
                            <input type="text" value={form.displayType} onChange={(e) => set('displayType', e.target.value)} className={inp} placeholder="e.g. Social Run" />
                        </Field>
                        <Field label="Description">
                            <textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={3} className={`${inp} resize-none`} placeholder="Full event description" />
                        </Field>
                    </SectionBlock>

                    <SectionBlock title="Location & Schedule">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field label="Organizer">
                                <input type="text" value={form.organizer} onChange={(e) => set('organizer', e.target.value)} className={inp} placeholder="Club / organizer name" />
                            </Field>
                            <Field label="City" hint='Shown as "Based in" on Run Club cards'>
                                <input type="text" value={form.city} onChange={(e) => set('city', e.target.value)} className={inp} placeholder="e.g. Mumbai" />
                            </Field>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field label="Venue">
                                <input type="text" value={form.venue} onChange={(e) => set('venue', e.target.value)} className={inp} placeholder="Venue / meeting point" />
                            </Field>
                            <Field label="Event Date">
                                <input type="date" value={form.eventDate} onChange={(e) => set('eventDate', e.target.value)} className={inp} />
                            </Field>
                        </div>
                        <Field label="Reporting Time">
                            <input type="text" value={form.reportingTime} onChange={(e) => set('reportingTime', e.target.value)} className={inp} placeholder="e.g. 6:00 AM" />
                        </Field>
                        {(form.runClubId || runClubId) && (
                            <Field
                                label="Run Category"
                                hint="Must match a category chip on the parent run club detail page"
                            >
                                <select
                                    value={form.runCategory}
                                    onChange={(e) => set('runCategory', e.target.value)}
                                    className={inp}
                                >
                                    <option value="">Select category...</option>
                                    {parentRunCategories.map((cat) => (
                                        <option key={cat} value={cat}>
                                            {cat}
                                        </option>
                                    ))}
                                </select>
                            </Field>
                        )}
                    </SectionBlock>

                    <SectionBlock title="Registration">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field label="Registration Fee (₹)">
                                <input type="number" min="0" value={form.registrationFee} onChange={(e) => set('registrationFee', e.target.value)} className={inp} />
                            </Field>
                            <Field label="Max Participants" hint="0 = unlimited">
                                <input type="number" min="0" value={form.maxParticipants} onChange={(e) => set('maxParticipants', e.target.value)} className={inp} />
                            </Field>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field label="Participation Type">
                                <select value={form.participationType} onChange={(e) => set('participationType', e.target.value)} className={inp}>
                                    <option value="individual">Individual</option>
                                    <option value="team">Team</option>
                                    <option value="both">Both</option>
                                </select>
                            </Field>
                            <Field label="Skill Level">
                                <select value={form.skillLevel} onChange={(e) => set('skillLevel', e.target.value)} className={inp}>
                                    <option value="all">All Levels</option>
                                    <option value="beginner">Beginner</option>
                                    <option value="intermediate">Intermediate</option>
                                    <option value="advanced">Advanced</option>
                                </select>
                            </Field>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field label="Registration Status">
                                <select
                                    value={form.registration?.status || 'open'}
                                    onChange={(e) => set('registration', { ...form.registration, status: e.target.value })}
                                    className={inp}
                                >
                                    <option value="open">Open</option>
                                    <option value="closed">Closed</option>
                                </select>
                            </Field>
                            <Field label="Registration Type">
                                <select
                                    value={form.registration?.mode || 'internal_form'}
                                    onChange={(e) => set('registration', { ...form.registration, mode: e.target.value })}
                                    className={inp}
                                >
                                    <option value="internal_form">1. Internal app booking (Cashfree when paid)</option>
                                    <option value="external_link">2. External link</option>
                                    <option value="organizer_qr">3. Form + QR / screenshot upload</option>
                                </select>
                            </Field>
                        </div>
                        {(form.registration?.mode || 'internal_form') === 'external_link' && (
                            <Field label="External Link" hint="WhatsApp / website / form link — opens in a new tab">
                                <input type="url" value={form.registrationLink} onChange={(e) => set('registrationLink', e.target.value)} className={inp} placeholder="https://..." />
                            </Field>
                        )}

                        {(form.registration?.mode || 'internal_form') === 'organizer_qr' && (
                            <div className="space-y-4 border-t border-[#0ECCEE]/15 pt-4 mt-1">
                                <p className="text-xs text-gray-500">
                                    Users fill the in-app form, pay the organizer via UPI QR, and upload a payment screenshot.
                                    {Number(form.registrationFee) > 0
                                        ? ' Paid runs stay pending until the run club organizer approves the screenshot.'
                                        : ' Fee is ₹0 — registration confirms instantly (no screenshot required).'}
                                </p>
                                <Field label="Organizer payment QR" hint="Upload UPI / payment QR image">
                                    <div className="flex flex-wrap gap-3 items-center">
                                        {form.registration?.paymentQR ? (
                                            <img src={form.registration.paymentQR} alt="Payment QR" className="h-28 w-28 object-contain rounded-lg border border-gray-700 bg-white p-1" />
                                        ) : null}
                                        <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-600 text-xs cursor-pointer hover:border-[#0ECCEE]">
                                            {uploadingCover ? 'Uploading…' : 'Upload QR'}
                                            <input
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={async (e) => {
                                                    const file = e.target.files?.[0];
                                                    if (!file) return;
                                                    setUploadingCover(true);
                                                    setError('');
                                                    try {
                                                        const fd = new FormData();
                                                        fd.append('image', file);
                                                        fd.append('folder', 'crwdctrl/sports');
                                                        const res = await adminFetch('/admin/upload/image', { method: 'POST', body: fd });
                                                        const data = await res.json().catch(() => ({}));
                                                        if (!res.ok) throw new Error(data.error || data.message || 'Upload failed');
                                                        set('registration', { ...form.registration, paymentQR: data.url || '' });
                                                    } catch (err) {
                                                        setError(err.message || 'QR upload failed');
                                                    } finally {
                                                        setUploadingCover(false);
                                                    }
                                                }}
                                            />
                                        </label>
                                        <input
                                            type="url"
                                            value={form.registration?.paymentQR || ''}
                                            onChange={(e) => set('registration', { ...form.registration, paymentQR: e.target.value })}
                                            className={`${inp} flex-1 min-w-[180px]`}
                                            placeholder="Or paste QR image URL"
                                        />
                                    </div>
                                </Field>
                                <Field label="UPI ID (optional)" hint="Shown with a Copy button on the booking page">
                                    <input
                                        type="text"
                                        value={form.registration?.paymentUpiId || ''}
                                        onChange={(e) => set('registration', { ...form.registration, paymentUpiId: e.target.value })}
                                        className={inp}
                                        placeholder="club@upi"
                                    />
                                </Field>
                                <Field label="Payment instructions" hint="Shown under the QR (amount note, etc.)">
                                    <textarea
                                        rows={2}
                                        value={form.registration?.paymentQRMessage || ''}
                                        onChange={(e) => set('registration', { ...form.registration, paymentQRMessage: e.target.value })}
                                        className={`${inp} resize-none`}
                                        placeholder="Pay the exact amount and upload the screenshot"
                                    />
                                </Field>
                            </div>
                        )}

                        {['internal_form', 'organizer_qr'].includes(form.registration?.mode || 'internal_form') && (
                            <div className="space-y-4 border-t border-[#0ECCEE]/15 pt-4 mt-1">
                                <p className="text-xs text-gray-500">
                                    {(form.registration?.mode || 'internal_form') === 'internal_form' ? (
                                        <>
                                            In-app booking form. Paid runs add a <span className="text-[#0ECCEE] font-semibold">3% platform fee</span> at checkout (secure Cashfree payment), same as treks.
                                        </>
                                    ) : (
                                        <>Form fields for QR / screenshot booking. No Cashfree — payment goes to the organizer.</>
                                    )}
                                    {' '}Runners see the single Event Date / Reporting Time from above — no multi-date picker.
                                </p>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <Field label="Max People per Booking">
                                        <input type="number" min="1" max="50"
                                            value={form.registration?.maxPeoplePerBooking ?? 10}
                                            onChange={(e) => set('registration', { ...form.registration, maxPeoplePerBooking: parseInt(e.target.value) || 10 })}
                                            className={inp} />
                                    </Field>
                                </div>

                                <Field label="Form Instructions" hint="Optional note shown above the booking form.">
                                    <textarea rows={2}
                                        value={form.registration?.formInstructions || ''}
                                        onChange={(e) => set('registration', { ...form.registration, formInstructions: e.target.value })}
                                        className={`${inp} resize-none`} placeholder="e.g. Carry a valid ID on the day of the run." />
                                </Field>

                                <div>
                                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Extra Form Fields</p>
                                    <p className="text-[10px] text-gray-600 mb-2">Default fields: Full Name · Contact No. · E-mail. Add extra below.</p>
                                    <div className="space-y-2">
                                        {(form.registration?.formSchema || []).map((field, idx) => (
                                            <div key={field.id || idx} className="bg-[#1D1E20] rounded-lg p-3 space-y-2">
                                                <div className="grid grid-cols-2 gap-2">
                                                    <input type="text" value={field.label || ''} placeholder="Field label"
                                                        onChange={(e) => {
                                                            const u = [...(form.registration?.formSchema || [])];
                                                            u[idx] = { ...field, label: e.target.value, fieldName: e.target.value.toLowerCase().replace(/\s+/g, '_') };
                                                            set('registration', { ...form.registration, formSchema: u });
                                                        }}
                                                        className="bg-[#111213] border border-gray-600 rounded px-2 py-1.5 text-white text-xs focus:outline-none focus:border-[#0ECCEE]" />
                                                    <div className="flex gap-2">
                                                        <select value={field.type || 'text'}
                                                            onChange={(e) => { const u = [...(form.registration?.formSchema || [])]; u[idx] = { ...field, type: e.target.value }; set('registration', { ...form.registration, formSchema: u }); }}
                                                            className="flex-1 bg-[#111213] border border-gray-600 rounded px-2 py-1.5 text-white text-xs focus:outline-none focus:border-[#0ECCEE]">
                                                            {['text', 'email', 'tel', 'number', 'textarea', 'select', 'file', 'date'].map((t) => <option key={t} value={t}>{t}</option>)}
                                                        </select>
                                                        <button type="button" onClick={() => { const u = (form.registration?.formSchema || []).filter((_, i) => i !== idx); set('registration', { ...form.registration, formSchema: u }); }}
                                                            className="text-red-400 hover:text-red-300 px-2">✕</button>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <input type="text" value={field.placeholder || ''} placeholder="Placeholder"
                                                        onChange={(e) => { const u = [...(form.registration?.formSchema || [])]; u[idx] = { ...field, placeholder: e.target.value }; set('registration', { ...form.registration, formSchema: u }); }}
                                                        className="flex-1 bg-[#111213] border border-gray-600 rounded px-2 py-1.5 text-white text-xs focus:outline-none focus:border-[#0ECCEE]" />
                                                    <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
                                                        <input type="checkbox" checked={field.required || false}
                                                            onChange={(e) => { const u = [...(form.registration?.formSchema || [])]; u[idx] = { ...field, required: e.target.checked }; set('registration', { ...form.registration, formSchema: u }); }}
                                                            className="accent-[#0ECCEE]" />
                                                        <span className="text-xs text-gray-400">Required</span>
                                                    </label>
                                                </div>
                                                {field.type === 'select' && (
                                                    <input type="text" value={(field.options || []).join(', ')} placeholder="Options: A, B, C"
                                                        onChange={(e) => { const u = [...(form.registration?.formSchema || [])]; u[idx] = { ...field, options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) }; set('registration', { ...form.registration, formSchema: u }); }}
                                                        className="w-full bg-[#111213] border border-gray-600 rounded px-2 py-1.5 text-white text-xs focus:outline-none focus:border-[#0ECCEE]" />
                                                )}
                                            </div>
                                        ))}
                                        <button type="button"
                                            onClick={() => { const f = form.registration?.formSchema || []; set('registration', { ...form.registration, formSchema: [...f, { id: `f_${Date.now()}`, label: '', fieldName: '', type: 'text', required: false, options: [], placeholder: '' }] }); }}
                                            className="w-full py-2 border border-dashed border-gray-600 hover:border-[#0ECCEE] rounded-lg text-xs text-gray-500 hover:text-[#0ECCEE] transition-colors">
                                            + Add Extra Field
                                        </button>
                                    </div>
                                </div>

                                <Field label="Google Sheet URL" hint="Optional — booking responses are appended here.">
                                    <input type="url" value={form.registration?.googleSheetsUrl || ''} onChange={(e) => set('registration', { ...form.registration, googleSheetsUrl: e.target.value })} className={inp} placeholder="https://docs.google.com/..." />
                                </Field>
                            </div>
                        )}
                    </SectionBlock>

                    <SectionBlock
                        title="Run Info"
                        hint="Shown in the Run Info widget on the run detail page — Details tab"
                    >
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field label="Return / End Time" hint="Details card">
                                <input type="text" value={form.returnTime} onChange={(e) => set('returnTime', e.target.value)} className={inp} placeholder="e.g. 8:00 AM" />
                            </Field>
                            <Field label="Fitness" hint="Details card">
                                <input type="text" value={form.fitnessLevel} onChange={(e) => set('fitnessLevel', e.target.value)} className={inp} placeholder="e.g. Beginner friendly" />
                            </Field>
                            <Field label="Meeting Point" hint="Details card">
                                <input type="text" value={form.meetingPoint} onChange={(e) => set('meetingPoint', e.target.value)} className={inp} placeholder="e.g. City Park Gate 2" />
                            </Field>
                            <Field label="Age Limit" hint="Details card">
                                <input type="text" value={form.ageLimit} onChange={(e) => set('ageLimit', e.target.value)} className={inp} placeholder="e.g. 16+" />
                            </Field>
                        </div>
                        <Field label="Experience Included" hint="One point per line — expandable checklist inside Run Info">
                            <textarea
                                value={form.inclusions}
                                onChange={(e) => set('inclusions', e.target.value)}
                                rows={4}
                                className={`${inp} resize-none`}
                                placeholder={'Finisher medal\nHydration support\nRoute marshals\nPost-run refreshments'}
                            />
                        </Field>
                        <Field label="Info sections" hint="Repeatable cards (title + details) inside Run Info">
                            <div className="space-y-3">
                                {(form.infoSections || []).map((section, idx) => (
                                    <div key={idx} className="bg-[#1D1E20] rounded-lg p-3 space-y-2 border border-gray-700/60">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-semibold text-gray-400">Section {idx + 1}</span>
                                            <button type="button" onClick={() => removeInfoSection(idx)} className="text-gray-500 hover:text-red-400 text-xs">Remove</button>
                                        </div>
                                        <input type="text" value={section.title} onChange={(e) => updateInfoSection(idx, 'title', e.target.value)} className={inp} placeholder="Title (e.g. About the route)" />
                                        <textarea value={section.details} onChange={(e) => updateInfoSection(idx, 'details', e.target.value)} rows={3} className={`${inp} resize-none`} placeholder="Details..." />
                                    </div>
                                ))}
                                <button type="button" onClick={addInfoSection} className="text-xs text-[#0ECCEE] hover:opacity-80 transition-opacity">+ Add info section</button>
                            </div>
                        </Field>
                    </SectionBlock>

                    <SectionBlock
                        title="Run detail page"
                        hint="Other fields shown on /sports/run/:id"
                    >
                        <Field label="Distance" hint='e.g. "3k-5k Runs"'>
                            <input type="text" value={form.distance} onChange={(e) => set('distance', e.target.value)} className={inp} placeholder="e.g. 3k-5k Runs" />
                        </Field>
                        <Field label="Terms & Conditions" hint="One point per line">
                            <textarea value={form.termsAndConditions} onChange={(e) => set('termsAndConditions', e.target.value)} rows={4} className={`${inp} resize-none`} placeholder="Cancellation policy..." />
                        </Field>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field label="Contact Phone" hint="Overrides run club contact on detail page">
                                <input type="tel" value={form.contactPhone} onChange={(e) => set('contactPhone', e.target.value)} className={inp} placeholder="+91..." />
                            </Field>
                            <Field label="Contact Instagram">
                                <input type="text" value={form.contactInstagram} onChange={(e) => set('contactInstagram', e.target.value)} className={inp} placeholder="@handle" />
                            </Field>
                        </div>
                    </SectionBlock>

                    <SectionBlock title="Event Details">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field label="Dress Code">
                                <input type="text" value={form.dressCode} onChange={(e) => set('dressCode', e.target.value)} className={inp} placeholder="e.g. Sports attire" />
                            </Field>
                            <Field label="Prizes">
                                <input type="text" value={form.prizes} onChange={(e) => set('prizes', e.target.value)} className={inp} placeholder="Prize details" />
                            </Field>
                        </div>
                        <Field label="Route Map (URL)">
                            <input type="url" value={form.routeMap} onChange={(e) => set('routeMap', e.target.value)} className={inp} placeholder="https://..." />
                        </Field>
                        <Field label="Sponsors (comma-separated)">
                            <input type="text" value={form.sponsors} onChange={(e) => set('sponsors', e.target.value)} className={inp} placeholder="Sponsor A, Sponsor B" />
                        </Field>
                    </SectionBlock>

                    <SectionBlock title="Cover images" hint="Cards and detail hero — separate from gallery">
                        <MultiCoverImagesUpload
                            value={form.coverImages}
                            onChange={(coverImages) => {
                                set('coverImages', coverImages);
                                set('coverImage', primaryCoverUrl(coverImages, form.coverImage));
                            }}
                            onError={(msg) => setError(`Cover upload failed: ${msg}`)}
                            onUploadingChange={setUploadingCover}
                            hint="Upload a cropped image per layout for listings and run detail pages."
                        />
                    </SectionBlock>

                    <SectionBlock title="Gallery" hint="Extra photos only — not used as cover or card images">
                        <GalleryImagesUploadField
                            value={form.images}
                            onChange={(images) => set('images', images)}
                            onError={(msg) => setError(`Gallery upload failed: ${msg}`)}
                            onUploadingChange={setUploadingGallery}
                        />
                    </SectionBlock>

                    <p className="text-[11px] text-gray-600 px-1">
                        Upcoming Activities visibility, order &amp; home carousel → <span className="text-gray-500">Home &amp; Sections → Runs</span>
                    </p>

                    <SectionBlock title="Status">
                        <div className="flex flex-wrap gap-4">
                            {['published', 'draft', 'completed', 'cancelled'].map((s) => (
                                <label key={s} className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="status"
                                        value={s}
                                        checked={form.status === s}
                                        onChange={() => set('status', s)}
                                        className="accent-[#0ECCEE]"
                                    />
                                    <span className="text-sm text-gray-300 capitalize">{s}</span>
                                </label>
                            ))}
                        </div>
                    </SectionBlock>

                    <div className="flex gap-3 pt-2 sticky bottom-0 bg-[#111213] pb-1">
                        <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors">
                            Cancel
                        </button>
                        <button type="submit" disabled={saving || uploadingCover || uploadingGallery} className="flex-1 px-4 py-2.5 bg-[#0ECCEE] hover:bg-[#0ECCEE]/80 text-black rounded-lg text-sm font-bold transition-colors disabled:opacity-50">
                            {saving ? 'Saving...' : event ? 'Update Run' : 'Add Run'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
