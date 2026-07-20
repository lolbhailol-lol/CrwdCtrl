import { useState, useEffect } from 'react';
import { X, Upload, Plus, Trash2 } from 'lucide-react';
import MultiCoverImagesUpload from './MultiCoverImagesUpload';
import GalleryImagesUploadField from './GalleryImagesUploadField';
import CroppedMultiImagesUpload from './CroppedMultiImagesUpload';
import { normalizeCoverImages, primaryCoverUrl, EMPTY_COVER_IMAGES } from '../../utils/coverImages';
import { seedTrekHeroImagesForForm, seedTrekGalleryForForm } from '../../utils/trekImages';
import { normalizeImageList } from '../../utils/uploadUrls';
import {
    TREK_FILTER_SECTIONS,
    emptyTrekFilters,
    getBudgetTier,
    DIFFICULTY_LEVEL_FILTER_OPTIONS,
} from '../../constants/trekFilters';
import { adminFetch, adminFetchJSON } from '../../services/api/admin.api.js';
import { normalizeTrekBatches, EMPTY_BATCH } from '../../utils/trekDateDisplay';
import { normalizeDetailBoxes } from '../../utils/trekDetailBoxes';
import { normalizeItineraryForForm, serializeItineraryForSave, EMPTY_MAIN_POINT, EMPTY_SUB_POINT, parsePastedSchedulePoints } from '../../utils/trekItinerary';
import { ScheduleMainMarker, ScheduleSubMarker } from '../SchedulePointMarkers';
import TrekDetailBoxesEditor from './TrekDetailBoxesEditor';
import TrekRegistrationFeePicker from './TrekRegistrationFeePicker';
import { sanitizeTrekRegistrationFee, sanitizeTrekPlatformFeePercent } from '../../utils/trekRegistrationFee';
import {
    TREK_FORM_FIELD_TYPES,
    TREK_FORM_OPTION_FIELD_TYPES,
    createEmptyTrekFormField,
    createAgreeTrekFormField,
} from '../../constants/trekFormFields';

const CARD_LABEL_SUGGESTIONS = ['Weekend', 'Weekday', '11 - 12 July', 'Every Saturday', 'Coming soon'];

const CATEGORY_VALUE_MAP = {
    Camping: 'camping',
    'Trail Walks': 'trail',
    Hiking: 'hiking',
    Backpacking: 'backpacking',
    Adventure: 'adventure',
    Nature: 'nature',
};

const CATEGORY_VALUES = new Set(['hiking', 'trail', 'backpacking', 'camping', 'adventure', 'nature']);

const normalizeCategory = (label) => {
    if (!label) return null;
    if (CATEGORY_VALUE_MAP[label]) return CATEGORY_VALUE_MAP[label];
    const lower = String(label).toLowerCase();
    return CATEGORY_VALUES.has(lower) ? lower : null;
};

const EMPTY = {
    communityId: null,
    trekName: '', description: '', difficultyLevel: '', trekDuration: '',
    startingPoint: '', destination: '', meetingLocation: '', departureTime: '',
    returnTime: '', fitnessRequirements: '', ageRestrictions: '', trekLeader: '',
    emergencyContact: '', contactInstagram: '', groupLink: '', contacts: [], registrationFee: 0, platformFeePercent: 3, registrationLink: '', maxParticipants: 0,
    trekDate: '', dateLabel: '', trekBatches: [], detailBoxes: [], city: '', trekCategory: '', status: 'published',
    registration: {
        status: 'open', mode: 'internal_form', googleSheetsUrl: '', organizerEmail: '', formInstructions: '',
        availableDates: [], timeSlots: [], locationOptions: [], maxPeoplePerBooking: 10, formSchema: [],
        genderQuotas: { enabled: false, femaleSeats: 0, maleSeats: 0, othersSeats: 0 },
        genderPhase: 'all',
    },
    inclusions: '', exclusions: '', thingsToCarry: '', termsAndConditions: '',
    itinerary: [],
    coverImage: '',
    coverImages: EMPTY_COVER_IMAGES(),
    heroImages: [],
    images: [],
    trekFilters: emptyTrekFilters(),
};

