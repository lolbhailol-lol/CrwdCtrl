import { useState, useEffect } from 'react';
import { X, ImagePlus } from 'lucide-react';
import { RUN_CATEGORY_OPTIONS } from '../../constants/runClubCategories';
import { normalizeImageList, parseUploadedUrls } from '../../utils/uploadUrls';

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

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
    status: 'published',
    runClubId: null,
    runCategory: '',
    distance: '',
    inclusions: '',
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

export default function SportsFormModal({ event, runClubId, clubName, onClose, onSaved }) {
    const [form, setForm] = useState(EMPTY);
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [parentRunCategories, setParentRunCategories] = useState([]);

    useEffect(() => {
        if (event) {
            setForm({
                ...EMPTY,
                ...event,
                sportType: 'run_club',
                eventDate: event.eventDate ? new Date(event.eventDate).toISOString().slice(0, 10) : '',
                sponsors: Array.isArray(event.sponsors) ? event.sponsors.join(', ') : (event.sponsors || ''),
                images: normalizeImageList(event.images || []),
                displayType: event.displayType || '',
                runClubId: event.runClubId || runClubId || null,
                runCategory: event.runCategory || '',
                distance: event.distance || '',
                inclusions: Array.isArray(event.inclusions) ? event.inclusions.join(', ') : '',
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
        const token = localStorage.getItem('admin_token');
        fetch(`${API}/admin/run-clubs/${clubId}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
            .then((res) => res.json())
            .then((data) => {
                const cats = Array.isArray(data?.club?.runCategories) ? data.club.runCategories : [];
                setParentRunCategories(cats.length ? cats : RUN_CATEGORY_OPTIONS);
            })
            .catch(() => setParentRunCategories(RUN_CATEGORY_OPTIONS));
    }, [form.runClubId, runClubId]);

    const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

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
        setSaving(true);
        try {
            const token = localStorage.getItem('admin_token');
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
                images: normalizeImageList(form.images),
                sponsors: form.sponsors ? form.sponsors.split(',').map((s) => s.trim()).filter(Boolean) : [],
                registrationLink: form.registrationLink?.trim() || '',
                description: form.description?.trim() || '',
                runCategory: form.runCategory?.trim() || '',
                distance: form.distance?.trim() || '',
                inclusions: form.inclusions
                    ? form.inclusions.split(',').map((s) => s.trim()).filter(Boolean)
                    : [],
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
                        <Field label="Registration Link" hint="Opens when user taps the activity card">
                            <input type="url" value={form.registrationLink} onChange={(e) => set('registrationLink', e.target.value)} className={inp} placeholder="https://..." />
                        </Field>
                    </SectionBlock>

                    <SectionBlock
                        title="Run detail page"
                        hint="Shown on /sports/run/:id — matches trek detail layout"
                    >
                        <Field label="Distance" hint='e.g. "3k-5k Runs"'>
                            <input type="text" value={form.distance} onChange={(e) => set('distance', e.target.value)} className={inp} placeholder="e.g. 3k-5k Runs" />
                        </Field>
                        <Field label="Experience Included" hint="Comma-separated — Breakfast, Games">
                            <input type="text" value={form.inclusions} onChange={(e) => set('inclusions', e.target.value)} className={inp} placeholder="Breakfast, Games" />
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
                        <button type="submit" disabled={saving || uploading} className="flex-1 px-4 py-2.5 bg-[#0ECCEE] hover:bg-[#0ECCEE]/80 text-black rounded-lg text-sm font-bold transition-colors disabled:opacity-50">
                            {saving ? 'Saving...' : event ? 'Update Run' : 'Add Run'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
