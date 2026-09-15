import { useEffect, useState } from 'react';
import { ArrowLeft, Heart, ImagePlus, Move, Share2, Upload, X } from 'lucide-react';
import CoverImageCropModal from '../CoverImageCropModal';
import ContentImage from '../ContentImage';
import { adminFetch } from '../../services/api/admin.api.js';
import { parseUploadedUrls } from '../../utils/uploadUrls';
import { COMMUNITY_PAGE_HERO } from '../../utils/communityPageHero';

/**
 * Community page banner upload — preview and crop frame match the public page (393×396).
 */
export default function CommunityHeroBannerField({
    value = '',
    onChange,
    onError,
    onUploadingChange,
    communityName = '',
}) {
    const [cropFile, setCropFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [adjusting, setAdjusting] = useState(false);

    const openCropFromUrl = async (url) => {
        if (!url) return;
        setAdjusting(true);
        try {
            const fileFromCanvas = () => new Promise((resolve, reject) => {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.naturalWidth;
                    canvas.height = img.naturalHeight;
                    canvas.getContext('2d').drawImage(img, 0, 0);
                    canvas.toBlob((blob) => {
                        if (!blob) reject(new Error('Could not read banner image'));
                        else resolve(new File([blob], 'banner.jpg', { type: 'image/jpeg' }));
                    }, 'image/jpeg', 0.92);
                };
                img.onerror = () => reject(new Error('Could not load current banner'));
                img.src = url;
            });

            try {
                const res = await fetch(url, { mode: 'cors' });
                if (res.ok) {
                    const blob = await res.blob();
                    const ext = blob.type?.includes('png') ? 'png' : 'jpg';
                    setCropFile(new File([blob], `banner.${ext}`, { type: blob.type || 'image/jpeg' }));
                    return;
                }
            } catch {
                /* fall through to canvas */
            }
            setCropFile(await fileFromCanvas());
        } catch (err) {
            onError?.(err.message || 'Could not open banner for adjustment');
        } finally {
            setAdjusting(false);
        }
    };

    useEffect(() => {
        onUploadingChange?.(uploading);
    }, [uploading, onUploadingChange]);

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
            onChange?.(urls[0]);
        } catch (err) {
            onError?.(err.message || 'Upload failed');
        } finally {
            setUploading(false);
        }
    };

    const { width, height, aspectId, preset, shortLabel } = COMMUNITY_PAGE_HERO;

    return (
        <div className="space-y-3">
            <div className="rounded-2xl border border-gray-700/60 bg-[#1D1E20]/50 overflow-hidden p-4">
                <p className="text-xs text-gray-500 mb-3 text-center">
                    Exact frame on the community page — {shortLabel}px (mobile)
                </p>

                {/* Click preview to re-adjust when banner exists */}
                <button
                    type="button"
                    onClick={() => value && openCropFromUrl(value)}
                    disabled={!value || adjusting}
                    className={`relative mx-auto block overflow-hidden rounded-none shadow-lg ring-1 ring-gray-700/80 transition-opacity ${
                        value ? 'cursor-pointer hover:ring-[#0ECCEE]/50' : 'cursor-default'
                    }`}
                    style={{
                        width: '100%',
                        maxWidth: `${width}px`,
                        aspectRatio: `${width} / ${height}`,
                        minHeight: `${Math.min(height, 280)}px`,
                    }}
                    aria-label={value ? 'Adjust banner position' : 'Banner preview'}
                >
                    <div className="absolute inset-0 bg-linear-to-br from-green-900 via-emerald-800 to-teal-700">
                    {value ? (
                        <ContentImage
                            src={value}
                            preset={preset}
                            alt={communityName ? `${communityName} banner` : 'Community banner'}
                            className="absolute inset-0 w-full h-full object-cover"
                        />
                    ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-gray-400 px-6 text-center">
                            <ImagePlus size={32} className="opacity-40" />
                            <p className="text-xs leading-snug">
                                Upload and crop to fit this box — what you see here is what visitors get
                            </p>
                        </div>
                    )}

                    <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/20 to-black/30 pointer-events-none" />

                    {/* Top bar — matches community page */}
                    <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-3 pt-8 pointer-events-none">
                        <div className="size-9 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center border border-white/10">
                            <ArrowLeft size={18} className="text-white" />
                        </div>
                        <div className="flex gap-2">
                            <div className="size-9 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center border border-white/10">
                                <Share2 size={16} className="text-white" />
                            </div>
                            <div className="size-9 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center border border-white/10">
                                <Heart size={16} className="text-white" />
                            </div>
                        </div>
                    </div>

                    {/* Stats badges — bottom-20 on public page */}
                    <div className="absolute bottom-[5rem] left-3 flex gap-2 pointer-events-none">
                        {['Treks', 'Categories'].map((label) => (
                            <div
                                key={label}
                                className="rounded-2xl bg-black/50 px-2.5 py-1.5 border border-white/10"
                            >
                                <p className="text-white text-sm font-bold leading-none">—</p>
                                <p className="text-white/70 text-[9px] font-medium mt-0.5">{label}</p>
                            </div>
                        ))}
                    </div>

                    {/* Content card peek — slides over hero on public page */}
                    <div className="absolute bottom-0 left-0 right-0 h-10 rounded-t-3xl bg-slate-100 pointer-events-none" />

                    {value ? (
                        <div className="absolute inset-0 flex items-end justify-center pb-12 pointer-events-none">
                            <span className="rounded-full bg-black/55 backdrop-blur-sm px-3 py-1 text-[10px] font-medium text-white border border-white/15">
                                {adjusting ? 'Opening…' : 'Tap to adjust position'}
                            </span>
                        </div>
                    ) : null}
                    </div>
                </button>

                <p className="text-[10px] text-center text-gray-600 mt-3 px-2">
                    Drag &amp; zoom to fill the frame — no black borders. Tap preview or use Adjust fit to reposition anytime.
                </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                {value ? (
                    <button
                        type="button"
                        onClick={() => openCropFromUrl(value)}
                        disabled={adjusting || uploading}
                        className="inline-flex items-center gap-2 rounded-lg border border-gray-600 hover:border-[#0ECCEE] px-4 py-2.5 text-sm text-gray-300 transition-colors disabled:opacity-50"
                    >
                        <Move size={15} />
                        {adjusting ? 'Opening…' : 'Adjust fit'}
                    </button>
                ) : null}
                <label className="inline-flex items-center gap-2 cursor-pointer rounded-lg border border-dashed border-gray-600 hover:border-[#0ECCEE] px-4 py-2.5 text-sm text-gray-300 transition-colors">
                    {uploading ? (
                        <span className="text-[#0ECCEE]">Uploading…</span>
                    ) : (
                        <>
                            <Upload size={15} />
                            <span>{value ? 'Replace & crop banner' : 'Upload & crop banner'}</span>
                        </>
                    )}
                    <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={uploading}
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            e.target.value = '';
                            if (file) setCropFile(file);
                        }}
                    />
                </label>
                {value ? (
                    <button
                        type="button"
                        onClick={() => onChange?.('')}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-700 px-3 py-2.5 text-sm text-gray-400 hover:text-red-400 hover:border-red-900/50 transition-colors"
                    >
                        <X size={15} />
                        Remove
                    </button>
                ) : null}
            </div>

            {cropFile ? (
                <CoverImageCropModal
                    file={cropFile}
                    fixedAspectId={aspectId}
                    fillFrame
                    title="Adjust community banner"
                    onCancel={() => setCropFile(null)}
                    onCropped={uploadCropped}
                />
            ) : null}
        </div>
    );
}
