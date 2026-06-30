import { useState } from 'react';
import { X, Upload, ImagePlus } from 'lucide-react';
import CoverImageCropModal from '../CoverImageCropModal';
import ContentImage from '../ContentImage';
import { adminFetch } from '../../utils/adminApi';
import { parseUploadedUrls } from '../../utils/uploadUrls';

import { CROP_ASPECT_OPTIONS } from '../../utils/coverCropAspects';

const SIZE_PREVIEWS = [
    { label: 'Portrait', preset: 'cardPortrait', className: 'w-14 aspect-[10/13] rounded-lg overflow-hidden' },
    { label: 'Wide', preset: 'cardWide', className: 'w-20 aspect-[10/7] rounded-lg overflow-hidden' },
    { label: 'Hero', preset: 'hero', className: 'w-24 aspect-[120/56] rounded-lg overflow-hidden' },
    { label: 'Square', preset: 'square', className: 'w-14 aspect-square rounded-lg overflow-hidden' },
    { label: 'Landscape', preset: 'cardLandscape', className: 'w-20 aspect-[5/3] rounded-lg overflow-hidden' },
    { label: 'Video', preset: 'cardVideo', className: 'w-20 aspect-video rounded-lg overflow-hidden' },
];

function CoverSizePreviews({ url }) {
    if (!url) return null;
    return (
        <div className="mt-3">
            <p className="text-xs text-gray-500 mb-2">Site auto-crops per layout ({CROP_ASPECT_OPTIONS.length} card types)</p>
            <div className="flex items-end gap-3 flex-wrap">
                {SIZE_PREVIEWS.map(({ label, preset, className }) => (
                    <div key={preset} className="text-center">
                        <div className={`${className} border border-gray-700 bg-[#1D1E20] mx-auto`}>
                            <ContentImage src={url} preset={preset} alt="" className="w-full h-full object-cover" />
                        </div>
                        <p className="text-[10px] text-gray-600 mt-1">{label}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}

/**
 * Admin cover image picker with crop-before-upload flow.
 */
export default function CoverImageUploadField({
    value,
    onChange,
    onError,
    uploading = false,
    onUploadingChange,
    layout = 'stack',
    label = 'Cover Image',
    hint,
    uploadLabel,
    replaceLabel,
    className = '',
}) {
    const [cropFile, setCropFile] = useState(null);
    const [internalUploading, setInternalUploading] = useState(false);
    const isUploading = uploading ?? internalUploading;
    const setUploading = (v) => {
        if (onUploadingChange) onUploadingChange(v);
        else setInternalUploading(v);
    };

    const handleFileSelect = (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (file) setCropFile(file);
    };

    const uploadCropped = async (file) => {
        setCropFile(null);
        setUploading(true);
        try {
            const fd = new FormData();
            fd.append('images', file);
            const res = await adminFetch('/admin/upload/images', { method: 'POST', body: fd });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || data.error || 'Upload failed');
            const urls = parseUploadedUrls(data);
            if (!urls.length) throw new Error('Upload succeeded but no image URL was returned');
            onChange(urls[0]);
        } catch (err) {
            onError?.(err.message || 'Upload failed');
        } finally {
            setUploading(false);
        }
    };

    const pickLabel = value ? (replaceLabel || 'Replace cover') : (uploadLabel || 'Upload cover image');
    const UploadIcon = layout === 'compact' ? ImagePlus : Upload;

    const uploadControl = (
        <label className={`flex items-center gap-2 cursor-pointer bg-[#1D1E20] border border-dashed border-gray-500 hover:border-[#0ECCEE] rounded-lg px-4 py-2 text-sm text-gray-400 transition-colors ${layout === 'compact' ? 'h-20' : 'w-fit'}`}>
            {isUploading ? (
                <span className="text-[#0ECCEE]">Uploading...</span>
            ) : (
                <>
                    <UploadIcon size={layout === 'compact' ? 16 : 14} />
                    <span>{pickLabel}</span>
                </>
            )}
            <input
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                disabled={isUploading}
                className="hidden"
            />
        </label>
    );

    return (
        <div className={className}>
            {label ? (
                <div className="block text-sm font-medium text-gray-300 mb-2">{label}</div>
            ) : null}

            {layout === 'compact' ? (
                <div className="flex items-start gap-4">
                    {value ? (
                        <div className="relative w-32 h-[10.4rem] shrink-0 rounded-lg overflow-hidden border border-gray-600">
                            <ContentImage src={value} preset="cardPortrait" alt="Cover" className="w-full h-full object-cover" />
                            <button
                                type="button"
                                onClick={() => onChange('')}
                                className="absolute -top-1.5 -right-1.5 bg-red-600 rounded-full p-0.5 hover:bg-red-700"
                                aria-label="Remove cover"
                            >
                                <X size={10} />
                            </button>
                        </div>
                    ) : null}
                    {uploadControl}
                </div>
            ) : (
                <>
                    {value ? (
                        <div className="relative w-full aspect-[10/13] max-h-48 mb-2 rounded-xl overflow-hidden">
                            <ContentImage src={value} preset="cardPortrait" alt="Cover" className="w-full h-full object-cover" />
                            <button
                                type="button"
                                onClick={() => onChange('')}
                                className="absolute top-2 right-2 bg-red-600 rounded-full p-1 hover:bg-red-700"
                                aria-label="Remove cover"
                            >
                                <X size={12} />
                            </button>
                        </div>
                    ) : null}
                    {uploadControl}
                </>
            )}

            {hint ? <p className="text-xs text-gray-500 mt-1">{hint}</p> : null}
            <CoverSizePreviews url={value} />

            {cropFile ? (
                <CoverImageCropModal
                    file={cropFile}
                    onCancel={() => setCropFile(null)}
                    onCropped={uploadCropped}
                />
            ) : null}
        </div>
    );
}
