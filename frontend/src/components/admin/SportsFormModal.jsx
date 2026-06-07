import { useState, useEffect } from 'react';
import { X, ImagePlus } from 'lucide-react';
import { deriveFeaturedSection, normalizeSportsSections } from '../../constants/sportsPage';
import { getBrowseCategoryForSportType, SPORTS_BROWSE_CATEGORIES } from '../../constants/sportsBrowseCategories';
import { normalizeImageList, parseUploadedUrls } from '../../utils/uploadUrls';

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

const SPORT_TYPES = [
    { value: 'run_club', label: 'Run Club', browse: 'Run Clubs' },
    { value: 'football', label: 'Football', browse: 'Sport Clubs' },
    { value: 'cricket', label: 'Cricket', browse: 'Sport Clubs' },
    { value: 'badminton', label: 'Badminton', browse: 'Sport Clubs' },
    { value: 'marathon', label: 'Marathon', browse: 'Marathon' },
    { value: 'gymkhana', label: 'Gymkhana', browse: 'Sport Clubs' },
    { value: 'other', label: 'Other', browse: 'Others' },
];

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
    images: [],
    sponsors: '',
    registrationLink: '',
    description: '',
    showInUpcoming: true,
    showInRunClubs: false,
    upcomingPriority: 999,
    runClubPriority: 999,
    showOnSportsPage: true,
    status: 'published',
    runClubId: null,
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

