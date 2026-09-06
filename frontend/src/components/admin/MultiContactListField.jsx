import { Plus, Trash2 } from 'lucide-react';

/**
 * Editable list of phone numbers or Instagram handles.
 * Always keeps at least one empty row for quick typing.
 */
export default function MultiContactListField({
    label,
    hint,
    values = [],
    onChange,
    placeholder = '',
    type = 'text',
    addLabel = 'Add another',
    inputClassName = '',
}) {
    const rows = values.length > 0 ? values : [''];

    const setRow = (idx, value) => {
        const next = [...rows];
        next[idx] = value;
        onChange(next);
    };

    const addRow = () => onChange([...rows, '']);

    const removeRow = (idx) => {
        const next = rows.filter((_, i) => i !== idx);
        onChange(next.length ? next : ['']);
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
                <div>
                    {label ? (
                        <p className="text-sm font-medium text-gray-300">{label}</p>
                    ) : null}
                    {hint ? (
                        <p className="text-[10px] text-gray-500 mt-0.5">{hint}</p>
                    ) : null}
                </div>
                <button
                    type="button"
                    onClick={addRow}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#0ECCEE] hover:underline shrink-0"
                >
                    <Plus size={12} /> {addLabel}
                </button>
            </div>
            <div className="space-y-2">
                {rows.map((value, idx) => (
                    <div key={`contact-row-${idx}`} className="flex items-center gap-2">
                        <input
                            type={type}
                            value={value}
                            onChange={(e) => setRow(idx, e.target.value)}
                            className={inputClassName}
                            placeholder={placeholder}
                        />
                        <button
                            type="button"
                            onClick={() => removeRow(idx)}
                            disabled={rows.length <= 1 && !String(value || '').trim()}
                            className="p-2 rounded-lg text-gray-500 hover:text-red-400 disabled:opacity-30 shrink-0"
                            aria-label="Remove"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
