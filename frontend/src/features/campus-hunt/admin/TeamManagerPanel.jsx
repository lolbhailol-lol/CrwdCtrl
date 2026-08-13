import { useEffect, useMemo, useState } from 'react';
import {
  adminListTeams,
  adminListRoutes,
  adminCreateTeam,
  adminUpdateTeam,
  adminDeleteTeam,
  adminCreateRoute,
  adminUpdateRoute,
  adminAutoAssignRoutes,
  adminRevealTeamAccess,
  adminSetAllTeamPasswords,
  adminListStartingPoints,
  adminListChallenges,
  adminListCheckpoints,
  adminBootstrapRound1,
  adminRepairTeamRosters,
  adminMarkTeamStartReached,
} from '../services/campusHunt.api';

function absoluteUrl(path) {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `${window.location.origin}${path}`;
}

function copyText(text) {
  navigator.clipboard?.writeText(text);
}

function id(value) {
  return String(value?._id || value?.id || value || '');
}

function toLocalDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return shifted.toISOString().slice(0, 16);
}

function TeamDetailCard({
  team,
  routes = [],
  startingPoints = [],
  clue1Variants = [],
  checkpoints = [],
  teamSize = 4,
  onCopied,
  onChanged,
}) {
  const scannersNeeded = Math.max(1, (Number(teamSize) || 4) - 1);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showCredentials, setShowCredentials] = useState(false);
  const [revealedAccess, setRevealedAccess] = useState(null);
  const [editForm, setEditForm] = useState({
    teamName: team.teamName || '',
    leaderName: team.leaderName || '',
    leaderEmail: team.leaderContactEmail || team.access?.leader?.contactEmail || '',
    memberNames: Array.from({ length: scannersNeeded }, (_, i) => team.memberNames?.[i] || ''),
    routeId: id(team.routeId),
    startingPointId: id(team.startingPointId),
    scheduledStartAt: toLocalDateTime(team.scheduledStartAt),
    clue1ChallengeId: id(team.clue1ChallengeId),
    firstCheckpointId: id(team.firstCheckpointId),
    leaderPassword: '',
    scannerPassword: '',
    teamPassword: '',
    reason: '',
  });
  const access = revealedAccess || team.access || {};
  const teamUrl = absoluteUrl(team.teamLoginPath || team.teamLoginUrl);
  const assignedRoute = routes.find((route) => id(route) === id(team.routeId));
  const names = team.allMemberNames?.length
    ? team.allMemberNames
    : [team.leaderName, ...(team.memberNames || [])].filter(Boolean);

  const startEdit = () => {
    setEditForm({
      teamName: team.teamName || '',
      leaderName: team.leaderName || '',
      leaderEmail: team.leaderContactEmail || team.access?.leader?.contactEmail || '',
      memberNames: Array.from({ length: scannersNeeded }, (_, i) => team.memberNames?.[i] || ''),
      routeId: id(team.routeId),
      startingPointId: id(team.startingPointId),
      scheduledStartAt: toLocalDateTime(team.scheduledStartAt),
      clue1ChallengeId: id(team.clue1ChallengeId),
      firstCheckpointId: id(team.firstCheckpointId),
      leaderPassword: '',
      scannerPassword: '',
      teamPassword: '',
      reason: '',
    });
    setEditing(true);
    setOpen(true);
  };

  const saveEdit = async () => {
    setBusy(true);
    try {
      const namesOnly = editForm.memberNames.map((n) => n.trim()).filter(Boolean);
      if (!editForm.teamName.trim() || !editForm.leaderName.trim() || namesOnly.length !== scannersNeeded) {
        onCopied?.(
          `Team name, leader name, and ${scannersNeeded} member name(s) are required (${teamSize} people/team)`,
        );
        return;
      }
      await adminUpdateTeam(team._id, {
        teamName: editForm.teamName.trim(),
        leaderName: editForm.leaderName.trim(),
        leaderEmail: editForm.leaderEmail.trim(),
        memberNames: namesOnly,
        routeId: editForm.routeId || undefined,
        startingPointId: editForm.startingPointId || null,
        scheduledStartAt: editForm.scheduledStartAt
          ? new Date(editForm.scheduledStartAt).toISOString()
          : null,
        clue1ChallengeId: editForm.clue1ChallengeId || null,
        firstCheckpointId: editForm.firstCheckpointId || null,
        confirm: true,
        reason: editForm.reason.trim() || 'Updated team assignment from team manager',
        teamPassword: editForm.teamPassword.trim() || undefined,
        leaderPassword: editForm.teamPassword.trim()
          ? undefined
          : (editForm.leaderPassword.trim() || undefined),
        scannerPassword: editForm.teamPassword.trim()
          ? undefined
          : (editForm.scannerPassword.trim() || undefined),
      });
      setEditing(false);
      onCopied?.(`Updated ${team.teamCode}`);
      await onChanged?.();
    } catch (err) {
      onCopied?.(err.message || 'Update failed');
    } finally {
      setBusy(false);
    }
  };

  const removeTeam = async () => {
    if (!window.confirm(`Delete team ${team.teamCode} (${team.teamName})? Progress will be wiped.`)) {
      return;
    }
    setBusy(true);
    try {
      await adminDeleteTeam(team._id);
      onCopied?.(`Deleted ${team.teamCode}`);
      await onChanged?.();
    } catch (err) {
      onCopied?.(err.message || 'Delete failed');
    } finally {
      setBusy(false);
    }
  };

  const copyTeamPack = () => {
    if (!revealedAccess) {
      onCopied?.('Reveal passwords before copying the full access pack');
      return;
    }
    const pass = access.teamPassword || access.sharedScannerPassword || access.leader?.password || '';
    const lines = [
      `Team ${team.teamCode}${team.teamName && !/^team\s*\d+$/i.test(team.teamName) ? ` — ${team.teamName}` : ''}`,
      '',
      '=== SHARE THIS LINK WITH THE WHOLE TEAM ===',
      teamUrl,
      '',
      `Password: ${pass}`,
      '',
      'Open link → type password → tap your name:',
      `  Leader: ${access.leader?.name || team.leaderName || ''}`,
      ...(access.scanners || []).map((s, i) => `  Player ${i + 1}: ${s.name}`),
    ];
    copyText(lines.join('\n'));
    onCopied?.(`Copied ${team.teamCode} pack`);
  };

  const printTeamSlip = () => {
    if (!revealedAccess) {
      onCopied?.('Reveal passwords before printing the team slip');
      return;
    }
    const popup = window.open('', '_blank', 'width=720,height=900');
    if (!popup) {
      onCopied?.('Allow popups to print the team slip');
      return;
    }
    const pass = access.teamPassword || access.sharedScannerPassword || access.leader?.password || '';
    const playerNames = (access.scanners || []).map((scanner) => (
      `<li><strong>${scanner.name}</strong> — tap this name after password</li>`
    )).join('');
    popup.document.write(`<!doctype html><html><head><title>${team.teamCode} access</title>
      <style>
        body{font:16px system-ui;padding:28px;line-height:1.45;color:#111}
        code{word-break:break-all;background:#f3f4f6;padding:8px 10px;display:block;border-radius:8px;margin-top:8px}
        .box{border:2px solid #0ECCEE;border-radius:12px;padding:14px;margin:16px 0}
        h2{margin:20px 0 8px;font-size:18px}
        li{margin:8px 0}
        .steps{font-size:15px;margin:12px 0 0;padding-left:18px}
      </style>
      </head><body>
      <h1>${team.teamCode}</h1>
      <div class="box">
        <strong>How to log in</strong>
        <ol class="steps">
          <li>Open the link below</li>
          <li>Enter password: <strong>${pass}</strong></li>
          <li>Tap your name</li>
        </ol>
        <code>${teamUrl}</code>
      </div>
      <h2>Who to tap</h2>
      <p><strong>Leader:</strong> ${access.leader?.name || ''} — tap Leader</p>
      <ol>${playerNames}</ol>
      <script>window.print()</script></body></html>`);
    popup.document.close();
  };

  const toggleCredentials = async () => {
    if (showCredentials) {
      setShowCredentials(false);
      setRevealedAccess(null);
      return;
    }
    setBusy(true);
    try {
      const result = await adminRevealTeamAccess(team._id);
      setRevealedAccess(result.data?.access || null);
      setShowCredentials(true);
      onCopied?.('Passwords revealed; this action was audited');
    } catch (err) {
      onCopied?.(err.message || 'Could not reveal passwords');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/5">
      <div className="flex w-full items-start justify-between gap-3 px-4 py-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="min-w-0 flex-1 text-left"
        >
          <p className="font-semibold">
            <span className="font-mono text-[#0ECCEE]">{team.teamCode}</span>
            {' · '}
            {team.teamName}
          </p>
          <p className="mt-1 text-xs text-white/55">
            {names.map((n, i) => (i === 0 ? `${n} (L)` : n)).join(' · ') || '—'}
          </p>
          <p className="mt-1 text-xs text-white/40">
            {team.currentStage} · score {team.currentScore} · route {assignedRoute?.routeKey || 'unassigned'}
            {' · start '}
            {team.startStatus || 'WAITING'}
          </p>
          <span className="mt-1 inline-block text-xs text-white/50">
            {open ? 'Hide details' : 'Show details'}
          </span>
        </button>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            disabled={busy}
            onClick={startEdit}
            className="rounded-lg bg-white/10 px-2 py-1 text-[11px] disabled:opacity-40"
          >
            Edit
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={removeTeam}
            className="rounded-lg bg-red-500/20 px-2 py-1 text-[11px] text-red-200 disabled:opacity-40"
          >
            Delete
          </button>
        </div>
      </div>

      {open && (
        <div className="space-y-3 border-t border-white/10 px-4 py-3 text-sm">
          {editing && (
            <div className="space-y-2 rounded-lg border border-[#0ECCEE]/30 bg-[#0ECCEE]/5 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#0ECCEE]">
                Edit team details
              </p>
              <input
                value={editForm.teamName}
                onChange={(e) => setEditForm((f) => ({ ...f, teamName: e.target.value }))}
                placeholder="Team name"
                className="w-full rounded-lg border border-white/20 bg-[#161718] px-3 py-2 text-sm"
              />
              <input
                value={editForm.leaderName}
                onChange={(e) => setEditForm((f) => ({ ...f, leaderName: e.target.value }))}
                placeholder="Leader name"
                className="w-full rounded-lg border border-white/20 bg-[#161718] px-3 py-2 text-sm"
              />
              <input
                type="email"
                value={editForm.leaderEmail}
                onChange={(e) => setEditForm((form) => ({ ...form, leaderEmail: e.target.value }))}
                placeholder="Leader contact email"
                className="w-full rounded-lg border border-white/20 bg-[#161718] px-3 py-2 text-sm"
              />
              {editForm.memberNames.map((n, idx) => (
                <input
                  key={idx}
                  value={n}
                  onChange={(e) => {
                    const next = [...editForm.memberNames];
                    next[idx] = e.target.value;
                    setEditForm((f) => ({ ...f, memberNames: next }));
                  }}
                  placeholder={`Member ${idx + 1} name`}
                  className="w-full rounded-lg border border-white/20 bg-[#161718] px-3 py-2 text-sm"
                />
              ))}
              <select
                value={editForm.routeId}
                onChange={(e) => setEditForm((f) => ({ ...f, routeId: e.target.value }))}
                className="w-full rounded-lg border border-white/20 bg-[#161718] px-3 py-2 text-sm"
              >
                <option value="">Route (unchanged / none)</option>
                {routes.map((r) => (
                  <option key={r._id} value={r._id}>
                    Route {r.routeKey} — {r.name}
                  </option>
                ))}
              </select>
              <details className="rounded-lg border border-white/10 bg-black/20 p-3">
                <summary className="cursor-pointer text-xs font-medium text-white/70">
                  Advanced start and clue assignments
                </summary>
                <p className="mt-2 text-xs text-white/45">
                  Usually managed automatically. Change these only when correcting one team.
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <select
                    value={editForm.startingPointId}
                    onChange={(e) => setEditForm((f) => ({
                      ...f,
                      startingPointId: e.target.value,
                    }))}
                    className="w-full rounded-lg border border-white/20 bg-[#161718] px-3 py-2 text-sm"
                  >
                    <option value="">No starting point</option>
                    {startingPoints.map((point) => (
                      <option key={id(point)} value={id(point)}>
                        {point.code} — {point.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="datetime-local"
                    value={editForm.scheduledStartAt}
                    onChange={(e) => setEditForm((f) => ({
                      ...f,
                      scheduledStartAt: e.target.value,
                    }))}
                    aria-label="Scheduled start time"
                    className="w-full rounded-lg border border-white/20 bg-[#161718] px-3 py-2 text-sm"
                  />
                  <select
                    value={editForm.clue1ChallengeId}
                    onChange={(e) => setEditForm((f) => ({
                      ...f,
                      clue1ChallengeId: e.target.value,
                    }))}
                    className="w-full rounded-lg border border-white/20 bg-[#161718] px-3 py-2 text-sm"
                  >
                    <option value="">No Clue 1 assignment</option>
                    {clue1Variants
                      .filter((challenge) => (
                        (!editForm.routeId || id(challenge.routeId) === editForm.routeId)
                        && (
                          !editForm.startingPointId
                          || !challenge.startingPointId
                          || id(challenge.startingPointId) === editForm.startingPointId
                        )
                      ))
                      .map((challenge) => (
                      <option key={id(challenge)} value={id(challenge)}>
                        {challenge.variantKey || 'DEFAULT'} · {challenge.difficulty || 'medium'}
                      </option>
                      ))}
                  </select>
                  <select
                    value={editForm.firstCheckpointId}
                    onChange={(e) => setEditForm((f) => ({
                      ...f,
                      firstCheckpointId: e.target.value,
                    }))}
                    className="w-full rounded-lg border border-white/20 bg-[#161718] px-3 py-2 text-sm"
                  >
                    <option value="">No first checkpoint</option>
                    {checkpoints
                      .filter((checkpoint) => (
                        String(checkpoint.progressionKey || checkpoint.checkpointKey) === '1'
                        && (!editForm.routeId || id(checkpoint.routeId) === editForm.routeId)
                      ))
                      .map((checkpoint) => (
                      <option key={id(checkpoint)} value={id(checkpoint)}>
                        {checkpoint.code || checkpoint.checkpointKey} — {checkpoint.locationName}
                      </option>
                      ))}
                  </select>
                </div>
                <input
                  value={editForm.reason}
                  onChange={(e) => setEditForm((f) => ({ ...f, reason: e.target.value }))}
                  placeholder="Reason for this manual change"
                  className="mt-2 w-full rounded-lg border border-amber-400/30 bg-[#161718] px-3 py-2 text-sm"
                />
              </details>
              <input
                type="password"
                value={editForm.teamPassword}
                onChange={(e) => setEditForm((f) => ({
                  ...f,
                  teamPassword: e.target.value,
                }))}
                placeholder={`Shared team password (all ${teamSize} people)`}
                className="w-full rounded-lg border border-[#0ECCEE]/40 bg-[#161718] px-3 py-2 font-mono text-sm"
              />
              <p className="text-[11px] text-white/45">
                One password for the team link. Leave blank to keep current.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={saveEdit}
                  className="rounded-lg bg-[#0ECCEE] px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-40"
                >
                  Save changes
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setEditing(false)}
                  className="rounded-lg bg-white/10 px-3 py-1.5 text-xs"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="grid gap-2 rounded-lg bg-black/30 px-3 py-2 text-xs sm:grid-cols-2">
            <p>
              <span className="text-white/45">Starting point:</span>{' '}
              {team.startingPoint?.code
                || startingPoints.find((point) => id(point) === id(team.startingPointId))?.code
                || 'unassigned'}
            </p>
            <p>
              <span className="text-white/45">Scheduled:</span>{' '}
              {team.scheduledStartAt ? new Date(team.scheduledStartAt).toLocaleString() : 'unscheduled'}
            </p>
            <p>
              <span className="text-white/45">Start status:</span>{' '}
              {team.startStatus || 'WAITING'}
            </p>
            <p>
              <span className="text-white/45">Actual start:</span>{' '}
              {team.actualStartAt ? new Date(team.actualStartAt).toLocaleString() : '—'}
            </p>
          </div>

          {['CLUE_4_COMPLETED', 'CLUE_4_FAILED'].includes(team.currentStage) && (
            <div className="rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-3">
              <p className="text-sm font-semibold text-red-100">Waiting at start</p>
              <p className="mt-1 text-xs text-white/65">
                Team finished Clue 4. When they arrive at{' '}
                {team.startingPoint?.name
                  || startingPoints.find((point) => id(point) === id(team.startingPointId))?.name
                  || 'their start'}
                , mark them reached to lock score.
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await adminMarkTeamStartReached(id(team), {
                      reason: 'Organizer marked reached at start',
                    });
                    onCopied?.(`${team.teamCode || 'Team'} marked complete`);
                    await onChanged?.();
                  } catch (err) {
                    onCopied?.(err.message || 'Could not mark team');
                  } finally {
                    setBusy(false);
                  }
                }}
                className="mt-3 w-full rounded-lg bg-red-500 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
              >
                Mark reached at start · lock score
              </button>
            </div>
          )}

          <div className="rounded-lg border border-[#0ECCEE]/30 bg-[#0ECCEE]/10 px-3 py-3">
            <p className="text-xs uppercase tracking-wide text-[#0ECCEE]/80">
              Team login · {team.teamCode}
            </p>
            <p className="mt-2 break-all font-mono text-xs text-[#0ECCEE]">{teamUrl}</p>
            <p className="mt-2 text-sm text-white/80">
              Password:{' '}
              <span className="font-mono text-[#0ECCEE]">
                {showCredentials
                  ? (access.teamPassword || access.sharedScannerPassword || access.leader?.password || 'not set')
                  : '••••••••'}
              </span>
            </p>
            <p className="mt-1 text-[11px] text-white/50">
              Share this one link. All {teamSize} people: password → tap their name.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  copyText(teamUrl);
                  onCopied?.('Copied team URL');
                }}
                className="rounded-lg bg-white/10 px-3 py-1.5 text-xs"
              >
                Copy URL
              </button>
              <a
                href={teamUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg bg-[#0ECCEE]/20 px-3 py-1.5 text-xs text-[#0ECCEE]"
              >
                Open
              </a>
              <button
                type="button"
                onClick={copyTeamPack}
                className="rounded-lg bg-emerald-500/20 px-3 py-1.5 text-xs text-emerald-200"
              >
                Copy slip
              </button>
              <button
                type="button"
                onClick={printTeamSlip}
                className="rounded-lg bg-white/10 px-3 py-1.5 text-xs"
              >
                Print slip
              </button>
              <button
                type="button"
                onClick={toggleCredentials}
                className="rounded-lg bg-white/10 px-3 py-1.5 text-xs"
              >
                {showCredentials ? 'Hide password' : 'Reveal password'}
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-black/25 px-3 py-3">
            <p className="text-xs uppercase tracking-wide text-white/45">
              This team · hub locks
            </p>
            <p className="mt-1 text-[11px] text-white/40">
              Force-lock a round for this team only (even if overall is open).
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {[
                ['round1', 'R1'],
                ['survival', 'Surv'],
                ['finale', 'Finals'],
              ].map(([key, label]) => {
                const locked = Boolean(team.playerRoundLocks?.[key]);
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await adminUpdateTeam(id(team), {
                          playerRoundLocks: {
                            round1: Boolean(team.playerRoundLocks?.round1),
                            survival: Boolean(team.playerRoundLocks?.survival),
                            finale: Boolean(team.playerRoundLocks?.finale),
                            [key]: !locked,
                          },
                        });
                        onCopied?.(
                          !locked
                            ? `${team.teamCode} · ${label} locked`
                            : `${team.teamCode} · ${label} unlocked`,
                        );
                        await onChanged?.();
                      } catch (err) {
                        onCopied?.(err.message || 'Could not update locks');
                      } finally {
                        setBusy(false);
                      }
                    }}
                    className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold disabled:opacity-40 ${
                      locked
                        ? 'bg-rose-500/25 text-rose-100'
                        : 'bg-white/10 text-white/70'
                    }`}
                  >
                    {label} · {locked ? 'LOCKED' : 'ok'}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-lg bg-black/30 px-3 py-2">
            <p className="text-xs uppercase tracking-wide text-white/45">Who taps what</p>
            <p className="mt-1 font-medium">
              Leader · {access.leader?.name || team.leaderName || '—'}
            </p>
            <ul className="mt-2 space-y-1">
              {(access.scanners || []).map((s, i) => (
                <li key={s.loginEmail || s.name || i} className="text-sm text-white/80">
                  Player {i + 1} · {s.name}
                </li>
              ))}
              {!access.scanners?.length && (
                <p className="text-xs text-white/45">No players listed yet.</p>
              )}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function CredentialsCard({ credentials, teamCode, teamLoginPath }) {
  if (!credentials) return null;
  const { leader, scanners, sharedScannerPassword, teamPassword, allMemberNames } = credentials;
  const teamUrl = absoluteUrl(teamLoginPath);
  const pass = teamPassword || sharedScannerPassword || leader?.password || '';

  const copyAll = () => {
    const lines = [
      `Team ${teamCode}`,
      teamUrl ? `Login link: ${teamUrl}` : '',
      `Password: ${pass}`,
      '',
      `All members: ${(allMemberNames || [leader?.name, ...(scanners || []).map((s) => s.name)]).join(', ')}`,
      '',
      `Leader: ${leader?.name || ''}`,
      ...(scanners || []).map((s, i) => `Player ${i + 1}: ${s.name}`),
    ].filter(Boolean);
    copyText(lines.join('\n'));
  };

  return (
    <div className="space-y-3 rounded-xl border border-emerald-400/40 bg-emerald-500/10 p-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold text-emerald-200">New team access — save / share now</p>
        <button type="button" onClick={copyAll} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs">
          Copy all
        </button>
      </div>

      {teamUrl && (
        <div className="rounded-lg bg-black/20 px-3 py-2">
          <p className="text-xs uppercase tracking-wide text-white/50">Login URL</p>
          <p className="break-all font-mono text-xs text-[#0ECCEE]">{teamUrl}</p>
        </div>
      )}

      <div className="rounded-lg bg-black/20 px-3 py-2">
        <p className="text-xs uppercase tracking-wide text-white/50">Password</p>
        <p className="font-mono text-sm text-white">{pass || '—'}</p>
      </div>

      <div className="rounded-lg bg-black/20 px-3 py-2">
        <p className="text-xs uppercase tracking-wide text-white/50">All names</p>
        <p className="text-sm text-white/90">
          {(allMemberNames || [leader?.name, ...(scanners || []).map((s) => s.name)]).join(' · ')}
        </p>
      </div>
    </div>
  );
}

export default function TeamManagerPanel({
  eventId,
  roundId,
  onChanged,
  showRouteTools = false,
  readiness = null,
  eventMeta: eventMetaProp = null,
}) {
  const [teams, setTeams] = useState([]);
  const [eventMeta, setEventMeta] = useState(eventMetaProp);
  const [routes, setRoutes] = useState([]);
  const [startingPoints, setStartingPoints] = useState([]);
  const [clue1Variants, setClue1Variants] = useState([]);
  const [checkpoints, setCheckpoints] = useState([]);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [lastCredentials, setLastCredentials] = useState(null);
  const [lastTeamCode, setLastTeamCode] = useState('');
  const [lastTeamLoginPath, setLastTeamLoginPath] = useState('');

  const [teamCode, setTeamCode] = useState('');
  const [teamName, setTeamName] = useState('');
  const [routeId, setRouteId] = useState('');
  const [leaderEmail, setLeaderEmail] = useState('');
  const [leaderName, setLeaderName] = useState('');
  const [leaderPassword, setLeaderPassword] = useState('');
  const [memberNames, setMemberNames] = useState(['', '', '']);
  const [scannerPassword, setScannerPassword] = useState('');
  const [bulkTeamPassword, setBulkTeamPassword] = useState('');
  const [routeDraft, setRouteDraft] = useState({ routeKey: '', name: '', teamSlots: 10 });

  const capacity = Math.max(2, Number(eventMeta?.teamCapacity) || 40);
  const teamSize = Math.max(2, Math.min(8, Number(eventMeta?.teamSize) || 4));
  const startCount = Math.max(1, Math.min(4, Number(eventMeta?.startCount) || 4));
  const teamsPerWait = Math.max(1, Math.ceil(capacity / startCount));
  const scannersNeeded = Math.max(1, teamSize - 1);

  const activeStarts = useMemo(() => {
    const active = (startingPoints || []).filter((p) => p.active !== false);
    const order = ['A', 'B', 'C', 'D'];
    const sorted = [...active].sort((a, b) => (
      order.indexOf(String(a.code || '').toUpperCase().charAt(0))
      - order.indexOf(String(b.code || '').toUpperCase().charAt(0))
    ));
    return sorted.slice(0, startCount);
  }, [startingPoints, startCount]);

  const refresh = async () => {
    const [t, r, pointResult, challengeResult, checkpointResult] = await Promise.all([
      adminListTeams(eventId),
      adminListRoutes(eventId),
      adminListStartingPoints(eventId).catch(() => ({ data: { startingPoints: [] } })),
      adminListChallenges(eventId).catch(() => ({ data: { challenges: [] } })),
      adminListCheckpoints(eventId).catch(() => ({ data: { checkpoints: [] } })),
    ]);
    setTeams(t.data?.teams || []);
    setEventMeta((prev) => ({
      ...(prev || {}),
      ...(eventMetaProp || {}),
      ...(t.data?.event || {}),
    }));
    const routeList = r.data?.routes || [];
    setRoutes(routeList);
    setStartingPoints(pointResult.data?.startingPoints || pointResult.data?.points || []);
    setClue1Variants(
      (challengeResult.data?.challenges || []).filter(
        (challenge) => Number(challenge.challengeNumber) === 1,
      ),
    );
    setCheckpoints(checkpointResult.data?.checkpoints || []);
    if (!routeId && routeList[0]) setRouteId(String(routeList[0]._id));
  };

  useEffect(() => {
    if (eventMetaProp) {
      setEventMeta((prev) => ({ ...(prev || {}), ...eventMetaProp }));
    }
  }, [eventMetaProp]);

  useEffect(() => {
    refresh().catch((err) => setMsg(err.message));
  }, [eventId]);

  useEffect(() => {
    setMemberNames((prev) => {
      const next = Array.from({ length: scannersNeeded }, (_, i) => prev[i] || '');
      if (next.length === prev.length && next.every((v, i) => v === prev[i])) return prev;
      return next;
    });
  }, [scannersNeeded]);

  const createOne = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg('');
    setLastCredentials(null);
    try {
      if (!leaderName.trim()) {
        setMsg('Enter the leader name');
        return;
      }
      const sharedPass = (leaderPassword.trim() || scannerPassword.trim());
      if (!sharedPass) {
        setMsg('Create the shared team password');
        return;
      }
      const names = memberNames.map((n) => n.trim()).filter(Boolean);
      if (names.length !== scannersNeeded) {
        setMsg(`Enter all ${scannersNeeded} member name(s) (${teamSize} people per team including leader)`);
        return;
      }
      const res = await adminCreateTeam(eventId, {
        teamCode,
        teamName,
        leaderEmail: leaderEmail.trim(),
        leaderName: leaderName.trim(),
        teamPassword: sharedPass,
        leaderPassword: sharedPass,
        memberNames: names,
        scannerPassword: sharedPass,
        routeId: routeId || undefined,
        roundId: roundId || undefined,
      });
      const code = String(res.data?.team?.teamCode || teamCode).toUpperCase();
      setMsg(`Created ${code}`);
      setLastCredentials(res.data?.credentials || null);
      setLastTeamCode(code);
      setLastTeamLoginPath(res.data?.teamLoginPath || '');
      setTeamCode('');
      setTeamName('');
      setLeaderEmail('');
      setLeaderName('');
      setLeaderPassword('');
      setMemberNames(Array.from({ length: scannersNeeded }, () => ''));
      setScannerPassword('');
      await refresh();
      onChanged?.();
    } catch (err) {
      setMsg(err.message || 'Create failed');
    } finally {
      setBusy(false);
    }
  };

  const setPasswordForAllTeams = async () => {
    const password = String(bulkTeamPassword || '').trim();
    if (password.length < 4) {
      setMsg('Password must be at least 4 characters');
      return;
    }
    if (!window.confirm(
      `Set password "${password}" for ALL ${teams.length} teams?\n\n`
      + 'Share each team’s /team/CC00x link. Everyone types this password, then taps their name.',
    )) {
      return;
    }
    setBusy(true);
    setMsg('');
    try {
      const res = await adminSetAllTeamPasswords(eventId, password);
      setMsg(res.data?.message || `Updated ${res.data?.teamsUpdated || 0} teams`);
      setBulkTeamPassword('');
      await refresh();
      onChanged?.();
    } catch (err) {
      setMsg(err.message || 'Could not set passwords');
    } finally {
      setBusy(false);
    }
  };

  const createRoute = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg('');
    try {
      await adminCreateRoute(eventId, {
        routeKey: routeDraft.routeKey.trim().toUpperCase(),
        name: routeDraft.name.trim(),
        teamSlots: Number(routeDraft.teamSlots) || 10,
      });
      setRouteDraft({ routeKey: '', name: '', teamSlots: 10 });
      setMsg('Route created');
      await refresh();
    } catch (err) {
      setMsg(err.message || 'Could not create route');
    } finally {
      setBusy(false);
    }
  };

  const toggleRoute = async (route) => {
    setBusy(true);
    try {
      await adminUpdateRoute(route._id, { active: !route.active });
      await refresh();
      setMsg(`Route ${route.routeKey} ${route.active ? 'disabled' : 'enabled'}`);
    } catch (err) {
      setMsg(err.message || 'Could not update route');
    } finally {
      setBusy(false);
    }
  };

  const autoAssign = async () => {
    setBusy(true);
    try {
      const result = await adminAutoAssignRoutes(eventId);
      setMsg(`Assigned ${result.data?.assigned || 0} teams to routes`);
      await refresh();
      onChanged?.();
    } catch (err) {
      setMsg(err.message || 'Could not assign routes');
    } finally {
      setBusy(false);
    }
  };

  const repairAllRosters = async () => {
    if (!teams.length) {
      setMsg('Create teams first');
      return;
    }
    const incomplete = readiness?.rostersIncomplete
      ?? teams.filter((t) => !(
        t.access?.leader?.loginEmail
        && Array.isArray(t.access?.scanners)
        && t.access.scanners.length === 3
        && t.access.scanners.every((s) => s.loginEmail)
      )).length;
    if (incomplete <= 0) {
      setMsg('All team rosters already have player accounts');
      return;
    }
    const ok = window.confirm(
      `Create leader + 3 player accounts for ${incomplete} team(s)?\n\n`
      + 'Required before Round 1 can start. Safe to re-run.',
    );
    if (!ok) return;

    setBusy(true);
    setMsg('');
    try {
      const result = await adminRepairTeamRosters(eventId);
      const d = result.data || {};
      setMsg(
        `Rosters repaired · ${d.repaired ?? 0} fixed, ${d.alreadyReady ?? 0} already OK`
        + (d.stillIncomplete ? ` · ${d.stillIncomplete} still incomplete` : ''),
      );
      await refresh();
      onChanged?.();
    } catch (err) {
      setMsg(err.message || 'Roster repair failed');
    } finally {
      setBusy(false);
    }
  };

  const createDemoTeams = async () => {
    if (teams.length >= capacity) {
      setMsg(`Already have ${teams.length}/${capacity} teams.`);
      return;
    }
    const ok = window.confirm(
      `Create demo Team 1–${capacity} (codes CC001–CC${String(capacity).padStart(3, '0')})?\n\n`
      + `${teamSize} people/team · ${startCount} start(s) · ~${teamsPerWait} teams per start.\n\n`
      + 'Does NOT set one shared password for all teams.\n'
      + 'After create: set a unique password per team (or run unique-campus-hunt-team-passwords.js).\n\n'
      + 'Skips teams that already exist.',
    );
    if (!ok) return;

    setBusy(true);
    setMsg('');
    try {
      const result = await adminBootstrapRound1(eventId, {
        createTeams: true,
        enablePublicLeaderboard: true,
      });
      const created = result.data?.teams?.created ?? 0;
      const skipped = result.data?.teams?.skipped ?? 0;
      const rosterRepair = result.data?.teams?.rosterRepair;
      let successMsg = `Demo teams ready · created ${created}, already had ${skipped}.`;
      if (rosterRepair?.repaired) {
        successMsg += ` Repaired ${rosterRepair.repaired} rosters.`;
      } else if (rosterRepair?.stillIncomplete) {
        successMsg += ` ${rosterRepair.stillIncomplete} rosters still need repair — tap Repair rosters below.`;
      }
      successMsg += ' Set UNIQUE passwords per team before sharing links (do not use one password for all).';
      setMsg(successMsg);
      setLastCredentials(null);
      setLastTeamCode('CC001');
      setLastTeamLoginPath(
        eventMeta?.slug ? `/campus-hunt/${eventMeta.slug}/team/CC001` : '',
      );
      await refresh();
      onChanged?.();
    } catch (err) {
      setMsg(err.message || 'Could not create demo teams');
    } finally {
      setBusy(false);
    }
  };

  const sortedTeams = useMemo(
    () => [...teams].sort((a, b) => (
      String(a.teamCode).localeCompare(String(b.teamCode), undefined, { numeric: true })
    )),
    [teams],
  );
  const teamsForSchedule = Math.min(teams.length, capacity);
  const leftoverTeams = Math.max(0, teams.length - capacity);
  const layoutTeams = sortedTeams.slice(0, capacity);
  const extraTeams = sortedTeams.slice(capacity);
  const demoReady = teamsForSchedule >= capacity;
  const localRostersReady = layoutTeams.filter((t) => (
    t.access?.leader?.loginEmail
    && Array.isArray(t.access?.scanners)
    && t.access.scanners.length >= scannersNeeded
    && t.access.scanners.slice(0, scannersNeeded).every((s) => s.loginEmail)
  )).length;
  const rostersIncomplete = readiness?.rostersIncomplete ?? Math.max(0, teamsForSchedule - localRostersReady);

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-[#0ECCEE]/30 bg-[#0ECCEE]/10 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold text-white">
              Demo teams ({capacity})
            </h3>
            <p className="mt-1 text-xs text-white/60">
              Creates CC001–CC{String(capacity).padStart(3, '0')} with placeholder names
              ({teamSize}/team · {startCount} start{startCount === 1 ? '' : 's'} · ~{teamsPerWait}/start).
              Each team gets its own login link — set a unique password per team before hunt day.
            </p>
            {demoReady ? (
              <p className="mt-2 text-sm text-emerald-200">
                {teamsForSchedule}/{capacity} teams ready for this layout
                {leftoverTeams > 0 ? ` · ${leftoverTeams} leftover beyond capacity` : ''}.
              </p>
            ) : (
              <p className="mt-2 text-sm text-amber-100/80">
                {teamsForSchedule}/{capacity} teams — create the rest for this layout.
              </p>
            )}
            {teams.length > 0 && rostersIncomplete > 0 && (
              <p className="mt-2 text-sm text-amber-100">
                {rostersIncomplete} team(s) missing player accounts — repair rosters before start.
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || demoReady}
              onClick={createDemoTeams}
              className="rounded-xl bg-[#0ECCEE] px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-40"
            >
              {busy ? 'Creating…' : demoReady ? `${capacity} teams ready` : `Create ${capacity} demo teams`}
            </button>
            {teams.length > 0 && rostersIncomplete > 0 && (
              <button
                type="button"
                disabled={busy}
                onClick={repairAllRosters}
                className="rounded-xl border border-amber-300/50 bg-amber-500/15 px-4 py-2.5 text-sm font-semibold text-amber-100 disabled:opacity-40"
              >
                {busy ? 'Repairing…' : `Repair rosters (${rostersIncomplete})`}
              </button>
            )}
          </div>
        </div>
        {eventMeta?.slug && demoReady && (
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href={absoluteUrl(`/campus-hunt/${eventMeta.slug}/team/CC001`)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex rounded-lg bg-black/30 px-3 py-2 text-xs font-semibold text-[#0ECCEE]"
            >
              Open CC001 login ↗
            </a>
            <button
              type="button"
              onClick={() => {
                const lines = layoutTeams
                  .map((t) => `${t.teamCode}\t${absoluteUrl(`/campus-hunt/${eventMeta.slug}/team/${t.teamCode}`)}`);
                copyText(`One link per team — use that team’s unique password\n\n${lines.join('\n')}`);
                setMsg(`Copied all ${lines.length} team URLs`);
              }}
              className="rounded-lg bg-[#0ECCEE]/20 px-3 py-2 text-xs font-semibold text-[#0ECCEE]"
            >
              Copy all {teamsForSchedule || capacity} URLs
            </button>
          </div>
        )}
      </section>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
        <p className="font-semibold text-white">
          Teams ({teamsForSchedule}/{capacity})
        </p>
        <p className="mt-1 text-xs text-white/55">
          Add real teams below, or use demo teams above for a dry run.
          Schedule assigns ~{teamsPerWait} team{teamsPerWait === 1 ? '' : 's'} per starting point
          ({startCount} start{startCount === 1 ? '' : 's'} · {teamSize} people/team).
          {leftoverTeams > 0
            ? ` ${leftoverTeams} extra team(s) from an older size are listed below capacity — schedule ignores them.`
            : ''}
        </p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-white/55">
          <li>
            Share each team&apos;s link:{' '}
            <span className="font-mono text-white/70">
              /campus-hunt/{eventMeta?.slug || 'EVENT'}/team/CC001
            </span>
          </li>
          <li>Players open that link → type password → tap their name</li>
          <li>Use “Set password for all teams” below so everyone has the same password</li>
        </ol>
        {activeStarts.length > 0 && (
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {activeStarts.map((point) => {
              const count = teams.filter(
                (team) => id(team.startingPointId) === id(point),
              ).length;
              const pointCap = Number(point.capacity) || teamsPerWait;
              return (
                <div key={id(point)} className="rounded-lg bg-black/25 px-3 py-2 text-xs">
                  <p className="font-semibold text-[#0ECCEE]">{point.code} · {point.name}</p>
                  <p className="text-white/50">{count}/{pointCap} assigned</p>
                </div>
              );
            })}
          </div>
        )}
        {!activeStarts.length && (
          <p className="mt-3 text-xs text-amber-200">
            No active starts yet — Save setup (starts & places) on Clues, then Schedule / Update Clue 1.
          </p>
        )}
        {eventMeta?.slug && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const lines = [
                  'Share ONE link per team. Players only type the password and tap their name.',
                  '',
                  ...layoutTeams
                    .map((t) => `${t.teamCode}\t${absoluteUrl(`/campus-hunt/${eventMeta.slug}/team/${t.teamCode}`)}`),
                ];
                copyText(lines.join('\n'));
                setMsg(`Copied ${layoutTeams.length} team login URLs`);
              }}
              className="rounded-lg bg-[#0ECCEE]/20 px-3 py-1.5 text-xs font-semibold text-[#0ECCEE]"
            >
              Copy all team URLs
            </button>
          </div>
        )}
        <div className="mt-4 rounded-lg border border-[#0ECCEE]/25 bg-[#0ECCEE]/10 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#0ECCEE]/80">
            Set password for all teams
          </p>
          <p className="mt-1 text-[11px] text-amber-100/75">
            Dry-run only. One shared password lets anyone open any /team/CC00x link.
            For hunt day use a different password per team.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              type="text"
              value={bulkTeamPassword}
              onChange={(e) => setBulkTeamPassword(e.target.value)}
              placeholder="e.g. HUNT2026"
              className="min-w-[12rem] flex-1 rounded-lg border border-white/20 bg-[#161718] px-3 py-2 font-mono text-sm"
            />
            <button
              type="button"
              disabled={busy || !teams.length}
              onClick={setPasswordForAllTeams}
              className="rounded-lg bg-[#0ECCEE] px-3 py-2 text-xs font-semibold text-black disabled:opacity-40"
            >
              Apply to all teams
            </button>
          </div>
        </div>
      </div>

      {showRouteTools && <section className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-semibold">1. Routes</h3>
            <p className="text-xs text-white/50">
              Routes spread teams across different paths. Create at least one before adding teams.
            </p>
          </div>
          <button
            type="button"
            disabled={busy || !routes.length}
            onClick={autoAssign}
            className="rounded-lg bg-[#0ECCEE]/20 px-3 py-2 text-xs text-[#0ECCEE] disabled:opacity-40"
          >
            Auto-assign teams
          </button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {routes.map((route) => {
            const used = teams.filter((team) => String(team.routeId) === String(route._id)).length;
            return (
              <div key={route._id} className="rounded-lg bg-black/25 p-3 text-sm">
                <p className="font-semibold">Route {route.routeKey}</p>
                <p className="text-xs text-white/55">{route.name}</p>
                <p className="mt-1 text-xs">{used}/{route.teamSlots} teams</p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => toggleRoute(route)}
                  className="mt-2 rounded bg-white/10 px-2 py-1 text-[11px]"
                >
                  {route.active ? 'Disable' : 'Enable'}
                </button>
              </div>
            );
          })}
          {!routes.length && <p className="text-sm text-amber-200">No routes yet. Create one below.</p>}
        </div>
        <form onSubmit={createRoute} className="grid gap-2 md:grid-cols-4">
          <input
            value={routeDraft.routeKey}
            onChange={(e) => setRouteDraft((draft) => ({ ...draft, routeKey: e.target.value }))}
            placeholder="Key (A)"
            className="rounded-lg border border-white/20 bg-[#161718] px-3 py-2"
            required
          />
          <input
            value={routeDraft.name}
            onChange={(e) => setRouteDraft((draft) => ({ ...draft, name: e.target.value }))}
            placeholder="Route name"
            className="rounded-lg border border-white/20 bg-[#161718] px-3 py-2"
            required
          />
          <input
            type="number"
            min="1"
            value={routeDraft.teamSlots}
            onChange={(e) => setRouteDraft((draft) => ({ ...draft, teamSlots: e.target.value }))}
            placeholder="Team capacity"
            className="rounded-lg border border-white/20 bg-[#161718] px-3 py-2"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-white/10 px-3 py-2 text-sm disabled:opacity-40"
          >
            Create route
          </button>
        </form>
      </section>}

      <form onSubmit={createOne} className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
        <div>
          <h3 className="font-semibold">1. Add team and login access</h3>
          <p className="mt-1 text-xs text-white/50">
            {teamSize} people/team (leader + {scannersNeeded} member{scannersNeeded === 1 ? '' : 's'}).
            One shared password for the whole team. Share each team&apos;s URL —
            players only type the password and tap their name.
          </p>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          <input
            value={teamCode}
            onChange={(e) => setTeamCode(e.target.value.toUpperCase())}
            placeholder="Team code (CC001)"
            className="rounded-lg border border-white/20 bg-[#161718] px-3 py-2"
            required
          />
          <input
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            placeholder="Team name"
            className="rounded-lg border border-white/20 bg-[#161718] px-3 py-2"
            required
          />
          <input
            value={leaderName}
            onChange={(e) => setLeaderName(e.target.value)}
            placeholder="Leader name"
            className="rounded-lg border border-white/20 bg-[#161718] px-3 py-2"
            required
          />
          <input
            value={leaderEmail}
            onChange={(e) => setLeaderEmail(e.target.value)}
            placeholder="Leader contact email"
            type="email"
            className="rounded-lg border border-white/20 bg-[#161718] px-3 py-2"
            required
          />
          <input
            type="password"
            value={leaderPassword}
            onChange={(e) => {
              setLeaderPassword(e.target.value);
              setScannerPassword(e.target.value);
            }}
            placeholder={`Shared team password (all ${teamSize} people)`}
            className="rounded-lg border border-[#0ECCEE]/40 bg-[#161718] px-3 py-2 font-mono md:col-span-2"
            required
          />
          {memberNames.map((name, idx) => (
            <input
              key={idx}
              value={name}
              onChange={(e) => {
                const next = [...memberNames];
                next[idx] = e.target.value;
                setMemberNames(next);
              }}
              placeholder={`Player ${idx + 1} name`}
              className="rounded-lg border border-white/20 bg-[#161718] px-3 py-2"
              required
            />
          ))}
          <select
            value={routeId}
            onChange={(e) => setRouteId(e.target.value)}
            className="rounded-lg border border-white/20 bg-[#161718] px-3 py-2 md:col-span-2"
          >
            {routes.map((r) => (
              <option key={r._id} value={r._id}>
                Route {r.routeKey} — {r.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-[#0ECCEE] px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
        >
          Create team + access
        </button>
      </form>

      <CredentialsCard
        credentials={lastCredentials}
        teamCode={lastTeamCode}
        teamLoginPath={lastTeamLoginPath}
      />

      {msg && <p className="text-sm text-[#0ECCEE]">{msg}</p>}

      <section className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold">2. Existing teams ({teamsForSchedule}/{capacity})</h3>
            <p className="mt-1 text-xs text-white/50">
              Open a team to copy its login link, reveal password, edit names, or delete.
              {leftoverTeams > 0
                ? ` First ${capacity} count for this layout; ${leftoverTeams} leftover below (delete if unused).`
                : ''}
            </p>
          </div>
          {teamsForSchedule >= capacity && (
            <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-200">
              All {capacity} ready
            </span>
          )}
        </div>
        {layoutTeams.map((t) => (
          <TeamDetailCard
            key={t._id}
            team={t}
            routes={routes}
            startingPoints={activeStarts.length ? activeStarts : startingPoints}
            clue1Variants={clue1Variants}
            checkpoints={checkpoints}
            teamSize={teamSize}
            onCopied={setMsg}
            onChanged={refresh}
          />
        ))}
        {extraTeams.length > 0 && (
          <div className="space-y-2 rounded-lg border border-amber-400/30 bg-amber-500/10 p-3">
            <p className="text-xs font-semibold text-amber-100">
              Leftover teams ({extraTeams.length}) — beyond current capacity of {capacity}
            </p>
            {extraTeams.map((t) => (
              <div key={t._id} className="opacity-70">
                <TeamDetailCard
                  team={t}
                  routes={routes}
                  startingPoints={activeStarts.length ? activeStarts : startingPoints}
                  clue1Variants={clue1Variants}
                  checkpoints={checkpoints}
                  teamSize={teamSize}
                  onCopied={setMsg}
                  onChanged={refresh}
                />
              </div>
            ))}
          </div>
        )}
        {!teams.length && (
          <p className="rounded-lg border border-dashed border-white/15 p-4 text-sm text-white/50">
            No teams yet. Use “Add team and login access” above, or create {capacity} demo teams.
          </p>
        )}
      </section>
    </div>
  );
}
