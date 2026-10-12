import React from 'react';
import { getImageUrl } from '../utils/imageImports';
import { handleImageErrorWithFallback } from '../utils/fallbackImageGenerator';

const PLACEHOLDER_NAMES = new Set(['tba', 'null', 'undefined', 'organizer']);

function realPerson(entry) {
    if (!entry) return null;
    const name = String(typeof entry === 'string' ? entry : (entry.name || entry.title || '')).trim();
    if (!name || PLACEHOLDER_NAMES.has(name.toLowerCase())) return null;
    const image = typeof entry === 'object' ? (entry.image || entry.avatar || entry.logo || entry.coverImage || null) : null;
    return { ...(typeof entry === 'object' ? entry : {}), name, image };
}

// Shows only organizers that come from the listing itself; renders nothing when there are none.
export default function OrganizersStorySlider({
    title = 'Organizers',
    items = null,
    realOrganizer = null,
    isDark = true,
    onItemClick,
}) {
    const list = [];
    for (const entry of [realOrganizer, ...(Array.isArray(items) ? items : [])]) {
        const person = realPerson(entry);
        if (person && !list.some((existing) => existing.name.toLowerCase() === person.name.toLowerCase())) list.push(person);
        if (list.length >= 6) break;
    }

    if (!list || list.length === 0) return null;

    return (
        <div className="w-full my-1 py-1 flex items-center justify-center">
            <div className="w-full flex items-center justify-center flex-wrap gap-1.5 sm:gap-2 max-w-full">
                {/* Title badge in same line */}
                <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full shrink-0 border ${
                    isDark ? 'bg-[#161718] border-white/10 text-gray-300' : 'bg-gray-100 border-gray-200 text-gray-700'
                }`}>
                    <span className="size-1.5 rounded-full bg-[#0ECCEE]" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">
                        {title}
                    </span>
                </div>

                {/* Compact Avatars & Names in same line */}
                <div className="flex items-center justify-center gap-1.5 sm:gap-2 flex-wrap">
                    {list.map((item, idx) => {
                        const name = item.name || item.title || 'Organizer';
                        const rawImg = item.image || item.coverImage || item.logo || item.avatar || null;
                        const imgSrc = rawImg ? getImageUrl(rawImg, { preset: 'thumb' }) : null;
                        const initial = (name[0] || 'O').toUpperCase();

                        return (
                            <button
                                key={item.id || item._id || item.slug || `org-${idx}`}
                                type="button"
                                onClick={() => onItemClick?.(item)}
                                className="flex items-center gap-1.5 py-0.5 px-1.5 rounded-full border transition-all duration-200 group cursor-pointer hover:border-[#0ECCEE]/50 shrink-0"
                                style={{
                                    backgroundColor: isDark ? '#111213' : '#ffffff',
                                    borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                                }}
                                title={name}
                            >
                                {/* Compact Avatar Circle */}
                                <div className="size-5 sm:size-6 rounded-full p-[1px] bg-gradient-to-tr from-[#0ECCEE] via-teal-400 to-[#0ECCEE]/40 group-hover:scale-105 transition-transform flex items-center justify-center shrink-0">
                                    <div className={`size-full rounded-full overflow-hidden flex items-center justify-center ${
                                        isDark ? 'bg-[#1A1B1D]' : 'bg-gray-100'
                                    }`}>
                                        {imgSrc ? (
                                            <img
                                                src={imgSrc}
                                                alt={name}
                                                className="size-full object-cover"
                                                loading="lazy"
                                                onError={(e) => {
                                                    handleImageErrorWithFallback(e, 30, 30, '#1A1B1D', name);
                                                }}
                                            />
                                        ) : (
                                            <span className="text-[9px] font-black text-[#0ECCEE]">
                                                {initial}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Organizer Name inline */}
                                <span className={`text-[10px] sm:text-[11px] font-semibold truncate max-w-[65px] sm:max-w-[85px] leading-none transition-colors group-hover:text-[#0ECCEE] ${
                                    isDark ? 'text-gray-300' : 'text-gray-700'
                                }`}>
                                    {name}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

