/** Shared visual tokens for the trek organizer portal (dark ops console). */

export const ORG = {
  pageBg: 'bg-[#0c0d0e]',
  surface: 'bg-[#161718]',
  surfaceRaised: 'bg-[#1a1b1d]',
  surfaceDeep: 'bg-[#121314]',
  border: 'border-white/10',
  borderStrong: 'border-white/15',
  accent: '#0ECCEE',
  accentText: 'text-[#0ECCEE]',
  accentBg: 'bg-[#0ECCEE]',
  accentSoft: 'bg-[#0ECCEE]/10',
  accentBorder: 'border-[#0ECCEE]/25',
  muted: 'text-gray-500',
  body: 'text-gray-300',
};

export const STAT_TONES = {
  default: {
    card: 'border-white/10 bg-linear-to-br from-[#1a1b1d] to-[#141516]',
    icon: 'bg-white/5 text-gray-300',
    value: 'text-white',
  },
  accent: {
    card: 'border-[#0ECCEE]/25 bg-linear-to-br from-[#0ECCEE]/15 to-[#0ECCEE]/5',
    icon: 'bg-[#0ECCEE]/15 text-[#0ECCEE]',
    value: 'text-white',
  },
  women: {
    card: 'border-pink-500/20 bg-linear-to-br from-pink-500/15 to-pink-500/5',
    icon: 'bg-pink-500/15 text-pink-300',
    value: 'text-pink-100',
  },
  men: {
    card: 'border-sky-500/20 bg-linear-to-br from-sky-500/15 to-sky-500/5',
    icon: 'bg-sky-500/15 text-sky-300',
    value: 'text-sky-100',
  },
  ok: {
    card: 'border-emerald-500/20 bg-linear-to-br from-emerald-500/15 to-emerald-500/5',
    icon: 'bg-emerald-500/15 text-emerald-300',
    value: 'text-emerald-100',
  },
  warn: {
    card: 'border-amber-500/20 bg-linear-to-br from-amber-500/15 to-amber-500/5',
    icon: 'bg-amber-500/15 text-amber-300',
    value: 'text-amber-100',
  },
  money: {
    card: 'border-emerald-500/20 bg-linear-to-br from-emerald-500/10 to-[#141516]',
    icon: 'bg-emerald-500/15 text-emerald-300',
    value: 'text-emerald-300',
  },
};

export const navActiveClass =
  'bg-[#0ECCEE]/15 text-[#0ECCEE] border border-[#0ECCEE]/25 shadow-[inset_3px_0_0_0_#0ECCEE]';
export const navIdleClass =
  'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent';
