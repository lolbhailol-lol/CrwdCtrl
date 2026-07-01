import { useState } from 'react';
import { Plus, Trash2, ChevronUp, ChevronDown, GripVertical } from 'lucide-react';
import TrekDetailIcon from '../TrekDetailIcon';
import {
    TREK_DETAIL_ICON_OPTIONS,
    DETAIL_BOX_PRESETS,
    createEmptyDetailBox,
    guessIconForLabel,
} from '../../utils/trekDetailBoxes';

const inp = 'w-full bg-[#111213] border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#0ECCEE]';

function useDragDrop(items, onReorder) {
    const [draggedIndex, setDraggedIndex] = useState(null);
    const [overIndex, setOverIndex] = useState(null);

    return {
        draggedIndex,
        overIndex,
        setOverIndex,
        handleDragStart: (e, index) => {
            setDraggedIndex(index);
            e.dataTransfer.effectAllowed = 'move';
        },
        handleDragOver: (e) => e.preventDefault(),
        handleDrop: (e, index) => {
            e.preventDefault();
            if (draggedIndex !== null && draggedIndex !== index) onReorder(draggedIndex, index);
            setDraggedIndex(null);
            setOverIndex(null);
        },
        handleDragEnd: () => {
            setDraggedIndex(null);
            setOverIndex(null);
        },
    };
}

export default function TrekDetailBoxesEditor({ boxes = [], onChange }) {
    const update = (idx, field, value) => {
        const next = boxes.map((box, i) => {
            if (i !== idx) return box;
            const updated = { ...box, [field]: value };
            if (field === 'label' && (!box.icon || box.icon === 'default' || box.icon === guessIconForLabel(box.label))) {
                updated.icon = guessIconForLabel(value);
            }
            return updated;
        });
        onChange(next);
    };

    const remove = (idx) => onChange(boxes.filter((_, i) => i !== idx).map((box, i) => ({ ...box, order: i })));

    const reorder = (from, to) => {
        const next = [...boxes];
        const [item] = next.splice(from, 1);
        next.splice(to, 0, item);
        onChange(next.map((box, i) => ({ ...box, order: i })));
    };

    const move = (idx, dir) => reorder(idx, idx + dir);

    const dnd = useDragDrop(boxes, reorder);

    const addBox = (preset = null) => {
        const box = createEmptyDetailBox(boxes.length);
        if (preset) {
            box.label = preset.label;
            box.icon = preset.icon;
        }
        onChange([...boxes, box]);
    };

    return (
        <div className="space-y-3">
            <p className="text-[11px] text-gray-500">Drag cards to reorder how they appear on the trek Details tab.</p>

            <div className="flex flex-wrap gap-2">
                {DETAIL_BOX_PRESETS.map((preset) => (
                    <button
                        key={preset.label}
                        type="button"
                        onClick={() => addBox(preset)}
                        className="px-2.5 py-1 rounded-full text-[11px] font-medium border border-gray-600 bg-[#1D1E20] text-gray-300 hover:border-[#0ECCEE] hover:text-[#0ECCEE]"
                    >
                        + {preset.label}
                    </button>
                ))}
                <button
                    type="button"
                    onClick={() => addBox()}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border border-[#0ECCEE]/40 bg-[#0ECCEE]/10 text-[#0ECCEE]"
                >
                    <Plus size={12} /> Custom box
                </button>
            </div>

            {boxes.length === 0 ? (
                <p className="text-xs text-gray-500 rounded-lg border border-dashed border-gray-600 px-3 py-3">
                    No detail boxes yet. Add presets or a custom box — each appears as a card on the trek Details tab.
                </p>
            ) : (
                <div className="space-y-2.5">
                    {boxes.map((box, idx) => {
                        const isDragging = dnd.draggedIndex === idx;
                        const isOver = dnd.overIndex === idx && dnd.draggedIndex !== idx;

                        return (
                            <div
                                key={box.id || idx}
                                draggable
                                onDragStart={(e) => dnd.handleDragStart(e, idx)}
                                onDragOver={dnd.handleDragOver}
                                onDragEnter={() => dnd.setOverIndex(idx)}
                                onDragLeave={() => dnd.setOverIndex(null)}
                                onDrop={(e) => dnd.handleDrop(e, idx)}
                                onDragEnd={dnd.handleDragEnd}
                                className={`rounded-xl border p-3 transition-all ${
                                    isOver
                                        ? 'border-[#0ECCEE]/50 bg-[#0ECCEE]/8'
                                        : 'border-gray-700 bg-[#1D1E20]'
                                } ${isDragging ? 'opacity-40' : ''}`}
                            >
                                <div className="flex items-start gap-2">
                                    <div className="flex flex-col items-center gap-1 pt-1 shrink-0">
                                        <GripVertical size={14} className="text-gray-500 cursor-grab active:cursor-grabbing" aria-hidden />
                                        <span className="text-[10px] font-bold text-gray-600">#{idx + 1}</span>
                                    </div>

                                    <div className="size-10 rounded-xl bg-[#111213] border border-gray-700 flex items-center justify-center shrink-0">
                                        <TrekDetailIcon icon={box.icon || 'default'} size={20} />
                                    </div>

                                    <div className="flex-1 min-w-0 space-y-2">
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="block text-[10px] font-medium text-gray-400 mb-1">Box label</label>
                                                <input
                                                    type="text"
                                                    value={box.label}
                                                    onChange={(e) => update(idx, 'label', e.target.value)}
                                                    className={inp}
                                                    placeholder="e.g. Max People"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-medium text-gray-400 mb-1">Icon</label>
                                                <select
                                                    value={box.icon || 'default'}
                                                    onChange={(e) => update(idx, 'icon', e.target.value)}
                                                    className={inp}
                                                >
                                                    {TREK_DETAIL_ICON_OPTIONS.map((opt) => (
                                                        <option key={opt.id} value={opt.id}>{opt.label}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-medium text-gray-400 mb-1">Value</label>
                                            <input
                                                type="text"
                                                value={box.value}
                                                onChange={(e) => update(idx, 'value', e.target.value)}
                                                className={inp}
                                                placeholder="e.g. 25 or 5:00 AM"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-1 shrink-0">
                                        <button type="button" onClick={() => move(idx, -1)} disabled={idx === 0} className="p-1 text-gray-500 hover:text-gray-300 disabled:opacity-30" aria-label="Move up">
                                            <ChevronUp size={14} />
                                        </button>
                                        <button type="button" onClick={() => move(idx, 1)} disabled={idx === boxes.length - 1} className="p-1 text-gray-500 hover:text-gray-300 disabled:opacity-30" aria-label="Move down">
                                            <ChevronDown size={14} />
                                        </button>
                                        <button type="button" onClick={() => remove(idx)} className="p-1 text-gray-500 hover:text-red-400" aria-label="Remove">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>

                                <div className="mt-2.5 ml-8 rounded-lg border border-gray-700 bg-[#111213] px-3 py-2">
                                    <p className="text-[10px] text-gray-500 mb-0.5">Preview</p>
                                    <p className="text-[11px] font-medium text-gray-400">{box.label || 'Label'}</p>
                                    <p className="text-sm font-semibold text-white">{box.value || '—'}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
