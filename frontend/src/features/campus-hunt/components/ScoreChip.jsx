export default function ScoreChip({ score }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-[#0ECCEE]/15 px-3 py-1 text-sm font-semibold text-[#0ECCEE]">
      <span className="opacity-70">Score</span>
      <span>{score ?? 0}</span>
    </div>
  );
}
