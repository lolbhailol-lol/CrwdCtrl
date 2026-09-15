import { useState, useEffect } from 'react';
import { X, Upload } from 'lucide-react';
import { adminFetch } from '../../services/api/admin.api.js';
import { normalizeImageList, normalizeImageUrl, parseUploadedUrls } from '../../utils/uploadUrls';

const GALLERY_PREVIEW_COUNT = 4;

function GalleryPreviewRow({ images }) {
    if (!images.length) {
        return (
            <p className="text-xs text-gray-500 rounded-lg border border-dashed border-gray-600 px-3 py-2">
                No gallery images yet. Upload photos for the gallery row on the detail page.
            </p>
        );
    }

    return (
        <div>
            <p className="text-xs text-gray-500 mb-2">Preview — scrollable gallery on the public fest page</p>
            <div className="flex gap-2 overflow-x-auto pb-1 max-w-full [scrollbar-width:thin]">
                {images.slice(0, GALLERY_PREVIEW_COUNT).map((url, i) => {
                    const isOverflowTile = images.length > GALLERY_PREVIEW_COUNT && i === GALLERY_PREVIEW_COUNT - 1;
                    const remainingCount = images.length - GALLERY_PREVIEW_COUNT;
                    return (
                        <div
                            key={`${url}-${i}`}
                            className="relative shrink-0 w-28 h-20 rounded-xl overflow-hidden bg-[#1D1E20] border border-gray-700"
                        >
                            <img src={url} alt="" className="absolute inset-0 w-full h-full object-cover" />
                            {isOverflowTile ? (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/55">
                                    <span className="text-white text-sm font-semibold">{remainingCount}+</span>
                                </div>
                            ) : null}
                        </div>
                    );
                })}
            </div>
            <p className="text-[11px] text-gray-600 mt-2">
                {images.length} gallery image{images.length !== 1 ? 's' : ''} · separate from cover images
            </p>
        </div>
    );
}

/**
 * Gallery-only upload — does not touch cover images.
 * Pass `uploadImages(FormData)` for organizer/non-admin upload endpoints.
 */
export default function GalleryImagesUploadField({
    value = [],
    onChange,
    onError,
    onUploadingChange,
    uploadImages,
    hint = 'Extra photos for the Gallery section at the bottom of the detail page.',
    uploadLabel = 'Upload gallery images',
    className = '',
}) {
    const images = normalizeImageList(value);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        onUploadingChange?.(uploading);
    }, [uploading, onUploadingChange]);

    const uploadFiles = async (files) => {
        if (!files.length) return;
        setUploading(true);
        try {
            const fd = new FormData();
            files.forEach((f) => fd.append('images', f));
            let data;
            if (typeof uploadImages === 'function') {
                const result = await uploadImages(fd);
                // Organizer adapter returns a Fetch Response; admin helpers may return JSON
                if (result && typeof result.json === 'function') {
                    data = await result.json();
                    if (!result.ok) throw new Error(data.message || data.error || 'Upload failed');
                } else {
                    data = result;
                }
            } else {
                const res = await adminFetch('/admin/upload/images', { method: 'POST', body: fd });
                data = await res.json();
                if (!res.ok) throw new Error(data.message || data.error || 'Upload failed');
            }
            const urls = parseUploadedUrls(data);
            if (!urls.length) throw new Error('Upload succeeded but no image URL was returned');
            onChange([...images, ...urls]);
        } catch (err) {
            onError?.(err.message || 'Upload failed');
        } finally {
            setUploading(false);
        }
    };

    const removeAt = (index) => {
        onChange(images.filter((_, j) => j !== index));
    };

    return (
        <div className={className}>
            {hint ? <p className="text-xs text-gray-500 mb-3">{hint}</p> : null}

            {images.length > 0 && (
                <div className="flex gap-2 mb-3 overflow-x-auto pb-1 [scrollbar-width:thin]">
                    {images.map((url, i) => (
                        <div key={`${url}-${i}`} className="relative w-20 h-20 shrink-0">
                            <img
                                src={normalizeImageUrl(url) || url}
                                alt=""
                                className="w-full h-full object-cover rounded-lg border border-gray-600"
                            />
                            <button
                                type="button"
                                onClick={() => removeAt(i)}
                                className="absolute -top-1.5 -right-1.5 bg-red-600 rounded-full p-0.5 hover:bg-red-700"
                                aria-label="Remove gallery image"
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
                        <Upload size={14} />
                        <span>{uploadLabel}</span>
                    </>
                )}
                <input
                    type="file"
                    accept="image/*"
                    multiple
                    disabled={uploading}
                    className="hidden"
                    onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        e.target.value = '';
                        if (files.length) uploadFiles(files);
                    }}
                />
            </label>

            <div className="mt-3">
                <GalleryPreviewRow images={images} />
            </div>
        </div>
    );
}
