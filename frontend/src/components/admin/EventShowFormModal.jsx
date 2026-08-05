import { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { adminFetch, adminFetchJSON } from '../../services/api/admin.api.js';
import EventRegistrationFeePicker from './EventRegistrationFeePicker';
import MultiCoverImagesUpload from './MultiCoverImagesUpload';
import CoverImageUploadField from './CoverImageUploadField';
import GalleryImagesUploadField from './GalleryImagesUploadField';
import { sanitizeEventPlatformFeePercent } from '../../utils/trekRegistrationFee';
import { normalizeCoverImages, primaryCoverUrl, EMPTY_COVER_IMAGES } from '../../utils/coverImages';
import {
    createEmptyTier,
    sanitizeEventShowTiers,
    formatInr,
} from '../../utils/eventShowTiers';

const EVENT_TYPE_OPTIONS = [
    { value: 'play', label: 'Play' },
    { value: 'musical', label: 'Musical' },
    { value: 'standup', label: 'Stand-up Comedy' },
    { value: 'improv', label: 'Improv' },
    { value: 'dance_drama', label: 'Dance Drama' },
    { value: 'fashion', label: 'Fashion' },
    { value: 'other', label: 'Other' },
];

const EMPTY = {
    title: '', displayName: '', description: '', eventType: '', eventHeading: '', organizer: '',
    venue: '', mapUrl: '', city: '', ticketPrice: 0, platformFeePercent: 2.5,
    pricingMode: 'single', tiers: [],
    sponsors: '', poster: '', coverImages: EMPTY_COVER_IMAGES(), banner: '', bookingLink: '',
    generalRules: '', process: '', prizePool: '',
    whatsIncluded: '', benefits: '', eligibility: '', slots: '', registrationProcess: '', registrationLink: '',
    rounds: [], contacts: [], galleryImages: [],
    showTimings: [], status: 'published',
    registration: {
        status: 'closed',
        mode: 'external_link',
        formType: 'SINGLE_STEP',
        formSchema: [],
        steps: [],
        googleSheetsUrl: '',
        paymentQR: '',
        paymentQRMessage: '',
        paymentUpiId: '',
        qrAutoConfirm: false,
    },
};

const FIELD_TYPES = [
    { value: 'text', label: 'Text' },
    { value: 'email', label: 'Email' },
    { value: 'tel', label: 'Phone Number' },
    { value: 'number', label: 'Number' },
    { value: 'textarea', label: 'Textarea' },
    { value: 'select', label: 'Select Dropdown' },
    { value: 'radio', label: 'Radio Buttons' },
    { value: 'checkbox', label: 'Checkbox' },
    { value: 'date', label: 'Date' },
    { value: 'file', label: 'File Upload' },
    { value: 'image', label: 'Image Upload' },
];

const newField = () => ({
    id: `f_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    label: '', fieldName: '', type: 'text', required: false, placeholder: '', options: [],
});

export default function EventShowFormModal({ show, onClose, onSaved }) {
    const [form, setForm] = useState(EMPTY);
    const [uploading, setUploading] = useState(false);
    const [uploadingCover, setUploadingCover] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (show) {
            const legacyPoster = (show.poster || '').trim();
            const coverImages = normalizeCoverImages(
                show.coverImages || (legacyPoster ? { portrait: legacyPoster } : {}),
            );
            setForm({
                ...EMPTY,
                ...show,
                coverImages,
                poster: primaryCoverUrl(coverImages, legacyPoster),
                registration: {
                    ...EMPTY.registration,
                    ...(show.registration || {}),
                    formSchema: Array.isArray(show.registration?.formSchema) ? show.registration.formSchema : [],
                    steps: Array.isArray(show.registration?.steps) ? show.registration.steps : [],
                },
                platformFeePercent: show.platformFeePercent ?? 2.5,
                pricingMode: show.pricingMode === 'tiers' ? 'tiers' : 'single',
                tiers: Array.isArray(show.tiers) && show.tiers.length
                    ? sanitizeEventShowTiers(show.tiers)
                    : [],
                sponsors: Array.isArray(show.sponsors) ? show.sponsors.join(', ') : (show.sponsors || ''),
                rounds: Array.isArray(show.rounds) ? show.rounds.map(r => ({ title: r.title || '', content: r.content || '' })) : [],
                contacts: Array.isArray(show.contacts) ? show.contacts.map(c => ({
                    name: c.name || '', role: c.role || '', phone: c.phone || '', email: c.email || '', instagramId: c.instagramId || '',
                })) : [],
                galleryImages: Array.isArray(show.galleryImages) ? show.galleryImages : [],
                showTimings: show.showTimings?.map(t => ({
                    date: t.date ? new Date(t.date).toISOString().slice(0, 10) : '',
                    time: t.time || '',
                })) || [],
            });
        } else {
            setForm(EMPTY);
        }
    }, [show]);

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const addRound = () => set('rounds', [...form.rounds, { title: '', content: '' }]);
    const updateRound = (idx, field, value) => set('rounds', form.rounds.map((r, i) => i === idx ? { ...r, [field]: value } : r));
    const removeRound = (idx) => set('rounds', form.rounds.filter((_, i) => i !== idx));

    const addContact = () => set('contacts', [...form.contacts, { name: '', role: '', phone: '', email: '', instagramId: '' }]);
    const updateContact = (idx, field, value) => set('contacts', form.contacts.map((c, i) => i === idx ? { ...c, [field]: value } : c));
    const removeContact = (idx) => set('contacts', form.contacts.filter((_, i) => i !== idx));

    // ── Registration builder ──
    const reg = form.registration || EMPTY.registration;
    const setReg = (patch) => set('registration', { ...reg, ...patch });

    // single-step field helpers
    const addField = () => setReg({ formSchema: [...reg.formSchema, newField()] });
    const updateField = (idx, key, value) => setReg({
        formSchema: reg.formSchema.map((f, i) => i === idx
            ? { ...f, [key]: key === 'fieldName' ? value.replace(/\s+/g, '_').toLowerCase() : value }
            : f),
    });
    const removeField = (idx) => setReg({ formSchema: reg.formSchema.filter((_, i) => i !== idx) });
    const addFieldOption = (idx) => setReg({ formSchema: reg.formSchema.map((f, i) => i === idx ? { ...f, options: [...(f.options || []), ''] } : f) });
    const updateFieldOption = (idx, oi, value) => setReg({ formSchema: reg.formSchema.map((f, i) => i === idx ? { ...f, options: f.options.map((o, j) => j === oi ? value : o) } : f) });
    const removeFieldOption = (idx, oi) => setReg({ formSchema: reg.formSchema.map((f, i) => i === idx ? { ...f, options: f.options.filter((_, j) => j !== oi) } : f) });

    // multi-step helpers
    const addStep = () => setReg({ steps: [...reg.steps, { stepNumber: reg.steps.length + 1, stepTitle: '', stepDescription: '', fields: [] }] });
    const updateStep = (si, key, value) => setReg({ steps: reg.steps.map((s, i) => i === si ? { ...s, [key]: value } : s) });
    const removeStep = (si) => setReg({ steps: reg.steps.filter((_, i) => i !== si).map((s, i) => ({ ...s, stepNumber: i + 1 })) });
    const addStepField = (si) => setReg({ steps: reg.steps.map((s, i) => i === si ? { ...s, fields: [...s.fields, newField()] } : s) });
    const updateStepField = (si, fi, key, value) => setReg({
        steps: reg.steps.map((s, i) => i === si ? {
            ...s,
            fields: s.fields.map((f, j) => j === fi
                ? { ...f, [key]: key === 'fieldName' ? value.replace(/\s+/g, '_').toLowerCase() : value }
                : f),
        } : s),
    });
    const removeStepField = (si, fi) => setReg({ steps: reg.steps.map((s, i) => i === si ? { ...s, fields: s.fields.filter((_, j) => j !== fi) } : s) });
    const addStepFieldOption = (si, fi) => setReg({ steps: reg.steps.map((s, i) => i === si ? { ...s, fields: s.fields.map((f, j) => j === fi ? { ...f, options: [...(f.options || []), ''] } : f) } : s) });
    const updateStepFieldOption = (si, fi, oi, value) => setReg({ steps: reg.steps.map((s, i) => i === si ? { ...s, fields: s.fields.map((f, j) => j === fi ? { ...f, options: f.options.map((o, k) => k === oi ? value : o) } : f) } : s) });
    const removeStepFieldOption = (si, fi, oi) => setReg({ steps: reg.steps.map((s, i) => i === si ? { ...s, fields: s.fields.map((f, j) => j === fi ? { ...f, options: f.options.filter((_, k) => k !== oi) } : f) } : s) });

    const timing = form.showTimings[0] || { date: '', time: '' };
    const setTiming = (field, value) => set('showTimings', [{ ...timing, [field]: value }]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (!form.title.trim() || !form.eventType) {
            setError('Title and Event Type are required.');
            return;
        }
        if (
            reg.mode === 'organizer_qr'
            && (
                form.pricingMode === 'tiers'
                    ? Math.max(0, ...(form.tiers || []).map((t) => Number(t.fee) || 0)) > 0
                    : Number(form.ticketPrice) > 0
            )
            && !String(reg.paymentQR || '').trim()
        ) {
            setError('Upload a payment QR image for QR mode when fee is greater than 0.');
            return;
        }
        setSaving(true);
        try {
            const slugify = (s) => (s || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
            const cleanField = (f) => {
                const label = (f.label || '').trim();
                const fieldName = (f.fieldName || '').trim() || slugify(label);
                return {
                    id: f.id,
                    label,
                    fieldName,
                    type: f.type || 'text',
                    required: !!f.required,
                    placeholder: (f.placeholder || '').trim(),
                    options: (f.options || []).map(o => (o || '').trim()).filter(Boolean),
                };
            };
            const validField = (f) => !!(f.label?.trim());
            const coverImages = normalizeCoverImages(form.coverImages);
            const pricingMode = form.pricingMode === 'tiers' ? 'tiers' : 'single';
            const tiers = pricingMode === 'tiers' ? sanitizeEventShowTiers(form.tiers) : [];
            if (pricingMode === 'tiers' && tiers.length < 1) {
                setError('Add at least one registration package when using Custom tiers.');
                setSaving(false);
                return;
            }
            const ticketPrice = pricingMode === 'tiers'
                ? (tiers.length ? Math.min(...tiers.map((t) => Number(t.fee) || 0)) : 0)
                : Number(form.ticketPrice) || 0;
            const payload = {
                ...form,
                coverImages,
                poster: primaryCoverUrl(coverImages, form.poster),
                sponsors: form.sponsors ? form.sponsors.split(',').map(s => s.trim()).filter(Boolean) : [],
                pricingMode,
                tiers,
                ticketPrice,
                mapUrl: (form.mapUrl || '').trim(),
                platformFeePercent: sanitizeEventPlatformFeePercent(form.platformFeePercent),
                rounds: form.rounds.filter(r => (r.title || '').trim() || (r.content || '').trim()),
                contacts: form.contacts.filter(c => (c.name || c.phone || c.email || c.instagramId || '').trim()),
                galleryImages: form.galleryImages.filter(Boolean),
                showTimings: form.showTimings.filter(s => s.date || s.time),
                registration: {
                    status: reg.status,
                    mode: reg.mode,
                    formType: reg.formType,
                    googleSheetsUrl: (reg.googleSheetsUrl || '').trim(),
                    paymentQR: (reg.paymentQR || '').trim(),
                    paymentQRMessage: (reg.paymentQRMessage || '').trim(),
                    paymentUpiId: (reg.paymentUpiId || '').trim(),
                    qrAutoConfirm: Boolean(reg.qrAutoConfirm),
                    formSchema: (reg.formSchema || []).filter(validField).map(cleanField),
                    steps: (reg.steps || []).map((s, i) => ({
                        stepNumber: i + 1,
                        stepTitle: (s.stepTitle || '').trim(),
                        stepDescription: (s.stepDescription || '').trim(),
                        fields: (s.fields || []).filter(validField).map(cleanField),
                    })).filter(s => s.fields.length > 0 || s.stepTitle),
                },
            };
            const path = show ? `/admin/events/${show._id}` : '/admin/events';
            const data = await adminFetchJSON(path, {
                method: show ? 'PUT' : 'POST',
                body: JSON.stringify(payload),
            });
            onSaved(data.show);
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const inp = "w-full bg-[#1D1E20] border border-gray-600 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#0ECCEE]";

    const inpField = "px-3 py-2 rounded-lg bg-[#111213] border border-gray-700 focus:border-[#0ECCEE] focus:outline-none text-white text-sm";
    const renderFieldEditor = (field, idx, h) => (
        <div key={field.id || idx} className="bg-[#1D1E20] p-4 rounded-lg space-y-3 border border-gray-700">
            <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-300">Field {idx + 1}</span>
                <button type="button" onClick={() => h.remove(idx)} className="text-red-400 hover:text-red-300"><Trash2 size={16} /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input type="text" placeholder="Field Label" className={inpField} value={field.label || ''} onChange={e => h.update(idx, 'label', e.target.value)} />
                <input type="text" placeholder="Field Name (no spaces)" className={inpField} value={field.fieldName || ''} onChange={e => h.update(idx, 'fieldName', e.target.value)} />
                <select className={inpField} value={field.type || 'text'} onChange={e => h.update(idx, 'type', e.target.value)}>
                    {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <input type="text" placeholder="Placeholder text" className={inpField} value={field.placeholder || ''} onChange={e => h.update(idx, 'placeholder', e.target.value)} />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={field.required || false} onChange={e => h.update(idx, 'required', e.target.checked)} className="w-4 h-4 accent-[#0ECCEE]" />
                <span className="text-sm">Required Field</span>
            </label>
            {['select', 'radio', 'checkbox'].includes(field.type) && (
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <label className="text-sm font-medium">Options</label>
                        <button type="button" onClick={() => h.addOption(idx)} className="px-2 py-1 bg-gray-700 text-white rounded text-xs hover:bg-gray-600 transition-colors">Add Option</button>
                    </div>
                    {(field.options || []).map((opt, oi) => (
                        <div key={oi} className="flex items-center gap-2">
                            <input type="text" placeholder={`Option ${oi + 1}`} className={`${inpField} flex-1`} value={opt || ''} onChange={e => h.updateOption(idx, oi, e.target.value)} />
                            <button type="button" onClick={() => h.removeOption(idx, oi)} className="text-red-400 hover:text-red-300"><Trash2 size={14} /></button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 py-8 px-4">
            <div className="w-full max-w-2xl bg-[#111213] rounded-xl border border-gray-700 shadow-2xl">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
                    <h2 className="text-lg font-bold text-white">{show ? 'Edit Event' : 'Create Event'}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={20} /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {error && <div className="bg-red-900/30 border border-red-700 text-red-300 text-sm rounded-lg px-4 py-3">{error}</div>}

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Title <span className="text-red-400">*</span></label>
                            <input type="text" value={form.title} onChange={e => set('title', e.target.value)} className={inp} placeholder="Show title" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Event Type <span className="text-red-400">*</span></label>
                            <select value={form.eventType} onChange={e => set('eventType', e.target.value)} className={inp}>
                                <option value="">Select...</option>
                                {EVENT_TYPE_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="block text-sm font-medium text-gray-300 mb-1">Display Name</label><input type="text" value={form.displayName} onChange={e => set('displayName', e.target.value)} className={inp} placeholder="Short name shown on the page" /></div>
                        <div><label className="block text-sm font-medium text-gray-300 mb-1">Type / Heading</label><input type="text" value={form.eventHeading} onChange={e => set('eventHeading', e.target.value)} className={inp} placeholder="e.g. Beauty Pageant / Fashion" /></div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Description (About)</label>
                        <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={3} className={`${inp} resize-none`} />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="block text-sm font-medium text-gray-300 mb-1">Organizer</label><input type="text" value={form.organizer} onChange={e => set('organizer', e.target.value)} className={inp} /></div>
                        <div><label className="block text-sm font-medium text-gray-300 mb-1">City</label><input type="text" value={form.city} onChange={e => set('city', e.target.value)} className={inp} /></div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="block text-sm font-medium text-gray-300 mb-1">Venue</label><input type="text" value={form.venue} onChange={e => set('venue', e.target.value)} className={inp} /></div>
                        <div><label className="block text-sm font-medium text-gray-300 mb-1">Booking Link</label><input type="url" value={form.bookingLink} onChange={e => set('bookingLink', e.target.value)} className={inp} placeholder="https://..." /></div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Map link</label>
                        <input
                            type="url"
                            value={form.mapUrl || ''}
                            onChange={e => set('mapUrl', e.target.value)}
                            className={inp}
                            placeholder="https://maps.app.goo.gl/… or https://www.google.com/maps/…"
                        />
                        <p className="mt-1 text-xs text-gray-500">Paste a Google Maps pin / share link for venue directions on the event page.</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="block text-sm font-medium text-gray-300 mb-1">Sponsors (comma-separated)</label><input type="text" value={form.sponsors} onChange={e => set('sponsors', e.target.value)} className={inp} /></div>
                    </div>

                    {/* ── Event detail page content ── */}
                    <div className="pt-2 mt-2 border-t border-gray-700">
                        <h3 className="text-sm font-bold text-[#0ECCEE] mb-3">Event Detail Page Content</h3>
                    </div>

                    <div><label className="block text-sm font-medium text-gray-300 mb-1">General Rules</label><textarea value={form.generalRules} onChange={e => set('generalRules', e.target.value)} rows={3} className={`${inp} resize-none`} placeholder="General rules shown under the 'General Rules' tab" /></div>

                    <div><label className="block text-sm font-medium text-gray-300 mb-1">Process</label><textarea value={form.process} onChange={e => set('process', e.target.value)} rows={3} className={`${inp} resize-none`} placeholder="Process / how it works (shown under the 'Process' tab)" /></div>

                    <div><label className="block text-sm font-medium text-gray-300 mb-1">Prize Pool</label><textarea value={form.prizePool} onChange={e => set('prizePool', e.target.value)} rows={2} className={`${inp} resize-none`} placeholder="Prize pool details (shown under the 'Prize Pool' tab)" /></div>

                    <div><label className="block text-sm font-medium text-gray-300 mb-1">What's Included</label><textarea value={form.whatsIncluded} onChange={e => set('whatsIncluded', e.target.value)} rows={3} className={`${inp} resize-none`} placeholder="One item per line (e.g. Professional Photoshoot)" /></div>

                    <div><label className="block text-sm font-medium text-gray-300 mb-1">Benefits</label><textarea value={form.benefits} onChange={e => set('benefits', e.target.value)} rows={3} className={`${inp} resize-none`} placeholder="One benefit per line" /></div>

                    <div><label className="block text-sm font-medium text-gray-300 mb-1">Eligibility</label><textarea value={form.eligibility} onChange={e => set('eligibility', e.target.value)} rows={2} className={`${inp} resize-none`} placeholder="Who can participate" /></div>

                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="block text-sm font-medium text-gray-300 mb-1">Slots</label><input type="text" value={form.slots} onChange={e => set('slots', e.target.value)} className={inp} placeholder="e.g. Limited" /></div>
                        <div><label className="block text-sm font-medium text-gray-300 mb-1">Registration Process</label><input type="text" value={form.registrationProcess} onChange={e => set('registrationProcess', e.target.value)} className={inp} placeholder="e.g. Send your profile for screening" /></div>
                    </div>

                    {/* ── Registration setup ── */}
                    <div className="pt-2 mt-2 border-t border-gray-700">
                        <h3 className="text-sm font-bold text-[#0ECCEE] mb-3">Registration</h3>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Registration Status</label>
                            <select value={reg.status} onChange={e => setReg({ status: e.target.value })} className={inp}>
                                <option value="closed">Closed</option>
                                <option value="open">Open</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Registration Type</label>
                            <select value={reg.mode} onChange={e => setReg({ mode: e.target.value })} className={inp}>
                                <option value="external_link">External Link</option>
                                <option value="internal_form">Internal Form (Cashfree payment)</option>
                                <option value="organizer_qr">Internal Form + QR / screenshot payment</option>
                            </select>
                        </div>
                    </div>

                    {reg.mode === 'organizer_qr' && (
                        <div className="space-y-4 rounded-lg border border-gray-700 p-4 bg-[#161718]">
                            <p className="text-xs text-gray-400">
                                Users fill the in-app form, pay organizer via QR/UPI, and upload payment screenshot.
                                {(form.pricingMode === 'tiers'
                                    ? Math.max(0, ...(form.tiers || []).map((t) => Number(t.fee) || 0))
                                    : Number(form.ticketPrice)) > 0
                                    ? (reg.qrAutoConfirm
                                        ? ' Paid registrations auto-approve on submit.'
                                        : ' Paid registrations remain pending until organizer approval.')
                                    : ' Free registrations auto-approve (no screenshot needed).'}
                            </p>
                            {(form.pricingMode === 'tiers'
                                ? Math.max(0, ...(form.tiers || []).map((t) => Number(t.fee) || 0))
                                : Number(form.ticketPrice)) > 0 ? (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-1">After screenshot submit</label>
                                        <select
                                            value={reg.qrAutoConfirm ? 'auto' : 'approval'}
                                            onChange={(e) => setReg({ qrAutoConfirm: e.target.value === 'auto' })}
                                            className={inp}
                                        >
                                            <option value="approval">Keep pending for organizer approval</option>
                                            <option value="auto">Auto-approve</option>
                                        </select>
                                    </div>
                                ) : null}
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Organizer payment QR</label>
                                <div className="flex flex-wrap gap-3 items-center">
                                    {reg.paymentQR ? (
                                        <img src={reg.paymentQR} alt="Payment QR" className="h-24 w-24 object-contain rounded-lg border border-gray-700 bg-white p-1" />
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
                                                    fd.append('folder', 'crwdctrl/events');
                                                    const res = await adminFetch('/admin/upload/image', { method: 'POST', body: fd });
                                                    const data = await res.json().catch(() => ({}));
                                                    if (!res.ok) throw new Error(data.error || data.message || 'Upload failed');
                                                    setReg({ paymentQR: data.url || '' });
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
                                        value={reg.paymentQR || ''}
                                        onChange={(e) => setReg({ paymentQR: e.target.value })}
                                        className={`${inp} flex-1 min-w-[180px]`}
                                        placeholder="Or paste QR image URL"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">UPI ID (optional)</label>
                                <input
                                    type="text"
                                    value={reg.paymentUpiId || ''}
                                    onChange={(e) => setReg({ paymentUpiId: e.target.value })}
                                    className={inp}
                                    placeholder="name@upi"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Payment instructions</label>
                                <textarea
                                    rows={2}
                                    value={reg.paymentQRMessage || ''}
                                    onChange={(e) => setReg({ paymentQRMessage: e.target.value })}
                                    className={`${inp} resize-none`}
                                    placeholder="Pay exact amount, then upload screenshot + transaction ID"
                                />
                            </div>
                        </div>
                    )}

                    <div className="pt-1">
                        <label className="block text-sm font-medium text-gray-300 mb-2">Pricing style</label>
                        <p className="text-[11px] text-gray-500 mb-2">Normal = one fee. Custom tiers = packages (Solo / Trio laps, etc.) at checkout.</p>
                        <div className="flex flex-wrap gap-2 mb-3">
                            {[
                                { id: 'single', label: 'Normal (single fee)' },
                                { id: 'tiers', label: 'Custom tiers' },
                            ].map((opt) => (
                                <button
                                    key={opt.id}
                                    type="button"
                                    onClick={() => {
                                        if (opt.id === 'tiers' && !(form.tiers || []).length) {
                                            setForm((f) => ({
                                                ...f,
                                                pricingMode: 'tiers',
                                                tiers: [createEmptyTier(0, 'Solo · 1 Lap')],
                                            }));
                                        } else {
                                            set('pricingMode', opt.id);
                                        }
                                    }}
                                    className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                                        (form.pricingMode || 'single') === opt.id
                                            ? 'border-[#0ECCEE] bg-[#0ECCEE]/15 text-[#0ECCEE]'
                                            : 'border-gray-600 text-gray-400 hover:border-gray-500'
                                    }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>

                        {(form.pricingMode || 'single') === 'tiers' ? (
                            <div className="space-y-3 rounded-xl border border-gray-700 bg-[#1D1E20] p-4 mb-4">
                                <EventRegistrationFeePicker
                                    ticketPrice={0}
                                    hideFeeInput
                                    sampleFee={(() => {
                                        const paid = (form.tiers || []).map((t) => Number(t.fee) || 0).filter((n) => n > 0);
                                        return paid.length ? Math.min(...paid) : 0;
                                    })()}
                                    platformFeePercent={form.platformFeePercent ?? 2.5}
                                    onTicketPriceChange={() => {}}
                                    onPlatformFeePercentChange={(platformFeePercent) => set('platformFeePercent', platformFeePercent)}
                                />
                                <p className="text-[11px] text-gray-500">
                                    Platform fee % applies on top of whichever package the user selects. Package list below.
                                </p>
                                <div className="flex items-center justify-between gap-2 pt-1 border-t border-gray-700">
                                    <p className="text-xs text-gray-500">Packages users pick on Register</p>
                                    <button
                                        type="button"
                                        onClick={() => set('tiers', [...(form.tiers || []), createEmptyTier((form.tiers || []).length)])}
                                        className="text-xs font-semibold text-[#0ECCEE] hover:underline"
                                    >
                                        + Add package
                                    </button>
                                </div>
                                {(form.tiers || []).map((tier, idx) => (
                                    <div key={tier.id || idx} className="rounded-lg border border-gray-700 bg-[#111213] p-3 space-y-2">
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="text-xs font-semibold text-gray-300">Package {idx + 1}</p>
                                            <button
                                                type="button"
                                                onClick={() => set('tiers', (form.tiers || []).filter((_, i) => i !== idx))}
                                                className="text-[10px] text-red-400 hover:underline"
                                            >
                                                Remove
                                            </button>
                                        </div>
                                        <input
                                            type="text"
                                            value={tier.name || ''}
                                            onChange={(e) => {
                                                const next = [...(form.tiers || [])];
                                                next[idx] = { ...next[idx], name: e.target.value };
                                                set('tiers', next);
                                            }}
                                            className={inp}
                                            placeholder="e.g. Solo · 1 Lap"
                                        />
                                        <input
                                            type="text"
                                            value={tier.description || ''}
                                            onChange={(e) => {
                                                const next = [...(form.tiers || [])];
                                                next[idx] = { ...next[idx], description: e.target.value };
                                                set('tiers', next);
                                            }}
                                            className={inp}
                                            placeholder="Group label e.g. Solo Participant Package"
                                        />
                                        <input
                                            type="number"
                                            min="0"
                                            value={tier.fee > 0 ? tier.fee : ''}
                                            onChange={(e) => {
                                                const next = [...(form.tiers || [])];
                                                next[idx] = { ...next[idx], fee: Math.max(0, Number(e.target.value) || 0) };
                                                set('tiers', next);
                                            }}
                                            className={inp}
                                            placeholder="Fee ₹"
                                        />
                                        <textarea
                                            rows={2}
                                            value={Array.isArray(tier.inclusions) ? tier.inclusions.join('\n') : ''}
                                            onChange={(e) => {
                                                const next = [...(form.tiers || [])];
                                                next[idx] = {
                                                    ...next[idx],
                                                    inclusions: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean),
                                                };
                                                set('tiers', next);
                                            }}
                                            className={`${inp} resize-none`}
                                            placeholder="Inclusions (one per line)"
                                        />
                                        <p className="text-[11px] text-gray-500">
                                            Checkout: {formatInr(tier.fee || 0)} + {form.platformFeePercent ?? 2.5}% platform fee
                                        </p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <EventRegistrationFeePicker
                                ticketPrice={form.ticketPrice}
                                platformFeePercent={form.platformFeePercent ?? 2.5}
                                onTicketPriceChange={(ticketPrice) => set('ticketPrice', ticketPrice)}
                                onPlatformFeePercentChange={(platformFeePercent) => set('platformFeePercent', platformFeePercent)}
                            />
                        )}
                    </div>

                    {reg.mode === 'external_link' && (
                        <div><label className="block text-sm font-medium text-gray-300 mb-1">Registration Link</label><input type="url" value={form.registrationLink} onChange={e => set('registrationLink', e.target.value)} className={inp} placeholder="https://forms.gle/..." /></div>
                    )}

                    {['internal_form', 'organizer_qr'].includes(reg.mode) && (
                        <div className="space-y-5 rounded-lg border border-gray-700 p-4 bg-[#161718]">
                            <p className="text-xs text-gray-400">
                                The &quot;Register Now&quot; button opens an in-app form.
                                {reg.mode === 'organizer_qr'
                                    ? ' Users pay via organizer QR and upload proof.'
                                    : ' Uses Cashfree for paid registrations.'}
                            </p>

                            {/* Google Sheet auto-export */}
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Organiser Google Sheet URL</label>
                                <input
                                    type="url"
                                    value={reg.googleSheetsUrl || ''}
                                    onChange={e => setReg({ googleSheetsUrl: e.target.value })}
                                    className={inp}
                                    placeholder="https://docs.google.com/spreadsheets/d/..."
                                />
                                <p className="mt-1 text-xs text-gray-500">
                                    Every registration (including Payment ID) is auto-saved here after payment. Share the sheet with the service account as Editor.
                                </p>
                            </div>

                            {/* Form Type Selection */}
                            <div>
                                <label className="block text-sm font-medium mb-3">Form Type</label>
                                <div className="flex gap-4">
                                    <label className="flex items-center space-x-2 cursor-pointer">
                                        <input type="radio" name="eventFormType" value="SINGLE_STEP" checked={reg.formType === 'SINGLE_STEP'} onChange={e => setReg({ formType: e.target.value })} className="w-4 h-4 accent-[#0ECCEE]" />
                                        <span className="text-sm">Single Step Form</span>
                                    </label>
                                    <label className="flex items-center space-x-2 cursor-pointer">
                                        <input type="radio" name="eventFormType" value="MULTI_STEP" checked={reg.formType === 'MULTI_STEP'} onChange={e => setReg({ formType: e.target.value })} className="w-4 h-4 accent-[#0ECCEE]" />
                                        <span className="text-sm">Multi-Step Form</span>
                                    </label>
                                </div>
                                <p className="text-xs text-gray-400 mt-2">
                                    {reg.formType === 'SINGLE_STEP'
                                        ? 'All form fields will be displayed on a single page'
                                        : 'Form will be split into multiple steps for better user experience'}
                                </p>
                            </div>

                            {/* Single Step Form Fields */}
                            {reg.formType === 'SINGLE_STEP' && (
                                <div>
                                    <label className="block text-sm font-medium mb-2">Registration Form Fields</label>
                                    <div className="bg-[#111213] rounded-lg p-4 border border-gray-700">
                                        <div className="flex items-center justify-between mb-4">
                                            <p className="text-sm text-gray-400">Configure the fields that users will fill during registration</p>
                                            <button type="button" onClick={addField} className="px-3 py-1 bg-[#0ECCEE] text-black rounded-lg text-sm font-medium hover:bg-[#0ECCEE]/80 transition-colors flex items-center gap-2">
                                                <Plus size={16} /> Add Field
                                            </button>
                                        </div>
                                        <div className="space-y-3">
                                            {reg.formSchema.map((f, idx) => renderFieldEditor(f, idx, {
                                                update: updateField, remove: removeField, addOption: addFieldOption, updateOption: updateFieldOption, removeOption: removeFieldOption,
                                            }))}
                                            {reg.formSchema.length === 0 && (
                                                <div className="text-center py-6 text-gray-400">
                                                    <p>No form fields added yet. Click "Add Field" to create your registration form.</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Multi-Step Form Configuration */}
                            {reg.formType === 'MULTI_STEP' && (
                                <div>
                                    <div className="flex items-center justify-between mb-4">
                                        <label className="block text-sm font-medium">Multi-Step Form Configuration</label>
                                        <button type="button" onClick={addStep} className="px-3 py-1 bg-[#0ECCEE] text-black rounded-lg text-sm font-medium hover:bg-[#0ECCEE]/80 transition-colors flex items-center gap-2">
                                            <Plus size={16} /> Add Step
                                        </button>
                                    </div>
                                    <div className="bg-[#111213] rounded-lg p-4 border border-gray-700">
                                        <div className="space-y-4">
                                            {reg.steps.map((s, si) => (
                                                <div key={si} className="bg-[#1D1E20] p-4 rounded-lg border border-gray-700">
                                                    <div className="flex items-center justify-between mb-4">
                                                        <div className="flex items-center gap-3 flex-1">
                                                            <div className="w-8 h-8 bg-[#0ECCEE] text-black rounded-full flex items-center justify-center text-sm font-bold shrink-0">{si + 1}</div>
                                                            <input type="text" placeholder="Step Title" className="text-lg font-medium bg-transparent border-none focus:outline-none focus:ring-0 text-white placeholder-gray-400 p-0 flex-1" value={s.stepTitle || ''} onChange={e => updateStep(si, 'stepTitle', e.target.value)} />
                                                        </div>
                                                        <button type="button" onClick={() => removeStep(si)} className="text-red-400 hover:text-red-300" title="Delete Step"><Trash2 size={18} /></button>
                                                    </div>
                                                    <div className="mb-4">
                                                        <input type="text" placeholder="Step description (optional)" className="w-full px-3 py-2 rounded-lg bg-[#111213] border border-gray-700 focus:border-[#0ECCEE] focus:outline-none text-sm" value={s.stepDescription || ''} onChange={e => updateStep(si, 'stepDescription', e.target.value)} />
                                                    </div>
                                                    <div className="space-y-3">
                                                        <div className="flex items-center justify-between">
                                                            <h6 className="text-sm font-medium text-gray-300">Fields in this step</h6>
                                                            <button type="button" onClick={() => addStepField(si)} className="px-2 py-1 bg-gray-700 text-white rounded text-xs hover:bg-gray-600 transition-colors flex items-center gap-1">
                                                                <Plus size={12} /> Add Field
                                                            </button>
                                                        </div>
                                                        {(s.fields || []).map((f, fi) => renderFieldEditor(f, fi, {
                                                            update: (i, k, v) => updateStepField(si, i, k, v),
                                                            remove: (i) => removeStepField(si, i),
                                                            addOption: (i) => addStepFieldOption(si, i),
                                                            updateOption: (i, oi, v) => updateStepFieldOption(si, i, oi, v),
                                                            removeOption: (i, oi) => removeStepFieldOption(si, i, oi),
                                                        }))}
                                                        {(s.fields || []).length === 0 && (
                                                            <div className="text-center py-4 text-gray-500 bg-[#111213] rounded-lg">
                                                                <p className="text-sm">No fields in this step. Click "Add Field" to add form fields.</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                            {reg.steps.length === 0 && (
                                                <div className="text-center py-6 text-gray-400">
                                                    <p>No steps created yet. Click "Add Step" to create your multi-step form.</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Rounds */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-sm font-medium text-gray-300">Rounds</label>
                            <button type="button" onClick={addRound} className="flex items-center gap-1 text-xs text-[#0ECCEE] hover:opacity-80 transition-opacity">
                                <Plus size={12} /> Add Round
                            </button>
                        </div>
                        {form.rounds.map((r, idx) => (
                            <div key={idx} className="mb-3 p-3 rounded-lg border border-gray-700 bg-[#161718] space-y-2">
                                <div className="flex items-center gap-3">
                                    <input type="text" value={r.title} onChange={e => updateRound(idx, 'title', e.target.value)} className={`${inp} flex-1`} placeholder={`Round ${idx + 1} title (e.g. Elimination Round)`} />
                                    <button type="button" onClick={() => removeRound(idx)} className="text-gray-500 hover:text-red-400 shrink-0"><Trash2 size={14} /></button>
                                </div>
                                <textarea value={r.content} onChange={e => updateRound(idx, 'content', e.target.value)} rows={3} className={`${inp} resize-none`} placeholder="Round rules / details" />
                            </div>
                        ))}
                    </div>

                    {/* Contacts */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-sm font-medium text-gray-300">Contact Details</label>
                            <button type="button" onClick={addContact} className="flex items-center gap-1 text-xs text-[#0ECCEE] hover:opacity-80 transition-opacity">
                                <Plus size={12} /> Add Contact
                            </button>
                        </div>
                        {form.contacts.map((c, idx) => (
                            <div key={idx} className="mb-3 p-3 rounded-lg border border-gray-700 bg-[#161718] space-y-2">
                                <div className="flex items-center gap-3">
                                    <input type="text" value={c.name} onChange={e => updateContact(idx, 'name', e.target.value)} className={`${inp} flex-1`} placeholder="Name" />
                                    <input type="text" value={c.role} onChange={e => updateContact(idx, 'role', e.target.value)} className={`${inp} flex-1`} placeholder="Role (optional)" />
                                    <button type="button" onClick={() => removeContact(idx)} className="text-gray-500 hover:text-red-400 shrink-0"><Trash2 size={14} /></button>
                                </div>
                                <div className="grid grid-cols-3 gap-3">
                                    <input type="text" value={c.phone} onChange={e => updateContact(idx, 'phone', e.target.value)} className={inp} placeholder="Phone" />
                                    <input type="email" value={c.email} onChange={e => updateContact(idx, 'email', e.target.value)} className={inp} placeholder="Email" />
                                    <input type="text" value={c.instagramId} onChange={e => updateContact(idx, 'instagramId', e.target.value)} className={inp} placeholder="@instagram" />
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Cover images — crop per card layout (same as treks) */}
                    <div className="rounded-xl border border-gray-700/60 p-4 space-y-4">
                        <div>
                            <p className="text-sm font-medium text-gray-200">Cover images</p>
                            <p className="text-xs text-gray-500 mt-0.5">Use Adjust on “Event page top image” to frame the upper section on the event detail page.</p>
                        </div>
                        <MultiCoverImagesUpload
                            value={form.coverImages}
                            onChange={(coverImages) => {
                                set('coverImages', coverImages);
                                set('poster', primaryCoverUrl(coverImages, form.poster));
                            }}
                            onError={(msg) => setError(`Cover upload failed: ${msg}`)}
                            onUploadingChange={setUploadingCover}
                            hint="Upload a cropped image per layout where this event appears."
                        />
                    </div>

                    {/* Gallery */}
                    <GalleryImagesUploadField
                        value={form.galleryImages}
                        onChange={(galleryImages) => set('galleryImages', galleryImages)}
                        onError={(msg) => setError(`Gallery upload failed: ${msg}`)}
                        onUploadingChange={setUploading}
                        uploadLabel="Upload gallery images"
                    />

                    {/* Event Date & Time */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Event Date</label>
                            <input type="date" value={timing.date} onChange={e => setTiming('date', e.target.value)} className={inp} style={{ colorScheme: 'dark' }} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Event Time</label>
                            <input type="text" value={timing.time} onChange={e => setTiming('time', e.target.value)} className={inp} placeholder="e.g. 7:00 PM" />
                        </div>
                    </div>

                    {/* Detail page banner */}
                    <CoverImageUploadField
                        label="Detail page banner"
                        hint="Use the Original tab for a full-width banner, or Hero for a cropped banner strip."
                        value={form.banner}
                        onChange={(banner) => set('banner', banner)}
                        onError={(msg) => setError(`Banner upload failed: ${msg}`)}
                        onUploadingChange={setUploading}
                        uploadLabel="Upload banner"
                        replaceLabel="Replace banner"
                    />

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Status</label>
                        <div className="flex gap-4">
                            {['published', 'draft'].map(s => (
                                <label key={s} className="flex items-center gap-2 cursor-pointer">
                                    <input type="radio" name="status" value={s} checked={form.status === s} onChange={() => set('status', s)} className="accent-[#0ECCEE]" />
                                    <span className="text-sm text-gray-300 capitalize">{s}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors">Cancel</button>
                        <button type="submit" disabled={saving || uploading || uploadingCover} className="flex-1 px-4 py-2.5 bg-[#0ECCEE] hover:bg-[#0ECCEE]/80 text-black rounded-lg text-sm font-bold transition-colors disabled:opacity-50">
                            {saving ? 'Saving...' : show ? 'Update' : 'Create'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
