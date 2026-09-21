import { useState } from 'react';
import { CAMPUS_HUNT_PATHS } from '../../config';
import { PUBLIC_WEB_ORIGIN } from '../../../../utils/publicWebOrigin';

function installUrl(token) {
  const origin = typeof window !== 'undefined' ? window.location.origin : PUBLIC_WEB_ORIGIN;
  try {
    const u = new URL(origin);
    if (u.hostname === 'crwdctrl.in') u.hostname = 'www.crwdctrl.in';
    return `${u.origin}${CAMPUS_HUNT_PATHS.offlineInstall(token)}`;
  } catch {
    return `${PUBLIC_WEB_ORIGIN}${CAMPUS_HUNT_PATHS.offlineInstall(token)}`;
  }
}

export function teamWhatsAppText(row) {
  const url = installUrl(row.token);
  const size = Number(row.teamSize) || 10;
  return [
    `Hunt — ${row.teamCode} (leader pack)`,
    '',
    `FOR THE TEAM LEADER ONLY — 1 pack · 1 phone.`,
    `Your team walks together (~${size} people). Only you install & play.`,
    '',
    'INSTALL TODAY (Wi‑Fi / data ON):',
    url,
    `Password: ${row.password || '(ask organizer)'}`,
    '',
    '1. Open the link in Chrome (⋮ in WhatsApp → Open in Chrome)',
    '2. Wait until you see Pack saved',
    '3. Chrome → Install app / Add to Home screen → name it Hunt',
    '4. Turn OFF Wi‑Fi + mobile data → open Hunt icon → password → The Hunt',
    '   If it does not open, you installed CrwdCtrl by mistake — delete that shortcut and install Hunt again on Wi‑Fi.',
    '',
    'AT THE FEST (offline OK):',
    '• Only your phone — whole team walks with you',
    '• Login → The Hunt',
    '• Clue 1: type location → scan orange',
    '• Clue 2: plant slips → join word → type → scan green',
    '• Then blue / purple / red scans as the phone says',
    '• Finish at Mindspark Lobby with organizer code',
    '',
    'Do not forward this to every teammate. One pack for the leader phone only.',
    'Do not wait until start time to install. Pack must be on the phone first.',
  ].join('\n');
}

export default function OfflineInstallCards({ installs = [] }) {
  const [copied, setCopied] = useState('');

  if (!installs.length) return null;

  const copy = async (row) => {
    const text = teamWhatsAppText(row);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(row.teamCode);
    } catch {
      setCopied('');
    }
  };

  const share = async (row) => {
    const text = teamWhatsAppText(row);
    if (navigator.share) {
      try {
        await navigator.share({ title: `Hunt ${row.teamCode}`, text });
        return;
      } catch {
        /* fall through to copy */
      }
    }
    await copy(row);
  };

  return (
    <div className="mt-3 space-y-2 print:hidden">
      <p className="text-[11px] font-semibold text-white">
        WhatsApp — one pack per team · send to leader only
      </p>
      {installs.map((row) => (
        <div
          key={row.token}
          className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2"
        >
          <span className="font-mono text-xs font-bold text-[#0ECCEE]">{row.teamCode}</span>
          {row.installed ? (
            <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[9px] font-bold uppercase text-emerald-200">
              Installed
            </span>
          ) : null}
          <span className="min-w-0 flex-1 truncate text-[10px] text-white/45">
            {installUrl(row.token)}
          </span>
          <button
            type="button"
            onClick={() => copy(row)}
            className="rounded-lg bg-white/10 px-2 py-1 text-[10px] font-semibold text-white"
          >
            {copied === row.teamCode ? 'Copied' : 'Copy WhatsApp'}
          </button>
          <button
            type="button"
            onClick={() => share(row)}
            className="rounded-lg bg-[#0ECCEE] px-2 py-1 text-[10px] font-bold text-black"
          >
            Share
          </button>
        </div>
      ))}
    </div>
  );
}
