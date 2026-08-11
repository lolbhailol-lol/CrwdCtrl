export const FINALE_MISSIONS = [
  {
    id: 'intel_hunt',
    emoji: '🧠',
    label: 'MISSION 1 · INTEL HUNT',
    short: '2 locations · combine fragments',
    detail: 'Each team gets 2 campus locations + intel fragments. Combined word = fragment₁ + fragment₂. +50 pts.',
    colorName: 'Orange',
    hex: '#F97316',
    borderClass: 'border-orange-400/55',
    bgClass: 'bg-orange-500/15',
    textClass: 'text-orange-200',
    solidClass: 'bg-orange-500',
    solidTextClass: 'text-white',
    accentRing: 'focus:border-orange-400',
    points: 50,
  },
  {
    id: 'lockbox',
    emoji: '🔐',
    label: 'MISSION 2 · THE LOCKBOX',
    short: 'Find key · assemble code',
    detail: 'Solve campus clue → find physical key → verify ID. Then 4 players each get a lockbox piece; communicate; leader submits final code. +75 pts.',
    colorName: 'Amber',
    hex: '#F59E0B',
    borderClass: 'border-amber-400/55',
    bgClass: 'bg-amber-500/15',
    textClass: 'text-amber-100',
    solidClass: 'bg-amber-500',
    solidTextClass: 'text-black',
    accentRing: 'focus:border-amber-400',
    points: 75,
  },
  {
    id: 'field_terminal',
    emoji: '💻',
    label: 'MISSION 3 · FIELD TERMINAL',
    short: 'Laptop grid · bring GRID code',
    detail: 'Borrow a laptop (phones banned — Desktop site = DQ) → Zip Grid → L1 25 / L2 50 / L3 50 · Hint −20 · miss timer keeps earlier points · completion code on phone (up to 125).',
    colorName: 'Blue',
    hex: '#3B82F6',
    borderClass: 'border-blue-400/55',
    bgClass: 'bg-blue-500/15',
    textClass: 'text-blue-200',
    solidClass: 'bg-blue-500',
    solidTextClass: 'text-white',
    accentRing: 'focus:border-blue-400',
    points: 125,
  },
  {
    id: 'operation_blackout',
    emoji: '⚡',
    label: 'MISSION 4 · OPERATION: BLACKOUT',
    short: '4 roles · stay together',
    detail: 'Scout → Cracker → Navigator → Controller. Team stays together; each seat has a role. Wrong answers cost points. Clear Controller for +200.',
    colorName: 'Violet',
    hex: '#A855F7',
    borderClass: 'border-violet-400/55',
    bgClass: 'bg-violet-500/15',
    textClass: 'text-violet-100',
    solidClass: 'bg-violet-500',
    solidTextClass: 'text-white',
    accentRing: 'focus:border-violet-400',
    points: 200,
  },
];

export function missionTheme(missionId) {
  return FINALE_MISSIONS.find((m) => m.id === missionId) || {
    id: missionId,
    hex: '#0ECCEE',
    borderClass: 'border-[#0ECCEE]/40',
    bgClass: 'bg-[#0ECCEE]/10',
    textClass: 'text-[#0ECCEE]',
    solidClass: 'bg-[#0ECCEE]',
    solidTextClass: 'text-black',
    accentRing: 'focus:border-[#0ECCEE]',
    colorName: 'Cyan',
  };
}

/** Card shell for player/admin mission tiles */
export function missionCardShell(missionId, { status } = {}) {
  const theme = missionTheme(missionId);
  if (status === 'completed') {
    return {
      theme,
      shell: `${theme.borderClass} ${theme.bgClass} ring-1 ring-emerald-400/25`,
      badge: 'bg-emerald-500/20 text-emerald-100',
      cta: `${theme.solidClass} ${theme.solidTextClass}`,
    };
  }
  if (status === 'coming_soon' || status === 'locked') {
    return {
      theme,
      shell: `${theme.borderClass} ${theme.bgClass} opacity-55`,
      badge: 'bg-white/10 text-white/50',
      cta: 'bg-white/10 text-white/40',
    };
  }
  if (status === 'active') {
    return {
      theme,
      shell: `${theme.borderClass} ${theme.bgClass}`,
      badge: `${theme.bgClass} ${theme.textClass}`,
      cta: `${theme.solidClass} ${theme.solidTextClass}`,
    };
  }
  return {
    theme,
    shell: `${theme.borderClass} ${theme.bgClass}`,
    badge: 'bg-white/10 text-white/70',
    cta: `${theme.solidClass} ${theme.solidTextClass}`,
  };
}
