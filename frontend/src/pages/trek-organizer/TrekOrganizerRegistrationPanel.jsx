import { useEffect, useState } from 'react';
import { Loader } from 'lucide-react';
import { updateTrekOrganizerRegistration } from '../../services/api/trekOrganizer.api';
import { GENDER_PHASE_OPTIONS } from '../../utils/trekGenderRegistration';

/**
 * Gender phase controls. When `embedded`, skips outer card chrome
 * (parent dashboard already wraps registration).
 */
export default function TrekOrganizerRegistrationPanel({
    trekId,
    trek,
    genderRegistration,
    onUpdated,
    embedded = false,
}) {
    const [phase, setPhase] = useState(trek?.genderPhase || genderRegistration?.phase || 'all');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');

    useEffect(() => {
        setPhase(trek?.genderPhase || genderRegistration?.phase || 'all');
    }, [trek?.genderPhase, genderRegistration?.phase]);

    const quotasEnabled = Boolean(genderRegistration?.enabled);
    const quotaRows = genderRegistration?.quotas
        ? ['female', 'male', 'others'].map((key) => genderRegistration.quotas[key]).filter((q) => q?.cap > 0)
        : [];

    const savePhase = async (nextPhase) => {
        if (nextPhase === phase) return;
        setPhase(nextPhase);
        setSaving(true);
        setError('');
        setMessage('');
        try {
            const res = await updateTrekOrganizerRegistration(trekId, { genderPhase: nextPhase });
            setMessage('Phase updated');
            onUpdated?.(res);
        } catch (e) {
            setError(e.message || 'Update failed');
            setPhase(trek?.genderPhase || genderRegistration?.phase || 'all');
        } finally {
            setSaving(false);
        }
    };

    if (!quotasEnabled) {
        if (embedded) return null;
        return null;
    }

    const body = (
        <div className="space-y-3.5">
            <div>
                <p className={embedded ? 'text-[11px] uppercase tracking-[0.1em] text-gray-500 font-medium' : 'text-sm font-semibold text-gray-100'}>
                    {embedded ? 'Who can register' : 'Who can register now'}
                </p>
                {!embedded ? (
                    <p className="text-xs text-gray-500 mt-0.5">
                        Switch between women-only, men-only, or open to all.
                    </p>
                ) : null}
            </div>

            {quotaRows.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                    {quotaRows.map((q) => {
                        const pct = q.cap > 0 ? Math.min(100, Math.round((q.filled / q.cap) * 100)) : 0;
                        return (
                            <div key={q.label} className="rounded-xl border border-white/10 bg-black/25 px-2.5 py-2.5">
                                <p className="text-[10px] uppercase tracking-[0.08em] text-gray-500">{q.label}</p>
                                <p className="text-sm font-semibold tabular-nums mt-0.5">
                                    {q.filled}<span className="text-gray-500 font-normal">/{q.cap}</span>
                                </p>
                                <div className="mt-1.5 h-1.5 rounded-full bg-white/5 overflow-hidden">
                                    <div
                                        className={`h-full rounded-full ${pct >= 100 ? 'bg-red-400' : 'bg-[#0ECCEE]'}`}
                                        style={{ width: `${pct}%` }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : null}

            <div className="grid grid-cols-2 gap-2">
                {GENDER_PHASE_OPTIONS.map((opt) => (
                    <button
                        key={opt.value}
                        type="button"
                        disabled={saving}
                        onClick={() => savePhase(opt.value)}
                        className={`px-3 py-3 min-h-[48px] rounded-xl text-xs font-semibold border transition-colors ${
                            phase === opt.value
                                ? 'bg-[#0ECCEE] text-black border-[#0ECCEE]'
                                : 'border-white/10 text-gray-300 hover:border-[#0ECCEE]/40 bg-white/5'
                        }`}
                    >
                        {opt.label}
                    </button>
                ))}
            </div>

            {saving ? (
                <p className="text-xs text-gray-500 inline-flex items-center gap-1.5">
                    <Loader size={14} className="animate-spin text-[#0ECCEE]" /> Saving…
                </p>
            ) : null}
            {error ? <p className="text-xs text-red-400">{error}</p> : null}
            {message ? <p className="text-xs text-emerald-400">{message}</p> : null}
        </div>
    );

    if (embedded) {
        return <div className="pt-4 border-t border-white/10">{body}</div>;
    }

    return (
        <div className="rounded-2xl border border-white/10 bg-[#161718] p-4">
            {body}
        </div>
    );
}
