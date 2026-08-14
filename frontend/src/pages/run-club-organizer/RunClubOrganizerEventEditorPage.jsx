import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader, Plus, Trash2, Upload } from 'lucide-react';
import {
    createRunClubOrganizerEvent,
    fetchRunClubOrganizerEvent,
    publishRunClubOrganizerEvent,
    updateRunClubOrganizerEvent,
    uploadRunClubOrganizerImage,
} from '../../services/api/runClubOrganizer.api';
import { getRunClubOrganizerSession, setRunClubOrganizerSession } from '../../utils/runClubOrganizerSession';
import { sportRunPath } from '../../utils/slugRoutes';
import TrekDetailBoxesEditor from '../../components/admin/TrekDetailBoxesEditor';
import MultiContactListField from '../../components/admin/MultiContactListField';
import SelectFieldOptionsEditor from '../../components/admin/SelectFieldOptionsEditor';
import {
    normalizeRunDetailBoxes,
    sanitizeDetailBoxesPayload,
    RUN_DETAIL_BOX_PRESETS,
} from '../../utils/trekDetailBoxes';
import { contactsFromEvent, contactsToPayload } from '../../utils/runContacts';

const FIELD_TYPES = [
    { value: 'text', label: 'Text' },
    { value: 'email', label: 'Email' },
    { value: 'tel', label: 'Phone' },
    { value: 'number', label: 'Number' },
    { value: 'textarea', label: 'Long text' },
    { value: 'select', label: 'Dropdown' },
    { value: 'date', label: 'Date' },
];

const emptyForm = () => ({
    title: '',
    venue: '',
    city: '',
    routeMap: '',
    eventDate: '',
    reportingTime: '',
    distance: '',
    coverImage: '',
    description: '',
    maxParticipants: '',
    meetingPoint: '',
    fitnessLevel: '',
    returnTime: '',
    ageLimit: '',
    detailBoxes: [],
    contactPhones: [''],
    contactInstagrams: [''],
    runCategory: '',
    status: 'draft',
    registration: {
        status: 'open',
        mode: 'internal_form',
        formInstructions: '',
        availableDates: [],
        timeSlots: [],
        maxPeoplePerBooking: 10,
        formSchema: [],
    },
});

function toDateInput(value) {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
}

function eventToForm(event) {
    return {
        title: event.title || '',
        venue: event.venue || '',
        city: event.city || '',
        routeMap: event.routeMap || '',
        eventDate: toDateInput(event.eventDate),
        reportingTime: event.reportingTime || '',
        distance: event.distance || '',
        coverImage: event.coverImage || '',
        description: event.description || '',
        maxParticipants: event.maxParticipants ? String(event.maxParticipants) : '',
        meetingPoint: event.meetingPoint || '',
        fitnessLevel: event.fitnessLevel || '',
        returnTime: event.returnTime || '',
        ageLimit: event.ageLimit || '',
        detailBoxes: normalizeRunDetailBoxes(event.detailBoxes, event),
        ...(() => {
            const c = contactsFromEvent(event);
            return {
                contactPhones: c.contactPhones.length ? c.contactPhones : [''],
                contactInstagrams: c.contactInstagrams.length ? c.contactInstagrams : [''],
            };
        })(),
        runCategory: event.runCategory || '',
        status: event.status || 'draft',
        registration: {
            status: event.registration?.status || 'open',
            mode: 'internal_form',
            formInstructions: event.registration?.formInstructions || '',
            availableDates: event.registration?.availableDates || [],
            timeSlots: event.registration?.timeSlots || [],
            maxPeoplePerBooking: event.registration?.maxPeoplePerBooking || 10,
            formSchema: Array.isArray(event.registration?.formSchema)
                ? event.registration.formSchema
                : [],
        },
    };
}

