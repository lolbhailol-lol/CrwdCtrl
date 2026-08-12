import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CAMPUS_HUNT_PATHS } from '../config';
import { FINALE_MISSIONS } from './finaleMissionTheme';

const ACTIVE_MISSIONS = FINALE_MISSIONS.filter((m) => !m.comingSoon);

const STATUS_LABEL = {
  not_started: 'Ready',
  active: 'Live',
  completed: 'Done',
  abandoned: 'Paused',
};

function Field({ label, value, onChange, multiline = false }) {
  return (
    <label className="block text-xs uppercase tracking-wide text-white/50">
      {label}
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white"
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="mt-1 w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white"
        />
      )}
    </label>
  );
}

function TeamChip({ team, eventSlug, theme }) {
  const loginPath = team.teamCode && eventSlug
    ? CAMPUS_HUNT_PATHS.teamLogin(eventSlug, team.teamCode)
    : null;

  const inner = (
    <>
      <span className="text-[10px] font-semibold text-white/45">{team.finaleSlotLabel}</span>
      <span className="font-mono text-sm font-bold" style={{ color: theme.hex }}>
        {team.teamCode}
      </span>
      {team.isDemoRow && (
        <span className="rounded bg-amber-500/20 px-1 text-[9px] uppercase text-amber-100">Preview</span>
      )}
    </>
  );

  const className = `flex min-w-[88px] flex-col gap-0.5 rounded-xl border px-2.5 py-2 transition ${theme.borderClass} ${theme.bgClass} hover:brightness-110`;

  if (loginPath) {
    return (
      <Link to={loginPath} target="_blank" rel="noreferrer" className={className} title={team.teamName}>
        {inner}
      </Link>
    );
  }

  return <div className={className}>{inner}</div>;
}

function IntelTeamRow({ team, theme, eventSlug }) {
  const intel = team.intel || {};
  const loginPath = team.teamCode && eventSlug
    ? CAMPUS_HUNT_PATHS.teamLogin(eventSlug, team.teamCode)
    : null;

  return (
    <tr className="border-t border-white/10 text-sm">
      <td className="py-2.5 pr-2">
        <span className="font-semibold text-white/70">{team.finaleSlotLabel}</span>
        {team.isDemoRow && (
          <span className="ml-1 rounded bg-amber-500/15 px-1 text-[9px] text-amber-100">demo</span>
        )}
      </td>
      <td className="py-2.5 pr-2">
        {loginPath ? (
          <Link to={loginPath} target="_blank" rel="noreferrer" className="font-mono font-semibold hover:underline" style={{ color: theme.hex }}>
            {team.teamCode}
          </Link>
        ) : (
          <span className="font-mono font-semibold" style={{ color: theme.hex }}>{team.teamCode}</span>
        )}
        <p className="truncate text-xs text-white/45">{team.teamName}</p>
      </td>
      <td className="py-2.5 pr-2">
        <p className="font-medium text-white">{intel.location1?.name || '—'}</p>
        <p className="font-mono text-xs" style={{ color: theme.hex }}>{intel.location1?.fragment || '—'}</p>
      </td>
      <td className="py-2.5 pr-2">
        <p className="font-medium text-white">{intel.location2?.name || '—'}</p>
        <p className="font-mono text-xs" style={{ color: theme.hex }}>{intel.location2?.fragment || '—'}</p>
      </td>
      <td className="py-2.5 pr-2">
        <p className="font-mono font-bold text-emerald-300">{intel.combinedAnswer || '—'}</p>
      </td>
      <td className="py-2.5">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${theme.bgClass} ${theme.textClass}`}>
          {STATUS_LABEL[intel.status] || intel.status}
        </span>
      </td>
    </tr>
  );
}

function GridTeamRow({ team, theme, eventSlug }) {
  const device = team.fieldTerminal || team.borrowedDevice || {};
  const loginPath = team.teamCode && eventSlug
    ? CAMPUS_HUNT_PATHS.teamLogin(eventSlug, team.teamCode)
    : null;

  return (
    <tr className="border-t border-white/10 text-sm">
      <td className="py-2.5 pr-2">
        <span className="font-semibold text-white/70">{team.finaleSlotLabel}</span>
      </td>
      <td className="py-2.5 pr-2">
        {loginPath ? (
          <Link to={loginPath} target="_blank" rel="noreferrer" className="font-mono font-semibold hover:underline" style={{ color: theme.hex }}>
            {team.teamCode}
          </Link>
        ) : (
          <span className="font-mono font-semibold" style={{ color: theme.hex }}>{team.teamCode}</span>
        )}
      </td>
      <td className="py-2.5 pr-2 font-mono tracking-wider" style={{ color: theme.hex }}>
        {device.accessCode || 'On start'}
      </td>
      <td className="py-2.5 pr-2 text-white/70">
        {device.grid
          ? `${device.grid.levelsCompleted}/${device.grid.totalLevels} · ${device.grid.status}`
          : '—'}
      </td>
      <td className="py-2.5 pr-2 font-mono text-emerald-300">
        {device.grid?.completionCode || '—'}
      </td>
      <td className="py-2.5">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${theme.bgClass} ${theme.textClass}`}>
          {STATUS_LABEL[device.status] || device.status}
        </span>
      </td>
    </tr>
  );
}

