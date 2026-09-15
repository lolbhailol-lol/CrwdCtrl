import { useState } from 'react';

export default function MissingFormAnswersEditor({ participant, onSave, busy = false }) {
    const [draftAnswers, setDraftAnswers] = useState({});
    const filled = new Set(
        (participant?.registrationFields || [])
            .filter((f) => String(f.value || '').trim())
            .map((f) => String(f.fieldName)),
    );
    const missing = (participant?.editableFormFields || []).filter(
        (f) => !filled.has(String(f.fieldName)),
    );
    if (!missing.length) return null;

    const submit = async () => {
        const payload = Object.fromEntries(
            Object.entries(draftAnswers).filter(([, value]) => String(value || '').trim()),
        );
        if (!Object.keys(payload).length) return;
        await onSave?.(payload);
        setDraftAnswers({});
    };

    return (
        <div className="mt-4 pt-4 border-t border-gray-800 space-y-3">
            <p className="text-xs text-amber-300">
                These answers were not stored with the original booking. Fill them here if you collect them later.
            </p>
            {missing.map((field) => (
                <label key={field.fieldName} className="block">
                    <span className="text-[11px] uppercase tracking-wide text-gray-500">{field.label}</span>
                    {field.options?.length ? (
                        <select
                            value={draftAnswers[field.fieldName] || ''}
                            onChange={(e) => setDraftAnswers((prev) => ({
                                ...prev,
                                [field.fieldName]: e.target.value,
                            }))}
                            className="mt-1 w-full px-3 py-2.5 rounded-xl bg-[#0c0d0e] border border-gray-700 text-sm"
                        >
                            <option value="">Not captured</option>
                            {field.options.map((opt) => (
                                <option key={opt} value={opt}>{opt}</option>
                            ))}
                        </select>
                    ) : (
                        <input
                            value={draftAnswers[field.fieldName] || ''}
                            onChange={(e) => setDraftAnswers((prev) => ({
                                ...prev,
                                [field.fieldName]: e.target.value,
                            }))}
                            className="mt-1 w-full px-3 py-2.5 rounded-xl bg-[#0c0d0e] border border-gray-700 text-sm"
                            placeholder="Add answer"
                        />
                    )}
                </label>
            ))}
            <button
                type="button"
                onClick={submit}
                disabled={busy || !Object.values(draftAnswers).some((v) => String(v || '').trim())}
                className="w-full py-2.5 rounded-xl bg-[#0ECCEE] text-black text-sm font-semibold disabled:opacity-60"
            >
                {busy ? 'Saving…' : 'Save drink & skill'}
            </button>
        </div>
    );
}