function formToPayload(form) {
    return {
        title: form.title.trim(),
        venue: form.venue.trim(),
        city: form.city.trim(),
        routeMap: form.routeMap.trim(),
        eventDate: form.eventDate || null,
        reportingTime: form.reportingTime.trim(),
        distance: form.distance.trim(),
        coverImage: form.coverImage.trim(),
        description: form.description,
        maxParticipants: Number(form.maxParticipants) || 0,
        meetingPoint: form.meetingPoint.trim(),
        fitnessLevel: form.fitnessLevel.trim(),
        returnTime: form.returnTime.trim(),
        ageLimit: form.ageLimit.trim(),
        detailBoxes: sanitizeDetailBoxesPayload(form.detailBoxes),
        ...contactsToPayload(form.contactPhones, form.contactInstagrams),
        runCategory: form.runCategory.trim(),
        registration: {
            ...form.registration,
            mode: 'internal_form',
            formSchema: (form.registration.formSchema || []).map((f) => ({
                ...f,
                fieldName: (f.fieldName || f.label || '')
                    .toLowerCase()
                    .trim()
                    .replace(/[^a-z0-9]+/g, '_')
                    .replace(/^_+|_+$/g, ''),
            })),
        },
    };
}

function syncSessionEvent(event) {
    const session = getRunClubOrganizerSession();
    if (!session || !event?._id) return;
    const events = [...(session.events || [])];
    const idx = events.findIndex((e) => String(e._id) === String(event._id));
    const slim = {
        _id: event._id,
        title: event.title,
        city: event.city,
        venue: event.venue,
        eventDate: event.eventDate,
        status: event.status,
        distance: event.distance,
        coverImage: event.coverImage,
        registration: event.registration,
        registrationFee: 0,
        maxParticipants: event.maxParticipants,
        runClubId: event.runClubId,
        sportType: 'run_club',
    };
    if (idx >= 0) events[idx] = { ...events[idx], ...slim };
    else events.unshift(slim);
    setRunClubOrganizerSession({ ...session, events });
}

