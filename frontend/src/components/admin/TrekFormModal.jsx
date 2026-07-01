import { useState, useEffect } from 'react';
import { X, Upload, Plus, Trash2 } from 'lucide-react';
import MultiCoverImagesUpload from './MultiCoverImagesUpload';
import GalleryImagesUploadField from './GalleryImagesUploadField';
import { normalizeCoverImages, primaryCoverUrl, EMPTY_COVER_IMAGES } from '../../utils/coverImages';
import {
    TREK_FILTER_SECTIONS,
    emptyTrekFilters,
    getBudgetTier,
    DIFFICULTY_LEVEL_FILTER_OPTIONS,
} from '../../constants/trekFilters';
import { adminFetch, adminFetchJSON } from '../../utils/adminApi';
import { normalizeTrekBatches, EMPTY_BATCH } from '../../utils/trekDateDisplay';

const CARD_LABEL_SUGGESTIONS = ['Weekend', 'Weekday', 'Every Saturday', 'Coming soon'];

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
    emergencyContact: '', contactInstagram: '', contacts: [], registrationFee: 0, registrationLink: '', maxParticipants: 0,
    trekDate: '', dateLabel: '', trekBatches: [], city: '', trekCategory: '', status: 'published',
    registration: { status: 'open', mode: 'internal_form', googleSheetsUrl: '', organizerEmail: '', formInstructions: '', availableDates: [], timeSlots: [], locationOptions: [], maxPeoplePerBooking: 10, formSchema: [] },
    inclusions: '', exclusions: '', thingsToCarry: '', termsAndConditions: '',
    itinerary: [],
    coverImage: '',
    coverImages: EMPTY_COVER_IMAGES(),
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
                                <label className="block text-[11px] font-medium text-gray-600 mb-1">Date</label>
                                <input
                                    type="date"
                                    value={batch.date || ''}
                                    onChange={(e) => update(idx, 'date', e.target.value)}
                                    className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-900 text-sm focus:outline-none focus:border-[#0ECCEE]"
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

export default function TrekFormModal({ trek, communityId, communityCategories, onClose, onSaved }) {
    const [form, setForm] = useState(EMPTY);
    const [uploading, setUploading] = useState(false);
    const [uploadingCover, setUploadingCover] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

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
                communityId: trek.communityId || communityId || null,
                trekDate: trek.trekDate ? new Date(trek.trekDate).toISOString().slice(0, 10) : '',
                dateLabel: trek.dateLabel || '',
                trekBatches: normalizeTrekBatches(trek.trekBatches, trek.trekDate),
                inclusions: Array.isArray(trek.inclusions) ? trek.inclusions.join('\n') : (trek.inclusions || ''),
                exclusions: Array.isArray(trek.exclusions) ? trek.exclusions.join('\n') : (trek.exclusions || ''),
                thingsToCarry: Array.isArray(trek.thingsToCarry) ? trek.thingsToCarry.join('\n') : (trek.thingsToCarry || ''),
                termsAndConditions: Array.isArray(trek.termsAndConditions) ? trek.termsAndConditions.join('\n') : (trek.termsAndConditions || ''),
                itinerary: trek.itinerary || [],
                contacts: Array.isArray(trek.contacts) ? trek.contacts.map(c => ({ name: c?.name || '', role: c?.role || '', phone: c?.phone || '' })) : [],
                coverImage: legacyCover || primaryCoverUrl(coverImages),
                coverImages,
                images: trek.images || [],
                trekFilters: {
                    ...emptyTrekFilters(),
                    ...(trek.trekFilters || {}),
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

    const addItineraryDay = () => {
        set('itinerary', [...form.itinerary, { day: form.itinerary.length + 1, title: '', description: '' }]);
    };

    const updateItinerary = (idx, field, value) => {
        const updated = form.itinerary.map((d, i) => i === idx ? { ...d, [field]: value } : d);
        set('itinerary', updated);
    };

    const removeItineraryDay = (idx) => {
        set('itinerary', form.itinerary.filter((_, i) => i !== idx));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (!form.trekName.trim() || !form.difficultyLevel) {
            setError('Trek name and difficulty level are required.');
            return;
        }
        if (uploadingCover || uploading) {
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
                inclusions: form.inclusions ? form.inclusions.split('\n').map(s => s.trim()).filter(Boolean) : [],
                exclusions: form.exclusions ? form.exclusions.split('\n').map(s => s.trim()).filter(Boolean) : [],
                thingsToCarry: form.thingsToCarry ? form.thingsToCarry.split('\n').map(s => s.trim()).filter(Boolean) : [],
                termsAndConditions: form.termsAndConditions ? form.termsAndConditions.split('\n').map(s => s.trim()).filter(Boolean) : [],
                registrationFee: Number(form.registrationFee) || 0,
                maxParticipants: Number(form.maxParticipants) || 0,
                trekDate: form.trekDate || null,
                dateLabel: (form.dateLabel || '').trim(),
                trekBatches: normalizeTrekBatches(form.trekBatches, form.trekDate || null),
                trekFilters: form.trekFilters || emptyTrekFilters(),
                contacts: (form.contacts || []).filter(c => (c.name || c.role || c.phone || '').trim()),
            };
            delete payload.featuredSection;
            delete payload.homeSection;
            delete payload.priority;
            delete payload.trekPagePriority;
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
                        <label className="block text-sm font-medium text-gray-300 mb-1">Description <span className="text-gray-500 font-normal">(shown in Overview on the trek detail page)</span></label>
                        <textarea
                            value={form.description}
                            onChange={e => set('description', e.target.value)}
                            rows={5}
                            className={`${inp} resize-none`}
                            placeholder="Describe the trek — location, highlights, what to expect, scenery, experience level, etc."
                        />
                    </div>

                    <div className="rounded-xl border border-gray-200 bg-white text-gray-900 p-4 space-y-3 shadow-sm">
                        <div>
                            <p className="text-sm font-semibold">Card subtitle</p>
                            <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                                Short label on community trek cards only — e.g. Weekend, Weekday, Every Saturday.
                                This is separate from departure dates in the Details tab.
                            </p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-800 mb-1">Card label</label>
                            <input
                                type="text"
                                value={form.dateLabel}
                                onChange={(e) => set('dateLabel', e.target.value)}
                                className="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 text-sm focus:outline-none focus:border-[#0ECCEE]"
                                placeholder="e.g. Weekend, Weekday"
                            />
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {CARD_LABEL_SUGGESTIONS.map((s) => (
                                <button
                                    key={s}
                                    type="button"
                                    onClick={() => set('dateLabel', s)}
                                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                                        form.dateLabel === s
                                            ? 'bg-[#0ECCEE] text-black border-[#0ECCEE]'
                                            : 'bg-gray-50 text-gray-700 border-gray-300 hover:border-[#0ECCEE]'
                                    }`}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="rounded-xl border border-gray-200 bg-white text-gray-900 p-4 space-y-3 shadow-sm">
                        <div>
                            <p className="text-sm font-semibold">Departure batches (Details tab)</p>
                            <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                                Add trek dates, batch size, timing and notes. Shown as white cards in the
                                Details tab on the public trek page.
                            </p>
                        </div>
                        <TrekBatchesEditor
                            batches={form.trekBatches}
                            onChange={(trekBatches) => set('trekBatches', trekBatches)}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="block text-sm font-medium text-gray-300 mb-1">City</label><input type="text" value={form.city} onChange={e => set('city', e.target.value)} className={inp} placeholder="Nearest city" /></div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Trek Category</label>
                        <select
                            value={form.trekCategory || ''}
                            onChange={e => set('trekCategory', e.target.value)}
                            className={inp}
                            disabled={!hasCategoryOptions}
                        >
                            <option value="">None</option>
                            {categoryOptions.map(option => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                        <p className="text-xs text-gray-500 mt-1">
                            {hasCategoryOptions
                                ? 'Shown as trek cards under the matching category chip on the community detail page.'
                                : 'Add trek categories in the community form to enable this.'}
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="block text-sm font-medium text-gray-300 mb-1">Starting Point</label><input type="text" value={form.startingPoint} onChange={e => set('startingPoint', e.target.value)} className={inp} /></div>
                        <div><label className="block text-sm font-medium text-gray-300 mb-1">Destination</label><input type="text" value={form.destination} onChange={e => set('destination', e.target.value)} className={inp} /></div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="block text-sm font-medium text-gray-300 mb-1">Meeting Location</label><input type="text" value={form.meetingLocation} onChange={e => set('meetingLocation', e.target.value)} className={inp} /></div>
                        <div><label className="block text-sm font-medium text-gray-300 mb-1">Trek Duration</label><input type="text" value={form.trekDuration} onChange={e => set('trekDuration', e.target.value)} className={inp} placeholder="e.g. 2 days 1 night" /></div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="block text-sm font-medium text-gray-300 mb-1">Departure Time</label><input type="text" value={form.departureTime} onChange={e => set('departureTime', e.target.value)} className={inp} placeholder="e.g. 5:00 AM" /></div>
                        <div><label className="block text-sm font-medium text-gray-300 mb-1">Return Time</label><input type="text" value={form.returnTime} onChange={e => set('returnTime', e.target.value)} className={inp} placeholder="e.g. 8:00 PM" /></div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="block text-sm font-medium text-gray-300 mb-1">Trek Leader</label><input type="text" value={form.trekLeader} onChange={e => set('trekLeader', e.target.value)} className={inp} /></div>
                        <div><label className="block text-sm font-medium text-gray-300 mb-1">Emergency Contact</label><input type="text" value={form.emergencyContact} onChange={e => set('emergencyContact', e.target.value)} className={inp} /></div>
                    </div>
                    <div><label className="block text-sm font-medium text-gray-300 mb-1">Instagram Handle <span className="text-gray-500 font-normal">(@username)</span></label><input type="text" value={form.contactInstagram || ''} onChange={e => set('contactInstagram', e.target.value)} className={inp} placeholder="@yourtrek" /></div>

                    {/* Repeatable people-to-contact list */}
                    <div className="rounded-lg border border-gray-700/60 p-3">
                        <div className="flex items-center justify-between mb-1">
                            <label className="block text-sm font-medium text-gray-300">People to contact</label>
                            <button type="button" onClick={addContact} className="flex items-center gap-1 text-xs font-semibold text-[#0ECCEE] hover:underline">
                                <Plus size={13} /> Add contact
                            </button>
                        </div>
                        <p className="text-xs text-gray-500 mb-3">Name, role and phone for each person. Shown as contact cards on the trek page.</p>
                        {(form.contacts || []).length === 0 ? (
                            <p className="text-xs text-gray-600 rounded-lg border border-dashed border-gray-600 px-3 py-2.5">No contacts added yet.</p>
                        ) : (
                            <div className="space-y-3">
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
                                            <input type="text" value={c.role} onChange={e => updateContact(idx, 'role', e.target.value)} className={inp} placeholder="Role (e.g. Trek Lead)" />
                                        </div>
                                        <input type="tel" value={c.phone} onChange={e => updateContact(idx, 'phone', e.target.value)} className={inp} placeholder="Phone (+91 98765 43210)" />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="block text-sm font-medium text-gray-300 mb-1">Fitness Requirements</label><input type="text" value={form.fitnessRequirements} onChange={e => set('fitnessRequirements', e.target.value)} className={inp} /></div>
                        <div><label className="block text-sm font-medium text-gray-300 mb-1">Age Restrictions</label><input type="text" value={form.ageRestrictions} onChange={e => set('ageRestrictions', e.target.value)} className={inp} placeholder="e.g. 18–55 years" /></div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="block text-sm font-medium text-gray-300 mb-1">Registration Fee (₹)</label><input type="number" min="0" value={form.registrationFee} onChange={e => set('registrationFee', e.target.value)} className={inp} /></div>
                        <div><label className="block text-sm font-medium text-gray-300 mb-1">Max Participants</label><input type="number" min="0" value={form.maxParticipants} onChange={e => set('maxParticipants', e.target.value)} className={inp} placeholder="0 = unlimited" /></div>
                    </div>

                    <TrekFilterTagsEditor
                        trekFilters={form.trekFilters || emptyTrekFilters()}
                        difficultyLevel={form.difficultyLevel}
                        registrationFee={form.registrationFee}
                        onChange={(next) => set('trekFilters', next)}
                    />

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Inclusions (one per line)</label>
                        <textarea value={form.inclusions} onChange={e => set('inclusions', e.target.value)} rows={3} className={`${inp} resize-none`} placeholder="Meals&#10;Transport&#10;Guide" />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Exclusions (one per line)</label>
                        <textarea value={form.exclusions} onChange={e => set('exclusions', e.target.value)} rows={2} className={`${inp} resize-none`} placeholder="Personal gear&#10;Insurance" />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Things to Carry (one per line)</label>
                        <textarea value={form.thingsToCarry} onChange={e => set('thingsToCarry', e.target.value)} rows={3} className={`${inp} resize-none`} placeholder="Trekking shoes&#10;Water bottle&#10;Raincoat" />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Terms &amp; Conditions <span className="text-gray-500 font-normal">(one point per line)</span></label>
                        <textarea value={form.termsAndConditions || ''} onChange={e => set('termsAndConditions', e.target.value)} rows={5} className={`${inp} resize-none`} placeholder="Participants must be medically fit.&#10;Follow all instructions from the trek leader.&#10;Cancellation refund: 50% if cancelled 7 days before.&#10;Organiser may cancel due to bad weather." />
                    </div>

                    {/* Itinerary */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-sm font-medium text-gray-300">Itinerary</label>
                            <button type="button" onClick={addItineraryDay} className="flex items-center gap-1 text-xs text-[#0ECCEE] hover:opacity-80 transition-opacity">
                                <Plus size={12} /> Add Day
                            </button>
                        </div>
                        {form.itinerary.map((day, idx) => (
                            <div key={idx} className="bg-[#1D1E20] rounded-lg p-3 mb-2 space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-gray-400">Day {day.day}</span>
                                    <button type="button" onClick={() => removeItineraryDay(idx)} className="text-gray-500 hover:text-red-400"><Trash2 size={13} /></button>
                                </div>
                                <input type="text" value={day.title} onChange={e => updateItinerary(idx, 'title', e.target.value)} className={inp} placeholder="Day title" />
                                <textarea value={day.description} onChange={e => updateItinerary(idx, 'description', e.target.value)} rows={2} className={`${inp} resize-none`} placeholder="Description" />
                            </div>
                        ))}
                    </div>

                    <div className="border border-gray-700/60 rounded-xl overflow-hidden">
                        <div className="px-4 py-3 bg-[#1D1E20] border-b border-gray-700/60">
                            <p className="text-sm font-semibold text-white">Cover images</p>
                            <p className="text-xs text-gray-500 mt-0.5">Card layouts and hero banner — separate from gallery</p>
                        </div>
                        <div className="p-4">
                            <MultiCoverImagesUpload
                                value={form.coverImages}
                                onChange={(coverImages) => {
                                    set('coverImages', coverImages);
                                    set('coverImage', primaryCoverUrl(coverImages, form.coverImage));
                                }}
                                onError={(msg) => setError(`Cover upload failed: ${msg}`)}
                                onUploadingChange={setUploadingCover}
                                hint="Upload a cropped image per layout (portrait cards, wide cards, hero, etc.)."
                            />
                        </div>
                    </div>

                    <div className="border border-gray-700/60 rounded-xl overflow-hidden">
                        <div className="px-4 py-3 bg-[#1D1E20] border-b border-gray-700/60">
                            <p className="text-sm font-semibold text-white">Gallery</p>
                            <p className="text-xs text-gray-500 mt-0.5">Extra photos for the trek detail carousel — not cover images</p>
                        </div>
                        <div className="p-4">
                            <GalleryImagesUploadField
                                value={form.images}
                                onChange={(images) => set('images', images)}
                                onError={(msg) => setError(`Gallery upload failed: ${msg}`)}
                                onUploadingChange={setUploading}
                                uploadLabel="Upload gallery images"
                            />
                        </div>
                    </div>

                    {/* ── Registration / Booking Form (status + type like fests) ── */}
                    <div className="border border-[#0ECCEE]/20 rounded-xl overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-3 bg-[#0ECCEE]/5 border-b border-[#0ECCEE]/15">
                            <div>
                                <p className="text-sm font-bold text-[#0ECCEE]">📋 Booking Form (3-Step)</p>
                                <p className="text-[10px] text-gray-500 mt-0.5">Step 1: Date/Time/People · Step 2: Personal Details · Step 3: Payment</p>
                            </div>
                            <span className="text-[10px] text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">Platform fee applies</span>
                        </div>

                        <div className="p-4 space-y-4">
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
                                        <option value="closed">Closed</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-400 mb-1">Registration Type</label>
                                    <select
                                        value={form.registration?.mode || 'internal_form'}
                                        onChange={e => set('registration', { ...form.registration, mode: e.target.value })}
                                        className={inp}
                                    >
                                        <option value="internal_form">Internal Form (in-app booking + payment)</option>
                                        <option value="external_link">External Link</option>
                                    </select>
                                </div>
                            </div>

                            {(form.registration?.mode || 'internal_form') === 'external_link' ? (
                                <div>
                                    <label className="block text-xs font-medium text-gray-400 mb-1">External Link</label>
                                    <input type="url" value={form.registrationLink || ''}
                                        onChange={e => set('registrationLink', e.target.value)}
                                        className={inp} placeholder="WhatsApp / website / form link — https://..." />
                                    <p className="text-[10px] text-gray-600 mt-1">The “Book Now” button opens this link in a new tab (WhatsApp, website, Google Form, anything).</p>
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
                                                    {['text','email','tel','number','textarea','select','file','date'].map(t=><option key={t} value={t}>{t}</option>)}
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
                                        {field.type==='select' && (
                                            <input type="text" value={(field.options||[]).join(', ')} placeholder="Options: A, B, C"
                                                onChange={e=>{const u=[...(form.registration?.formSchema||[])];u[idx]={...field,options:e.target.value.split(',').map(s=>s.trim()).filter(Boolean)};set('registration',{...form.registration,formSchema:u});}}
                                                className="w-full bg-[#111213] border border-gray-600 rounded px-2 py-1.5 text-white text-xs focus:outline-none focus:border-[#0ECCEE]"
                                            />
                                        )}
                                    </div>
                                ))}
                                <button type="button"
                                    onClick={() => { const f=form.registration?.formSchema||[]; set('registration',{...form.registration,formSchema:[...f,{id:`f_${Date.now()}`,label:'',fieldName:'',type:'text',required:false,options:[],placeholder:''}]}); }}
                                    className="w-full py-2 border border-dashed border-gray-600 hover:border-[#0ECCEE] rounded-lg text-xs text-gray-500 hover:text-[#0ECCEE] transition-colors">
                                    + Add Extra Field
                                </button>
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
                        </div>
                    </div>

                    <p className="text-[11px] text-gray-600 px-1">
                        Treks page sections, order &amp; home carousel → <span className="text-gray-500">Home &amp; Sections → Treks</span>
                    </p>

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

                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors">Cancel</button>
                        <button type="submit" disabled={saving || uploading || uploadingCover} className="flex-1 px-4 py-2.5 bg-[#0ECCEE] hover:bg-[#0ECCEE]/80 text-black rounded-lg text-sm font-bold transition-colors disabled:opacity-50">
                            {saving ? 'Saving...' : trek ? 'Update Trek' : 'Create Trek'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
