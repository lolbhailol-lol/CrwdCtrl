import { useEffect, useState } from 'react';
import { X, Upload } from 'lucide-react';
import CoverImageCropModal from '../CoverImageCropModal';
import { adminFetch } from '../../utils/adminApi';
import { normalizeImageList, normalizeImageUrl, parseUploadedUrls } from '../../utils/uploadUrls';

/**
 * Multi-image upload with crop-before-upload (size-wise).
 * Used for trek detail hero slider (393×396 / communityBanner aspect).
 */
export default function CroppedMultiImagesUpload({
    value = [],
    onChange,
    onError,
    onUploadingChange,
    max = 5,
    fixedAspectId = 'communityBanner',
    fillFrame = true,
    title = 'Crop image',
    hint = '',
    uploadLabel = 'Add image',
    className = '',
}) {
    const images = normalizeImageList(value).slice(0, max);
    const [cropFile, setCropFile] = useState(null);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        onUploadingChange?.(uploading);
    }, [uploading, onUploadingChange]);

    const uploadCropped = async (file) => {
        setCropFile(null);
        if (!file) return;
        if (images.length >= max) {
            onError?.(`Maximum ${max} images`);
            return;
        }
        setUploading(true);
        try {
            const fd = new FormData();
            fd.append('images', file);
            const res = await adminFetch('/admin/upload/images', { method: 'POST', body: fd });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || data.error || 'Upload failed');
            const urls = parseUploadedUrls(data);
            if (!urls.length) throw new Error('Upload succeeded but no image URL was returned');
            onChange([...images, urls[0]].slice(0, max));
        } catch (err) {
            onError?.(err.message || 'Upload failed');
        } finally {
            setUploading(false);
        }
    };

    const removeAt = (index) => {
        onChange(images.filter((_, j) => j !== index));
    };

    const canAdd = images.length < max && !uploading;

    return (
        <div className={className}>
            {hint ? <p className="text-xs text-gray-500 mb-3">{hint}</p> : null}

            {images.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                    {images.map((url, i) => (
                        <div key={`${url}-${i}`} className="relative w-[72px] h-[72px]">
                            <img
                                src={normalizeImageUrl(url) || url}
                                alt=""
                                className="w-full h-full object-cover rounded-lg border border-gray-600"
                            />
                            <span className="absolute left-1 bottom-1 text-[9px] font-bold px-1 py-0.5 rounded bg-black/60 text-white tabular-nums">
                                {i + 1}
                            </span>
                            <button
                                type="button"
                                onClick={() => removeAt(i)}
                                className="absolute -top-1.5 -right-1.5 bg-red-600 rounded-full p-0.5 hover:bg-red-700"
                                aria-label="Remove image"
                            >
                                <X size={10} />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <label
                className={`flex items-center gap-2 w-fit rounded-lg px-4 py-2 text-sm transition-colors border border-dashed ${
                    canAdd
                        ? 'cursor-pointer bg-[#1D1E20] border-gray-500 hover:border-[#0ECCEE] text-gray-400'
                        : 'cursor-not-allowed bg-[#1D1E20]/50 border-gray-700 text-gray-600'
                }`}
            >
                {uploading ? (
                    <span className="text-[#0ECCEE]">Uploading…</span>
                ) : (
                    <>
                        <Upload size={14} />
                        <span>{images.length >= max ? `Max ${max} images` : uploadLabel}</span>
                    </>
                )}
                <input
                    type="file"
                    accept="image/*"
                    disabled={!canAdd}
                    className="hidden"
                    onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        if (file) setCropFile(file);
                    }}
                />
            </label>

            <p className="text-[11px] text-gray-600 mt-2">
                {images.length}/{max} · each image is cropped to the detail-page hero frame before upload
            </p>

            {cropFile ? (
                <CoverImageCropModal
                    file={cropFile}
                    fixedAspectId={fixedAspectId}
                    fillFrame={fillFrame}
                    title={title}
                    onCancel={() => setCropFile(null)}
                    onCropped={uploadCropped}
                />
            ) : null}
        </div>
    );
}
