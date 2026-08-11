import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CAMPUS_HUNT_PATHS } from '../config';

const ADMIN_STEPS = [
  ['1 · Bootstrap', 'Finale → Setup → Bootstrap Finale round. Saves default Intel + Device config (500 pts, 45 min).'],
  ['2 · Configure', 'Edit Intel loc1/loc2/combined answer. Save mission config (Field Terminal uses CrwdCtrl Grid — no admin code).'],
  ['3 · Finalize R1', 'Round 1 → Results → Stop & lock → Finalize leaderboard (required before promotion).'],
  ['4 · Promote 12', 'Finalists → Auto-promote top 5 → manually pick 7 from Survival pool.'],
  ['5 · Start timer', 'Schedule → Lock → Start Finals. Live → release waves (or Playtest desk → Release one team).'],
  ['6 · Playtest', 'Live → pick team → Release → Open team link → Complete Intel/Device cheats → Mark finish.'],
  ['7 · Close', 'Live → Force lock at end → Results → Finalize → toggle public finale board.'],
];

const PLAYER_FLOW = [
  ['Login', 'Open /team/CC001 with team password → tap Leader or Player. Finalists see Mission Board, not Round 1 clues.'],
  ['Board', 'Header shows 500+ score + countdown from server endsAt. Five mission cards; 3–5 show Coming Soon.'],
  ['Intel Hunt', 'Leader starts mission → loc1 answer → loc2 unlocks → combine word → +50, mission locked on board.'],
  ['Field Terminal', 'Leader starts → device key → Zip Grid on a real laptop only (phones / Desktop site banned; DQ if caught) → GRID-XXXX on phone for score.'],
  ['Abandon', 'Return to board mid-mission — mission stays available; no points awarded.'],
  ['Stop', 'Leader “Stop for now” — no new missions until organizer reopens (team status stopped).'],
  ['Leader-only', 'Players see “Only the Team Leader can submit” on Intel + Device. Submit as player → 403.'],
  ['Laptop rule', 'Announce at brief: Field Terminal is laptop-only. Phones against the rules; Desktop site = cheating.'],
  ['Timer lock', 'After lock or 45:00, board disables new starts; completed scores stay on finale leaderboard.'],
];

const UNIT_TESTS = [
  ['All backend tests', 'cd backend && npm test'],
  ['Finale only', 'cd backend && npm run test:finale'],
  ['Campus Hunt suite', 'cd backend && npm run test:campus-hunt'],
  ['Watch mode', 'cd backend && npm run test:finale:watch'],
  ['CI', 'GitHub Actions → Backend Tests on every backend/ PR and push to main'],
];

const QA_CHECKS = [
  'Finale round bootstrapped; config saved with known test answers',
  'R1 finalized; auto-promote created 5 direct entries',
  'Manual pick added 7 teams; total entries = 12; teams have competitionPhase finale',
  'Promoted team play page shows Mission Board (not Round 1)',
  'Intel loc2 hidden until loc1 correct; combine needs both fragments',
  'Field Terminal: grid Zip score (20/40/40 − hints) claimed via completion code',
  'Completed mission cannot be started again',
  'Non-leader submit returns 403 LEADER_ONLY',
  'Finale leaderboard tab shows finaleScore separate from Round 1',
  'Lock freezes entries; finalize persists winner order',
];

const TROUBLESHOOTING = [
  ['Finale tab locked', 'Finalize Round 1 first. Hub opens Finale when R1 is locked/finalized.'],
  ['Auto-promote fails', 'Need 5+ DIRECT_FINALE teams on finalized R1 leaderboard. Bootstrap finale first.'],
  ['Start disabled', 'Need exactly 12 finalists promoted before Start 45-min Finale.'],
  ['Player sees Round 1', 'Team not promoted — check Finalists tab; promotion sets competitionPhase finale.'],
  ['403 on /finale/me', 'Team must be promoted and logged in on their own team link.'],
  ['Public board empty', 'Results → Show public finale board, or wait until locked/finalized.'],
];

function copyText(text, onDone) {
  if (!text) return;
  navigator.clipboard?.writeText(String(text)).then(() => onDone?.()).catch(() => {});
}

