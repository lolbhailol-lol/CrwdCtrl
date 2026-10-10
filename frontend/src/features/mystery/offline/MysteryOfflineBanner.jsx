export default function MysteryOfflineBanner({ isOnline, pendingCount }) {
  if (isOnline && pendingCount === 0) return null;
  return (
    <div className={`px-5 py-2 text-center text-xs font-semibold ${isOnline ? 'bg-amber-400/15 text-amber-300' : 'bg-rose-400/15 text-rose-300'}`}>
      {!isOnline && 'Offline — actions scan/save hoke baad me sync honge'}
      {isOnline && pendingCount > 0 && `Syncing ${pendingCount} saved action(s)…`}
    </div>
  );
}