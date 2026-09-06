function ordinalSuffix(n) {
  const v = Number(n);
  const mod = v % 100;
  if (mod >= 11 && mod <= 13) return 'th';
  if (v % 10 === 1) return 'st';
  if (v % 10 === 2) return 'nd';
  if (v % 10 === 3) return 'rd';
  return 'th';
}

export default function ScoreChip({ score, label = 'Score', rank = null, fieldSize = null }) {
  const place = Number(rank);
  const total = Number(fieldSize);
  const hasRank = Number.isFinite(place) && place > 0;
  const hasField = Number.isFinite(total) && total > 0;

  return (
    <div className="shrink-0 text-right">
      <div className="flex items-start justify-end gap-4">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-white/35">
            {label}
          </p>
          <p className="text-xl font-semibold tabular-nums leading-none text-[#0ECCEE]">
            {score ?? 0}
          </p>
        </div>
        {hasRank ? (
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-white/35">
              Rank
            </p>
            <p className="text-xl font-semibold tabular-nums leading-none text-white">
              #{place}
            </p>
          </div>
        ) : null}
      </div>
      {hasRank ? (
        <p className="mt-1 text-[11px] tabular-nums text-white/55">
          {place}{ordinalSuffix(place)}
          {hasField ? ` of ${total}` : ''}
        </p>
      ) : null}
    </div>
  );
}
