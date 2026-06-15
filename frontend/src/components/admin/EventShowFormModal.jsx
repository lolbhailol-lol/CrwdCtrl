import { useState, useEffect } from 'react';
import { X, Upload, Plus, Trash2 } from 'lucide-react';
import { adminFetch, adminFetchJSON } from '../../utils/adminApi';

const EVENT_TYPE_OPTIONS = [
    { value: 'play', label: 'Play' },
    { value: 'musical', label: 'Musical' },
    { value: 'standup', label: 'Stand-up Comedy' },
    { value: 'improv', label: 'Improv' },
    { value: 'dance_drama', label: 'Dance Drama' },
    { value: 'other', label: 'Other' },
];

const EMPTY = {
    title: '', description: '', eventType: '', organizer: '', cast: '',
    venue: '', city: '', duration: '', language: '', ageRating: '',
    ticketPrice: 0, seatingCapacity: 0, performerDetails: '',
    sponsors: '', poster: '', trailerLink: '', bookingLink: '',
    showTimings: [], status: 'published',
};

export default function EventShowFormModal({ show, onClose, onSaved }) {
    const [form, setForm] = useState(EMPTY);
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (show) {
            setForm({
                ...EMPTY,
                ...show,
                cast: Array.isArray(show.cast) ? show.cast.join(', ') : (show.cast || ''),
                sponsors: Array.isArray(show.sponsors) ? show.sponsors.join(', ') : (show.sponsors || ''),
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

    const handlePosterUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setUploading(true);
        try {
            const fd = new FormData();
            fd.append('image', file);
            const res = await adminFetch('/admin/upload/image', { method: 'POST', body: fd });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Upload failed');
            set('poster', data.url || data.imageUrl || '');
        } catch (err) {
            setError(`Upload failed: ${err.message}`);
        } finally {
            setUploading(false);
            e.target.value = '';
        }
    };

    const addShowing = () => {
        set('showTimings', [...form.showTimings, { date: '', time: '' }]);
    };

    const updateShowing = (idx, field, value) => {
        const updated = form.showTimings.map((s, i) => i === idx ? { ...s, [field]: value } : s);
        set('showTimings', updated);
    };

    const removeShowing = (idx) => {
        set('showTimings', form.showTimings.filter((_, i) => i !== idx));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (!form.title.trim() || !form.eventType) {
            setError('Title and Event Type are required.');
            return;
        }
        setSaving(true);
        try {
            const payload = {
                ...form,
                cast: form.cast ? form.cast.split(',').map(s => s.trim()).filter(Boolean) : [],
                sponsors: form.sponsors ? form.sponsors.split(',').map(s => s.trim()).filter(Boolean) : [],
                ticketPrice: Number(form.ticketPrice) || 0,
                seatingCapacity: Number(form.seatingCapacity) || 0,
                showTimings: form.showTimings.filter(s => s.date || s.time),
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

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
                        <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={3} className={`${inp} resize-none`} />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="block text-sm font-medium text-gray-300 mb-1">Organizer</label><input type="text" value={form.organizer} onChange={e => set('organizer', e.target.value)} className={inp} /></div>
                        <div><label className="block text-sm font-medium text-gray-300 mb-1">City</label><input type="text" value={form.city} onChange={e => set('city', e.target.value)} className={inp} /></div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="block text-sm font-medium text-gray-300 mb-1">Venue</label><input type="text" value={form.venue} onChange={e => set('venue', e.target.value)} className={inp} /></div>
                        <div><label className="block text-sm font-medium text-gray-300 mb-1">Duration</label><input type="text" value={form.duration} onChange={e => set('duration', e.target.value)} className={inp} placeholder="e.g. 2 hours" /></div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div><label className="block text-sm font-medium text-gray-300 mb-1">Language</label><input type="text" value={form.language} onChange={e => set('language', e.target.value)} className={inp} placeholder="Hindi / English" /></div>
                        <div><label className="block text-sm font-medium text-gray-300 mb-1">Age Rating</label><input type="text" value={form.ageRating} onChange={e => set('ageRating', e.target.value)} className={inp} placeholder="U / A / UA" /></div>
                        <div><label className="block text-sm font-medium text-gray-300 mb-1">Seating Capacity</label><input type="number" min="0" value={form.seatingCapacity} onChange={e => set('seatingCapacity', e.target.value)} className={inp} /></div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="block text-sm font-medium text-gray-300 mb-1">Ticket Price (₹)</label><input type="number" min="0" value={form.ticketPrice} onChange={e => set('ticketPrice', e.target.value)} className={inp} /></div>
                        <div><label className="block text-sm font-medium text-gray-300 mb-1">Booking Link</label><input type="url" value={form.bookingLink} onChange={e => set('bookingLink', e.target.value)} className={inp} placeholder="https://..." /></div>
                    </div>

                    <div><label className="block text-sm font-medium text-gray-300 mb-1">Cast (comma-separated)</label><input type="text" value={form.cast} onChange={e => set('cast', e.target.value)} className={inp} placeholder="Actor A, Actor B" /></div>

                    <div><label className="block text-sm font-medium text-gray-300 mb-1">Performer Details</label><textarea value={form.performerDetails} onChange={e => set('performerDetails', e.target.value)} rows={2} className={`${inp} resize-none`} /></div>

                    <div><label className="block text-sm font-medium text-gray-300 mb-1">Sponsors (comma-separated)</label><input type="text" value={form.sponsors} onChange={e => set('sponsors', e.target.value)} className={inp} /></div>

                    <div><label className="block text-sm font-medium text-gray-300 mb-1">Trailer Link</label><input type="url" value={form.trailerLink} onChange={e => set('trailerLink', e.target.value)} className={inp} placeholder="https://..." /></div>

                    {/* Show Timings */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-sm font-medium text-gray-300">Show Timings</label>
                            <button type="button" onClick={addShowing} className="flex items-center gap-1 text-xs text-[#0ECCEE] hover:opacity-80 transition-opacity">
                                <Plus size={12} /> Add Showing
                            </button>
                        </div>
                        {form.showTimings.map((s, idx) => (
                            <div key={idx} className="flex items-center gap-3 mb-2">
                                <input type="date" value={s.date} onChange={e => updateShowing(idx, 'date', e.target.value)} className={`${inp} flex-1`} />
                                <input type="text" value={s.time} onChange={e => updateShowing(idx, 'time', e.target.value)} className={`${inp} flex-1`} placeholder="e.g. 7:00 PM" />
                                <button type="button" onClick={() => removeShowing(idx)} className="text-gray-500 hover:text-red-400 shrink-0"><Trash2 size={14} /></button>
                            </div>
                        ))}
                    </div>

                    {/* Poster */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Poster</label>
                        {form.poster && <img src={form.poster} alt="poster" className="w-24 h-32 object-cover rounded-lg border border-gray-600 mb-2" />}
                        <label className="flex items-center gap-2 cursor-pointer w-fit bg-[#1D1E20] border border-dashed border-gray-500 hover:border-[#0ECCEE] rounded-lg px-4 py-2 text-sm text-gray-400 transition-colors">
                            {uploading ? <span className="text-[#0ECCEE]">Uploading...</span> : <><Upload size={14} /><span>{form.poster ? 'Replace poster' : 'Upload poster'}</span></>}
                            <input type="file" accept="image/*" onChange={handlePosterUpload} disabled={uploading} className="hidden" />
                        </label>
                    </div>

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
                        <button type="submit" disabled={saving || uploading} className="flex-1 px-4 py-2.5 bg-[#0ECCEE] hover:bg-[#0ECCEE]/80 text-black rounded-lg text-sm font-bold transition-colors disabled:opacity-50">
                            {saving ? 'Saving...' : show ? 'Update' : 'Create'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
