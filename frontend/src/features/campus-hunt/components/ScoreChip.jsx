export default function ScoreChip({ score }) {
  return (
    <div className="shrink-0 text-right">
      <p className="text-[10px] font-medium uppercase tracking-wider text-white/35">Score</p>
      <p className="text-xl font-semibold tabular-nums leading-none text-[#0ECCEE]">
        {score ?? 0}
      </p>
    </div>
  );
}