export default function RunClubOrganizerEventEditorPage() {
    const { eventId } = useParams();
    const isNew = !eventId || eventId === 'new';
    const navigate = useNavigate();
    const session = getRunClubOrganizerSession();
    const categories = session?.runClub?.runCategories || [];

    const [form, setForm] = useState(emptyForm);
    const [loading, setLoading] = useState(!isNew);
    const [saving, setSaving] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [savedEvent, setSavedEvent] = useState(null);

    useEffect(() => {
        if (isNew) {
            const club = session?.runClub;
            const phone = club?.contactPhone || session?.organizer?.phone || '';
            const insta = club?.contactInstagram || '';
            setForm((prev) => ({
                ...prev,
                city: club?.basedIn || '',
                contactPhones: phone ? [phone] : [''],
                contactInstagrams: insta ? [insta] : [''],
            }));
            return;
        }

        let cancelled = false;
        (async () => {
            setLoading(true);
            setError('');
            try {
                const res = await fetchRunClubOrganizerEvent(eventId);
                if (cancelled) return;
                setSavedEvent(res.event);
                setForm(eventToForm(res.event));
            } catch (e) {
                if (!cancelled) setError(e.message || 'Failed to load run');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [eventId, isNew]);

    const publicUrl = useMemo(() => {
        const event = savedEvent || (form.title ? { _id: eventId, title: form.title } : null);
        if (!event?._id || isNew) return '';
        if (typeof window === 'undefined') return sportRunPath(event);
        return `${window.location.origin}${sportRunPath(event)}`;
    }, [savedEvent, form.title, eventId, isNew]);

    const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
    const setRegistration = (key, value) =>
        setForm((prev) => ({
            ...prev,
            registration: { ...prev.registration, [key]: value },
        }));

    const updateSchemaField = (idx, patch) => {
        const next = [...(form.registration.formSchema || [])];
        next[idx] = { ...next[idx], ...patch };
        setRegistration('formSchema', next);
    };

    const addSchemaField = () => {
        setRegistration('formSchema', [
            ...(form.registration.formSchema || []),
            {
                id: `f_${Date.now()}`,
                label: '',
                fieldName: '',
                type: 'text',
                required: false,
                options: [],
                placeholder: '',
            },
        ]);
    };

    const removeSchemaField = (idx) => {
        setRegistration(
            'formSchema',
            (form.registration.formSchema || []).filter((_, i) => i !== idx),
        );
    };

    const handleCoverUpload = async (file) => {
        if (!file) return;
        setUploading(true);
        setError('');
        try {
            const res = await uploadRunClubOrganizerImage(file);
            setField('coverImage', res.url || '');
            setNotice('Cover image uploaded');
        } catch (e) {
            setError(e.message || 'Image upload failed');
        } finally {
            setUploading(false);
        }
    };

    const save = async ({ andPublish = false } = {}) => {
        if (!form.title.trim()) {
            setError('Title is required');
            return;
        }
        setSaving(true);
        setPublishing(andPublish);
        setError('');
        setNotice('');
        try {
            const payload = formToPayload(form);
            let event;
            if (isNew) {
                const res = await createRunClubOrganizerEvent({
                    ...payload,
                    status: andPublish ? 'published' : 'draft',
                });
                event = res.event;
                syncSessionEvent(event);
                if (andPublish && event.status !== 'published') {
                    const pub = await publishRunClubOrganizerEvent(event._id);
                    event = pub.event;
                    syncSessionEvent(event);
                }
                setNotice(andPublish ? 'Run published — live on the website' : 'Draft saved — click Publish run to show it on the website');
                navigate(`/run-club-organizer/events/${event._id}/edit`, { replace: true });
            } else {
                const res = await updateRunClubOrganizerEvent(eventId, payload);
                event = res.event;
                if (andPublish) {
                    const pub = await publishRunClubOrganizerEvent(eventId);
                    event = pub.event;
                }
                syncSessionEvent(event);
                setSavedEvent(event);
                setForm(eventToForm(event));
                setNotice(andPublish ? 'Run published — live on the website' : 'Draft saved — click Publish run to show it on the website');
            }
        } catch (e) {
            setError(e.message || 'Save failed');
        } finally {
            setSaving(false);
            setPublishing(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center py-20">
                <Loader className="animate-spin text-[#0ECCEE]" />
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-3xl">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <Link
                        to={isNew ? '/run-club-organizer' : `/run-club-organizer/events/${eventId}`}
                        className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white mb-2"
                    >
                        <ArrowLeft size={14} /> Back
                    </Link>
                    <h1 className="text-2xl font-bold">{isNew ? 'Create run' : 'Edit run'}</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Free registration only — guests fill your form, no payment on CrwdCtrl.
                    </p>
                </div>
            </div>

            {error ? <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div> : null}
            {notice ? <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">{notice}</div> : null}

            <section className="rounded-2xl border border-gray-800 bg-[#161718] p-4 sm:p-5 space-y-4">
                <h2 className="font-semibold">Basics</h2>
                <label className="block space-y-1.5">
                    <span className="text-xs text-gray-400">Title *</span>
                    <input
                        value={form.title}
                        onChange={(e) => setField('title', e.target.value)}
                        className="w-full rounded-xl bg-[#0f1011] border border-gray-700 px-3 py-2.5 text-sm focus:outline-none focus:border-[#0ECCEE]"
                        placeholder="Sunday morning 5K"
                    />
                </label>
                <div className="grid sm:grid-cols-2 gap-3">
                    <label className="block space-y-1.5">
                        <span className="text-xs text-gray-400">Date</span>
                        <input
                            type="date"
                            value={form.eventDate}
                            onChange={(e) => setField('eventDate', e.target.value)}
                            className="w-full rounded-xl bg-[#0f1011] border border-gray-700 px-3 py-2.5 text-sm focus:outline-none focus:border-[#0ECCEE]"
                        />
                    </label>
                    <label className="block space-y-1.5">
                        <span className="text-xs text-gray-400">Reporting time</span>
                        <input
                            value={form.reportingTime}
                            onChange={(e) => setField('reportingTime', e.target.value)}
                            className="w-full rounded-xl bg-[#0f1011] border border-gray-700 px-3 py-2.5 text-sm focus:outline-none focus:border-[#0ECCEE]"
                            placeholder="6:00 AM"
                        />
                    </label>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                    <label className="block space-y-1.5">
                        <span className="text-xs text-gray-400">Venue</span>
                        <input
                            value={form.venue}
                            onChange={(e) => setField('venue', e.target.value)}
                            className="w-full rounded-xl bg-[#0f1011] border border-gray-700 px-3 py-2.5 text-sm focus:outline-none focus:border-[#0ECCEE]"
                            placeholder="Cubbon Park gate"
                        />
                    </label>
                    <label className="block space-y-1.5">
                        <span className="text-xs text-gray-400">City</span>
                        <input
                            value={form.city}
                            onChange={(e) => setField('city', e.target.value)}
                            className="w-full rounded-xl bg-[#0f1011] border border-gray-700 px-3 py-2.5 text-sm focus:outline-none focus:border-[#0ECCEE]"
                        />
                    </label>
                </div>
                <label className="block space-y-1.5">
                    <span className="text-xs text-gray-400">Map link</span>
                    <input
                        type="text"
                        value={form.routeMap}
                        onChange={(e) => setField('routeMap', e.target.value)}
                        className="w-full rounded-xl bg-[#0f1011] border border-gray-700 px-3 py-2.5 text-sm focus:outline-none focus:border-[#0ECCEE]"
                        placeholder="Paste Google Maps pin / share link"
                    />
                    <p className="text-[10px] text-gray-500">
                        Shown on the public run page map. Place name goes in Venue; paste a Maps link here for an exact pin.
                    </p>
                </label>
                <div className="grid sm:grid-cols-2 gap-3">
                    <label className="block space-y-1.5">
                        <span className="text-xs text-gray-400">Distance</span>
                        <input
                            value={form.distance}
                            onChange={(e) => setField('distance', e.target.value)}
                            className="w-full rounded-xl bg-[#0f1011] border border-gray-700 px-3 py-2.5 text-sm focus:outline-none focus:border-[#0ECCEE]"
                            placeholder="5K"
                        />
                    </label>
                    <label className="block space-y-1.5">
                        <span className="text-xs text-gray-400">Capacity (0 = unlimited)</span>
                        <input
                            type="number"
                            min="0"
                            value={form.maxParticipants}
                            onChange={(e) => setField('maxParticipants', e.target.value)}
                            className="w-full rounded-xl bg-[#0f1011] border border-gray-700 px-3 py-2.5 text-sm focus:outline-none focus:border-[#0ECCEE]"
                        />
                    </label>
                </div>
                {categories.length > 0 ? (
                    <label className="block space-y-1.5">
                        <span className="text-xs text-gray-400">Run category</span>
                        <select
                            value={form.runCategory}
                            onChange={(e) => setField('runCategory', e.target.value)}
                            className="w-full rounded-xl bg-[#0f1011] border border-gray-700 px-3 py-2.5 text-sm focus:outline-none focus:border-[#0ECCEE]"
                        >
                            <option value="">Select category</option>
                            {categories.map((cat) => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </label>
                ) : null}
                <label className="block space-y-1.5">
                    <span className="text-xs text-gray-400">About</span>
                    <textarea
                        value={form.description}
                        onChange={(e) => setField('description', e.target.value)}
                        rows={4}
                        className="w-full rounded-xl bg-[#0f1011] border border-gray-700 px-3 py-2.5 text-sm focus:outline-none focus:border-[#0ECCEE] resize-y"
                        placeholder="What runners should know…"
                    />
                </label>
            </section>

            <section className="rounded-2xl border border-gray-800 bg-[#161718] p-4 sm:p-5 space-y-4">
                <div>
                    <h2 className="font-semibold">Contact</h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                        Add multiple phones and Instagram handles for the public run page.
                    </p>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                    <MultiContactListField
                        label="Phones"
                        values={form.contactPhones}
                        onChange={(contactPhones) => setField('contactPhones', contactPhones)}
                        type="tel"
                        placeholder="+91..."
                        addLabel="Add phone"
                        inputClassName="w-full rounded-xl bg-[#0f1011] border border-gray-700 px-3 py-2.5 text-sm focus:outline-none focus:border-[#0ECCEE]"
                    />
                    <MultiContactListField
                        label="Instagram"
                        values={form.contactInstagrams}
                        onChange={(contactInstagrams) => setField('contactInstagrams', contactInstagrams)}
                        type="text"
                        placeholder="@handle"
                        addLabel="Add Instagram"
                        inputClassName="w-full rounded-xl bg-[#0f1011] border border-gray-700 px-3 py-2.5 text-sm focus:outline-none focus:border-[#0ECCEE]"
                    />
                </div>
            </section>

            <section className="rounded-2xl border border-gray-800 bg-[#161718] p-4 sm:p-5 space-y-4">
                <h2 className="font-semibold">Cover image</h2>
                {form.coverImage ? (
                    <div className="rounded-xl overflow-hidden border border-gray-800 h-40 bg-cover bg-center" style={{ backgroundImage: `url(${form.coverImage})` }} />
                ) : null}
                <div className="flex flex-wrap gap-3 items-center">
                    <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-700 text-sm cursor-pointer hover:border-[#0ECCEE]/50">
                        <Upload size={16} />
                        {uploading ? 'Uploading…' : 'Upload image'}
                        <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            disabled={uploading}
                            onChange={(e) => handleCoverUpload(e.target.files?.[0])}
                        />
                    </label>
                    <input
                        value={form.coverImage}
                        onChange={(e) => setField('coverImage', e.target.value)}
                        className="flex-1 min-w-[200px] rounded-xl bg-[#0f1011] border border-gray-700 px-3 py-2.5 text-sm focus:outline-none focus:border-[#0ECCEE]"
                        placeholder="Or paste image URL"
                    />
                </div>
            </section>

            <section className="rounded-2xl border border-gray-800 bg-[#161718] p-4 sm:p-5 space-y-4">
                <div>
                    <h2 className="font-semibold">Detail boxes</h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                        Add cards one by one (timing, meeting point, fitness…) — shown on the public run page Details tab.
                    </p>
                </div>
                <TrekDetailBoxesEditor
                    boxes={form.detailBoxes || []}
                    onChange={(detailBoxes) => setField('detailBoxes', detailBoxes)}
                    presets={RUN_DETAIL_BOX_PRESETS}
                    hint="Tap a preset or Custom box. Drag to reorder."
                    emptyText="No detail boxes yet. Start with Run Timing or Meeting Point."
                />
            </section>

            <section className="rounded-2xl border border-gray-800 bg-[#161718] p-4 sm:p-5 space-y-4">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <h2 className="font-semibold">Registration form</h2>
                        <p className="text-xs text-gray-500 mt-0.5">
                            Extra questions beyond name / phone defaults. For a dropdown, add a coupon next to an option to show it on booking page 1 and auto-apply if coupon rules pass.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={addSchemaField}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-[#0ECCEE]/15 text-[#0ECCEE] font-medium"
                    >
                        <Plus size={14} /> Add field
                    </button>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                    <label className="block space-y-1.5">
                        <span className="text-xs text-gray-400">Registration status</span>
                        <select
                            value={form.registration.status}
                            onChange={(e) => setRegistration('status', e.target.value)}
                            className="w-full rounded-xl bg-[#0f1011] border border-gray-700 px-3 py-2.5 text-sm focus:outline-none focus:border-[#0ECCEE]"
                        >
                            <option value="open">Open</option>
                            <option value="closed">Closed</option>
                        </select>
                    </label>
                    <label className="block space-y-1.5">
                        <span className="text-xs text-gray-400">Form instructions</span>
                        <input
                            value={form.registration.formInstructions}
                            onChange={(e) => setRegistration('formInstructions', e.target.value)}
                            className="w-full rounded-xl bg-[#0f1011] border border-gray-700 px-3 py-2.5 text-sm focus:outline-none focus:border-[#0ECCEE]"
                            placeholder="Shown above the form"
                        />
                    </label>
                </div>
                <div className="space-y-3">
                    {(form.registration.formSchema || []).map((field, idx) => (
                        <div key={field.id || idx} className="rounded-xl border border-gray-800 bg-[#0f1011] p-3 space-y-2">
                            <div className="flex gap-2">
                                <input
                                    value={field.label}
                                    onChange={(e) => updateSchemaField(idx, { label: e.target.value })}
                                    className="flex-1 rounded-lg bg-[#161718] border border-gray-700 px-3 py-2 text-sm"
                                    placeholder="Field label"
                                />
                                <select
                                    value={field.type}
                                    onChange={(e) => updateSchemaField(idx, { type: e.target.value })}
                                    className="rounded-lg bg-[#161718] border border-gray-700 px-2 py-2 text-sm"
                                >
                                    {FIELD_TYPES.map((t) => (
                                        <option key={t.value} value={t.value}>{t.label}</option>
                                    ))}
                                </select>
                                <button
                                    type="button"
                                    onClick={() => removeSchemaField(idx)}
                                    className="p-2 rounded-lg text-gray-500 hover:text-red-400"
                                    aria-label="Remove field"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                            <div className="flex flex-wrap gap-3 items-center">
                                <input
                                    value={field.placeholder || ''}
                                    onChange={(e) => updateSchemaField(idx, { placeholder: e.target.value })}
                                    className="flex-1 min-w-[140px] rounded-lg bg-[#161718] border border-gray-700 px-3 py-2 text-sm"
                                    placeholder="Placeholder"
                                />
                                <label className="inline-flex items-center gap-2 text-xs text-gray-400">
                                    <input
                                        type="checkbox"
                                        checked={Boolean(field.required)}
                                        onChange={(e) => updateSchemaField(idx, { required: e.target.checked })}
                                    />
                                    Required
                                </label>
                            </div>
                            {field.type === 'select' ? (
                                <SelectFieldOptionsEditor
                                    key={field.id || idx}
                                    options={field.options || []}
                                    optionCoupons={field.optionCoupons || {}}
                                    onChange={(patch) => updateSchemaField(idx, patch)}
                                    inputClass="w-full rounded-lg bg-[#161718] border border-gray-700 px-3 py-2 text-sm"
                                />
                            ) : null}
                        </div>
                    ))}
                    {(form.registration.formSchema || []).length === 0 ? (
                        <p className="text-sm text-gray-500">No custom fields yet. Default booking fields still apply.</p>
                    ) : null}
                </div>
            </section>

            {!isNew && publicUrl ? (
                <section className="rounded-2xl border border-gray-800 bg-[#161718] p-4 sm:p-5 space-y-2">
                    <h2 className="font-semibold">Public link</h2>
                    <p className="text-xs text-gray-500 break-all">{publicUrl}</p>
                    <button
                        type="button"
                        onClick={async () => {
                            try {
                                await navigator.clipboard.writeText(publicUrl);
                                setNotice('Link copied');
                            } catch {
                                setError('Could not copy link');
                            }
                        }}
                        className="px-3 py-2 rounded-lg text-sm border border-gray-700 hover:border-[#0ECCEE]/50"
                    >
                        Copy link
                    </button>
                </section>
            ) : null}

            <div className="flex flex-wrap gap-3 sticky bottom-4">
                <button
                    type="button"
                    disabled={saving}
                    onClick={() => save({ andPublish: false })}
                    className="px-4 py-3 min-h-[44px] rounded-xl border border-gray-700 text-sm font-medium hover:border-[#0ECCEE]/50 disabled:opacity-50"
                >
                    {saving && !publishing ? 'Saving…' : 'Save draft'}
                </button>
                <button
                    type="button"
                    disabled={saving}
                    onClick={() => save({ andPublish: true })}
                    className="px-4 py-3 min-h-[44px] rounded-xl bg-[#0ECCEE] text-black text-sm font-bold disabled:opacity-50"
                >
                    {publishing ? 'Publishing…' : form.status === 'published' ? 'Save & keep live' : 'Publish run'}
                </button>
                {!isNew ? (
                    <Link
                        to={`/run-club-organizer/events/${eventId}`}
                        className="px-4 py-3 min-h-[44px] inline-flex items-center rounded-xl border border-gray-700 text-sm font-medium"
                    >
                        Open dashboard
                    </Link>
                ) : null}
            </div>
        </div>
    );
}
