import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { X, ZoomIn, ZoomOut, Check, Loader2, Minimize2, Maximize2 } from 'lucide-react';
import {
    CROP_ASPECT_OPTIONS,
    CROP_ORIGINAL_OPTION,
    VIEW_MAX_W,
    findCropAspect,
    getViewDimensions,
} from '../utils/coverCropAspects';

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const FILL_FRAME_MIN_ZOOM = 1;
const DEFAULT_FRAMING = () => ({ zoom: 1, offset: { x: 0, y: 0 } });

/**
 * Cover cropper with per-layout aspect tabs (portrait, wide, hero, square, …).
 * fillFrame — image must always cover the crop box (min zoom 1, no letterbox gaps).
 */
export default function CoverImageCropModal({
    file,
    imageUrl = '',
    isDark = true,
    fixedAspectId,
    fillFrame = false,
    title = 'Crop cover image',
    onCancel,
    onCropped,
}) {
    const minZoom = fillFrame ? FILL_FRAME_MIN_ZOOM : MIN_ZOOM;
    const [imgSrc, setImgSrc] = useState('');
    const [imgEl, setImgEl] = useState(null);
    const [activeAspectId, setActiveAspectId] = useState(fixedAspectId || CROP_ASPECT_OPTIONS[0].id);
    const [framingByAspect, setFramingByAspect] = useState({});
    const [processing, setProcessing] = useState(false);
    const [minimized, setMinimized] = useState(false);

    const dragRef = useRef(null);
    const pointersRef = useRef(new Map());
    const pinchRef = useRef(null);

    const isOriginal = activeAspectId === CROP_ORIGINAL_OPTION.id;
    const aspect = findCropAspect(activeAspectId);
    const { viewW, viewH } = useMemo(() => {
        if (isOriginal && imgEl) {
            const ratio = imgEl.naturalWidth / imgEl.naturalHeight;
            const maxH = 380;
            if (ratio >= 1) {
                const w = VIEW_MAX_W;
                return { viewW: w, viewH: Math.min(maxH, Math.round(w / ratio)) };
            }
            const h = maxH;
            return { viewW: Math.round(h * ratio), viewH: h };
        }
        return getViewDimensions(aspect.ratio);
    }, [isOriginal, aspect.ratio, imgEl]);

    const framing = framingByAspect[activeAspectId] || DEFAULT_FRAMING();
    const { zoom, offset } = framing;

    const setFraming = useCallback((patch) => {
        setFramingByAspect((prev) => ({
            ...prev,
            [activeAspectId]: { ...(prev[activeAspectId] || DEFAULT_FRAMING()), ...patch },
        }));
    }, [activeAspectId]);

    const setZoom = (v) => setFraming({ zoom: v });
    const setOffset = (v) => setFraming({ offset: v });

    useEffect(() => {
        setFramingByAspect({});
        setActiveAspectId(fixedAspectId || CROP_ASPECT_OPTIONS[0].id);
        setMinimized(false);
        setImgEl(null);

        if (file) {
            const url = URL.createObjectURL(file);
            setImgSrc(url);
            return () => URL.revokeObjectURL(url);
        }

        const remote = String(imageUrl || '').trim();
        if (remote) {
            setImgSrc(remote);
            return undefined;
        }

        setImgSrc('');
        return undefined;
    }, [file, imageUrl, fixedAspectId]);

    useEffect(() => {
        if (!imgSrc) return;
        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.onload = () => setImgEl(image);
        image.onerror = () => {
            // Retry without CORS if CDN blocks anonymous (canvas may still taint)
            const fallback = new Image();
            fallback.onload = () => setImgEl(fallback);
            fallback.src = imgSrc;
        };
        image.src = imgSrc;
    }, [imgSrc]);

    const baseScale = imgEl
        ? Math.max(viewW / imgEl.naturalWidth, viewH / imgEl.naturalHeight)
        : 1;
    const displayScale = baseScale * zoom;
    const dispW = imgEl ? imgEl.naturalWidth * displayScale : viewW;
    const dispH = imgEl ? imgEl.naturalHeight * displayScale : viewH;

    const clampOffset = useCallback(
        (next) => {
            const maxX = Math.max(0, (dispW - viewW) / 2);
            const maxY = Math.max(0, (dispH - viewH) / 2);
            return {
                x: Math.min(maxX, Math.max(-maxX, next.x)),
                y: Math.min(maxY, Math.max(-maxY, next.y)),
            };
        },
        [dispW, dispH, viewW, viewH],
    );

    useEffect(() => {
        if (fillFrame && zoom < minZoom) setZoom(minZoom);
    }, [fillFrame, zoom, minZoom, setZoom]);

    useEffect(() => {
        setFramingByAspect((prev) => {
            const current = prev[activeAspectId] || DEFAULT_FRAMING();
            const clamped = clampOffset(current.offset);
            if (clamped.x === current.offset.x && clamped.y === current.offset.y) return prev;
            return { ...prev, [activeAspectId]: { ...current, offset: clamped } };
        });
    }, [activeAspectId, viewW, viewH, clampOffset]);

    const pinchDistance = () => {
        const pts = [...pointersRef.current.values()];
        if (pts.length < 2) return 0;
        return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    };

    const onPointerDown = (e) => {
        if (isOriginal) return;
        e.currentTarget.setPointerCapture?.(e.pointerId);
        pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

        if (pointersRef.current.size === 2) {
            dragRef.current = null;
            pinchRef.current = { startDist: pinchDistance() || 1, baseZoom: zoom };
        } else {
            dragRef.current = { startX: e.clientX, startY: e.clientY, baseX: offset.x, baseY: offset.y };
        }
    };

    const onPointerMove = (e) => {
        if (isOriginal) return;
        if (pointersRef.current.has(e.pointerId)) {
            pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        }

        if (pinchRef.current && pointersRef.current.size >= 2) {
            const dist = pinchDistance();
            if (dist > 0) {
                const next = pinchRef.current.baseZoom * (dist / pinchRef.current.startDist);
                setZoom(Math.min(MAX_ZOOM, Math.max(minZoom, next)));
            }
            return;
        }

        if (!dragRef.current) return;
        const dx = e.clientX - dragRef.current.startX;
        const dy = e.clientY - dragRef.current.startY;
        setOffset(clampOffset({ x: dragRef.current.baseX + dx, y: dragRef.current.baseY + dy }));
    };

    const onPointerUp = (e) => {
        pointersRef.current.delete(e.pointerId);
        if (pointersRef.current.size < 2) pinchRef.current = null;
        if (pointersRef.current.size === 1) {
            const [remaining] = [...pointersRef.current.values()];
            dragRef.current = { startX: remaining.x, startY: remaining.y, baseX: offset.x, baseY: offset.y };
        } else if (pointersRef.current.size === 0) {
            dragRef.current = null;
        }
    };

    const exportOriginal = async () => {
        if (!imgEl) return;
        const maxSide = 1600;
        const scale = Math.min(1, maxSide / Math.max(imgEl.naturalWidth, imgEl.naturalHeight));
        const w = Math.round(imgEl.naturalWidth * scale);
        const h = Math.round(imgEl.naturalHeight * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(imgEl, 0, 0, w, h);
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
        if (!blob) return;
        onCropped?.(new File([blob], 'cover.jpg', { type: 'image/jpeg' }));
    };

    const exportCropped = async () => {
        if (!imgEl) return;
        const canvas = document.createElement('canvas');
        canvas.width = aspect.outputW;
        canvas.height = aspect.outputH;
        const ctx = canvas.getContext('2d');

        const tlx = viewW / 2 - dispW / 2 + offset.x;
        const tly = viewH / 2 - dispH / 2 + offset.y;
        const sx = (0 - tlx) / displayScale;
        const sy = (0 - tly) / displayScale;
        const sW = viewW / displayScale;
        const sH = viewH / displayScale;

        ctx.drawImage(imgEl, sx, sy, sW, sH, 0, 0, aspect.outputW, aspect.outputH);

        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
        if (!blob) return;
        onCropped?.(new File([blob], 'cover.jpg', { type: 'image/jpeg' }));
    };

    const handleConfirm = async () => {
        if (!imgEl) return;
        setProcessing(true);
        try {
            if (fixedAspectId || !isOriginal) await exportCropped();
            else await exportOriginal();
        } catch {
            // keep modal open on failure
        } finally {
            setProcessing(false);
        }
    };

    const aspectTabs = (
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
            {[...CROP_ASPECT_OPTIONS, CROP_ORIGINAL_OPTION].map((opt) => {
                const active = activeAspectId === opt.id;
                return (
                    <button
                        key={opt.id}
                        type="button"
                        disabled={processing}
                        onClick={() => setActiveAspectId(opt.id)}
                        className={`shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            active
                                ? 'bg-[#0ECCEE] text-black'
                                : isDark
                                    ? 'bg-[#1D1E20] text-gray-400 border border-gray-700 hover:border-gray-500'
                                    : 'bg-gray-100 text-gray-600 border border-gray-200'
                        }`}
                    >
                        {opt.label}
                        {opt.short ? <span className="opacity-70 ml-1">{opt.short}</span> : null}
                    </button>
                );
            })}
        </div>
    );

    const cropViewport = (
        <div
            className={`relative overflow-hidden rounded-xl touch-none select-none ring-2 ring-white/30 mx-auto ${
                isOriginal ? '' : 'cursor-grab active:cursor-grabbing'
            } ${fillFrame ? 'bg-[#1a3a2a]' : 'bg-black'}`}
            style={{ width: viewW, height: viewH, maxWidth: '100%' }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
        >
            {imgEl && (
                <img
                    src={imgSrc}
                    alt="Crop preview"
                    draggable={false}
                    style={
                        isOriginal
                            ? {
                                position: 'absolute',
                                inset: 0,
                                width: '100%',
                                height: '100%',
                                objectFit: 'contain',
                            }
                            : {
                                position: 'absolute',
                                left: '50%',
                                top: '50%',
                                width: dispW,
                                height: dispH,
                                transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
                                maxWidth: 'none',
                            }
                    }
                />
            )}
        </div>
    );

    const zoomControls = !isOriginal ? (
        <>
            <div className="flex items-center gap-3 mt-4">
                <ZoomOut className={`w-5 h-5 shrink-0 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                <input
                    type="range"
                    min={minZoom}
                    max={MAX_ZOOM}
                    step="0.01"
                    value={Math.max(minZoom, zoom)}
                    onChange={(e) => setZoom(parseFloat(e.target.value))}
                    className="w-full accent-[#0ECCEE]"
                    aria-label="Zoom"
                />
                <ZoomIn className={`w-5 h-5 shrink-0 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
            </div>
            {fillFrame ? (
                <p className="text-xs text-gray-500 mt-2 text-center">
                    Drag to reposition · zoom in to crop tighter — frame stays full, no empty borders
                </p>
            ) : null}
        </>
    ) : (
        <p className="text-xs text-gray-500 mt-3 text-center">Full image — site auto-crops per card layout</p>
    );

    const actionButtons = (compact = false) => (
        <div className={`flex gap-2 ${compact ? '' : 'mt-4 gap-3'}`}>
            <button
                type="button"
                onClick={onCancel}
                disabled={processing}
                className={`${compact ? 'px-3 py-2 text-xs' : 'flex-1 py-2.5'} rounded-xl font-medium transition-colors ${
                    isDark
                        ? 'bg-[#111213] border border-gray-800 hover:bg-gray-800'
                        : 'bg-gray-50 border border-gray-200 hover:bg-gray-100'
                }`}
            >
                Cancel
            </button>
            <button
                type="button"
                onClick={handleConfirm}
                disabled={processing || !imgEl}
                className={`${compact ? 'px-3 py-2 text-xs' : 'flex-1 py-2.5'} rounded-xl font-semibold text-black bg-[#0ECCEE] hover:bg-[#0ECCEE]/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5`}
            >
                {processing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                    <>
                        <Check className="w-4 h-4" />
                        {isOriginal ? 'Use original' : `Use ${aspect.label.toLowerCase()}`}
                    </>
                )}
            </button>
        </div>
    );

    const headerHint = fixedAspectId
        ? `Crop for ${aspect.label}${aspect.short ? ` · ${aspect.short}` : ''}`
        : isOriginal
            ? 'Upload full image — Cloudinary adapts each card size'
            : `Crop for ${aspect.label} cards · switch tabs to preview other layouts`;

    if (minimized) {
        return (
            <div className="fixed bottom-4 right-4 z-[10000] max-w-[calc(100vw-2rem)]">
                <div
                    className={`rounded-2xl border shadow-2xl p-3 ${
                        isDark ? 'bg-[#161718] border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-900'
                    }`}
                >
                    <div className="flex items-center gap-3">
                        <div
                            className="shrink-0 overflow-hidden rounded-lg ring-1 ring-white/20 pointer-events-none"
                            style={{ width: 72, height: Math.round(72 * (viewH / viewW)) }}
                        >
                            <div
                                style={{
                                    transform: `scale(${72 / viewW})`,
                                    transformOrigin: 'top left',
                                    width: viewW,
                                    height: viewH,
                                }}
                            >
                                {cropViewport}
                            </div>
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold truncate">
                                Crop · {isOriginal ? 'Original' : aspect.label}
                            </p>
                            <p className="text-[11px] text-gray-500">Minimized — expand to adjust</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setMinimized(false)}
                            disabled={processing}
                            aria-label="Expand crop editor"
                            className={`shrink-0 rounded-lg p-2 transition-colors ${
                                isDark ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-gray-100 text-gray-600'
                            }`}
                        >
                            <Maximize2 className="w-4 h-4" />
                        </button>
                        <button
                            type="button"
                            onClick={onCancel}
                            disabled={processing}
                            aria-label="Cancel crop"
                            className={`shrink-0 rounded-lg p-2 transition-colors ${
                                isDark ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-gray-100 text-gray-600'
                            }`}
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="mt-2.5">{actionButtons(true)}</div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={processing ? undefined : onCancel}
            />
            <div
                className={`relative w-full max-w-md rounded-2xl p-5 shadow-2xl max-h-[95vh] overflow-y-auto ${
                    isDark ? 'bg-[#161718] text-white' : 'bg-white text-gray-900'
                }`}
            >
                <div className="flex items-center justify-between mb-3">
                    <div>
                        <h3 className="text-lg font-semibold">{title}</h3>
                        <p className="text-xs text-gray-500 mt-0.5">{headerHint}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                        <button
                            type="button"
                            onClick={() => setMinimized(true)}
                            disabled={processing}
                            aria-label="Minimize"
                            className={`rounded-lg p-1 transition-colors ${
                                isDark ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-gray-100 text-gray-600'
                            }`}
                        >
                            <Minimize2 className="w-5 h-5" />
                        </button>
                        <button
                            type="button"
                            onClick={onCancel}
                            disabled={processing}
                            aria-label="Cancel"
                            className={`rounded-lg p-1 transition-colors ${
                                isDark ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-gray-100 text-gray-600'
                            }`}
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {!fixedAspectId ? aspectTabs : null}
                <div className="mt-3">{cropViewport}</div>
                {zoomControls}
                {actionButtons()}
            </div>
        </div>
    );
}