function TrekFilterTagsEditor({ trekFilters, difficultyLevel, registrationFee, onChange }) {
    const toggleTag = (sectionId, option) => {
        const current = trekFilters[sectionId] || [];
        const next = current.includes(option)
            ? current.filter((v) => v !== option)
            : [...current, option];
        onChange({ ...trekFilters, [sectionId]: next });
    };

    const budgetTier = getBudgetTier(registrationFee);

    return (
        <div className="border border-[#0ECCEE]/20 rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-[#0ECCEE]/5 border-b border-[#0ECCEE]/15">
                <p className="text-sm font-bold text-[#0ECCEE]">User Filter Tags</p>
                <p className="text-[10px] text-gray-500 mt-0.5">
                    These appear when users filter treks on the Trek Category page.
                </p>
            </div>

            <div className="p-4 space-y-4">
                <div className="rounded-lg bg-[#1D1E20] border border-gray-700 px-3 py-2">
                    <p className="text-xs font-semibold text-gray-300">Difficulty level (auto)</p>
                    <p className="text-[11px] text-gray-500 mt-1">
                        Easy / Moderate / Difficult / Extreme filters use the Difficulty Level field above
                        {difficultyLevel ? `: ${difficultyLevel}` : '.'}
                    </p>
                </div>

                <div className="rounded-lg bg-[#1D1E20] border border-gray-700 px-3 py-2">
                    <p className="text-xs font-semibold text-gray-300">Budget tier (auto)</p>
                    <p className="text-[11px] text-gray-500 mt-1">
                        Based on Registration Fee:{' '}
                        <span className="text-[#0ECCEE] font-medium">{budgetTier}</span>
                    </p>
                </div>

                {TREK_FILTER_SECTIONS.filter((section) => !section.adminAuto).map((section) => (
                    <div key={section.id}>
                        <p className="text-xs font-semibold text-gray-300 mb-1">{section.label}</p>
                        {section.adminNote && (
                            <p className="text-[10px] text-gray-600 mb-2">{section.adminNote}</p>
                        )}
                        <div className="flex flex-wrap gap-2">
                            {section.options.map((option) => {
                                const checked = (trekFilters[section.id] || []).includes(option);
                                return (
                                    <button
                                        key={option}
                                        type="button"
                                        onClick={() => toggleTag(section.id, option)}
                                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                                            checked
                                                ? 'bg-[#0ECCEE]/20 border-[#0ECCEE] text-[#0ECCEE]'
                                                : 'bg-[#1D1E20] border-gray-600 text-gray-400 hover:border-gray-500'
                                        }`}
                                    >
                                        {option}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                ))}

                <p className="text-[10px] text-gray-600">
                    Difficulty filters shown to users: {DIFFICULTY_LEVEL_FILTER_OPTIONS.join(', ')} plus any tags selected above.
                </p>
            </div>
        </div>
    );
}

/* Reusable chip-list editor for dates / time slots / locations */
function RegListEditor({ label, hint, items, placeholder, onChange }) {
    const [draft, setDraft] = useState('');
    const add = () => { const v = draft.trim(); if (v && !items.includes(v)) { onChange([...items, v]); setDraft(''); } };
    return (
        <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">{label}</label>
            {hint && <p className="text-[10px] text-gray-600 mb-1.5">{hint}</p>}
            {items.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                    {items.map((item, i) => (
                        <span key={i} className="flex items-center gap-1 bg-[#1D1E20] border border-gray-600 text-gray-300 text-xs rounded-lg px-2 py-1">
                            {item}
                            <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} className="text-gray-500 hover:text-red-400 ml-0.5">×</button>
                        </span>
                    ))}
                </div>
            )}
            <div className="flex gap-2">
                <input value={draft} onChange={e => setDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
                    placeholder={placeholder}
                    className={`flex-1 bg-[#1D1E20] border border-gray-600 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-[#0ECCEE]`} />
                <button type="button" onClick={add}
                    className="px-3 py-1.5 bg-[#0ECCEE]/10 border border-[#0ECCEE]/30 text-[#0ECCEE] rounded-lg text-xs font-semibold hover:bg-[#0ECCEE]/20 transition-colors">
                    + Add
                </button>
            </div>
        </div>
    );
}

function TrekBatchesEditor({ batches, onChange }) {
    const list = batches?.length ? batches : [];
    const update = (idx, field, value) => {
        onChange(list.map((b, i) => (i === idx ? { ...b, [field]: value } : b)));
    };
    const add = () => onChange([...list, EMPTY_BATCH()]);
    const remove = (idx) => onChange(list.filter((_, i) => i !== idx));

    return (
        <div className="space-y-3">
            {list.length === 0 ? (
                <p className="text-xs text-gray-600 rounded-lg border border-dashed border-gray-300 px-3 py-2.5 bg-gray-50">
                    No batches yet. Add departure dates with group size for the trek Details tab.
                </p>
            ) : (
                list.map((batch, idx) => (
                    <div key={idx} className="rounded-lg border border-gray-300 bg-gray-50 p-3 space-y-2.5">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-gray-700">Batch {idx + 1}</span>
                            <button type="button" onClick={() => remove(idx)} className="text-gray-500 hover:text-red-500">
                                <Trash2 size={14} />
                            </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <div>
                                <label className="block text-[11px] font-medium text-gray-600 mb-1">Date / range</label>
                                <input
                                    type="text"
                                    value={batch.date || ''}
                                    onChange={(e) => update(idx, 'date', e.target.value)}
                                    className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-900 text-sm focus:outline-none focus:border-[#0ECCEE]"
                                    placeholder="e.g. 11 - 12 July"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-medium text-gray-600 mb-1">Batch size</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={batch.batchSize || ''}
                                    onChange={(e) => update(idx, 'batchSize', e.target.value)}
                                    className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-900 text-sm focus:outline-none focus:border-[#0ECCEE]"
                                    placeholder="e.g. 15"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-medium text-gray-600 mb-1">Timing</label>
                                <input
                                    type="text"
                                    value={batch.timing || ''}
                                    onChange={(e) => update(idx, 'timing', e.target.value)}
                                    className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-900 text-sm focus:outline-none focus:border-[#0ECCEE]"
                                    placeholder="e.g. 5:00 AM"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-medium text-gray-600 mb-1">Note</label>
                                <input
                                    type="text"
                                    value={batch.note || ''}
                                    onChange={(e) => update(idx, 'note', e.target.value)}
                                    className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-900 text-sm focus:outline-none focus:border-[#0ECCEE]"
                                    placeholder="e.g. Last 3 spots"
                                />
                            </div>
                        </div>
                    </div>
                ))
            )}
            <button
                type="button"
                onClick={add}
                className="flex items-center gap-1 text-xs font-semibold text-[#0ECCEE] hover:underline"
            >
                <Plus size={13} /> Add batch
            </button>
        </div>
    );
}

function FormSection({ step, title, subtitle, optional = false, children }) {
    return (
        <div className="rounded-xl border border-gray-700/60 overflow-hidden">
            <div className="px-4 py-3 bg-[#1D1E20] border-b border-gray-700/60 flex items-start justify-between gap-2">
                <div>
                    <p className="text-sm font-semibold text-white">
                        <span className="text-[#0ECCEE] mr-1.5">{step}.</span>
                        {title}
                    </p>
                    {subtitle ? <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{subtitle}</p> : null}
                </div>
                {optional ? (
                    <span className="text-[10px] font-medium text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full shrink-0">Optional</span>
                ) : null}
            </div>
            <div className="p-4 space-y-4">{children}</div>
        </div>
    );
}

export default function TrekFormModal({ trek, communityId, communityCategories, onClose, onSaved }) {
    const [form, setForm] = useState(EMPTY);
    const [uploading, setUploading] = useState(false);
    const [uploadingCover, setUploadingCover] = useState(false);
    const [uploadingHero, setUploadingHero] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [pasteByDay, setPasteByDay] = useState({});

    const categoryOptions = (communityCategories || [])
        .map(label => ({ label, value: normalizeCategory(label) }))
        .filter(option => option.value);
    const hasCategoryOptions = categoryOptions.length > 0;

    useEffect(() => {
        if (trek) {
            const coverImages = normalizeCoverImages(trek.coverImages);
            const legacyCover = trek.coverImage || '';
            if (!coverImages.portrait && legacyCover) coverImages.portrait = legacyCover;
            setForm({
                ...EMPTY,
                ...trek,
                communityId: (() => {
                    const raw = trek.communityId ?? communityId ?? null;
                    if (raw && typeof raw === 'object') return raw._id || raw.id || null;
                    return raw || null;
                })(),
                trekDate: trek.trekDate ? new Date(trek.trekDate).toISOString().slice(0, 10) : '',
                dateLabel: trek.dateLabel || '',
                trekBatches: normalizeTrekBatches(trek.trekBatches, trek.trekDate),
                detailBoxes: normalizeDetailBoxes(trek.detailBoxes, trek),
                inclusions: Array.isArray(trek.inclusions) ? trek.inclusions.join('\n') : (trek.inclusions || ''),
                exclusions: Array.isArray(trek.exclusions) ? trek.exclusions.join('\n') : (trek.exclusions || ''),
                thingsToCarry: Array.isArray(trek.thingsToCarry) ? trek.thingsToCarry.join('\n') : (trek.thingsToCarry || ''),
                termsAndConditions: Array.isArray(trek.termsAndConditions) ? trek.termsAndConditions.join('\n') : (trek.termsAndConditions || ''),
                itinerary: normalizeItineraryForForm(trek.itinerary || []),
                contacts: Array.isArray(trek.contacts) ? trek.contacts.map(c => ({ name: c?.name || '', role: c?.role || '', phone: c?.phone || '' })) : [],
                coverImage: legacyCover || primaryCoverUrl(coverImages),
                coverImages,
                heroImages: seedTrekHeroImagesForForm(trek),
                images: seedTrekGalleryForForm(trek),
                trekFilters: {
                    ...emptyTrekFilters(),
                    ...(trek.trekFilters || {}),
                },
                platformFeePercent: trek.platformFeePercent ?? 3,
                registration: {
                    ...EMPTY.registration,
                    ...(trek.registration || {}),
                    genderQuotas: {
                        ...EMPTY.registration.genderQuotas,
                        ...(trek.registration?.genderQuotas || {}),
                    },
                    formSchema: Array.isArray(trek.registration?.formSchema) ? trek.registration.formSchema : [],
                },
            });
        } else {
            setForm({ ...EMPTY, communityId: communityId || null });
        }
    }, [trek, communityId]);

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const addContact = () => setForm(f => ({ ...f, contacts: [...(f.contacts || []), { name: '', role: '', phone: '' }] }));
    const updateContact = (idx, field, value) => setForm(f => ({ ...f, contacts: (f.contacts || []).map((c, i) => (i === idx ? { ...c, [field]: value } : c)) }));
    const removeContact = (idx) => setForm(f => ({ ...f, contacts: (f.contacts || []).filter((_, i) => i !== idx) }));

    const updateFormSchemaField = (idx, patch) => {
        set('registration', {
            ...form.registration,
            formSchema: (form.registration?.formSchema || []).map((f, i) => (i === idx ? { ...f, ...patch } : f)),
        });
    };

    const addFormFieldOption = (fieldIdx) => {
        const schema = form.registration?.formSchema || [];
        updateFormSchemaField(fieldIdx, { options: [...(schema[fieldIdx]?.options || []), ''] });
    };

    const updateFormFieldOption = (fieldIdx, optionIdx, value) => {
        const options = [...(form.registration?.formSchema?.[fieldIdx]?.options || [])];
        options[optionIdx] = value;
        updateFormSchemaField(fieldIdx, { options });
    };

    const removeFormFieldOption = (fieldIdx, optionIdx) => {
        const options = (form.registration?.formSchema?.[fieldIdx]?.options || []).filter((_, i) => i !== optionIdx);
        updateFormSchemaField(fieldIdx, { options });
    };

    const addItineraryDay = () => {
        // Do not run normalizeItinerary here — it strips empty in-progress points/days.
        setForm((f) => {
            const next = Array.isArray(f.itinerary) ? f.itinerary : [];
            return {
                ...f,
                itinerary: [
                    ...next,
                    {
                        day: next.length + 1,
                        title: '',
                        description: '',
                        points: [{ ...EMPTY_MAIN_POINT }],
                    },
                ],
            };
        });
    };

    const updateItinerary = (idx, field, value) => {
        setForm((f) => ({
            ...f,
            itinerary: (f.itinerary || []).map((d, i) => (i === idx ? { ...d, [field]: value } : d)),
        }));
    };

    const addItineraryPoint = (dayIdx, level = 'main') => {
        const point = level === 'sub' ? { ...EMPTY_SUB_POINT } : { ...EMPTY_MAIN_POINT };
        setForm((f) => ({
            ...f,
            itinerary: (f.itinerary || []).map((d, i) => {
                if (i !== dayIdx) return d;
                return { ...d, points: [...(d.points || []), point] };
            }),
        }));
    };

    const applyPastedPoints = (dayIdx) => {
        const raw = pasteByDay[dayIdx] || '';
        const parsed = parsePastedSchedulePoints(raw);
        if (!parsed.length) return;
        setForm((f) => ({
            ...f,
            itinerary: (f.itinerary || []).map((d, i) => {
                if (i !== dayIdx) return d;
                const existing = (d.points || []).filter((p) => String(p.text || '').trim());
                return { ...d, points: [...existing, ...parsed] };
            }),
        }));
        setPasteByDay((prev) => ({ ...prev, [dayIdx]: '' }));
    };

    const replaceWithPastedPoints = (dayIdx) => {
        const raw = pasteByDay[dayIdx] || '';
        const parsed = parsePastedSchedulePoints(raw);
        if (!parsed.length) return;
        setForm((f) => ({
            ...f,
            itinerary: (f.itinerary || []).map((d, i) => (i === dayIdx ? { ...d, points: parsed } : d)),
        }));
        setPasteByDay((prev) => ({ ...prev, [dayIdx]: '' }));
    };

    const updateItineraryPoint = (dayIdx, pointIdx, field, value) => {
        setForm((f) => ({
            ...f,
            itinerary: (f.itinerary || []).map((d, i) => {
                if (i !== dayIdx) return d;
                const points = (d.points || []).map((p, j) => (j === pointIdx ? { ...p, [field]: value } : p));
                return { ...d, points };
            }),
        }));
    };

    const removeItineraryPoint = (dayIdx, pointIdx) => {
        setForm((f) => ({
            ...f,
            itinerary: (f.itinerary || []).map((d, i) => {
                if (i !== dayIdx) return d;
                return { ...d, points: (d.points || []).filter((_, j) => j !== pointIdx) };
            }),
        }));
    };

    const removeItineraryDay = (idx) => {
        setForm((f) => ({
            ...f,
            itinerary: (f.itinerary || []).filter((_, i) => i !== idx),
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (!form.trekName.trim() || !form.difficultyLevel) {
            setError('Trek name and difficulty level are required.');
            return;
        }
        if (uploadingCover || uploading || uploadingHero) {
            setError('Please wait for image upload to finish.');
            return;
        }
        setSaving(true);
        try {
            const coverImages = normalizeCoverImages(form.coverImages);
            const payload = {
                ...form,
                communityId: form.communityId || null,
                trekCategory: form.trekCategory || null,
                coverImages,
                coverImage: primaryCoverUrl(coverImages, form.coverImage) || null,
                heroImages: normalizeImageList(form.heroImages).slice(0, 5),
                images: normalizeImageList(form.images),
                inclusions: form.inclusions ? form.inclusions.split('\n').map(s => s.trim()).filter(Boolean) : [],
                exclusions: form.exclusions ? form.exclusions.split('\n').map(s => s.trim()).filter(Boolean) : [],
                thingsToCarry: form.thingsToCarry ? form.thingsToCarry.split('\n').map(s => s.trim()).filter(Boolean) : [],
                termsAndConditions: form.termsAndConditions ? form.termsAndConditions.split('\n').map(s => s.trim()).filter(Boolean) : [],
                registrationFee: sanitizeTrekRegistrationFee(form.registrationFee),
                platformFeePercent: sanitizeTrekPlatformFeePercent(form.platformFeePercent),
                maxParticipants: Number(form.maxParticipants) || 0,
                trekDate: form.trekDate || null,
                dateLabel: (form.dateLabel || '').trim(),
                trekBatches: normalizeTrekBatches(form.trekBatches, form.trekDate || null),
                detailBoxes: normalizeDetailBoxes(form.detailBoxes),
                itinerary: serializeItineraryForSave(form.itinerary),
                trekFilters: form.trekFilters || emptyTrekFilters(),
                contacts: (form.contacts || []).filter(c => (c.name || c.role || c.phone || '').trim()),
                registration: {
                    ...(form.registration || {}),
                    formSchema: (form.registration?.formSchema || [])
                        .map((f) => ({
                            ...f,
                            label: String(f.label || '').trim(),
                            fieldName: String(f.fieldName || '').trim(),
                            options: (f.options || []).map((o) => String(o).trim()).filter(Boolean),
                        }))
                        .filter((f) => f.label && f.fieldName),
                },
                // Only External Link mode uses registrationLink for Book Now.
                // Clearing prevents a leftover community WhatsApp from hijacking booking.
                registrationLink:
                    (form.registration?.mode || 'internal_form') === 'external_link'
                        ? String(form.registrationLink || '').trim()
                        : '',
            };
            delete payload.featuredSection;
            delete payload.homeSection;
            delete payload.priority;
            delete payload.trekPagePriority;
            delete payload.communityPriority;
            delete payload.homePriority;
            const path = trek ? `/admin/treks/${trek._id}` : '/admin/treks';
            const data = await adminFetchJSON(path, {
                method: trek ? 'PUT' : 'POST',
                body: JSON.stringify(payload),
            });
            localStorage.setItem('admin_data_updated', Date.now().toString());
            setTimeout(() => localStorage.removeItem('admin_data_updated'), 1000);
            onSaved(data.trek);
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
                    <h2 className="text-lg font-bold text-white">{trek ? 'Edit Trek' : 'Create Trek'}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={20} /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {error && <div className="bg-red-900/30 border border-red-700 text-red-300 text-sm rounded-lg px-4 py-3">{error}</div>}

                    <FormSection step="1" title="Basic info" subtitle="Required fields to create the trek.">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Trek Name <span className="text-red-400">*</span></label>
                                <input type="text" value={form.trekName} onChange={e => set('trekName', e.target.value)} className={inp} placeholder="Trek name" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Difficulty Level <span className="text-red-400">*</span></label>
                                <select value={form.difficultyLevel} onChange={e => set('difficultyLevel', e.target.value)} className={inp}>
                                    <option value="">Select...</option>
                                    <option value="easy">Easy</option>
                                    <option value="moderate">Moderate</option>
                                    <option value="difficult">Difficult</option>
                                    <option value="extreme">Extreme</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">City</label>
                            <input type="text" value={form.city} onChange={e => set('city', e.target.value)} className={inp} placeholder="Nearest city" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Registration fee (₹ per person)</label>
                            <input
                                type="number"
                                min="0"
                                step="1"
                                value={form.registrationFee > 0 ? form.registrationFee : ''}
                                onChange={(e) => set('registrationFee', e.target.value === '' ? 0 : Number(e.target.value) || 0)}
                                className={inp}
                                placeholder="e.g. 3500 — empty = Free"
                            />
                            <p className="text-[10px] text-gray-500 mt-1">Platform fee % is set in Booking (step 13).</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Trek Category</label>
                            <select value={form.trekCategory || ''} onChange={e => set('trekCategory', e.target.value)} className={inp} disabled={!hasCategoryOptions}>
                                <option value="">None</option>
                                {categoryOptions.map(option => (<option key={option.value} value={option.value}>{option.label}</option>))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Status</label>
                            <div className="flex flex-wrap gap-4">
                                {['published', 'draft', 'completed', 'cancelled'].map(s => (
                                    <label key={s} className="flex items-center gap-2 cursor-pointer">
                                        <input type="radio" name="status" value={s} checked={form.status === s} onChange={() => set('status', s)} className="accent-[#0ECCEE]" />
                                        <span className="text-sm text-gray-300 capitalize">{s}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </FormSection>

                    <FormSection step="2" title="Overview" subtitle="Shown at the top of the trek page under the title.">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
                            <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={5} className={`${inp} resize-none`} placeholder="Describe the trek — location, highlights, what to expect..." />
                        </div>
                        <div><label className="block text-sm font-medium text-gray-300 mb-1">Trek Duration</label><input type="text" value={form.trekDuration} onChange={e => set('trekDuration', e.target.value)} className={inp} placeholder="e.g. 2 days 1 night" /></div>
                    </FormSection>

                    <FormSection step="3" title="Card subtitle & departures" subtitle="Card label on community pages and departure batches in Details tab.">
                        <div className="rounded-xl border border-gray-200 bg-white text-gray-900 p-4 space-y-3 shadow-sm">
                            <div>
                                <p className="text-sm font-semibold">Card subtitle</p>
                                <p className="text-xs text-gray-600 mt-1">e.g. Weekend, Weekday, or 11 - 12 July</p>
                            </div>
                            <input type="text" value={form.dateLabel} onChange={(e) => set('dateLabel', e.target.value)} className="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 text-sm focus:outline-none focus:border-[#0ECCEE]" placeholder="e.g. Weekend, 11 - 12 July" />
                            <div className="flex flex-wrap gap-2">
                                {CARD_LABEL_SUGGESTIONS.map((s) => (
                                    <button key={s} type="button" onClick={() => set('dateLabel', s)} className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${form.dateLabel === s ? 'bg-[#0ECCEE] text-black border-[#0ECCEE]' : 'bg-gray-50 text-gray-700 border-gray-300 hover:border-[#0ECCEE]'}`}>{s}</button>
                                ))}
                            </div>
                        </div>
                        <div className="rounded-xl border border-gray-200 bg-white text-gray-900 p-4 space-y-3 shadow-sm">
                            <p className="text-sm font-semibold">Departure batches</p>
                            <TrekBatchesEditor batches={form.trekBatches} onChange={(trekBatches) => set('trekBatches', trekBatches)} />
                        </div>
                    </FormSection>

                    <FormSection step="4" title="Trek Info — Details" subtitle="Detail cards on the Details tab. Drag to reorder; icon is auto-picked from the label.">
                        <TrekDetailBoxesEditor boxes={form.detailBoxes || []} onChange={(detailBoxes) => set('detailBoxes', detailBoxes)} />
                        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-700/50">
                            <div><label className="block text-sm font-medium text-gray-300 mb-1">Starting Point</label><input type="text" value={form.startingPoint} onChange={e => set('startingPoint', e.target.value)} className={inp} /></div>
                            <div><label className="block text-sm font-medium text-gray-300 mb-1">Destination</label><input type="text" value={form.destination} onChange={e => set('destination', e.target.value)} className={inp} /></div>
                            <div className="col-span-2"><label className="block text-sm font-medium text-gray-300 mb-1">Meeting Location</label><input type="text" value={form.meetingLocation} onChange={e => set('meetingLocation', e.target.value)} className={inp} placeholder="Used for map on trek page" /></div>
                        </div>
                    </FormSection>

                    <FormSection step="5" title="Trek Info — Schedule" subtitle="Paste all lines at once, then mark Main or Sub on each row." optional>
                        <div className="flex items-center justify-between">
                            <p className="text-xs text-gray-500">Leave empty if you don&apos;t need a schedule yet.</p>
                            <button type="button" onClick={addItineraryDay} className="flex items-center gap-1 text-xs text-[#0ECCEE] hover:opacity-80 transition-opacity"><Plus size={12} /> Add Day</button>
                        </div>
                        {(form.itinerary || []).map((day, idx) => (
                            <div key={idx} className="bg-[#1D1E20] rounded-lg p-3 space-y-2.5">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-gray-400">Day {day.day || idx + 1}</span>
                                    <button type="button" onClick={() => removeItineraryDay(idx)} className="text-gray-500 hover:text-red-400"><Trash2 size={13} /></button>
                                </div>
                                <input type="text" value={day.title || ''} onChange={e => updateItinerary(idx, 'title', e.target.value)} className={inp} placeholder="Day title" />
                                <div className="space-y-2">
                                    <div className="rounded-lg border border-dashed border-gray-600/80 p-2.5 space-y-2">
                                        <p className="text-[11px] font-medium text-gray-400">Paste schedule (one point per line)</p>
                                        <textarea
                                            value={pasteByDay[idx] || ''}
                                            onChange={(e) => setPasteByDay((prev) => ({ ...prev, [idx]: e.target.value }))}
                                            rows={4}
                                            className={`${inp} resize-y min-h-[88px]`}
                                            placeholder={'Reach base camp\n  Check-in & briefing\nEvening trek\n  Sunset viewpoint'}
                                        />
                                        <p className="text-[10px] text-gray-600">
                                            Tip: indent a line (2 spaces) to auto-mark it as Sub. You can still switch Main / Sub after.
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            <button
                                                type="button"
                                                disabled={!String(pasteByDay[idx] || '').trim()}
                                                onClick={() => replaceWithPastedPoints(idx)}
                                                className="px-3 py-1.5 rounded-lg bg-[#0ECCEE] text-black text-xs font-semibold disabled:opacity-40"
                                            >
                                                Replace with paste
                                            </button>
                                            <button
                                                type="button"
                                                disabled={!String(pasteByDay[idx] || '').trim()}
                                                onClick={() => applyPastedPoints(idx)}
                                                className="px-3 py-1.5 rounded-lg border border-gray-600 text-gray-300 text-xs font-medium disabled:opacity-40"
                                            >
                                                Append paste
                                            </button>
                                        </div>
                                    </div>
                                    <p className="text-[11px] font-medium text-gray-400">Schedule points — tap Main or Sub</p>
                                    {(day.points || []).length === 0 ? (
                                        <p className="text-xs text-gray-600 border border-dashed border-gray-600 rounded-lg px-3 py-2">No points yet — paste above or add one.</p>
                                    ) : (
                                        (day.points || []).map((point, pointIdx) => {
                                            const isSub = point.level === 'sub';
                                            return (
                                                <div
                                                    key={pointIdx}
                                                    className={`flex items-center gap-2 ${isSub ? 'ml-[14px] pl-2 border-l border-[#0ECCEE]/25' : ''}`}
                                                >
                                                    {!isSub ? (
                                                        <ScheduleMainMarker className="mt-0" />
                                                    ) : (
                                                        <ScheduleSubMarker isDark className="mt-0" />
                                                    )}
                                                    <input
                                                        type="text"
                                                        value={point.text || ''}
                                                        onChange={(e) => updateItineraryPoint(idx, pointIdx, 'text', e.target.value)}
                                                        className={`${inp} flex-1 min-w-0`}
                                                        placeholder={isSub ? 'Sub-point' : 'Main point'}
                                                    />
                                                    <div className="flex rounded-lg border border-gray-600 overflow-hidden shrink-0">
                                                        <button
                                                            type="button"
                                                            onClick={() => updateItineraryPoint(idx, pointIdx, 'level', 'main')}
                                                            className={`px-2 py-1 text-[10px] font-medium ${!isSub ? 'bg-[#0ECCEE]/20 text-[#0ECCEE]' : 'bg-[#111213] text-gray-500'}`}
                                                        >
                                                            Main
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => updateItineraryPoint(idx, pointIdx, 'level', 'sub')}
                                                            className={`px-2 py-1 text-[10px] font-medium ${isSub ? 'bg-[#0ECCEE]/20 text-[#0ECCEE]' : 'bg-[#111213] text-gray-500'}`}
                                                        >
                                                            Sub
                                                        </button>
                                                    </div>
                                                    <button type="button" onClick={() => removeItineraryPoint(idx, pointIdx)} className="text-gray-500 hover:text-red-400 p-1" aria-label="Remove point">
                                                        <Trash2 size={13} />
                                                    </button>
                                                </div>
                                            );
                                        })
                                    )}
                                    <div className="flex flex-wrap gap-2 pt-0.5">
                                        <button type="button" onClick={() => addItineraryPoint(idx, 'main')} className="flex items-center gap-1 text-xs text-[#0ECCEE] hover:opacity-80">
                                            <Plus size={12} /> Main point
                                        </button>
                                        <button type="button" onClick={() => addItineraryPoint(idx, 'sub')} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-300">
                                            <Plus size={12} /> Sub point
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </FormSection>

                    <FormSection step="6" title="Trek Info — Inclusion" subtitle="One item per line — shown in the Inclusion tab." optional>
                        <textarea value={form.inclusions} onChange={e => set('inclusions', e.target.value)} rows={4} className={`${inp} resize-none`} placeholder="Meals&#10;Transport&#10;Guide" />
                    </FormSection>

                    <FormSection step="7" title="Trek Info — Exclusion" subtitle="Listed in the Exclusion tab on the trek page." optional>
                        <textarea value={form.exclusions} onChange={e => set('exclusions', e.target.value)} rows={3} className={`${inp} resize-none`} placeholder="Personal gear&#10;Insurance" />
                    </FormSection>

                    <FormSection step="8" title="Things to Carry" subtitle="Expandable list on the Details tab." optional>
                        <textarea value={form.thingsToCarry} onChange={e => set('thingsToCarry', e.target.value)} rows={3} className={`${inp} resize-none`} placeholder="Trekking shoes&#10;Water bottle" />
                    </FormSection>

                    <FormSection step="9" title="Terms & Conditions" subtitle="Shown at the bottom of the trek page." optional>
                        <textarea value={form.termsAndConditions || ''} onChange={e => set('termsAndConditions', e.target.value)} rows={5} className={`${inp} resize-none`} placeholder="One point per line..." />
                    </FormSection>

                    <FormSection step="10" title="Contacts" subtitle="Phone, Instagram and people to reach on the trek page." optional>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="block text-sm font-medium text-gray-300 mb-1">Trek Leader</label><input type="text" value={form.trekLeader} onChange={e => set('trekLeader', e.target.value)} className={inp} /></div>
                            <div><label className="block text-sm font-medium text-gray-300 mb-1">Emergency Contact</label><input type="text" value={form.emergencyContact} onChange={e => set('emergencyContact', e.target.value)} className={inp} /></div>
                        </div>
                        <div><label className="block text-sm font-medium text-gray-300 mb-1">Instagram</label><input type="text" value={form.contactInstagram || ''} onChange={e => set('contactInstagram', e.target.value)} className={inp} placeholder="@yourtrek" /></div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">WhatsApp group link (this trek)</label>
                            <input
                                type="url"
                                value={form.groupLink || ''}
                                onChange={e => set('groupLink', e.target.value)}
                                className={inp}
                                placeholder="https://chat.whatsapp.com/..."
                            />
                            <p className="text-[11px] text-gray-600 mt-1.5">
                                Shown only after someone registers (email + My Bookings). Does not control Book Now.
                                If empty, the linked trek community’s WhatsApp is used — set this trek’s own link to avoid another community’s group.
                            </p>
                        </div>
                        <div className="rounded-lg border border-gray-700/60 p-3">
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-sm font-medium text-gray-300">People to contact</label>
                                <button type="button" onClick={addContact} className="flex items-center gap-1 text-xs font-semibold text-[#0ECCEE] hover:underline"><Plus size={13} /> Add</button>
                            </div>
                            {(form.contacts || []).map((c, idx) => (
                                <div key={idx} className="rounded-lg border border-gray-700 bg-[#1D1E20] p-3 space-y-2 mb-2">
                                    <div className="flex justify-between"><span className="text-xs text-gray-400">Contact {idx + 1}</span><button type="button" onClick={() => removeContact(idx)} className="text-gray-500 hover:text-red-400"><Trash2 size={14} /></button></div>
                                    <div className="grid grid-cols-2 gap-2"><input type="text" value={c.name} onChange={e => updateContact(idx, 'name', e.target.value)} className={inp} placeholder="Name" /><input type="text" value={c.role} onChange={e => updateContact(idx, 'role', e.target.value)} className={inp} placeholder="Role" /></div>
                                    <input type="tel" value={c.phone} onChange={e => updateContact(idx, 'phone', e.target.value)} className={inp} placeholder="Phone" />
                                </div>
                            ))}
                        </div>
                    </FormSection>

                    <FormSection step="11" title="User filter tags" subtitle="Tags for the Trek Category filter page." optional>
                    <TrekFilterTagsEditor
                        trekFilters={form.trekFilters || emptyTrekFilters()}
                        difficultyLevel={form.difficultyLevel}
                        registrationFee={form.registrationFee}
                        onChange={(next) => set('trekFilters', next)}
                    />
                    </FormSection>

                    <FormSection step="12" title="Images" subtitle="Separate slots so you can crop size-wise: cards, detail slider, gallery.">
                        <div className="space-y-5">
                            <div className="rounded-xl border border-gray-700/60 bg-[#1D1E20]/40 p-4 space-y-3">
                                <div>
                                    <p className="text-sm font-semibold text-white">Cover card images</p>
                                    <p className="text-[11px] text-gray-500 mt-0.5">
                                        Portrait shows on the community page trek cards and treks listing. Upload other layouts for home / wide rows.
                                    </p>
                                </div>
                                <MultiCoverImagesUpload
                                    value={form.coverImages}
                                    onChange={(coverImages) => {
                                        set('coverImages', coverImages);
                                        set('coverImage', primaryCoverUrl(coverImages, form.coverImage));
                                    }}
                                    onError={(msg) => setError(`Cover upload failed: ${msg}`)}
                                    onUploadingChange={setUploadingCover}
                                    hint="Crop each layout to its aspect — portrait is the main community card."
                                />
                            </div>

                            <div className="rounded-xl border border-[#0ECCEE]/25 bg-[#0ECCEE]/5 p-4 space-y-3">
                                <div>
                                    <p className="text-sm font-semibold text-white">Detail page sliding images</p>
                                    <p className="text-[11px] text-gray-500 mt-0.5">
                                        Top carousel on the trek detail page (same frame as community banner — 393×396). Add up to 5; cropped before upload.
                                    </p>
                                </div>
                                <CroppedMultiImagesUpload
                                    value={form.heroImages}
                                    onChange={(heroImages) => set('heroImages', heroImages)}
                                    onError={(msg) => setError(`Slider upload failed: ${msg}`)}
                                    onUploadingChange={setUploadingHero}
                                    max={5}
                                    fixedAspectId="communityBanner"
                                    title="Crop sliding hero image"
                                    uploadLabel="Add sliding image"
                                    hint="These only appear in the detail hero slider — not on community trek cards."
                                />
                            </div>

                            <div className="rounded-xl border border-gray-700/60 bg-[#1D1E20]/40 p-4 space-y-3">
                                <div>
                                    <p className="text-sm font-semibold text-white">Gallery images</p>
                                    <p className="text-[11px] text-gray-500 mt-0.5">
                                        Separate gallery grid on the trek detail page (below the info sections). Not mixed into the top slider.
                                    </p>
                                </div>
                                <GalleryImagesUploadField
                                    value={form.images}
                                    onChange={(images) => set('images', images)}
                                    onError={(msg) => setError(`Gallery upload failed: ${msg}`)}
                                    onUploadingChange={setUploading}
                                    uploadLabel="Upload gallery images"
                                    hint="Square-friendly photos work best for the gallery row."
                                />
                            </div>
                        </div>
                    </FormSection>

                    <FormSection step="13" title="Booking & registration" subtitle="Registration status, booking form and payment.">
                            <TrekRegistrationFeePicker
                                registrationFee={form.registrationFee}
                                platformFeePercent={form.platformFeePercent ?? 3}
                                onRegistrationFeeChange={(registrationFee) => set('registrationFee', registrationFee)}
                                onPlatformFeePercentChange={(platformFeePercent) => set('platformFeePercent', platformFeePercent)}
                                maxPeoplePerBooking={form.registration?.maxPeoplePerBooking ?? 10}
                                inputClassName={inp}
                            />

                            <hr className="border-gray-700" />

                            {/* Registration status + type — same as the fests/events form */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-gray-400 mb-1">Registration Status</label>
                                    <select
                                        value={form.registration?.status || 'open'}
                                        onChange={e => set('registration', { ...form.registration, status: e.target.value })}
                                        className={inp}
                                    >
                                        <option value="open">Open</option>
                                        <option value="not_open_yet">Not open yet</option>
                                        <option value="closed">Closed</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-400 mb-1">Registration Type</label>
                                    <select
                                        value={form.registration?.mode || 'internal_form'}
                                        onChange={(e) => {
                                            const mode = e.target.value;
                                            setForm((f) => ({
                                                ...f,
                                                registration: { ...f.registration, mode },
                                                registrationLink: mode === 'external_link' ? (f.registrationLink || '') : '',
                                            }));
                                        }}
                                        className={inp}
                                    >
                                        <option value="internal_form">Internal Form (in-app booking + Cashfree) — default</option>
                                        <option value="external_link">External Link (skips your form — opens URL)</option>
                                        <option value="organizer_qr">Optional: Form + UPI QR (manual payment review)</option>
                                    </select>
                                    <p className="text-[10px] text-gray-500 mt-1.5">
                                        Use Internal Form for custom fields + Cashfree. Do not put a WhatsApp group here — that belongs under Contacts → WhatsApp group link (sent only after someone registers).
                                    </p>
                                </div>
                            </div>

                            {(form.registration?.mode || 'internal_form') === 'organizer_qr' ? (
                                <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 space-y-3">
                                    <p className="text-xs font-semibold text-amber-200">Optional UPI / QR (manual review)</p>
                                    <p className="text-[10px] text-gray-500">
                                        Only if you skip Cashfree: participants pay via your QR, upload a screenshot, then you approve in the organizer panel.
                                    </p>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-400 mb-1">Payment QR image URL</label>
                                        <input
                                            type="url"
                                            value={form.registration?.paymentQR || ''}
                                            onChange={(e) => set('registration', { ...form.registration, paymentQR: e.target.value })}
                                            className={inp}
                                            placeholder="https://res.cloudinary.com/…/qr.jpg"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-400 mb-1">UPI ID (optional)</label>
                                        <input
                                            type="text"
                                            value={form.registration?.paymentUpiId || ''}
                                            onChange={(e) => set('registration', { ...form.registration, paymentUpiId: e.target.value })}
                                            className={inp}
                                            placeholder="name@upi"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-400 mb-1">Payment note (optional)</label>
                                        <input
                                            type="text"
                                            value={form.registration?.paymentQRMessage || ''}
                                            onChange={(e) => set('registration', { ...form.registration, paymentQRMessage: e.target.value })}
                                            className={inp}
                                            placeholder="Add trek name in UPI remark"
                                        />
                                    </div>
                                </div>
                            ) : null}

                            <div className="rounded-xl border border-gray-700/80 p-4 space-y-3">
                                <div>
                                    <p className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Gender seat limits</p>
                                    <p className="text-[10px] text-gray-600 mt-1">
                                        Split capacity by gender. Organizers can open women-only registration first from their portal.
                                    </p>
                                </div>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={Boolean(form.registration?.genderQuotas?.enabled)}
                                        onChange={(e) => set('registration', {
                                            ...form.registration,
                                            genderQuotas: {
                                                ...(form.registration?.genderQuotas || {}),
                                                enabled: e.target.checked,
                                            },
                                        })}
                                        className="w-4 h-4 accent-[#0ECCEE]"
                                    />
                                    <span className="text-sm text-gray-300">Enable gender-based seats</span>
                                </label>
                                {form.registration?.genderQuotas?.enabled ? (
                                    <>
                                        <div className="grid grid-cols-3 gap-3">
                                            {[
                                                { key: 'femaleSeats', label: 'Women seats' },
                                                { key: 'maleSeats', label: 'Men seats' },
                                                { key: 'othersSeats', label: 'Others seats' },
                                            ].map(({ key, label }) => (
                                                <div key={key}>
                                                    <label className="block text-[10px] text-gray-500 mb-1">{label}</label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={form.registration?.genderQuotas?.[key] ?? 0}
                                                        onChange={(e) => set('registration', {
                                                            ...form.registration,
                                                            genderQuotas: {
                                                                ...(form.registration?.genderQuotas || {}),
                                                                [key]: Math.max(0, Number(e.target.value) || 0),
                                                            },
                                                        })}
                                                        className={inp}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-400 mb-1">Starting registration phase</label>
                                            <select
                                                value={form.registration?.genderPhase || 'all'}
                                                onChange={(e) => set('registration', { ...form.registration, genderPhase: e.target.value })}
                                                className={inp}
                                            >
                                                <option value="women_only">Women only (open women first)</option>
                                                <option value="men_only">Men only</option>
                                                <option value="all">Open to all</option>
                                                <option value="closed">Paused</option>
                                            </select>
                                        </div>
                                        <p className="text-[10px] text-gray-600">
                                            When enabled, each booking is 1 person. Users pick Male/Female in booking step 1;
                                            if phase is women-only and they pick male, they cannot continue.
                                        </p>
                                    </>
                                ) : null}
                            </div>

                            {(form.registration?.mode || 'internal_form') === 'external_link' ? (
                                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-2">
                                    <p className="text-xs font-semibold text-amber-200">
                                        External Link skips your custom form
                                    </p>
                                    <p className="text-[10px] text-gray-500">
                                        Book Now will open this URL instead of CrwdCtrl booking. For in-app forms, switch Registration Type back to Internal Form.
                                    </p>
                                    <label className="block text-xs font-medium text-gray-400 mb-1">External registration URL</label>
                                    <input type="url" value={form.registrationLink || ''}
                                        onChange={e => set('registrationLink', e.target.value)}
                                        className={inp} placeholder="https://forms.gle/... or your own site" />
                                    <p className="text-[10px] text-gray-600 mt-1">
                                        Not for post-booking WhatsApp groups — use Contacts → WhatsApp group link for that.
                                    </p>
                                </div>
                            ) : (
                            <>
                            {/* ── Step 1 config ── */}
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Step 1 — Date · Time · People</p>

                            {/* Available Dates */}
                            <RegListEditor
                                label="Available Dates"
                                hint='e.g. "19 May 2025" — users will pick from these chips'
                                items={form.registration?.availableDates || []}
                                placeholder="e.g. 19 May 2025"
                                onChange={arr => set('registration', { ...form.registration, availableDates: arr })}
                                inp={inp}
                            />

                            {/* Time Slots */}
                            <RegListEditor
                                label="Time Slots"
                                hint='e.g. "6:00 AM", "8:30 AM"'
                                items={form.registration?.timeSlots || []}
                                placeholder="e.g. 6:00 AM"
                                onChange={arr => set('registration', { ...form.registration, timeSlots: arr })}
                                inp={inp}
                            />

                            {/* Location Options */}
                            <RegListEditor
                                label="Location Options"
                                hint='Leave empty to use the trek city. Add multiple for user to choose.'
                                items={form.registration?.locationOptions || []}
                                placeholder="e.g. Rishikesh, Uttarakhand"
                                onChange={arr => set('registration', { ...form.registration, locationOptions: arr })}
                                inp={inp}
                            />

                            {/* Max People per Booking */}
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1">Max People per Booking</label>
                                <input
                                    type="number" min="1" max="50"
                                    value={form.registration?.maxPeoplePerBooking ?? 10}
                                    onChange={e => set('registration', { ...form.registration, maxPeoplePerBooking: parseInt(e.target.value) || 10 })}
                                    className={`${inp} w-28`}
                                />
                            </div>

                            <hr className="border-gray-700" />

                            {/* ── Step 2 config ── */}
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Step 2 — Personal Details</p>
                            <p className="text-[10px] text-gray-600">Default fields: Full Name · Contact No. · E-mail · ID Proof. Add extra below.</p>

                            {/* Extra form fields */}
                            <div className="space-y-2">
                                {(form.registration?.formSchema || []).map((field, idx) => (
                                    <div key={field.id} className="bg-[#1D1E20] rounded-lg p-3 space-y-2">
                                        <div className="grid grid-cols-2 gap-2">
                                            <input type="text" value={field.label} placeholder="Field label"
                                                onChange={e => {
                                                    const u = [...(form.registration?.formSchema || [])];
                                                    u[idx] = { ...field, label: e.target.value, fieldName: e.target.value.toLowerCase().replace(/\s+/g,'_') };
                                                    set('registration', { ...form.registration, formSchema: u });
                                                }}
                                                className="bg-[#111213] border border-gray-600 rounded px-2 py-1.5 text-white text-xs focus:outline-none focus:border-[#0ECCEE]"
                                            />
                                            <div className="flex gap-2">
                                                <select value={field.type}
                                                    onChange={e => { const u=[...(form.registration?.formSchema||[])]; u[idx]={...field,type:e.target.value}; set('registration',{...form.registration,formSchema:u}); }}
                                                    className="flex-1 bg-[#111213] border border-gray-600 rounded px-2 py-1.5 text-white text-xs focus:outline-none focus:border-[#0ECCEE]">
                                                    {TREK_FORM_FIELD_TYPES.map((t) => (
                                                        <option key={t.value} value={t.value}>{t.label}</option>
                                                    ))}
                                                </select>
                                                <button type="button" onClick={() => { const u=(form.registration?.formSchema||[]).filter((_,i)=>i!==idx); set('registration',{...form.registration,formSchema:u}); }}
                                                    className="text-red-400 hover:text-red-300 px-2">✕</button>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <input type="text" value={field.placeholder||''} placeholder="Placeholder"
                                                onChange={e=>{const u=[...(form.registration?.formSchema||[])];u[idx]={...field,placeholder:e.target.value};set('registration',{...form.registration,formSchema:u});}}
                                                className="flex-1 bg-[#111213] border border-gray-600 rounded px-2 py-1.5 text-white text-xs focus:outline-none focus:border-[#0ECCEE]"
                                            />
                                            <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
                                                <input type="checkbox" checked={field.required||false}
                                                    onChange={e=>{const u=[...(form.registration?.formSchema||[])];u[idx]={...field,required:e.target.checked};set('registration',{...form.registration,formSchema:u});}}
                                                    className="accent-[#0ECCEE]" />
                                                <span className="text-xs text-gray-400">Required</span>
                                            </label>
                                        </div>
                                        {field.type === 'agree' ? (
                                            <p className="text-[10px] text-gray-500">
                                                Agreement text goes in the label above. Users must tick the box to continue.
                                            </p>
                                        ) : null}
                                        {TREK_FORM_OPTION_FIELD_TYPES.includes(field.type) && (
                                            <div className="space-y-2 rounded-lg border border-gray-700 bg-[#111213] p-2.5">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[11px] font-medium text-gray-400">Options</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => addFormFieldOption(idx)}
                                                        className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium text-[#0ECCEE] border border-[#0ECCEE]/30 hover:bg-[#0ECCEE]/10"
                                                    >
                                                        <Plus size={11} /> Add option
                                                    </button>
                                                </div>
                                                {(field.options || []).length === 0 ? (
                                                    <p className="text-[10px] text-gray-600">No options yet — click Add option.</p>
                                                ) : (
                                                    (field.options || []).map((opt, oi) => (
                                                        <div key={oi} className="flex items-center gap-2">
                                                            <input
                                                                type="text"
                                                                value={opt}
                                                                placeholder={`Option ${oi + 1}`}
                                                                onChange={(e) => updateFormFieldOption(idx, oi, e.target.value)}
                                                                className="flex-1 bg-[#1D1E20] border border-gray-600 rounded px-2 py-1.5 text-white text-xs focus:outline-none focus:border-[#0ECCEE]"
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => removeFormFieldOption(idx, oi)}
                                                                className="text-gray-500 hover:text-red-400 p-1"
                                                                aria-label="Remove option"
                                                            >
                                                                <Trash2 size={13} />
                                                            </button>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                                <div className="flex flex-col sm:flex-row gap-2">
                                    <button type="button"
                                        onClick={() => { const f=form.registration?.formSchema||[]; set('registration',{...form.registration,formSchema:[...f, createEmptyTrekFormField()]}); }}
                                        className="flex-1 py-2 border border-dashed border-gray-600 hover:border-[#0ECCEE] rounded-lg text-xs text-gray-500 hover:text-[#0ECCEE] transition-colors">
                                        + Add Extra Field
                                    </button>
                                    <button type="button"
                                        onClick={() => { const f=form.registration?.formSchema||[]; set('registration',{...form.registration,formSchema:[...f, createAgreeTrekFormField()]}); }}
                                        className="flex-1 py-2 border border-dashed border-[#0ECCEE]/40 hover:border-[#0ECCEE] rounded-lg text-xs text-[#0ECCEE] hover:bg-[#0ECCEE]/5 transition-colors">
                                        + I Agree Field
                                    </button>
                                </div>
                            </div>

                            <hr className="border-gray-700" />

                            {/* ── Google Sheets + notifications ── */}
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Data & Notifications</p>
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1">Google Sheets URL</label>
                                <input type="url" value={form.registration?.googleSheetsUrl||''} placeholder="https://docs.google.com/spreadsheets/d/..."
                                    onChange={e=>set('registration',{...form.registration,googleSheetsUrl:e.target.value})} className={inp} />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1">Organizer Email</label>
                                <input type="email" value={form.registration?.organizerEmail||''} placeholder="organizer@email.com"
                                    onChange={e=>set('registration',{...form.registration,organizerEmail:e.target.value})} className={inp} />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1">Instructions shown to user</label>
                                <textarea rows={2} value={form.registration?.formInstructions||''} placeholder="e.g. Bring original ID proof on trek day."
                                    onChange={e=>set('registration',{...form.registration,formInstructions:e.target.value})} className={`${inp} resize-none`} />
                            </div>
                            </>
                            )}
                    </FormSection>

                    <p className="text-[11px] text-gray-600 px-1">
                        Treks page sections, order &amp; home carousel → <span className="text-gray-500">Home &amp; Sections → Treks</span>
                    </p>

                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors">Cancel</button>
                        <button type="submit" disabled={saving || uploading || uploadingCover || uploadingHero} className="flex-1 px-4 py-2.5 bg-[#0ECCEE] hover:bg-[#0ECCEE]/80 text-black rounded-lg text-sm font-bold transition-colors disabled:opacity-50">
                            {saving ? 'Saving...' : trek ? 'Update Trek' : 'Create Trek'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