export default function SportsFormModal({ event, runClubId, onClose, onSaved }) {
    const [form, setForm] = useState(EMPTY);
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (event) {
            const normalized = normalizeSportsSections(event);
            setForm({
                ...EMPTY,
                ...normalized,
                eventDate: event.eventDate ? new Date(event.eventDate).toISOString().slice(0, 10) : '',
                sponsors: Array.isArray(event.sponsors) ? event.sponsors.join(', ') : (event.sponsors || ''),
                images: normalizeImageList(event.images || []),
                displayType: event.displayType || '',
                upcomingPriority: normalized.upcomingPriority ?? 999,
                runClubPriority: normalized.runClubPriority ?? 999,
                showInUpcoming: normalized.showInUpcoming !== false,
                showInRunClubs: normalized.showInRunClubs !== false,
                showOnSportsPage: event.showOnSportsPage !== false,
                runClubId: event.runClubId || runClubId || null,
            });
        } else {
            setForm({ ...EMPTY, runClubId: runClubId || null, showInUpcoming: true, showInRunClubs: false });
        }
    }, [event, runClubId]);

    useEffect(() => {
        if (form.sportType === 'run_club' && !event) {
            setForm((f) => ({ ...f, showInRunClubs: true }));
        }
        if (form.sportType && form.sportType !== 'run_club') {
            setForm((f) => (f.showInRunClubs ? { ...f, showInRunClubs: false } : f));
        }
    }, [form.sportType, event]);

    const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

    const selectedSport = SPORT_TYPES.find((s) => s.value === form.sportType);

    const handleImageUpload = async (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;
        setUploading(true);
        setError('');
        try {
            const token = localStorage.getItem('admin_token');
            const fd = new FormData();
            files.forEach((f) => fd.append('images', f));
            const res = await fetch(`${API}/admin/upload/images`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: fd,
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || data.error || 'Upload failed');
            const urls = parseUploadedUrls(data);
            if (!urls.length) throw new Error('Upload succeeded but no image URL was returned');
            setForm((f) => ({ ...f, images: [...normalizeImageList(f.images), ...urls] }));
        } catch (err) {
            setError(`Upload failed: ${err.message}`);
        } finally {
            setUploading(false);
            e.target.value = '';
        }
    };

    const applyPlacementPreset = (preset) => {
        const isRunClub = form.sportType === 'run_club';
        if (preset === 'upcoming') {
            setForm((f) => ({ ...f, showOnSportsPage: true, showInUpcoming: true, showInRunClubs: false }));
        } else if (preset === 'run_clubs') {
            setForm((f) => ({
                ...f,
                showOnSportsPage: true,
                showInUpcoming: false,
                showInRunClubs: isRunClub,
            }));
        } else if (preset === 'both') {
            setForm((f) => ({
                ...f,
                showOnSportsPage: true,
                showInUpcoming: true,
                showInRunClubs: isRunClub,
            }));
        } else if (preset === 'hidden') {
            setForm((f) => ({ ...f, showOnSportsPage: false, showInUpcoming: false, showInRunClubs: false }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (!form.title.trim() || !form.sportType) {
            setError('Title and Sport Type are required.');
            return;
        }
        setSaving(true);
        try {
            const token = localStorage.getItem('admin_token');
            const showInUpcoming = form.showOnSportsPage && form.showInUpcoming;
            const showInRunClubs = !form.runClubId && form.showOnSportsPage && form.sportType === 'run_club' && form.showInRunClubs;
            const payload = {
                ...form,
                runClubId: form.runClubId || runClubId || null,
                sponsors: form.sponsors ? form.sponsors.split(',').map((s) => s.trim()).filter(Boolean) : [],
                registrationFee: Number(form.registrationFee) || 0,
                maxParticipants: Number(form.maxParticipants) || 0,
                upcomingPriority: Number(form.upcomingPriority) || 999,
                runClubPriority: Number(form.runClubPriority) || 999,
                priority: Number(form.upcomingPriority) || 999,
                eventDate: form.eventDate || null,
                displayType: form.displayType?.trim() || '',
                images: normalizeImageList(form.images),
                showInUpcoming,
                showInRunClubs,
                featuredSection: deriveFeaturedSection({ showInUpcoming, showInRunClubs }),
            };
            const url = event ? `${API}/admin/sports/${event._id}` : `${API}/admin/sports`;
            const method = event ? 'PUT' : 'POST';
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Save failed');
            localStorage.setItem('admin_data_updated', Date.now().toString());
            setTimeout(() => localStorage.removeItem('admin_data_updated'), 1000);
            onSaved(data.event);
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const Field = ({ label, required, children, hint }) => (
        <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
                {label}
                {required && <span className="text-red-400 ml-1">*</span>}
            </label>
            {hint && <p className="text-[10px] text-gray-600 mb-1.5">{hint}</p>}
            {children}
        </div>
    );

    const inp = 'w-full bg-[#1D1E20] border border-gray-600 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#0ECCEE]';

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 py-8 px-4">
            <div className="w-full max-w-3xl bg-[#111213] rounded-xl border border-gray-700 shadow-2xl">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 sticky top-0 bg-[#111213] z-10">
                    <div>
                        <h2 className="text-lg font-bold text-white">
                            {event ? 'Edit Sports Event' : runClubId ? 'Add Event to Run Club' : 'Create Sports Event'}
                        </h2>
                        <p className="text-xs text-gray-500 mt-0.5">All fields map to the Sports category page (/sports)</p>
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

                    <SectionBlock title="Basic Info" hint="Shown as card title and type on the Sports page">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field label="Title" required>
                                <input type="text" value={form.title} onChange={(e) => set('title', e.target.value)} className={inp} placeholder="e.g. Sunday Morning Run" />
                            </Field>
                            <Field label="Sport Type" required hint="Also picks the Browse by Categories icon on /sports">
                                <select value={form.sportType} onChange={(e) => set('sportType', e.target.value)} className={inp}>
                                    <option value="">Select...</option>
                                    {SPORT_TYPES.map((s) => (
                                        <option key={s.value} value={s.value}>
                                            {s.label} · {s.browse}
                                        </option>
                                    ))}
                                </select>
                            </Field>
                        </div>
                        <div>
                            <p className="text-xs font-medium text-gray-400 mb-2">Browse by Categories (on /sports)</p>
                            <div className="flex flex-wrap gap-4">
                                {SPORTS_BROWSE_CATEGORIES.map((cat) => {
                                    const selected = getBrowseCategoryForSportType(form.sportType)?.id === cat.id;
                                    return (
                                        <div
                                            key={cat.id}
                                            className={`flex flex-col items-center w-[72px] ${selected ? 'opacity-100' : 'opacity-50'}`}
                                        >
                                            <div
                                                className={`size-16 rounded-full overflow-hidden bg-slate-100 ${
                                                    selected ? 'ring-2 ring-[#0ECCEE] ring-offset-2 ring-offset-[#111213]' : ''
                                                }`}
                                            >
                                                <img src={cat.image} alt={cat.label} className="w-full h-full object-cover" />
                                            </div>
                                            <span className={`mt-1.5 text-[11px] font-medium text-center ${selected ? 'text-[#0ECCEE]' : 'text-gray-400'}`}>
                                                {cat.label}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        <Field
                            label="Display Type (card subtitle)"
                            hint='Optional. Overrides the default type label on cards (e.g. "cultural", "marathon"). Leave blank to use sport type.'
                        >
                            <input type="text" value={form.displayType} onChange={(e) => set('displayType', e.target.value)} className={inp} placeholder={selectedSport?.label || 'e.g. Run Club'} />
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
                        <Field label="Registration Link" hint="Opens when user taps the activity card">
                            <input type="url" value={form.registrationLink} onChange={(e) => set('registrationLink', e.target.value)} className={inp} placeholder="https://..." />
                        </Field>
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

                    <SectionBlock title="Images" hint="First image is used on Upcoming Activities and Run Club cards (320×224)">
                        {form.images.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {form.images.map((url, i) => (
                                    <div key={i} className="relative w-24 h-24">
                                        <img src={url} alt="" className="w-full h-full object-cover rounded-lg border border-gray-600" />
                                        {i === 0 && (
                                            <span className="absolute bottom-1 left-1 text-[9px] bg-[#0ECCEE] text-black px-1 rounded font-bold">Cover</span>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => set('images', form.images.filter((_, j) => j !== i))}
                                            className="absolute -top-1.5 -right-1.5 bg-red-600 rounded-full p-0.5 hover:bg-red-700"
                                        >
                                            <X size={10} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                        <label className="flex items-center gap-2 cursor-pointer w-fit bg-[#1D1E20] border border-dashed border-gray-500 hover:border-[#0ECCEE] rounded-lg px-4 py-2 text-sm text-gray-400 transition-colors">
                            {uploading ? (
                                <span className="text-[#0ECCEE]">Uploading...</span>
                            ) : (
                                <>
                                    <ImagePlus size={14} />
                                    <span>Upload images</span>
                                </>
                            )}
                            <input type="file" accept="image/*" multiple onChange={handleImageUpload} disabled={uploading} className="hidden" />
                        </label>
                    </SectionBlock>

                    <SectionBlock
                        title="Where on /sports?"
                        hint={
                            form.runClubId
                                ? 'This event belongs to a run club and appears under Upcoming Activities when enabled.'
                                : 'Upcoming Activities and Explore Run Clubs are managed separately. Browse by Categories uses Sport Type automatically.'
                        }
                    >
                        {!form.runClubId ? (
                        <>
                        <div className="flex flex-wrap gap-2">
                            {[
                                { id: 'upcoming', label: 'Upcoming only' },
                                { id: 'run_clubs', label: 'Run Club only' },
                                { id: 'both', label: 'Both sections' },
                                { id: 'hidden', label: 'Hidden from page' },
                            ].map((preset) => (
                                <button
                                    key={preset.id}
                                    type="button"
                                    onClick={() => applyPlacementPreset(preset.id)}
                                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-600 text-gray-300 hover:border-[#0ECCEE] hover:text-[#0ECCEE] transition-colors"
                                >
                                    {preset.label}
                                </button>
                            ))}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div
                                className={`rounded-xl border p-4 transition-colors ${
                                    form.showInUpcoming && form.showOnSportsPage
                                        ? 'border-[#0ECCEE] bg-[#0ECCEE]/5'
                                        : 'border-gray-600 bg-[#1D1E20]'
                                }`}
                            >
                                <label className="flex items-start gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={form.showInUpcoming && form.showOnSportsPage}
                                        onChange={(e) => set('showInUpcoming', e.target.checked)}
                                        disabled={!form.showOnSportsPage}
                                        className="accent-[#0ECCEE] mt-1"
                                    />
                                    <div className="flex-1">
                                        <p className="text-sm font-semibold text-white">Upcoming Activities</p>
                                        <p className="text-[10px] text-gray-500 mt-0.5">Center carousel · events, marathons, fests mix</p>
                                    </div>
                                </label>
                                {form.showInUpcoming && form.showOnSportsPage && (
                                    <div className="mt-3 pt-3 border-t border-white/10">
                                        <label className="block text-[11px] text-gray-400 mb-1">Display priority (1 = first)</label>
                                        <input
                                            type="number"
                                            min="1"
                                            max="999"
                                            value={form.upcomingPriority}
                                            onChange={(e) => set('upcomingPriority', e.target.value)}
                                            className={inp}
                                        />
                                    </div>
                                )}
                            </div>

                            <div
                                className={`rounded-xl border p-4 transition-colors ${
                                    form.sportType !== 'run_club'
                                        ? 'border-gray-700 bg-[#151617] opacity-60'
                                        : form.showInRunClubs && form.showOnSportsPage
                                          ? 'border-[#0ECCEE] bg-[#0ECCEE]/5'
                                          : 'border-gray-600 bg-[#1D1E20]'
                                }`}
                            >
                                <label className="flex items-start gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={form.showInRunClubs && form.showOnSportsPage}
                                        onChange={(e) => set('showInRunClubs', e.target.checked)}
                                        disabled={!form.showOnSportsPage || form.sportType !== 'run_club'}
                                        className="accent-[#0ECCEE] mt-1"
                                    />
                                    <div className="flex-1">
                                        <p className="text-sm font-semibold text-white">Explore Run Clubs</p>
                                        <p className="text-[10px] text-gray-500 mt-0.5">
                                            {form.sportType === 'run_club'
                                                ? 'Horizontal scroll · city & organizer shown'
                                                : 'Set Sport Type to Run Club to enable'}
                                        </p>
                                    </div>
                                </label>
                                {form.sportType === 'run_club' && form.showInRunClubs && form.showOnSportsPage && (
                                    <div className="mt-3 pt-3 border-t border-white/10">
                                        <label className="block text-[11px] text-gray-400 mb-1">Display priority (1 = first)</label>
                                        <input
                                            type="number"
                                            min="1"
                                            max="999"
                                            value={form.runClubPriority}
                                            onChange={(e) => set('runClubPriority', e.target.value)}
                                            className={inp}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                        </>
                        ) : (
                            <div
                                className={`rounded-xl border p-4 transition-colors ${
                                    form.showInUpcoming && form.showOnSportsPage
                                        ? 'border-[#0ECCEE] bg-[#0ECCEE]/5'
                                        : 'border-gray-600 bg-[#1D1E20]'
                                }`}
                            >
                                <label className="flex items-start gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={form.showInUpcoming && form.showOnSportsPage}
                                        onChange={(e) => set('showInUpcoming', e.target.checked)}
                                        disabled={!form.showOnSportsPage}
                                        className="accent-[#0ECCEE] mt-1"
                                    />
                                    <div className="flex-1">
                                        <p className="text-sm font-semibold text-white">Show in Upcoming Activities</p>
                                        <p className="text-[10px] text-gray-500 mt-0.5">Runs, sessions & events for this club</p>
                                    </div>
                                </label>
                                {form.showInUpcoming && form.showOnSportsPage && (
                                    <div className="mt-3 pt-3 border-t border-white/10">
                                        <label className="block text-[11px] text-gray-400 mb-1">Display priority (1 = first)</label>
                                        <input
                                            type="number"
                                            min="1"
                                            max="999"
                                            value={form.upcomingPriority}
                                            onChange={(e) => set('upcomingPriority', e.target.value)}
                                            className={inp}
                                        />
                                    </div>
                                )}
                            </div>
                        )}

                        <label className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer ${form.showOnSportsPage ? 'border-[#0ECCEE] bg-[#0ECCEE]/5' : 'border-gray-600 bg-[#1D1E20]'}`}>
                            <div>
                                <p className="text-sm font-medium text-gray-200">Visible on Sports Page</p>
                                <p className="text-[10px] text-gray-500 mt-0.5">Turn off to hide from /sports while keeping the record</p>
                            </div>
                            <input
                                type="checkbox"
                                checked={form.showOnSportsPage}
                                onChange={(e) => set('showOnSportsPage', e.target.checked)}
                                className="accent-[#0ECCEE] w-4 h-4"
                            />
                        </label>
                    </SectionBlock>

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
                        <button type="submit" disabled={saving || uploading} className="flex-1 px-4 py-2.5 bg-[#0ECCEE] hover:bg-[#0ECCEE]/80 text-black rounded-lg text-sm font-bold transition-colors disabled:opacity-50">
                            {saving ? 'Saving...' : event ? 'Update Event' : 'Create Event'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
