import { useState, useEffect } from 'react';
import { X, Upload } from 'lucide-react';

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

const SPORT_TYPES = [
    { value: 'run_club', label: 'Run Club' },
    { value: 'football', label: 'Football' },
    { value: 'cricket', label: 'Cricket' },
    { value: 'badminton', label: 'Badminton' },
    { value: 'marathon', label: 'Marathon' },
    { value: 'gymkhana', label: 'Gymkhana' },
    { value: 'other', label: 'Other' },
];

const EMPTY = {
    title: '', sportType: '', organizer: '', venue: '', city: '',
    eventDate: '', reportingTime: '', registrationFee: 0, dressCode: '',
    participationType: 'individual', maxParticipants: 0, skillLevel: 'all',
    prizes: '', routeMap: '', images: [], sponsors: '', registrationLink: '',
    description: '', status: 'published',
};

export default function SportsFormModal({ event, onClose, onSaved }) {
    const [form, setForm] = useState(EMPTY);
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (event) {
            setForm({
                ...EMPTY,
                ...event,
                eventDate: event.eventDate ? new Date(event.eventDate).toISOString().slice(0, 10) : '',
                sponsors: Array.isArray(event.sponsors) ? event.sponsors.join(', ') : (event.sponsors || ''),
                images: event.images || [],
            });
        } else {
            setForm(EMPTY);
        }
    }, [event]);

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const handleImageUpload = async (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;
        setUploading(true);
        setError('');
        try {
            const token = localStorage.getItem('admin_token');
            const fd = new FormData();
            files.forEach(f => fd.append('images', f));
            const res = await fetch(`${API}/admin/upload/images`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: fd,
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Upload failed');
            const urls = data.urls || data.imageUrls || [];
            set('images', [...form.images, ...urls]);
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
        if (!form.title.trim() || !form.sportType) {
            setError('Title and Sport Type are required.');
            return;
        }
        setSaving(true);
        try {
            const token = localStorage.getItem('admin_token');
            const payload = {
                ...form,
                sponsors: form.sponsors ? form.sponsors.split(',').map(s => s.trim()).filter(Boolean) : [],
                registrationFee: Number(form.registrationFee) || 0,
                maxParticipants: Number(form.maxParticipants) || 0,
                eventDate: form.eventDate || null,
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
            onSaved(data.event);
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const Field = ({ label, required, children }) => (
        <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
                {label}{required && <span className="text-red-400 ml-1">*</span>}
            </label>
            {children}
        </div>
    );

    const inp = "w-full bg-[#1D1E20] border border-gray-600 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#0ECCEE]";

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 py-8 px-4">
            <div className="w-full max-w-2xl bg-[#111213] rounded-xl border border-gray-700 shadow-2xl">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
                    <h2 className="text-lg font-bold text-white">{event ? 'Edit Sports Event' : 'Create Sports Event'}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={20} /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {error && <div className="bg-red-900/30 border border-red-700 text-red-300 text-sm rounded-lg px-4 py-3">{error}</div>}

                    <div className="grid grid-cols-2 gap-4">
                        <Field label="Title" required>
                            <input type="text" value={form.title} onChange={e => set('title', e.target.value)} className={inp} placeholder="Event title" />
                        </Field>
                        <Field label="Sport Type" required>
                            <select value={form.sportType} onChange={e => set('sportType', e.target.value)} className={inp}>
                                <option value="">Select...</option>
                                {SPORT_TYPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                            </select>
                        </Field>
                    </div>

                    <Field label="Description">
                        <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={3} className={`${inp} resize-none`} placeholder="Event description" />
                    </Field>

                    <div className="grid grid-cols-2 gap-4">
                        <Field label="Organizer"><input type="text" value={form.organizer} onChange={e => set('organizer', e.target.value)} className={inp} placeholder="Organizer name" /></Field>
                        <Field label="City"><input type="text" value={form.city} onChange={e => set('city', e.target.value)} className={inp} placeholder="City" /></Field>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <Field label="Venue"><input type="text" value={form.venue} onChange={e => set('venue', e.target.value)} className={inp} placeholder="Venue" /></Field>
                        <Field label="Event Date"><input type="date" value={form.eventDate} onChange={e => set('eventDate', e.target.value)} className={inp} /></Field>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <Field label="Reporting Time"><input type="text" value={form.reportingTime} onChange={e => set('reportingTime', e.target.value)} className={inp} placeholder="e.g. 6:00 AM" /></Field>
                        <Field label="Registration Fee (₹)"><input type="number" min="0" value={form.registrationFee} onChange={e => set('registrationFee', e.target.value)} className={inp} /></Field>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <Field label="Participation Type">
                            <select value={form.participationType} onChange={e => set('participationType', e.target.value)} className={inp}>
                                <option value="individual">Individual</option>
                                <option value="team">Team</option>
                                <option value="both">Both</option>
                            </select>
                        </Field>
                        <Field label="Skill Level">
                            <select value={form.skillLevel} onChange={e => set('skillLevel', e.target.value)} className={inp}>
                                <option value="all">All Levels</option>
                                <option value="beginner">Beginner</option>
                                <option value="intermediate">Intermediate</option>
                                <option value="advanced">Advanced</option>
                            </select>
                        </Field>
                        <Field label="Max Participants"><input type="number" min="0" value={form.maxParticipants} onChange={e => set('maxParticipants', e.target.value)} className={inp} placeholder="0 = unlimited" /></Field>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <Field label="Dress Code"><input type="text" value={form.dressCode} onChange={e => set('dressCode', e.target.value)} className={inp} placeholder="e.g. Sports attire" /></Field>
                        <Field label="Prizes"><input type="text" value={form.prizes} onChange={e => set('prizes', e.target.value)} className={inp} placeholder="Prize details" /></Field>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <Field label="Route Map (URL)"><input type="url" value={form.routeMap} onChange={e => set('routeMap', e.target.value)} className={inp} placeholder="https://..." /></Field>
                        <Field label="Registration Link"><input type="url" value={form.registrationLink} onChange={e => set('registrationLink', e.target.value)} className={inp} placeholder="https://..." /></Field>
                    </div>

                    <Field label="Sponsors (comma-separated)">
                        <input type="text" value={form.sponsors} onChange={e => set('sponsors', e.target.value)} className={inp} placeholder="Sponsor A, Sponsor B" />
                    </Field>

                    {/* Images */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Images</label>
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

                    {/* Status */}
                    <Field label="Status">
                        <div className="flex gap-4">
                            {['published', 'draft'].map(s => (
                                <label key={s} className="flex items-center gap-2 cursor-pointer">
                                    <input type="radio" name="status" value={s} checked={form.status === s} onChange={() => set('status', s)} className="accent-[#0ECCEE]" />
                                    <span className="text-sm text-gray-300 capitalize">{s}</span>
                                </label>
                            ))}
                        </div>
                    </Field>

                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors">Cancel</button>
                        <button type="submit" disabled={saving || uploading} className="flex-1 px-4 py-2.5 bg-[#0ECCEE] hover:bg-[#0ECCEE]/80 text-black rounded-lg text-sm font-bold transition-colors disabled:opacity-50">
                            {saving ? 'Saving...' : event ? 'Update' : 'Create'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
