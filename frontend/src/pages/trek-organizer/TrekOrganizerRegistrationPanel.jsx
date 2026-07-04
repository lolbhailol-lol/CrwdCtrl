import { useState } from 'react';
import { Loader, Users } from 'lucide-react';
import { updateTrekOrganizerRegistration } from '../../services/api/trekOrganizer.api';
import { GENDER_PHASE_OPTIONS, formatQuotaLine } from '../../utils/trekGenderRegistration';

export default function TrekOrganizerRegistrationPanel({ trekId, trek, genderRegistration, onUpdated }) {
    const [phase, setPhase] = useState(trek?.genderPhase || genderRegistration?.phase || 'all');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');

    const quotasEnabled = Boolean(genderRegistration?.enabled);
    const quotaRows = genderRegistration?.quotas
        ? ['female', 'male', 'others'].map((key) => genderRegistration.quotas[key]).filter((q) => q?.cap > 0)
        : [];

    const savePhase = async (nextPhase) => {
        setPhase(nextPhase);
        setSaving(true);
        setError('');
        setMessage('');
        try {
            const res = await updateTrekOrganizerRegistration(trekId, { genderPhase: nextPhase });
            setMessage('Registration phase updated');
            onUpdated?.(res);
        } catch (e) {
            setError(e.message || 'Update failed');
            setPhase(trek?.genderPhase || genderRegistration?.phase || 'all');
        } finally {
            setSaving(false);
        }
    };

    if (!quotasEnabled) {
        return (
            <div className="rounded-xl border border-gray-800 bg-[#161718] p-4">
                <p className="text-sm font-semibold text-gray-200">Gender seat limits</p>
                <p className="text-xs text-gray-500 mt-1">
                    Not enabled for this trek. Ask your admin to turn on gender quotas in the trek form (Booking &amp; registration).
                </p>
            </div>
        );
    }

    return (
        <div className="rounded-xl border border-gray-800 bg-[#161718] p-4 space-y-4">
            <div className="flex items-start gap-3">
                <div className="size-9 rounded-lg bg-[#0ECCEE]/15 text-[#0ECCEE] flex items-center justify-center shrink-0">
                    <Users size={16} />
                </div>
                <div>
                    <p className="text-sm font-semibold text-gray-100">Registration phase</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                        Control who can register now — e.g. open women&apos;s seats first, then men later.
                        Users pick Male or Female in booking step 1; wrong choice for the current phase cannot proceed.
                    </p>
                </div>
            </div>

            {quotaRows.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {quotaRows.map((q) => (
                        <div key={q.label} className="rounded-lg border border-gray-800 bg-[#111213] px-3 py-2">
                            <p className="text-[10px] uppercase tracking-wide text-gray-500">{q.label}</p>
                            <p className="text-sm font-semibold tabular-nums mt-0.5">
                                {q.filled}/{q.cap}
                            </p>
                            <p className="text-[11px] text-gray-500">{q.remaining ?? 0} left</p>
                        </div>
                    ))}
                </div>
            )}

            <div className="flex flex-wrap gap-2">
                {GENDER_PHASE_OPTIONS.map((opt) => (
                    <button
                        key={opt.value}
                        type="button"
                        disabled={saving}
                        onClick={() => savePhase(opt.value)}
                        className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-colors min-h-[40px] ${
                            phase === opt.value
                                ? 'bg-[#0ECCEE] text-black border-[#0ECCEE]'
                                : 'border-gray-700 text-gray-300 hover:border-[#0ECCEE]/40'
                        }`}
                    >
                        {opt.label}
                    </button>
                ))}
                {saving ? <Loader size={16} className="animate-spin text-[#0ECCEE] self-center" /> : null}
            </div>

            <p className="text-xs text-gray-400">
                Current: <span className="text-[#0ECCEE] font-medium">{GENDER_PHASE_OPTIONS.find((o) => o.value === phase)?.short || phase}</span>
            </p>

            {error ? <p className="text-xs text-red-400">{error}</p> : null}
            {message ? <p className="text-xs text-emerald-400">{message}</p> : null}

            {quotaRows.length > 0 && (
                <ul className="text-[11px] text-gray-600 space-y-0.5">
                    {quotaRows.map((q) => (
                        <li key={q.label}>{formatQuotaLine(q)}</li>
                    ))}
                </ul>
            )}
        </div>
    );
}
