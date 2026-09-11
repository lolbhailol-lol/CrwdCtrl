/**
 * Display helpers for team code / name (demo teams are often named "Team 1").
 */

export function isGenericTeamName(name) {
  const n = String(name || '').trim();
  if (!n) return true;
  return /^team\s*#?\s*\d+$/i.test(n);
}

/** Primary label: code first; skip useless "Team 1" names. */
export function teamPrimaryLabel(team = {}) {
  const code = String(team.teamCode || '').trim();
  const name = String(team.teamName || '').trim();
  if (code) return code;
  if (name && !isGenericTeamName(name)) return name;
  if (name) return name;
  return 'Team';
}

/** Secondary line — only a real custom name, never "Team 1". */
export function teamSecondaryName(team = {}) {
  const name = String(team.teamName || '').trim();
  if (!name || isGenericTeamName(name)) return '';
  const code = String(team.teamCode || '').trim();
  if (code && name.toLowerCase() === code.toLowerCase()) return '';
  return name;
}

/** "CC001" or "CC001 · Lions" — never "Team 1 ·" with a hanging dot. */
export function teamInlineLabel(team = {}) {
  const primary = teamPrimaryLabel(team);
  const secondary = teamSecondaryName(team);
  return secondary ? `${primary} · ${secondary}` : primary;
}
