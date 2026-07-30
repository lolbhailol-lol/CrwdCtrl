import { useEffect, useMemo, useState } from 'react';
import { X, MessageCircle } from 'lucide-react';
import {
    WHATSAPP_PRESETS,
    isValidWhatsAppPhone,
    openWhatsApp,
    loadSavedWhatsAppCustom,
    saveWhatsAppCustom,
} from '../../utils/whatsappDeepLink';

/**
 * Opens WhatsApp on the organizer's device (wa.me) — no WhatsApp API.
 * Supports single recipient or sequential bulk ("Open next").
 */
export default function TrekOrganizerWhatsAppModal({
    open,
    onClose,
    recipients = [],
    trekName = '',
    trekDate = '',
    meetingPoint = '',
    communityId = '',
}) {
    const validRecipients = useMemo(
        () => (recipients || []).filter((r) => isValidWhatsAppPhone(r.phone)),
        [recipients],
    );
    const skipped = Math.max(0, (recipients || []).length - validRecipients.length);

    const [index, setIndex] = useState(0);
    const [presetId, setPresetId] = useState('reminder');
    const [message, setMessage] = useState('');

    const current = validRecipients[index] || null;
    const isBulk = validRecipients.length > 1;

    const buildCtx = (recipient) => ({
        name: recipient?.name || '',
        trekName: recipient?.trekName || trekName,
        trekDate: recipient?.trekDate || trekDate,
        meetingPoint: recipient?.meetingPoint || meetingPoint,
    });

    useEffect(() => {
        if (!open) return;
        setIndex(0);
        setPresetId('reminder');
        const first = (recipients || []).find((r) => isValidWhatsAppPhone(r.phone));
        const preset = WHATSAPP_PRESETS.find((p) => p.id === 'reminder');
        setMessage(preset?.build(buildCtx(first)) || '');
        // eslint-disable-next-line react-hooks/exhaustive-deps -- rebuild when modal opens
    }, [open, recipients, trekName, trekDate, meetingPoint]);

    useEffect(() => {
        if (!open || !current) return;
        const preset = WHATSAPP_PRESETS.find((p) => p.id === presetId);
        if (!preset || preset.id === 'custom') return;
        setMessage(preset.build(buildCtx(current)));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [index, presetId, open, current, trekName, trekDate, meetingPoint]);

    if (!open) return null;

    const applyPreset = (id) => {
        setPresetId(id);
        const preset = WHATSAPP_PRESETS.find((p) => p.id === id);
        if (!preset) return;
        if (id === 'custom') {
            setMessage(loadSavedWhatsAppCustom(communityId));
            return;
        }
        setMessage(preset.build(buildCtx(current)));
    };

    const openCurrent = () => {
        if (!current) return false;
        if (presetId === 'custom') {
            saveWhatsAppCustom(communityId, message);
        }
        return openWhatsApp(current.phone, message);
    };

    const handleOpen = () => {
        if (!openCurrent()) return;
        if (!isBulk) {
            onClose?.();
            return;
        }
        if (index >= validRecipients.length - 1) {
            onClose?.();
            return;
        }
        setIndex((i) => i + 1);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <button type="button" className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" onClick={onClose} aria-label="Close" />
            <div className="relative w-full sm:max-w-md max-h-[92dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-white/10 bg-[#121314] shadow-2xl">
                <div className="sticky top-0 flex items-start justify-between gap-3 px-4 py-3.5 border-b border-white/10 bg-[#121314]/95 backdrop-blur z-10">
                    <div>
                        <p className="text-[10px] uppercase tracking-widest text-[#25D366] font-semibold">WhatsApp</p>
                        <h2 className="font-semibold text-white">
                            {isBulk ? `Message guests (${index + 1}/${validRecipients.length})` : 'Message guest'}
                        </h2>
                        <p className="text-xs text-gray-500 mt-0.5">
                            Opens WhatsApp on your phone — no API, sends from your number.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2.5 min-h-11 min-w-11 inline-flex items-center justify-center rounded-xl border border-white/10 text-gray-400 hover:bg-white/5"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="p-4 space-y-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
                    {!validRecipients.length ? (
                        <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 px-4 py-8 text-center">
                            <p className="text-sm text-gray-300 font-medium">No valid phone numbers</p>
                            <p className="text-xs text-gray-500 mt-1">
                                {skipped > 0
                                    ? `${skipped} selected guest${skipped === 1 ? '' : 's'} missing a phone.`
                                    : 'Add a phone on the registration to WhatsApp them.'}
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="rounded-2xl border border-white/10 bg-linear-to-br from-[#1a1b1d] to-[#141516] px-4 py-3">
                                <p className="text-[10px] uppercase tracking-widest text-gray-500">To</p>
                                <p className="text-base font-semibold text-white mt-1">{current?.name || 'Guest'}</p>
                                <p className="text-sm text-[#25D366] mt-0.5">{current?.phone}</p>
                                {(current?.trekName || trekName) ? (
                                    <p className="text-xs text-gray-500 mt-1">
                                        {current?.trekName || trekName}
                                        {(current?.trekDate || trekDate) ? ` · ${current?.trekDate || trekDate}` : ''}
                                    </p>
                                ) : null}
                                {(current?.meetingPoint || meetingPoint) ? (
                                    <p className="text-xs text-gray-500 mt-0.5">
                                        Meet: {current?.meetingPoint || meetingPoint}
                                    </p>
                                ) : null}
                                {skipped > 0 ? (
                                    <p className="text-[11px] text-amber-300/80 mt-2">
                                        Skipping {skipped} without a phone
                                    </p>
                                ) : null}
                            </div>

                            <div>
                                <p className="text-[11px] uppercase tracking-widest text-gray-500 mb-2 font-medium">Preset</p>
                                <div className="flex flex-wrap gap-2">
                                    {WHATSAPP_PRESETS.map((preset) => (
                                        <button
                                            key={preset.id}
                                            type="button"
                                            onClick={() => applyPreset(preset.id)}
                                            className={`px-3 py-2 rounded-full text-xs font-medium border transition-colors ${
                                                presetId === preset.id
                                                    ? 'bg-[#25D366] text-black border-[#25D366]'
                                                    : 'border-white/10 text-gray-400 hover:border-[#25D366]/40 bg-white/5'
                                            }`}
                                        >
                                            {preset.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <textarea
                                value={message}
                                onChange={(e) => {
                                    setPresetId('custom');
                                    setMessage(e.target.value);
                                }}
                                rows={4}
                                maxLength={1000}
                                placeholder="Type your WhatsApp message…"
                                className="w-full px-3.5 py-3 rounded-xl bg-black/30 border border-white/10 text-sm resize-none focus:outline-none focus:border-[#25D366]/50"
                            />

                            <button
                                type="button"
                                onClick={handleOpen}
                                className="w-full inline-flex items-center justify-center gap-2 py-3.5 min-h-[52px] rounded-2xl bg-[#25D366] text-black text-sm font-bold hover:brightness-110"
                            >
                                <MessageCircle size={18} />
                                {isBulk
                                    ? index >= validRecipients.length - 1
                                        ? 'Open WhatsApp (last)'
                                        : `Open WhatsApp · next ${index + 2}/${validRecipients.length}`
                                    : 'Open WhatsApp'}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
