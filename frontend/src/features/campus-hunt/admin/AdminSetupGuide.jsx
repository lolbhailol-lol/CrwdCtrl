const STEPS = [
  'Places — 20 campus stops · plant join-words · 1 gather point',
  'Clues — Bootstrap, then open each color for hint + QR',
  'Teams — 20 leader packs · one phone + password each',
  'Links — WhatsApp install link ~1 day before (leaders download at home)',
  'Fest day — shout start code at gather point · leaders type it · hunt starts',
  'Results — lock scores · finalize · finish at Mindspark Lobby',
];

/**
 * Short runbook. Closed by default — no wall of cards.
 */
export default function AdminSetupGuide() {
  return (
    <details className="rounded-xl border border-white/10 bg-white/4 px-4 py-3">
      <summary className="cursor-pointer list-none text-sm font-semibold text-white/80">
        Quick start
        <span className="ml-2 text-xs font-normal text-white/40">tap if needed</span>
      </summary>
      <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-white/60">
        {STEPS.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ol>
      <p className="mt-3 text-xs text-white/40">
        One leader phone per team. Shared plant slips → join-word (Clue 2). Finish at Mindspark Lobby.
      </p>
    </details>
  );
}
