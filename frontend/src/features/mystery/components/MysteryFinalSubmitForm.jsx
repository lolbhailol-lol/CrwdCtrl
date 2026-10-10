import { useState } from 'react';

export default function MysteryFinalSubmitForm({ onSubmit, busy }) {
  const [identityTheory, setIdentityTheory] = useState('');
  const [fullExplanation, setFullExplanation] = useState('');
  const [confidenceLevel, setConfidenceLevel] = useState(50);

  const submit = () => {
    if (!identityTheory.trim()) return;
    onSubmit({
      identityTheory: identityTheory.trim(),
      fullExplanation: fullExplanation.trim(),
      confidenceLevel: Number(confidenceLevel),
    });
  };

  return (
    <div className="rounded-2xl border border-[#0ECCEE]/40 bg-[#0ECCEE]/5 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#0ECCEE]">Final case submission</p>
      <label className="mt-3 block text-xs text-white/50">
        Who did it? (your theory)
        <input
          value={identityTheory}
          onChange={(e) => setIdentityTheory(e.target.value)}
          placeholder="e.g. A-17"
          className="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-white placeholder:text-white/25"
        />
      </label>
      <label className="mt-3 block text-xs text-white/50">
        Explain your reasoning
        <textarea
          value={fullExplanation}
          onChange={(e) => setFullExplanation(e.target.value)}
          rows={4}
          className="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-white placeholder:text-white/25"
        />
      </label>
      <label className="mt-3 block text-xs text-white/50">
        Confidence: {confidenceLevel}%
        <input type="range" min={0} max={100} value={confidenceLevel} onChange={(e) => setConfidenceLevel(e.target.value)} className="mt-2 w-full" />
      </label>
      <button
        type="button"
        disabled={busy || !identityTheory.trim()}
        onClick={submit}
        className="mt-4 w-full rounded-xl bg-[#0ECCEE] py-3 text-sm font-bold text-black disabled:opacity-40"
      >
        {busy ? 'Submitting…' : 'Submit final case'}
      </button>
    </div>
  );
}