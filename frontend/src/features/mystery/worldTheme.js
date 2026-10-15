import { MessageCircle, MonitorSmartphone, Puzzle, Search } from 'lucide-react';

export const WORLD_THEME = {
  physical: { label: 'Physical', hint: 'Objects & places', color: '#22D3EE', Icon: Search },
  digital: { label: 'Digital', hint: 'Screens & logs', color: '#A78BFA', Icon: MonitorSmartphone },
  human: { label: 'Human', hint: 'People & statements', color: '#FB923C', Icon: MessageCircle },
  logic: { label: 'Logic', hint: 'Deductions', color: '#34D399', Icon: Puzzle },
};

export const WORLD_ORDER = ['physical', 'digital', 'human', 'logic'];

export const worldTheme = (world) => WORLD_THEME[world] || WORLD_THEME.physical;

export const DIFFICULTY_THEME = {
  rookie: { label: 'Easy', color: '#34D399' },
  detective: { label: 'Medium', color: '#FBBF24' },
  master: { label: 'Hard', color: '#F472B6' },
};

export const difficultyTheme = (difficulty) => DIFFICULTY_THEME[difficulty] || DIFFICULTY_THEME.detective;

/** Soft world-tinted card surface; colors are 6-digit hex so alpha can be appended. */
export const worldSurface = (color) => ({
  background: `linear-gradient(135deg, ${color}26 0%, ${color}0d 45%, rgba(255,255,255,0.03) 100%)`,
  borderColor: `${color}59`,
});
