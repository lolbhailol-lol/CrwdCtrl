import { useEffect, useState } from 'react';
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
  adminListStartingPoints,
  adminListChallenges,
  adminListCheckpoints,
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
  onCopied,
  onChanged,
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showCredentials, setShowCredentials] = useState(false);
  const [revealedAccess, setRevealedAccess] = useState(null);
  const [editForm, setEditForm] = useState({
    teamName: team.teamName || '',
    leaderName: team.leaderName || '',
    leaderEmail: team.leaderContactEmail || team.access?.leader?.contactEmail || '',
    memberNames: [
      team.memberNames?.[0] || '',
      team.memberNames?.[1] || '',
      team.memberNames?.[2] || '',
    ],
    routeId: id(team.routeId),
    startingPointId: id(team.startingPointId),
    scheduledStartAt: toLocalDateTime(team.scheduledStartAt),
    clue1ChallengeId: id(team.clue1ChallengeId),
    firstCheckpointId: id(team.firstCheckpointId),
    leaderPassword: '',
    scannerPassword: '',
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
      memberNames: [
        team.memberNames?.[0] || '',
        team.memberNames?.[1] || '',
        team.memberNames?.[2] || '',
      ],
      routeId: id(team.routeId),
      startingPointId: id(team.startingPointId),
      scheduledStartAt: toLocalDateTime(team.scheduledStartAt),
      clue1ChallengeId: id(team.clue1ChallengeId),
      firstCheckpointId: id(team.firstCheckpointId),
      leaderPassword: '',
      scannerPassword: '',
      reason: '',
    });
    setEditing(true);
    setOpen(true);
  };

  const saveEdit = async () => {
    setBusy(true);
    try {
      const namesOnly = editForm.memberNames.map((n) => n.trim()).filter(Boolean);
      if (!editForm.teamName.trim() || !editForm.leaderName.trim() || namesOnly.length !== 3) {
        onCopied?.('Team name, leader name, and 3 member names are required');
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
        leaderPassword: editForm.leaderPassword.trim() || undefined,
        scannerPassword: editForm.scannerPassword.trim() || undefined,
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
    const lines = [
      `Team ${team.teamCode} — ${team.teamName}`,
      `Team login URL: ${teamUrl}`,
      '',
      `All members: ${names.join(', ')}`,
      '',
      'LEADER (full access)',
      `Name: ${access.leader?.name || team.leaderName || ''}`,
      `Login: ${access.leader?.loginEmail || ''}`,
      access.leader?.password
        ? `Password: ${access.leader.password}`
        : 'Password: existing CrwdCtrl password',
      `Leader URL: ${absoluteUrl(access.leader?.loginPath || team.teamLoginPath)}`,
      '',
      'SCANNERS (same password)',
      `Shared password: ${access.sharedScannerPassword || ''}`,
      ...(access.scanners || []).map(
        (s, i) =>
          `${i + 1}. ${s.name}\n   Login: ${s.loginEmail}\n   Password: ${s.password || access.sharedScannerPassword || ''}\n   URL: ${absoluteUrl(s.loginPath)}`,
      ),
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
    const scanners = (access.scanners || []).map((scanner) => (
      `<li><strong>${scanner.name}</strong><br>${scanner.loginEmail}<br>Password: ${
        scanner.password || access.sharedScannerPassword || ''
      }</li>`
    )).join('');
    popup.document.write(`<!doctype html><html><head><title>${team.teamCode} access</title>
      <style>body{font:16px system-ui;padding:32px;line-height:1.5}code{word-break:break-all}li{margin:12px 0}</style>
      </head><body><h1>${team.teamCode} — ${team.teamName}</h1>
      <p><strong>Team URL:</strong><br><code>${teamUrl}</code></p>
      <h2>Leader — full hunt</h2><p>${access.leader?.name || ''}<br>${access.leader?.loginEmail || ''}
      <br>Password: ${access.leader?.password || ''}</p>
      <h2>Scanners — checkpoint access</h2><ol>${scanners}</ol>
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
                value={editForm.leaderPassword}
                onChange={(e) => setEditForm((f) => ({
                  ...f,
                  leaderPassword: e.target.value,
                }))}
                placeholder="New leader password (optional)"
                className="w-full rounded-lg border border-cyan-400/30 bg-[#161718] px-3 py-2 font-mono text-sm"
              />
              <input
                type="password"
                value={editForm.scannerPassword}
                onChange={(e) => setEditForm((f) => ({
                  ...f,
                  scannerPassword: e.target.value.toUpperCase(),
                }))}
                placeholder="New shared scanner password (optional)"
                className="w-full rounded-lg border border-white/20 bg-[#161718] px-3 py-2 font-mono text-sm"
              />
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

          <div className="rounded-lg bg-black/30 px-3 py-2">
            <p className="text-xs uppercase tracking-wide text-white/45">Team login URL</p>
            <p className="break-all font-mono text-xs text-[#0ECCEE]">{teamUrl}</p>
            <div className="mt-2 flex flex-wrap gap-2">
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
                Copy full access pack
              </button>
              <button
                type="button"
                onClick={printTeamSlip}
                className="rounded-lg bg-white/10 px-3 py-1.5 text-xs"
              >
                Print team slip
              </button>
              <button
                type="button"
                onClick={toggleCredentials}
                className="rounded-lg bg-white/10 px-3 py-1.5 text-xs"
              >
                {showCredentials ? 'Hide passwords' : 'Reveal passwords'}
              </button>
            </div>
          </div>

          <div className="rounded-lg bg-black/30 px-3 py-2">
            <p className="text-xs uppercase tracking-wide text-white/45">Leader — full hunt</p>
            <p className="font-medium">{access.leader?.name || team.leaderName || '—'}</p>
            <p className="font-mono text-xs text-white/70">{access.leader?.loginEmail || '—'}</p>
            <p className="text-xs text-white/60">
              Password:{' '}
              {showCredentials ? (access.leader?.password || 'not set') : '••••••••'}
            </p>
            <p className="mt-1 break-all font-mono text-[11px] text-[#0ECCEE]">
              {absoluteUrl(access.leader?.loginPath)}
            </p>
          </div>

          <div className="rounded-lg bg-black/30 px-3 py-2">
            <p className="text-xs uppercase tracking-wide text-white/45">
              Scanners — shared password
            </p>
            <p className="mb-2 font-mono text-sm text-[#0ECCEE]">
              {showCredentials ? (access.sharedScannerPassword || '—') : '••••••••'}
            </p>
            <ul className="space-y-3">
              {(access.scanners || []).map((s) => (
                <li key={s.loginEmail || s.name}>
                  <p className="font-medium">{s.name}</p>
                  <p className="font-mono text-xs text-white/70">{s.loginEmail}</p>
                  <p className="text-xs text-white/55">
                    Password: {showCredentials ? (s.password || access.sharedScannerPassword || '—') : '••••••••'}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        copyText(absoluteUrl(s.loginPath));
                        onCopied?.(`Copied ${s.name} URL`);
                      }}
                      className="rounded bg-white/10 px-2 py-1 text-[11px]"
                    >
                      Copy login URL
                    </button>
                    <a
                      href={absoluteUrl(s.loginPath)}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded bg-white/10 px-2 py-1 text-[11px] text-[#0ECCEE]"
                    >
                      Open
                    </a>
                  </div>
                </li>
              ))}
              {!access.scanners?.length && (
                <p className="text-xs text-white/45">
                  No stored scanner logins (create team with names to generate access pack).
                </p>
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
  const { leader, scanners, sharedScannerPassword, allMemberNames } = credentials;
  const teamUrl = absoluteUrl(teamLoginPath);

  const copyAll = () => {
    const lines = [
      `Team ${teamCode}`,
      teamUrl ? `Team login URL: ${teamUrl}` : '',
      '',
      `All members: ${(allMemberNames || [leader.name, ...scanners.map((s) => s.name)]).join(', ')}`,
      '',
      'LEADER (full access)',
      `Name: ${leader.name}`,
      `Login: ${leader.loginEmail}`,
      leader.password
        ? `Password: ${leader.password}`
        : 'Password: (their existing CrwdCtrl password)',
      '',
      'SCANNERS (same password)',
      `Shared password: ${sharedScannerPassword}`,
      ...scanners.map(
        (s, i) => `${i + 1}. ${s.name}\n   Login: ${s.loginEmail}\n   Password: ${s.password}`,
      ),
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
          <p className="text-xs uppercase tracking-wide text-white/50">Team login URL</p>
          <p className="break-all font-mono text-xs text-[#0ECCEE]">{teamUrl}</p>
        </div>
      )}

      <div className="rounded-lg bg-black/20 px-3 py-2">
        <p className="text-xs uppercase tracking-wide text-white/50">All 4 names</p>
        <p className="text-sm text-white/90">
          {(allMemberNames || [leader.name, ...scanners.map((s) => s.name)]).join(' · ')}
        </p>
      </div>

      <div className="rounded-lg bg-black/30 px-3 py-2">
        <p className="text-xs uppercase tracking-wide text-white/50">Leader — full hunt</p>
        <p className="font-medium">{leader.name}</p>
        <p className="font-mono text-xs text-[#0ECCEE]">{leader.loginEmail}</p>
        <p className="text-xs text-white/70">
          {leader.password
            ? `Password: ${leader.password}`
            : 'Password: existing CrwdCtrl account password'}
        </p>
      </div>

      <div className="rounded-lg bg-black/30 px-3 py-2">
        <p className="text-xs uppercase tracking-wide text-white/50">3 scanners — same password</p>
        <p className="mb-2 font-mono text-sm text-[#0ECCEE]">Password: {sharedScannerPassword}</p>
        <ul className="space-y-2">
          {scanners.map((s) => (
            <li key={s.loginEmail}>
              <p className="font-medium">{s.name}</p>
              <p className="font-mono text-xs text-white/70">{s.loginEmail}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function TeamManagerPanel({
  eventId,
  roundId,
  onChanged,
  showRouteTools = false,
}) {
  const [teams, setTeams] = useState([]);
  const [eventMeta, setEventMeta] = useState(null);
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
  const [routeDraft, setRouteDraft] = useState({ routeKey: '', name: '', teamSlots: 10 });

  const refresh = async () => {
    const [t, r, pointResult, challengeResult, checkpointResult] = await Promise.all([
      adminListTeams(eventId),
      adminListRoutes(eventId),
      adminListStartingPoints(eventId).catch(() => ({ data: { startingPoints: [] } })),
      adminListChallenges(eventId).catch(() => ({ data: { challenges: [] } })),
      adminListCheckpoints(eventId).catch(() => ({ data: { checkpoints: [] } })),
    ]);
    setTeams(t.data?.teams || []);
    setEventMeta(t.data?.event || null);
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
    refresh().catch((err) => setMsg(err.message));
  }, [eventId]);

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
      if (!leaderPassword.trim()) {
        setMsg('Create a password for the leader');
        return;
      }
      if (!scannerPassword.trim()) {
        setMsg('Create the shared password for the 3 scanners');
        return;
      }
      const names = memberNames.map((n) => n.trim()).filter(Boolean);
      if (names.length !== 3) {
        setMsg('Enter all 3 member names (scanners)');
        return;
      }
      const res = await adminCreateTeam(eventId, {
        teamCode,
        teamName,
        leaderEmail: leaderEmail.trim(),
        leaderName: leaderName.trim(),
        leaderPassword: leaderPassword.trim(),
        memberNames: names,
        scannerPassword: scannerPassword.trim(),
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
      setMemberNames(['', '', '']);
      setScannerPassword('');
      await refresh();
      onChanged?.();
    } catch (err) {
      setMsg(err.message || 'Create failed');
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

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
        <p className="font-semibold text-white">Team access</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-white/55">
          <li>Each team gets its own login URL (share with that team only)</li>
          <li>Leader has a separate password and full hunt access</li>
          <li>The other 3 members use scanner accounts with one shared password</li>
          <li>Open a team below for passwords, emails, and per-person login links</li>
        </ol>
        {eventMeta?.slug && (
          <p className="mt-2 font-mono text-[11px] text-white/40">
            Pattern: /campus-hunt/{eventMeta.slug}/team/TEAMCODE
          </p>
        )}
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
            Add the four players. The leader plays the hunt; the other three receive scanner logins.
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
            placeholder="Leader email (full access)"
            type="email"
            className="rounded-lg border border-white/20 bg-[#161718] px-3 py-2"
            required
          />
          <input
            type="password"
            value={leaderPassword}
            onChange={(e) => setLeaderPassword(e.target.value)}
            placeholder="Leader password (full access)"
            className="rounded-lg border border-cyan-400/30 bg-[#161718] px-3 py-2 font-mono"
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
              placeholder={`Member ${idx + 1} name (scanner)`}
              className="rounded-lg border border-white/20 bg-[#161718] px-3 py-2"
              required
            />
          ))}
          <input
            type="password"
            value={scannerPassword}
            onChange={(e) => setScannerPassword(e.target.value.toUpperCase())}
            placeholder="Shared password for all 3 scanners"
            className="rounded-lg border border-white/20 bg-[#161718] px-3 py-2 font-mono"
            required
          />
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
          Create team + access URLs
        </button>
      </form>

      <CredentialsCard
        credentials={lastCredentials}
        teamCode={lastTeamCode}
        teamLoginPath={lastTeamLoginPath}
      />

      {msg && <p className="text-sm text-[#0ECCEE]">{msg}</p>}

      <section className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
        <div>
          <h3 className="font-semibold">2. Existing teams ({teams.length})</h3>
          <p className="mt-1 text-xs text-white/50">
            Open a team to share login access, reveal credentials, edit details, or delete it.
          </p>
        </div>
        {teams.map((t) => (
          <TeamDetailCard
            key={t._id}
            team={t}
            routes={routes}
            startingPoints={startingPoints}
            clue1Variants={clue1Variants}
            checkpoints={checkpoints}
            onCopied={setMsg}
            onChanged={refresh}
          />
        ))}
        {!teams.length && (
          <p className="rounded-lg border border-dashed border-white/15 p-4 text-sm text-white/50">
            No teams yet. Use “Add team and login access” above to create the first team.
          </p>
        )}
      </section>
    </div>
  );
}
