import { Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import TrekDetailIcon from '../TrekDetailIcon';
import {
    TREK_DETAIL_ICON_OPTIONS,
    DETAIL_BOX_PRESETS,
    createEmptyDetailBox,
    guessIconForLabel,
} from '../../utils/trekDetailBoxes';

const whiteInp = 'w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-gray-900 text-sm focus:outline-none focus:border-[#0ECCEE]';

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

    const remove = (idx) => onChange(boxes.filter((_, i) => i !== idx));

    const move = (idx, dir) => {
        const next = [...boxes];
        const target = idx + dir;
        if (target < 0 || target >= next.length) return;
        [next[idx], next[target]] = [next[target], next[idx]];
        onChange(next.map((box, i) => ({ ...box, order: i })));
    };

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
            <div className="flex flex-wrap gap-2">
                {DETAIL_BOX_PRESETS.map((preset) => (
                    <button
                        key={preset.label}
                        type="button"
                        onClick={() => addBox(preset)}
                        className="px-2.5 py-1 rounded-full text-[11px] font-medium border border-gray-300 bg-gray-50 text-gray-700 hover:border-[#0ECCEE] hover:text-[#0ECCEE]"
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
                <p className="text-xs text-gray-500 rounded-lg border border-dashed border-gray-300 px-3 py-3">
                    No detail boxes yet. Add presets or a custom box — each appears as a white card on the trek Details tab.
                </p>
            ) : (
                <div className="space-y-2.5">
                    {boxes.map((box, idx) => (
                        <div key={box.id || idx} className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
                            <div className="flex items-start gap-3">
                                <div className="size-10 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0">
                                    <TrekDetailIcon icon={box.icon || 'default'} size={20} />
                                </div>

                                <div className="flex-1 min-w-0 space-y-2">
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="block text-[10px] font-medium text-gray-500 mb-1">Box label</label>
                                            <input
                                                type="text"
                                                value={box.label}
                                                onChange={(e) => update(idx, 'label', e.target.value)}
                                                className={whiteInp}
                                                placeholder="e.g. Max People"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-medium text-gray-500 mb-1">Icon</label>
                                            <select
                                                value={box.icon || 'default'}
                                                onChange={(e) => update(idx, 'icon', e.target.value)}
                                                className={whiteInp}
                                            >
                                                {TREK_DETAIL_ICON_OPTIONS.map((opt) => (
                                                    <option key={opt.id} value={opt.id}>{opt.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-medium text-gray-500 mb-1">Value</label>
                                        <input
                                            type="text"
                                            value={box.value}
                                            onChange={(e) => update(idx, 'value', e.target.value)}
                                            className={whiteInp}
                                            placeholder="e.g. 25 or 5:00 AM"
                                        />
                                    </div>
                                </div>

                                <div className="flex flex-col gap-1 shrink-0">
                                    <button type="button" onClick={() => move(idx, -1)} disabled={idx === 0} className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30" aria-label="Move up">
                                        <ChevronUp size={14} />
                                    </button>
                                    <button type="button" onClick={() => move(idx, 1)} disabled={idx === boxes.length - 1} className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30" aria-label="Move down">
                                        <ChevronDown size={14} />
                                    </button>
                                    <button type="button" onClick={() => remove(idx)} className="p-1 text-gray-400 hover:text-red-500" aria-label="Remove">
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>

                            <div className="mt-2.5 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                                <p className="text-[10px] text-gray-400 mb-0.5">Preview</p>
                                <p className="text-[11px] font-medium text-gray-500">{box.label || 'Label'}</p>
                                <p className="text-sm font-semibold text-gray-900">{box.value || '—'}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
