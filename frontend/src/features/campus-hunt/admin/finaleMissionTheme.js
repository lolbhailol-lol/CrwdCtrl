/** Finale mission colors — aligned with Round 1 clue palette */

export const FINALE_MISSIONS = [
  {
    id: 'intel_hunt',
    emoji: '🧠',
    label: 'MISSION 1 · INTEL HUNT',
    short: 'Campus exploration · 2 locations',
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
    id: 'field_terminal',
    emoji: '💻',
    label: 'MISSION 2 · FIELD TERMINAL',
    short: 'CrwdCtrl Zip · laptop only',
    detail: 'Borrow a laptop (phones banned — Desktop site = DQ) → Zip Grid → L1 20 / L2 40 / L3 40 · Hint −20 · miss timer keeps earlier points · completion code on phone (up to 100).',
    colorName: 'Blue',
    hex: '#3B82F6',
    borderClass: 'border-blue-400/55',
    bgClass: 'bg-blue-500/15',
    textClass: 'text-blue-200',
    solidClass: 'bg-blue-500',
    solidTextClass: 'text-white',
    accentRing: 'focus:border-blue-400',
    points: 100,
  },
  {
    id: 'mission_3',
    emoji: '🎯',
    label: 'MISSION 3',
    short: 'Coming soon',
    detail: 'High-risk mission — design TBD.',
    colorName: 'Green',
    hex: '#22C55E',
    borderClass: 'border-emerald-400/55',
    bgClass: 'bg-emerald-500/15',
    textClass: 'text-emerald-200',
    solidClass: 'bg-emerald-500',
    solidTextClass: 'text-black',
    accentRing: 'focus:border-emerald-400',
    points: 0,
    comingSoon: true,
  },
  {
    id: 'mission_4',
    emoji: '🔥',
    label: 'MISSION 4',
    short: 'Coming soon',
    detail: 'Finale wildcard mission — design TBD.',
    colorName: 'Red',
    hex: '#EF4444',
    borderClass: 'border-red-400/55',
    bgClass: 'bg-red-500/15',
    textClass: 'text-red-200',
    solidClass: 'bg-red-500',
    solidTextClass: 'text-white',
    accentRing: 'focus:border-red-400',
    points: 0,
    comingSoon: true,
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
      badge: 'bg-black/35 text-white/50',
      cta: `${theme.solidClass} ${theme.solidTextClass}`,
    };
  }
  if (status === 'active') {
    return {
      theme,
      shell: `${theme.borderClass} ${theme.bgClass} shadow-[0_0_24px_rgba(0,0,0,0.25)]`,
      badge: `${theme.bgClass} ${theme.textClass}`,
      cta: `${theme.solidClass} ${theme.solidTextClass}`,
    };
  }
  return {
    theme,
    shell: `${theme.borderClass} ${theme.bgClass}`,
    badge: 'bg-black/30 text-white/65',
    cta: `${theme.solidClass} ${theme.solidTextClass}`,
  };
}
