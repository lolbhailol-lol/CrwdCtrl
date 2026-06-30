/** Crop frame options — ratios match IMAGE_PRESETS / site card layouts */
export const CROP_ASPECT_OPTIONS = [
    {
        id: 'cardPortrait',
        label: 'Portrait',
        short: '10:13',
        ratio: 10 / 13,
        outputW: 1200,
        outputH: 1560,
    },
    {
        id: 'cardWide',
        label: 'Wide',
        short: '10:7',
        ratio: 10 / 7,
        outputW: 1200,
        outputH: 840,
    },
    {
        id: 'hero',
        label: 'Hero',
        short: '15:7',
        ratio: 120 / 56,
        outputW: 1200,
        outputH: 560,
    },
    {
        id: 'square',
        label: 'Square',
        short: '1:1',
        ratio: 1,
        outputW: 1200,
        outputH: 1200,
    },
    {
        id: 'cardLandscape',
        label: 'Landscape',
        short: '5:3',
        ratio: 5 / 3,
        outputW: 1200,
        outputH: 720,
    },
    {
        id: 'cardVideo',
        label: 'Video',
        short: '16:9',
        ratio: 16 / 9,
        outputW: 1280,
        outputH: 720,
    },
    {
        id: 'cardPanel',
        label: 'Panel',
        short: '7:5',
        ratio: 7 / 5,
        outputW: 1400,
        outputH: 1000,
    },
];

export const CROP_ORIGINAL_OPTION = {
    id: 'original',
    label: 'Original',
    short: 'Full',
};

export const VIEW_MAX_W = 300;

export function getViewDimensions(ratio) {
    const viewW = VIEW_MAX_W;
    const viewH = Math.max(80, Math.round(viewW / ratio));
    return { viewW, viewH };
}

export function findCropAspect(id) {
    return CROP_ASPECT_OPTIONS.find((o) => o.id === id) || CROP_ASPECT_OPTIONS[0];
}
