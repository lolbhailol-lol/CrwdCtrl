import { useState, useEffect } from 'react';
import { X, Upload, Plus, Trash2, ImagePlus } from 'lucide-react';
import {
    TREK_FILTER_SECTIONS,
    emptyTrekFilters,
    getBudgetTier,
    DIFFICULTY_LEVEL_FILTER_OPTIONS,
} from '../../constants/trekFilters';
import { adminFetch, adminFetchJSON } from '../../utils/adminApi';

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
    emergencyContact: '', contactInstagram: '', registrationFee: 0, registrationLink: '', maxParticipants: 0,
    trekDate: '', city: '', trekCategory: '', status: 'published',
    registration: { googleSheetsUrl: '', organizerEmail: '', formInstructions: '', availableDates: [], timeSlots: [], locationOptions: [], maxPeoplePerBooking: 10, formSchema: [] },
    inclusions: '', exclusions: '', thingsToCarry: '', termsAndConditions: '',
    itinerary: [],
    coverImage: '',
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
            setForm({
                ...EMPTY,
                ...trek,
                communityId: trek.communityId || communityId || null,
                trekDate: trek.trekDate ? new Date(trek.trekDate).toISOString().slice(0, 10) : '',
                inclusions: Array.isArray(trek.inclusions) ? trek.inclusions.join('\n') : (trek.inclusions || ''),
                exclusions: Array.isArray(trek.exclusions) ? trek.exclusions.join('\n') : (trek.exclusions || ''),
                thingsToCarry: Array.isArray(trek.thingsToCarry) ? trek.thingsToCarry.join('\n') : (trek.thingsToCarry || ''),
                termsAndConditions: Array.isArray(trek.termsAndConditions) ? trek.termsAndConditions.join('\n') : (trek.termsAndConditions || ''),
                itinerary: trek.itinerary || [],
                coverImage: trek.coverImage || '',
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

    const handleImageUpload = async (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;
        setUploading(true);
        try {
            const fd = new FormData();
            files.forEach(f => fd.append('images', f));
            const res = await adminFetch('/admin/upload/images', { method: 'POST', body: fd });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || data.error || 'Upload failed');
            const urls = (data.urls || data.imageUrls || []).map(u => u?.url || u).filter(Boolean);
            set('images', [...form.images, ...urls]);
        } catch (err) {
            setError(`Upload failed: ${err.message}`);
        } finally {
            setUploading(false);
            e.target.value = '';
        }
    };

    const handleCoverUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadingCover(true);
        try {
            const fd = new FormData();
            fd.append('images', file);
            const res = await adminFetch('/admin/upload/images', { method: 'POST', body: fd });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || data.error || 'Upload failed');
            const urlObj = (data.urls || data.imageUrls || [])[0];
            const url = urlObj?.url || urlObj;
            if (url) set('coverImage', url);
        } catch (err) {
            setError(`Cover upload failed: ${err.message}`);
        } finally {
            setUploadingCover(false);
            e.target.value = '';
        }
    };

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
        setSaving(true);
        try {
            const payload = {
                ...form,
                communityId: form.communityId || null,
                trekCategory: form.trekCategory || null,
                coverImage: form.coverImage || null,
                inclusions: form.inclusions ? form.inclusions.split('\n').map(s => s.trim()).filter(Boolean) : [],
                exclusions: form.exclusions ? form.exclusions.split('\n').map(s => s.trim()).filter(Boolean) : [],
                thingsToCarry: form.thingsToCarry ? form.thingsToCarry.split('\n').map(s => s.trim()).filter(Boolean) : [],
                termsAndConditions: form.termsAndConditions ? form.termsAndConditions.split('\n').map(s => s.trim()).filter(Boolean) : [],
                registrationFee: Number(form.registrationFee) || 0,
                maxParticipants: Number(form.maxParticipants) || 0,
                trekDate: form.trekDate || null,
                trekFilters: form.trekFilters || emptyTrekFilters(),
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

                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="block text-sm font-medium text-gray-300 mb-1">City</label><input type="text" value={form.city} onChange={e => set('city', e.target.value)} className={inp} placeholder="Nearest city" /></div>
                        <div><label className="block text-sm font-medium text-gray-300 mb-1">Trek Date</label><input type="date" value={form.trekDate} onChange={e => set('trekDate', e.target.value)} className={inp} /></div>
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

                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="block text-sm font-medium text-gray-300 mb-1">Fitness Requirements</label><input type="text" value={form.fitnessRequirements} onChange={e => set('fitnessRequirements', e.target.value)} className={inp} /></div>
                        <div><label className="block text-sm font-medium text-gray-300 mb-1">Age Restrictions</label><input type="text" value={form.ageRestrictions} onChange={e => set('ageRestrictions', e.target.value)} className={inp} placeholder="e.g. 18–55 years" /></div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="block text-sm font-medium text-gray-300 mb-1">Registration Fee (₹)</label><input type="number" min="0" value={form.registrationFee} onChange={e => set('registrationFee', e.target.value)} className={inp} /></div>
                        <div><label className="block text-sm font-medium text-gray-300 mb-1">Max Participants</label><input type="number" min="0" value={form.maxParticipants} onChange={e => set('maxParticipants', e.target.value)} className={inp} placeholder="0 = unlimited" /></div>
                    </div>

                    <div><label className="block text-sm font-medium text-gray-300 mb-1">Registration Link</label><input type="url" value={form.registrationLink} onChange={e => set('registrationLink', e.target.value)} className={inp} placeholder="https://..." /></div>

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

                    {/* Cover Image */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Cover Image <span className="text-gray-500 font-normal text-xs">(shown on cards and hero banners)</span></label>
                        <div className="flex items-start gap-4">
                            {form.coverImage ? (
                                <div className="relative w-32 h-20 shrink-0">
                                    <img src={form.coverImage} alt="Cover" className="w-full h-full object-cover rounded-lg border border-gray-600" />
                                    <button type="button" onClick={() => set('coverImage', '')} className="absolute -top-1.5 -right-1.5 bg-red-600 rounded-full p-0.5 hover:bg-red-700"><X size={10} /></button>
                                </div>
                            ) : null}
                            <label className="flex items-center gap-2 cursor-pointer bg-[#1D1E20] border border-dashed border-gray-500 hover:border-[#0ECCEE] rounded-lg px-4 py-2 text-sm text-gray-400 transition-colors h-20">
                                {uploadingCover
                                    ? <span className="text-[#0ECCEE]">Uploading...</span>
                                    : <><ImagePlus size={16} /><span>{form.coverImage ? 'Replace cover' : 'Upload cover image'}</span></>}
                                <input type="file" accept="image/*" onChange={handleCoverUpload} disabled={uploadingCover} className="hidden" />
                            </label>
                        </div>
                    </div>

                    {/* Gallery Images */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Gallery Images <span className="text-gray-500 font-normal text-xs">(trek detail page image carousel)</span></label>
                        {form.images.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-2">
                                {form.images.map((url, i) => (
                                    <div key={i} className="relative w-20 h-20">
                                        <img src={url} alt="" className="w-full h-full object-cover rounded-lg border border-gray-600" />
                                        <button type="button" onClick={() => set('images', form.images.filter((_, j) => j !== i))} className="absolute -top-1.5 -right-1.5 bg-red-600 rounded-full p-0.5 hover:bg-red-700"><X size={10} /></button>
                                    </div>
                                ))}
                            </div>
                        )}
                        <label className="flex items-center gap-2 cursor-pointer w-fit bg-[#1D1E20] border border-dashed border-gray-500 hover:border-[#0ECCEE] rounded-lg px-4 py-2 text-sm text-gray-400 transition-colors">
                            {uploading ? <span className="text-[#0ECCEE]">Uploading...</span> : <><Upload size={14} /><span>Upload images</span></>}
                            <input type="file" accept="image/*" multiple onChange={handleImageUpload} disabled={uploading} className="hidden" />
                        </label>
                    </div>

                    {/* ── Registration / Booking Form ── */}
                    <div className="border border-[#0ECCEE]/20 rounded-xl overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-3 bg-[#0ECCEE]/5 border-b border-[#0ECCEE]/15">
                            <div>
                                <p className="text-sm font-bold text-[#0ECCEE]">📋 Booking Form (3-Step)</p>
                                <p className="text-[10px] text-gray-500 mt-0.5">Step 1: Date/Time/People · Step 2: Personal Details · Step 3: Payment</p>
                            </div>
                            <span className="text-[10px] text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">3% platform fee applies</span>
                        </div>

                        <div className="p-4 space-y-4">
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
                        <button type="submit" disabled={saving || uploading} className="flex-1 px-4 py-2.5 bg-[#0ECCEE] hover:bg-[#0ECCEE]/80 text-black rounded-lg text-sm font-bold transition-colors disabled:opacity-50">
                            {saving ? 'Saving...' : trek ? 'Update Trek' : 'Create Trek'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