function IntelContentEditor({ config, setConfig, theme }) {
  const intel = config?.intelHunt || {};
  const locationPool = intel.locationPool || [];

  const patchLocation = (index, field, val) => {
    setConfig((prev) => {
      const pool = [...(prev.intelHunt?.locationPool || [])];
      pool[index] = { ...pool[index], [field]: val };
      return { ...prev, intelHunt: { ...prev.intelHunt, locationPool: pool } };
    });
  };

  const patchLocationFragment = (index, val) => {
    const upper = val.toUpperCase();
    setConfig((prev) => {
      const pool = [...(prev.intelHunt?.locationPool || [])];
      pool[index] = {
        ...pool[index],
        fragment: upper,
        acceptedAnswers: upper ? [upper] : [],
      };
      return { ...prev, intelHunt: { ...prev.intelHunt, locationPool: pool } };
    });
  };

  return (
    <div className="space-y-3">
      <p className={`text-xs font-semibold uppercase tracking-wide ${theme.textClass}`}>
        Edit location pool ({locationPool.length})
      </p>
      <p className="text-xs text-white/45">
        12 campus locations. Each team gets 2 when they start. Combined word = fragment₁ + fragment₂.
      </p>
      <div className="max-h-80 space-y-2 overflow-y-auto rounded-xl border border-white/10 bg-black/20">
        {locationPool.map((loc, index) => (
          <div key={loc.id || index} className="grid gap-2 border-b border-white/10 p-3 md:grid-cols-2">
            <Field
              label={`${loc.id || `loc_${index}`} · Location name`}
              value={loc.name || ''}
              onChange={(v) => patchLocation(index, 'name', v)}
            />
            <Field
              label="Intel fragment / answer"
              value={loc.fragment || (loc.acceptedAnswers || [])[0] || ''}
              onChange={(v) => patchLocationFragment(index, v)}
            />
            <div className="md:col-span-2">
              <Field
                label="Player instruction at location"
                value={loc.instruction || ''}
                onChange={(v) => patchLocation(index, 'instruction', v)}
                multiline
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DeviceContentEditor({ config, setConfig, theme }) {
  const device = config?.fieldTerminal || config?.borrowedDevice || {};

  return (
    <div className="space-y-3">
      <p className={`text-xs font-semibold uppercase tracking-wide ${theme.textClass}`}>
        Edit mission copy
      </p>
      <Field
        label="Mission label (optional)"
        value={device.locationName || ''}
        onChange={(v) => setConfig((p) => ({
          ...p,
          fieldTerminal: { ...(p.fieldTerminal || p.borrowedDevice || {}), locationName: v },
        }))}
      />
      <Field
        label="Opening clue (shown on phone)"
        value={device.instruction || ''}
        onChange={(v) => setConfig((p) => ({
          ...p,
          fieldTerminal: { ...(p.fieldTerminal || p.borrowedDevice || {}), instruction: v },
        }))}
        multiline
      />
      <div className={`rounded-xl border px-3 py-2 text-xs ${theme.borderClass} ${theme.bgClass}`}>
        <p className={`font-semibold ${theme.textClass}`}>Grid game</p>
        <p className="mt-1 text-white/60">Shared URL: <code className="text-white/80">/campus-hunt/grid</code></p>
        <p className="mt-1 text-white/45">Access codes auto-generate per team at mission start.</p>
        <p className="mt-1 text-amber-200/70">
          Player phone copy stays cryptic (clue image). Enforce laptop-only on the grid page + ops brief.
        </p>
      </div>
      <Field
        label="Max wrong completion codes"
        value={String(device.maxAttempts ?? 3)}
        onChange={(v) => setConfig((p) => ({
          ...p,
          fieldTerminal: { ...(p.fieldTerminal || p.borrowedDevice || {}), maxAttempts: Number(v) || 3 },
        }))}
      />
    </div>
  );
}

function LockboxTeamRow({ team, theme }) {
  const lb = team.lockbox || {};
  return (
    <tr className="border-t border-white/5 text-sm text-white/80">
      <td className="px-3 py-2 text-white/45">{team.finaleSlotLabel}</td>
      <td className="pr-2 font-mono font-semibold" style={{ color: theme.hex }}>{team.teamCode}</td>
      <td className="pr-2 font-mono text-xs">{lb.assignedKeyLabel || lb.assignedKeyId || '—'}</td>
      <td className="pr-2 text-xs uppercase text-white/55">{lb.step || '—'}</td>
      <td className="pr-3 text-xs uppercase">{STATUS_LABEL[lb.status] || lb.status || '—'}</td>
    </tr>
  );
}

function LockboxContentEditor({ config, setConfig, theme }) {
  const lb = config?.lockbox || {};
  const pieces = lb.playerPieces || [];
  const codes = Array.isArray(lb.acceptedCodes) ? lb.acceptedCodes.join(', ') : '';

  const patch = (patchObj) => setConfig((p) => ({
    ...p,
    lockbox: { ...(p.lockbox || {}), ...patchObj },
  }));

  const patchPiece = (index, field, value) => {
    const next = pieces.map((row, i) => (i === index ? { ...row, [field]: value } : row));
    while (next.length < 4) {
      next.push({ seat: next.length, label: `Player ${next.length + 1}`, info: '' });
    }
    patch({ playerPieces: next.slice(0, 4).map((row, i) => ({ ...row, seat: i })) });
  };

  return (
    <div className="space-y-3">
      <p className={`text-xs font-semibold uppercase tracking-wide ${theme.textClass}`}>
        Task 1 — campus clue + physical key
      </p>
      <Field
        label="Campus clue (riddle)"
        value={lb.clue || ''}
        onChange={(v) => patch({ clue: v })}
        multiline
      />
      <Field
        label="Location name (ops)"
        value={lb.locationName || ''}
        onChange={(v) => patch({ locationName: v })}
      />
      <Field
        label="Location hint (shown to players)"
        value={lb.locationHint || ''}
        onChange={(v) => patch({ locationHint: v })}
        multiline
      />
      <div className={`rounded-xl border px-3 py-2 text-xs ${theme.borderClass} ${theme.bgClass}`}>
        <p className={`font-semibold ${theme.textClass}`}>Physical keys</p>
        <p className="mt-1 text-white/60">
          {(lb.keyPool || []).length || 0} keys in pool (default KEY — 01…12). Assigned per team at start.
        </p>
        <p className="mt-1 text-white/45">Players enter the engraved ID — not a QR / scanner.</p>
      </div>
      <Field
        label="Max wrong key attempts"
        value={String(lb.maxAttemptsKey ?? 3)}
        onChange={(v) => patch({ maxAttemptsKey: Number(v) || 3 })}
      />

      <p className={`pt-2 text-xs font-semibold uppercase tracking-wide ${theme.textClass}`}>
        Task 2 — digital lockbox (4 pieces)
      </p>
      <div className={`rounded-xl border px-3 py-2 text-xs ${theme.borderClass} ${theme.bgClass}`}>
        <p className={`font-semibold ${theme.textClass}`}>Code pool</p>
        <p className="mt-1 text-white/60">
          {(lb.codePool || []).length || 0} team code sets (default 12). Each team gets a unique code at start.
        </p>
        <p className="mt-1 text-white/45">
          Legacy fallback pieces/codes below apply only if the code pool is empty.
        </p>
      </div>
      <Field
        label="Task 2 instruction"
        value={lb.lockboxInstruction || ''}
        onChange={(v) => patch({ lockboxInstruction: v })}
        multiline
      />
      {[0, 1, 2, 3].map((seat) => {
        const piece = pieces[seat] || { seat, label: seat === 0 ? 'Team Leader' : `Player ${seat + 1}`, info: '' };
        return (
          <div key={seat} className="grid gap-2 sm:grid-cols-2">
            <Field
              label={`Seat ${seat + 1} label`}
              value={piece.label || ''}
              onChange={(v) => patchPiece(seat, 'label', v)}
            />
            <Field
              label={`Seat ${seat + 1} info (private)`}
              value={piece.info || ''}
              onChange={(v) => patchPiece(seat, 'info', v)}
            />
          </div>
        );
      })}
      <Field
        label="Accepted final codes (comma-separated)"
        value={codes}
        onChange={(v) => patch({
          acceptedCodes: v.split(',').map((s) => s.trim()).filter(Boolean),
        })}
      />
      <Field
        label="Max wrong code attempts"
        value={String(lb.maxAttemptsCode ?? 3)}
        onChange={(v) => patch({ maxAttemptsCode: Number(v) || 3 })}
      />
    </div>
  );
}

function BlackoutTeamRow({ team, theme }) {
  const b = team.blackout || {};
  const roles = b.roleBySeat
    ? Object.entries(b.roleBySeat).map(([seat, role]) => `S${Number(seat) + 1}:${role}`).join(' · ')
    : '—';
  return (
    <tr className="border-t border-white/5 text-sm text-white/80">
      <td className="px-3 py-2 text-white/45">{team.finaleSlotLabel}</td>
      <td className="pr-2 font-mono font-semibold" style={{ color: theme.hex }}>{team.teamCode}</td>
      <td className="pr-2 text-xs uppercase text-white/55">{b.step || '—'}</td>
      <td className="pr-2 font-mono text-[10px] text-white/60">{roles}</td>
      <td className="pr-2 font-mono text-xs">{b.accessToken || '—'}</td>
      <td className="pr-3 text-xs uppercase">{STATUS_LABEL[b.status] || b.status || '—'}</td>
    </tr>
  );
}

function BlackoutContentEditor({ config, setConfig, theme }) {
  const b = config?.blackout || {};
  const patch = (patchObj) => setConfig((p) => ({
    ...p,
    blackout: { ...(p.blackout || {}), ...patchObj },
  }));
  const patchTask = (task, field, value) => {
    patch({
      [task]: {
        ...(b[task] || {}),
        [field]: value,
      },
    });
  };

  return (
    <div className="space-y-3">
      <p className={`text-xs font-semibold uppercase tracking-wide ${theme.textClass}`}>
        OPERATION: BLACKOUT · config
      </p>
      <Field
        label="Duration (minutes)"
        value={String(b.durationMinutes ?? 15)}
        onChange={(v) => patch({ durationMinutes: Number(v) || 15 })}
      />
      <Field
        label="Max total penalty"
        value={String(b.maxPenaltyTotal ?? 100)}
        onChange={(v) => patch({ maxPenaltyTotal: Number(v) || 100 })}
      />
      {['scout', 'cracker', 'navigator', 'controller'].map((task) => {
        const t = b[task] || {};
        const promptKey = task === 'scout' ? 'clue' : task === 'cracker' ? 'puzzlePrompt' : 'challengePrompt';
        return (
          <div key={task} className={`rounded-xl border px-3 py-3 ${theme.borderClass} ${theme.bgClass}`}>
            <p className={`text-xs font-bold uppercase ${theme.textClass}`}>{task}</p>
            <Field
              label={promptKey}
              value={t[promptKey] || ''}
              onChange={(v) => patchTask(task, promptKey, v)}
              multiline
            />
            {task === 'scout' && (
              <Field
                label="Location hint"
                value={t.locationHint || ''}
                onChange={(v) => patchTask(task, 'locationHint', v)}
              />
            )}
            <Field
              label="Accepted answers (comma-separated)"
              value={Array.isArray(t.acceptedAnswers) ? t.acceptedAnswers.join(', ') : ''}
              onChange={(v) => patchTask(
                task,
                'acceptedAnswers',
                v.split(',').map((s) => s.trim()).filter(Boolean),
              )}
            />
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <Field
                label="Max attempts"
                value={String(t.maxAttempts ?? 3)}
                onChange={(v) => patchTask(task, 'maxAttempts', Number(v) || 3)}
              />
              <Field
                label="Penalty"
                value={String(t.penalty ?? 10)}
                onChange={(v) => patchTask(task, 'penalty', Number(v) || 0)}
              />
            </div>
          </div>
        );
      })}
      <p className="text-[11px] text-white/45">
        Controller: leave accepted answers empty to use derived code TOKEN-ROUTEINITIALS-FREQDIGITS.
      </p>
    </div>
  );
}

function MissionBoard({
  mission,
  teams,
  eventSlug,
  config,
  setConfig,
  onSave,
  busy,
  defaultOpen = true,
  onToggleEnabled,
}) {
  const [open, setOpen] = useState(defaultOpen);
  const theme = mission;
  const missionCfg = (config?.missions || []).find((m) => (
    m.id === mission.id || (mission.id === 'field_terminal' && m.id === 'borrowed_device')
  ));
  const enabled = missionCfg?.enabled !== false;

  const allottedCount = useMemo(() => {
    if (mission.id === 'intel_hunt') return teams.filter((t) => t.intel?.location1).length;
    if (mission.id === 'lockbox') return teams.filter((t) => t.lockbox?.assignedKeyId || t.lockbox?.status === 'completed').length;
    if (mission.id === 'field_terminal') return teams.length;
    if (mission.id === 'operation_blackout') {
      return teams.filter((t) => t.blackout?.status === 'active' || t.blackout?.status === 'completed').length;
    }
    return 0;
  }, [mission.id, teams]);

  return (
    <section
      className={`overflow-hidden rounded-2xl border bg-white/5 ${theme.borderClass} ${enabled ? '' : 'opacity-70'}`}
      style={{ boxShadow: open ? `inset 4px 0 0 ${theme.hex}` : undefined }}
    >
      <div className="flex w-full items-start justify-between gap-3 px-4 py-4">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="min-w-0 flex-1 text-left"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${theme.solidClass} ${theme.solidTextClass}`}>
              {theme.colorName}
            </span>
            <span className={`text-[11px] font-semibold uppercase tracking-wide ${theme.textClass}`}>
              {theme.emoji} {theme.short}
            </span>
            {theme.points > 0 && (
              <span className="text-xs text-white/45">+{theme.points} pts</span>
            )}
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
              enabled ? 'bg-emerald-500/20 text-emerald-100' : 'bg-white/10 text-white/45'
            }`}
            >
              {enabled ? 'On' : 'Off'}
            </span>
          </div>
          <h3 className="mt-1 text-lg font-bold uppercase tracking-wide text-white">{theme.label}</h3>
          <p className="mt-1 text-xs text-white/50">{theme.detail}</p>
          <p className="mt-2 text-xs text-white/40">{allottedCount} teams allotted</p>
        </button>
        <div className="flex shrink-0 flex-col items-end gap-2">
          {onToggleEnabled && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onToggleEnabled(mission.id, !enabled)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wide disabled:opacity-40 ${
                enabled
                  ? 'bg-emerald-500/25 text-emerald-100'
                  : 'bg-white/10 text-white/55'
              }`}
            >
              {busy ? '…' : enabled ? 'Turn off' : 'Turn on'}
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="text-sm text-white/50"
          >
            {open ? 'Hide' : 'Edit'}
          </button>
        </div>
      </div>

      {open && (
        <div className="space-y-5 border-t border-white/10 px-4 py-4">
          {teams.length > 0 && (
            <>
              <div>
                <p className={`text-xs font-semibold uppercase tracking-wide ${theme.textClass}`}>Team allotments</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {teams.map((team) => (
                    <TeamChip key={team.teamId || team.teamCode} team={team} eventSlug={eventSlug} theme={theme} />
                  ))}
                </div>
              </div>

              {mission.id === 'intel_hunt' && (
                <div className="overflow-x-auto rounded-xl border border-white/10 bg-black/15">
                  <table className="w-full min-w-[720px] text-left">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-wide text-white/45">
                        <th className="px-3 pb-2 pt-2">Slot</th>
                        <th className="pb-2 pr-2">Team</th>
                        <th className="pb-2 pr-2">Location 1</th>
                        <th className="pb-2 pr-2">Location 2</th>
                        <th className="pb-2 pr-2">Combined</th>
                        <th className="pb-2 pr-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teams.map((team) => (
                        <IntelTeamRow key={team.teamId || team.teamCode} team={team} theme={theme} eventSlug={eventSlug} />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {mission.id === 'lockbox' && (
                <div className="overflow-x-auto rounded-xl border border-white/10 bg-black/15">
                  <table className="w-full min-w-[640px] text-left">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-wide text-white/45">
                        <th className="px-3 pb-2 pt-2">Slot</th>
                        <th className="pb-2 pr-2">Team</th>
                        <th className="pb-2 pr-2">Assigned key</th>
                        <th className="pb-2 pr-2">Step</th>
                        <th className="pb-2 pr-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teams.map((team) => (
                        <LockboxTeamRow key={team.teamId || team.teamCode} team={team} theme={theme} />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {mission.id === 'field_terminal' && (
                <div className="overflow-x-auto rounded-xl border border-white/10 bg-black/15">
                  <table className="w-full min-w-[640px] text-left">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-wide text-white/45">
                        <th className="px-3 pb-2 pt-2">Slot</th>
                        <th className="pb-2 pr-2">Team</th>
                        <th className="pb-2 pr-2">Access code</th>
                        <th className="pb-2 pr-2">Grid progress</th>
                        <th className="pb-2 pr-2">Completion</th>
                        <th className="pb-2 pr-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teams.map((team) => (
                        <GridTeamRow key={team.teamId || team.teamCode} team={team} theme={theme} eventSlug={eventSlug} />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {mission.id === 'operation_blackout' && (
                <div className="overflow-x-auto rounded-xl border border-white/10 bg-black/15">
                  <table className="w-full min-w-[720px] text-left">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-wide text-white/45">
                        <th className="px-3 pb-2 pt-2">Slot</th>
                        <th className="pb-2 pr-2">Team</th>
                        <th className="pb-2 pr-2">Step</th>
                        <th className="pb-2 pr-2">Roles</th>
                        <th className="pb-2 pr-2">Token</th>
                        <th className="pb-2 pr-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teams.map((team) => (
                        <BlackoutTeamRow key={team.teamId || team.teamCode} team={team} theme={theme} />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {config && setConfig && mission.id === 'intel_hunt' && (
            <IntelContentEditor config={config} setConfig={setConfig} theme={theme} />
          )}

          {config && setConfig && mission.id === 'lockbox' && (
            <LockboxContentEditor config={config} setConfig={setConfig} theme={theme} />
          )}

          {config && setConfig && mission.id === 'field_terminal' && (
            <DeviceContentEditor config={config} setConfig={setConfig} theme={theme} />
          )}

          {config && setConfig && mission.id === 'operation_blackout' && (
            <BlackoutContentEditor config={config} setConfig={setConfig} theme={theme} />
          )}

          {onSave && (
            <button
              type="button"
              disabled={busy}
              onClick={onSave}
              className={`rounded-xl px-5 py-2.5 text-sm font-bold disabled:opacity-40 ${theme.solidClass} ${theme.solidTextClass}`}
            >
              Save {theme.colorName} mission
            </button>
          )}
        </div>
      )}
    </section>
  );
}

export default function FinaleMissionAssignments({
  assignments,
  eventSlug,
  loading,
  config,
  setConfig,
  onSave,
  busy,
  onPromoteDemo,
  demoBusy,
  hasRound,
  onToggleMissionEnabled,
}) {
  const teams = assignments?.teams || [];

  if (loading) {
    return (
      <p className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/60">
        Loading missions…
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-white/45">
        Turn missions On/Off for testing. Off missions stay on the board as locked for players.
      </p>
      {onPromoteDemo && teams.some((t) => t.isDemoRow) && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-3">
          <p className="text-sm text-emerald-100">Demo teams showing as preview — promote to make them real finalists.</p>
          <button
            type="button"
            disabled={demoBusy || !hasRound}
            onClick={onPromoteDemo}
            className="rounded-xl bg-emerald-500/25 px-4 py-2 text-sm font-bold text-emerald-100 disabled:opacity-40"
          >
            {demoBusy ? 'Adding…' : 'Make CC001–CC012 finalists'}
          </button>
        </div>
      )}

      {teams.length === 0 ? (
        <p className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          No teams found. Bootstrap finale and create demo teams CC001–CC012.
        </p>
      ) : (
        ACTIVE_MISSIONS.map((mission, index) => (
          <MissionBoard
            key={mission.id}
            mission={mission}
            teams={teams}
            eventSlug={eventSlug}
            config={config}
            setConfig={setConfig}
            onSave={onSave}
            busy={busy}
            defaultOpen={index === 0}
            onToggleEnabled={onToggleMissionEnabled}
          />
        ))
      )}
    </div>
  );
}
