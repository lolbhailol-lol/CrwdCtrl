const STEPS = [
  'Locations — name starts & campus places',
  'Clues — Bootstrap all, then open each color for hint + QR',
  'Teams — passwords · one leader phone per team',
  'Send links — WhatsApp install link per team',
  'Live — Start the hunt on fest day',
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
        Playtest is for dry-run only. Finish at Mindspark Lobby → mark reached on Live.
      </p>
    </details>
  );
}