export default function FinaleTestGuide({ eventSlug, entries = [] }) {
  const storageKey = `campus_hunt_finale_qa_${eventSlug || 'default'}`;
  const [checked, setChecked] = useState(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  const [copied, setCopied] = useState('');

  const finalistTeams = useMemo(
    () => [...entries].sort((a, b) => String(a.teamCode).localeCompare(String(b.teamCode), undefined, { numeric: true })),
    [entries],
  );

  const toggleCheck = (index) => {
    setChecked((prev) => {
      const next = { ...prev, [index]: !prev[index] };
      localStorage.setItem(storageKey, JSON.stringify(next));
      return next;
    });
  };

  const resetChecks = () => {
    setChecked({});
    localStorage.removeItem(storageKey);
  };

  const doneCount = QA_CHECKS.filter((_, i) => checked[i]).length;

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <h3 className="text-sm font-bold uppercase tracking-wide text-[#0ECCEE]">Admin setup order</h3>
        <ol className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {ADMIN_STEPS.map(([title, detail]) => (
            <li key={title} className="rounded-lg border border-[#0ECCEE]/20 bg-[#0ECCEE]/5 px-3 py-2">
              <p className="text-xs font-semibold uppercase text-[#0ECCEE]">{title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-white/60">{detail}</p>
            </li>
          ))}
        </ol>
      </section>

      {finalistTeams.length > 0 && eventSlug && (
        <section className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4">
          <h3 className="text-sm font-bold uppercase tracking-wide text-emerald-200">Quick open — finalist teams</h3>
          <p className="mt-1 text-xs text-white/55">Copy team link → open on phone → login as leader + one player to test leader-only rules.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {finalistTeams.slice(0, 6).map((e) => {
              const path = CAMPUS_HUNT_PATHS.teamLogin(eventSlug, e.teamCode);
              return (
                <div key={e.id || e.teamId} className="flex items-center gap-2 rounded-lg bg-black/25 px-3 py-2">
                  <Link to={path} target="_blank" rel="noreferrer" className="font-mono text-sm text-[#0ECCEE] hover:underline">
                    {e.teamCode}
                  </Link>
                  <button
                    type="button"
                    onClick={() => copyText(`${window.location.origin}${path}`, () => {
                      setCopied(e.teamCode);
                      setTimeout(() => setCopied(''), 1500);
                    })}
                    className="text-[10px] uppercase text-white/45 hover:text-white"
                  >
                    {copied === e.teamCode ? 'Copied' : 'Copy link'}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <h3 className="text-sm font-bold uppercase tracking-wide text-emerald-300">Player test flow (one team)</h3>
        <ol className="mt-3 grid gap-2 md:grid-cols-2">
          {PLAYER_FLOW.map(([title, detail], index) => (
            <li key={title} className="rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-3 py-2">
              <p className="text-xs font-semibold text-emerald-200">{index + 1}. {title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-white/60">{detail}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold uppercase tracking-wide text-violet-300">QA checklist</h3>
          <div className="flex items-center gap-2 text-xs text-white/50">
            <span>{doneCount}/{QA_CHECKS.length} done</span>
            <button type="button" onClick={resetChecks} className="underline hover:text-white">Reset</button>
          </div>
        </div>
        <ul className="mt-3 space-y-2">
          {QA_CHECKS.map((item, index) => (
            <li key={item}>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2 hover:bg-black/30">
                <input
                  type="checkbox"
                  checked={Boolean(checked[index])}
                  onChange={() => toggleCheck(index)}
                  className="mt-0.5"
                />
                <span className={`text-xs leading-relaxed ${checked[index] ? 'text-white/40 line-through' : 'text-white/75'}`}>
                  {item}
                </span>
              </label>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <h3 className="text-sm font-bold uppercase tracking-wide text-violet-300">Automated tests (terminal)</h3>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {UNIT_TESTS.map(([name, cmd]) => (
            <div key={name} className="rounded-lg border border-violet-400/20 bg-violet-500/10 px-3 py-2">
              <p className="text-xs font-semibold text-violet-200">{name}</p>
              <div className="mt-1 flex items-center gap-2">
                <code className="flex-1 truncate text-[11px] text-white/70">{cmd}</code>
                <button
                  type="button"
                  onClick={() => copyText(cmd, () => {
                    setCopied(cmd);
                    setTimeout(() => setCopied(''), 1500);
                  })}
                  className="shrink-0 text-[10px] uppercase text-white/45 hover:text-white"
                >
                  {copied === cmd ? 'OK' : 'Copy'}
                </button>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-white/45">
          Full runbook: <code className="text-white/60">backend/docs/campus-hunt-finale-test-flow.md</code>
        </p>
      </section>

      <section className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4">
        <h3 className="text-sm font-bold uppercase tracking-wide text-amber-200">Troubleshooting</h3>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {TROUBLESHOOTING.map(([title, detail]) => (
            <div key={title} className="rounded-lg bg-black/25 px-3 py-2">
              <p className="text-xs font-semibold text-amber-100">{title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-white/55">{detail}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
