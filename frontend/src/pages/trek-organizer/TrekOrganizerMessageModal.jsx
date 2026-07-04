import { useEffect, useState } from 'react';
import { X, Loader, Mail } from 'lucide-react';

const PRESETS = [
    {
        id: 'whatsapp',
        title: 'Join our WhatsApp group',
        message: 'Thanks for registering! Join our WhatsApp group for trek updates, meetup details and announcements.',
        includeWhatsAppLink: true,
    },
    {
        id: 'reminder',
        title: 'Trek reminder',
        message: 'This is a reminder about your upcoming trek. Please arrive on time with your QR ticket and carry the items listed on the trek page.',
        includeWhatsAppLink: false,
    },
    {
        id: 'meeting',
        title: 'Meeting point update',
        message: 'The meeting point or reporting time for this trek has been updated. Please check your booking details in the app for the latest information.',
        includeWhatsAppLink: false,
    },
];

export default function TrekOrganizerMessageModal({
    open,
    onClose,
    recipientCount = 0,
    recipientLabel = '',
    onSend,
}) {
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [includeWhatsAppLink, setIncludeWhatsAppLink] = useState(false);
    const [notifyInApp, setNotifyInApp] = useState(true);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!open) return;
        setError('');
        setSending(false);
    }, [open]);

    if (!open) return null;

    const applyPreset = (preset) => {
        setTitle(preset.title);
        setMessage(preset.message);
        setIncludeWhatsAppLink(!!preset.includeWhatsAppLink);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!title.trim() || !message.trim()) {
            setError('Title and message are required');
            return;
        }
        setSending(true);
        setError('');
        try {
            await onSend({
                title: title.trim(),
                message: message.trim(),
                includeWhatsAppLink,
                notifyInApp,
            });
            onClose();
        } catch (err) {
            setError(err.message || 'Failed to send');
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <button
                type="button"
                aria-label="Close"
                className="absolute inset-0 bg-black/70"
                onClick={onClose}
            />
            <div className="relative w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-gray-800 bg-[#161718] shadow-xl">
                <div className="sticky top-0 flex items-center justify-between gap-3 border-b border-gray-800 bg-[#161718] px-5 py-4">
                    <div>
                        <h2 className="text-lg font-bold flex items-center gap-2">
                            <Mail size={18} className="text-[#0ECCEE]" />
                            Email participant{recipientCount !== 1 ? 's' : ''}
                        </h2>
                        <p className="text-xs text-gray-500 mt-0.5">
                            {recipientCount} selected
                            {recipientLabel ? ` · ${recipientLabel}` : ''}
                        </p>
                    </div>
                    <button type="button" onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5">
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    <div className="flex flex-wrap gap-2">
                        {PRESETS.map((preset) => (
                            <button
                                key={preset.id}
                                type="button"
                                onClick={() => applyPreset(preset)}
                                className="px-2.5 py-1 rounded-lg border border-gray-700 text-[11px] text-gray-400 hover:border-[#0ECCEE]/40 hover:text-gray-200"
                            >
                                {preset.title}
                            </button>
                        ))}
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1.5">Email subject</label>
                        <input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="e.g. Join WhatsApp group for trek updates"
                            className="w-full px-3 py-2.5 rounded-xl bg-[#111213] border border-gray-800 text-sm focus:outline-none focus:border-[#0ECCEE]/50"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1.5">Message</label>
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            rows={5}
                            placeholder="Write your message to the selected participant(s)…"
                            className="w-full px-3 py-2.5 rounded-xl bg-[#111213] border border-gray-800 text-sm focus:outline-none focus:border-[#0ECCEE]/50 resize-none"
                            required
                        />
                    </div>

                    <label className="flex items-start gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={includeWhatsAppLink}
                            onChange={(e) => setIncludeWhatsAppLink(e.target.checked)}
                            className="mt-0.5 rounded border-gray-600"
                        />
                        <span className="text-sm text-gray-300">
                            Include WhatsApp group link in email
                            <span className="block text-[11px] text-gray-500 mt-0.5">Uses the trek or community link configured in admin.</span>
                        </span>
                    </label>

                    <label className="flex items-start gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={notifyInApp}
                            onChange={(e) => setNotifyInApp(e.target.checked)}
                            className="mt-0.5 rounded border-gray-600"
                        />
                        <span className="text-sm text-gray-300">
                            Also send in-app notification
                            <span className="block text-[11px] text-gray-500 mt-0.5">Push notification if the user has alerts enabled.</span>
                        </span>
                    </label>

                    {error ? <p className="text-sm text-red-400">{error}</p> : null}

                    <div className="flex gap-2 pt-1">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-2.5 rounded-xl border border-gray-700 text-sm font-medium text-gray-300 hover:bg-white/5"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={sending}
                            className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#0ECCEE] text-black text-sm font-bold disabled:opacity-60"
                        >
                            {sending ? <Loader className="animate-spin" size={16} /> : <Mail size={16} />}
                            Send email
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
