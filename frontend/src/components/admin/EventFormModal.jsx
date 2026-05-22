import { useState, useEffect } from 'react';
import { X, Upload, Trash2, Plus } from 'lucide-react';

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

const CATEGORIES = [
    { value: 'fest', label: 'Fest' },
    { value: 'trek', label: 'Trek' },
    { value: 'sports', label: 'Sports' },
    { value: 'theatre', label: 'Theatre' },
    { value: 'workshop', label: 'Workshop' },
];

const EMPTY_FORM = {
    title: '',
    description: '',
    category: '',
    venue: '',
    city: '',
    startDate: '',
    endDate: '',
    organizer: '',
    registrationLink: '',
    price: 0,
    status: 'published',
    images: [],
};

function toDateInputValue(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d)) return '';
    return d.toISOString().slice(0, 10);
}

export default function EventFormModal({ event, onClose, onSaved }) {
    const [form, setForm] = useState(EMPTY_FORM);
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (event) {
            setForm({
                title: event.title || '',
                description: event.description || '',
                category: event.category || '',
                venue: event.venue || '',
                city: event.city || '',
                startDate: toDateInputValue(event.startDate),
                endDate: toDateInputValue(event.endDate),
                organizer: event.organizer || '',
                registrationLink: event.registrationLink || '',
                price: event.price ?? 0,
                status: event.status || 'published',
                images: event.images || [],
            });
        } else {
            setForm(EMPTY_FORM);
        }
    }, [event]);

    const set = (key, value) => setForm(f => ({ ...f, [key]: value }));

    const handleImageUpload = async (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;

        setUploading(true);
        setError('');
        try {
            const token = localStorage.getItem('admin_token');
            const formData = new FormData();
            files.forEach(f => formData.append('images', f));

            const res = await fetch(`${API}/admin/upload/images`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: formData,
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Upload failed');

            const urls = data.urls || data.imageUrls || [];
            set('images', [...form.images, ...urls]);
        } catch (err) {
            setError(`Image upload failed: ${err.message}`);
        } finally {
            setUploading(false);
            e.target.value = '';
        }
    };

    const removeImage = (idx) => {
        set('images', form.images.filter((_, i) => i !== idx));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!form.title.trim() || !form.description.trim() || !form.category) {
            setError('Title, description, and category are required.');
            return;
        }

        setSaving(true);
        try {
            const token = localStorage.getItem('admin_token');
            const payload = {
                ...form,
                startDate: form.startDate || null,
                endDate: form.endDate || null,
                price: Number(form.price) || 0,
            };

            const url = event ? `${API}/admin/events/${event._id}` : `${API}/admin/events`;
            const method = event ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
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

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 py-8 px-4">
            <div className="w-full max-w-2xl bg-[#111213] rounded-xl border border-gray-700 shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
                    <h2 className="text-lg font-bold text-white">
                        {event ? 'Edit Event' : 'Create New Event'}
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {error && (
                        <div className="bg-red-900/30 border border-red-700 text-red-300 text-sm rounded-lg px-4 py-3">
                            {error}
                        </div>
                    )}

                    {/* Title */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">
                            Title <span className="text-red-400">*</span>
                        </label>
                        <input
                            type="text"
                            value={form.title}
                            onChange={e => set('title', e.target.value)}
                            className="w-full bg-[#1D1E20] border border-gray-600 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#0ECCEE]"
                            placeholder="Event title"
                        />
                    </div>

                    {/* Category */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">
                            Category <span className="text-red-400">*</span>
                        </label>
                        <select
                            value={form.category}
                            onChange={e => set('category', e.target.value)}
                            className="w-full bg-[#1D1E20] border border-gray-600 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#0ECCEE]"
                        >
                            <option value="">Select category...</option>
                            {CATEGORIES.map(c => (
                                <option key={c.value} value={c.value}>{c.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">
                            Description <span className="text-red-400">*</span>
                        </label>
                        <textarea
                            value={form.description}
                            onChange={e => set('description', e.target.value)}
                            rows={4}
                            className="w-full bg-[#1D1E20] border border-gray-600 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#0ECCEE] resize-none"
                            placeholder="Describe the event..."
                        />
                    </div>

                    {/* Venue + City */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Venue</label>
                            <input
                                type="text"
                                value={form.venue}
                                onChange={e => set('venue', e.target.value)}
                                className="w-full bg-[#1D1E20] border border-gray-600 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#0ECCEE]"
                                placeholder="Venue name"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">City</label>
                            <input
                                type="text"
                                value={form.city}
                                onChange={e => set('city', e.target.value)}
                                className="w-full bg-[#1D1E20] border border-gray-600 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#0ECCEE]"
                                placeholder="City"
                            />
                        </div>
                    </div>

                    {/* Start Date + End Date */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Start Date</label>
                            <input
                                type="date"
                                value={form.startDate}
                                onChange={e => set('startDate', e.target.value)}
                                className="w-full bg-[#1D1E20] border border-gray-600 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#0ECCEE]"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">End Date</label>
                            <input
                                type="date"
                                value={form.endDate}
                                onChange={e => set('endDate', e.target.value)}
                                className="w-full bg-[#1D1E20] border border-gray-600 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#0ECCEE]"
                            />
                        </div>
                    </div>

                    {/* Organizer */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Organizer</label>
                        <input
                            type="text"
                            value={form.organizer}
                            onChange={e => set('organizer', e.target.value)}
                            className="w-full bg-[#1D1E20] border border-gray-600 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#0ECCEE]"
                            placeholder="Organizer name"
                        />
                    </div>

                    {/* Registration Link + Price */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Registration Link</label>
                            <input
                                type="url"
                                value={form.registrationLink}
                                onChange={e => set('registrationLink', e.target.value)}
                                className="w-full bg-[#1D1E20] border border-gray-600 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#0ECCEE]"
                                placeholder="https://..."
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Price (₹)</label>
                            <input
                                type="number"
                                min="0"
                                value={form.price}
                                onChange={e => set('price', e.target.value)}
                                className="w-full bg-[#1D1E20] border border-gray-600 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#0ECCEE]"
                                placeholder="0 = free"
                            />
                        </div>
                    </div>

                    {/* Status */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Status</label>
                        <div className="flex gap-4">
                            {['published', 'draft'].map(s => (
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
                    </div>

                    {/* Images */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Images</label>

                        {form.images.length > 0 && (
                            <div className="flex flex-wrap gap-3 mb-3">
                                {form.images.map((url, idx) => (
                                    <div key={idx} className="relative w-24 h-24">
                                        <img
                                            src={url}
                                            alt={`img-${idx}`}
                                            className="w-full h-full object-cover rounded-lg border border-gray-600"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => removeImage(idx)}
                                            className="absolute -top-2 -right-2 bg-red-600 rounded-full p-0.5 hover:bg-red-700 transition-colors"
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <label className="flex items-center gap-2 cursor-pointer w-fit bg-[#1D1E20] border border-dashed border-gray-500 hover:border-[#0ECCEE] rounded-lg px-4 py-2.5 text-sm text-gray-400 transition-colors">
                            {uploading ? (
                                <span className="text-[#0ECCEE]">Uploading...</span>
                            ) : (
                                <>
                                    <Upload size={16} />
                                    <span>Upload images</span>
                                </>
                            )}
                            <input
                                type="file"
                                accept="image/*"
                                multiple
                                onChange={handleImageUpload}
                                disabled={uploading}
                                className="hidden"
                            />
                        </label>
                    </div>

                    {/* Footer */}
                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving || uploading}
                            className="flex-1 px-4 py-2.5 bg-[#0ECCEE] hover:bg-[#0ECCEE]/80 text-black rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
                        >
                            {saving ? 'Saving...' : event ? 'Update Event' : 'Create Event'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
