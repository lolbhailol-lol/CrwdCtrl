import { useState, useEffect } from 'react';
import { X, Upload } from 'lucide-react';
import CoverImageCropModal from '../CoverImageCropModal';
import ContentImage from '../ContentImage';
import { adminFetch } from '../../services/api/admin.api.js';
import { parseUploadedUrls } from '../../utils/uploadUrls';
import { COVER_IMAGE_SLOTS, normalizeCoverImages } from '../../utils/coverImages';

/**
 * Per-layout cover uploads — each card type gets its own cropped image.
 */
export default function MultiCoverImagesUpload({
    value,
    onChange,
    onError,
    onUploadingChange,
    hint = 'Upload a separate image for each layout where this content appears.',
    excludeKeys = [],
    className = '',
}) {
    const covers = normalizeCoverImages(value);
    const slots = COVER_IMAGE_SLOTS.filter((slot) => !excludeKeys.includes(slot.key));
    const [cropState, setCropState] = useState(null);
    const [uploadingKey, setUploadingKey] = useState(null);

    useEffect(() => {
        onUploadingChange?.(Boolean(uploadingKey));
    }, [uploadingKey, onUploadingChange]);

    const setSlot = (key, url) => {
        onChange({ ...covers, [key]: url || '' });
    };

    const uploadCropped = async (file) => {
        const { key } = cropState || {};
        setCropState(null);
        if (!key) return;
        setUploadingKey(key);
        try {
            const fd = new FormData();
            fd.append('images', file);
            const res = await adminFetch('/admin/upload/images', { method: 'POST', body: fd });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || data.error || 'Upload failed');
            const urls = parseUploadedUrls(data);
            if (!urls.length) throw new Error('Upload succeeded but no image URL was returned');
            setSlot(key, urls[0]);
        } catch (err) {
            onError?.(err.message || 'Upload failed');
        } finally {
            setUploadingKey(null);
        }
    };

    return (
        <div className={className}>
            <p className="text-xs text-gray-500 mb-3">{hint}</p>
            <div className="space-y-3">
                {slots.map((slot) => {
                    const url = covers[slot.key];
                    const busy = uploadingKey === slot.key;
                    return (
                        <div
                            key={slot.key}
                            className="flex items-center gap-3 rounded-xl border border-gray-700/60 bg-[#1D1E20]/50 p-3"
                        >
                            <button
                                type="button"
                                disabled={!url || Boolean(uploadingKey)}
                                onClick={() => {
                                    if (!url) return;
                                    setCropState({
                                        key: slot.key,
                                        aspectId: slot.aspectId,
                                        imageUrl: url,
                                    });
                                }}
                                className={`${slot.previewClass} shrink-0 rounded-lg overflow-hidden border border-gray-700 bg-[#161718] ${url ? 'cursor-pointer hover:border-[#0ECCEE]/80' : ''}`}
                                title={url ? 'Click to adjust crop' : undefined}
                            >
                                {url ? (
                                    <ContentImage src={url} preset={slot.preset} alt="" className="w-full h-full object-cover pointer-events-none" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-600 px-1 text-center">
                                        {slot.short}
                                    </div>
                                )}
                            </button>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-200">{slot.label}</p>
                                <p className="text-xs text-gray-500">{slot.short} aspect</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                {url ? (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => setCropState({
                                                key: slot.key,
                                                aspectId: slot.aspectId,
                                                imageUrl: url,
                                            })}
                                            disabled={Boolean(uploadingKey)}
                                            className="rounded-lg border border-gray-600 hover:border-[#0ECCEE] px-2.5 py-1.5 text-xs text-gray-300 transition-colors disabled:opacity-50"
                                        >
                                            Adjust
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setSlot(slot.key, '')}
                                            className="text-gray-500 hover:text-red-400 p-1"
                                            aria-label={`Remove ${slot.label}`}
                                        >
                                            <X size={16} />
                                        </button>
                                    </>
                                ) : null}
                                <label className="flex items-center gap-1.5 cursor-pointer rounded-lg border border-dashed border-gray-600 hover:border-[#0ECCEE] px-3 py-1.5 text-xs text-gray-400 transition-colors">
                                    {busy ? (
                                        <span className="text-[#0ECCEE]">Uploading…</span>
                                    ) : (
                                        <>
                                            <Upload size={13} />
                                            <span>{url ? 'Replace' : 'Upload'}</span>
                                        </>
                                    )}
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        disabled={Boolean(uploadingKey)}
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            e.target.value = '';
                                            if (file) setCropState({ key: slot.key, aspectId: slot.aspectId, file });
                                        }}
                                    />
                                </label>
                            </div>
                        </div>
                    );
                })}
            </div>

            {(cropState?.file || cropState?.imageUrl) ? (
                <CoverImageCropModal
                    file={cropState.file || null}
                    imageUrl={cropState.imageUrl || ''}
                    fixedAspectId={cropState.aspectId}
                    title={cropState.imageUrl ? 'Adjust cover image' : 'Crop cover image'}
                    onCancel={() => setCropState(null)}
                    onCropped={uploadCropped}
                />
            ) : null}
        </div>
    );
}
