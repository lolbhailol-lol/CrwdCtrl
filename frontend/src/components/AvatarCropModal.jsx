import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X, ZoomIn, Check, Loader2 } from 'lucide-react';

const VIEW = 288; // square viewport (px)
const OUTPUT = 512; // exported image size (px)

/**
 * Square avatar cropper with pinch/drag pan + zoom.
 * Props:
 *  - file: the selected image File
 *  - isDark: theme flag
 *  - onCancel(): close without saving
 *  - onCropped(file): receives the cropped square File (image/jpeg)
 */
export default function AvatarCropModal({ file, isDark = false, onCancel, onCropped }) {
    const [imgSrc, setImgSrc] = useState('');
    const [imgEl, setImgEl] = useState(null);
    const [zoom, setZoom] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [processing, setProcessing] = useState(false);
    const dragRef = useRef(null);
    const pointersRef = useRef(new Map());
    const pinchRef = useRef(null);

    useEffect(() => {
        if (!file) return undefined;
        const url = URL.createObjectURL(file);
        setImgSrc(url);
        return () => URL.revokeObjectURL(url);
    }, [file]);

    useEffect(() => {
        if (!imgSrc) return;
        const image = new Image();
        image.onload = () => setImgEl(image);
        image.src = imgSrc;
    }, [imgSrc]);

    // Base scale so the image's shorter side covers the viewport ("cover" fit).
    const baseScale = imgEl
        ? VIEW / Math.min(imgEl.naturalWidth, imgEl.naturalHeight)
        : 1;
    const displayScale = baseScale * zoom;
    const dispW = imgEl ? imgEl.naturalWidth * displayScale : VIEW;
    const dispH = imgEl ? imgEl.naturalHeight * displayScale : VIEW;

    const clampOffset = useCallback(
        (next) => {
            const maxX = Math.max(0, (dispW - VIEW) / 2);
            const maxY = Math.max(0, (dispH - VIEW) / 2);
            return {
                x: Math.min(maxX, Math.max(-maxX, next.x)),
                y: Math.min(maxY, Math.max(-maxY, next.y)),
            };
        },
        [dispW, dispH],
    );

    useEffect(() => {
        setOffset((prev) => clampOffset(prev));
    }, [clampOffset]);

    const pinchDistance = () => {
        const pts = [...pointersRef.current.values()];
        if (pts.length < 2) return 0;
        const dx = pts[0].x - pts[1].x;
        const dy = pts[0].y - pts[1].y;
        return Math.hypot(dx, dy);
    };

    const onPointerDown = (e) => {
        e.currentTarget.setPointerCapture?.(e.pointerId);
        pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

        if (pointersRef.current.size === 2) {
            // Start a pinch: anchor on the current distance + zoom, pause dragging.
            dragRef.current = null;
            pinchRef.current = { startDist: pinchDistance() || 1, baseZoom: zoom };
        } else {
            // Single pointer: start (or restart) a drag.
            dragRef.current = { startX: e.clientX, startY: e.clientY, baseX: offset.x, baseY: offset.y };
        }
    };

    const onPointerMove = (e) => {
        if (pointersRef.current.has(e.pointerId)) {
            pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        }

        if (pinchRef.current && pointersRef.current.size >= 2) {
            const dist = pinchDistance();
            if (dist > 0) {
                const next = pinchRef.current.baseZoom * (dist / pinchRef.current.startDist);
                setZoom(Math.min(3, Math.max(1, next)));
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

        if (pointersRef.current.size < 2) {
            pinchRef.current = null;
        }
        if (pointersRef.current.size === 1) {
            // Resume dragging from the remaining pointer.
            const [remaining] = [...pointersRef.current.values()];
            dragRef.current = { startX: remaining.x, startY: remaining.y, baseX: offset.x, baseY: offset.y };
        } else if (pointersRef.current.size === 0) {
            dragRef.current = null;
        }
    };

    const handleConfirm = async () => {
        if (!imgEl) return;
        setProcessing(true);
        try {
            const canvas = document.createElement('canvas');
            canvas.width = OUTPUT;
            canvas.height = OUTPUT;
            const ctx = canvas.getContext('2d');

            // Top-left of the displayed image inside the viewport coordinate space.
            const tlx = VIEW / 2 - dispW / 2 + offset.x;
            const tly = VIEW / 2 - dispH / 2 + offset.y;

            // Map the viewport square back to source-image pixels.
            const sx = (0 - tlx) / displayScale;
            const sy = (0 - tly) / displayScale;
            const sSize = VIEW / displayScale;

            ctx.drawImage(imgEl, sx, sy, sSize, sSize, 0, 0, OUTPUT, OUTPUT);

            const blob = await new Promise((resolve) =>
                canvas.toBlob(resolve, 'image/jpeg', 0.9),
            );
            if (!blob) {
                setProcessing(false);
                return;
            }
            const croppedFile = new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
            onCropped?.(croppedFile);
        } catch {
            setProcessing(false);
        }
    };

    return (
        <div className="fixed inset-0 z-10000 flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={processing ? undefined : onCancel}
            />
            <div
                className={`relative w-full max-w-sm rounded-2xl p-5 shadow-2xl ${
                    isDark ? 'bg-[#161718] text-white' : 'bg-white text-gray-900'
                }`}
            >
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Adjust photo</h3>
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

                <div
                    className="relative mx-auto overflow-hidden rounded-full bg-black touch-none select-none cursor-grab active:cursor-grabbing"
                    style={{ width: VIEW, height: VIEW }}
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
                            style={{
                                position: 'absolute',
                                left: '50%',
                                top: '50%',
                                width: dispW,
                                height: dispH,
                                transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
                                maxWidth: 'none',
                            }}
                        />
                    )}
                    {/* subtle ring overlay */}
                    <div className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-white/40" />
                </div>

                <div className="flex items-center gap-3 mt-5">
                    <ZoomIn className={`w-5 h-5 shrink-0 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                    <input
                        type="range"
                        min="1"
                        max="3"
                        step="0.01"
                        value={zoom}
                        onChange={(e) => setZoom(parseFloat(e.target.value))}
                        className="w-full accent-[#0ECCEE]"
                        aria-label="Zoom"
                    />
                </div>

                <div className="flex gap-3 mt-5">
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={processing}
                        className={`flex-1 py-2.5 rounded-xl font-medium transition-colors ${
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
                        className="flex-1 py-2.5 rounded-xl font-semibold text-black bg-[#0ECCEE] hover:bg-[#0ECCEE]/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                        {processing ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <>
                                <Check className="w-5 h-5" />
                                Save
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
