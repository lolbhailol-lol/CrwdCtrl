import { useState } from 'react';
import { CAMPUS_HUNT_PATHS } from '../../config';

function installUrl(token) {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://crwdctrl.in';
  return `${origin}${CAMPUS_HUNT_PATHS.offlineInstall(token)}`;
}

export function teamWhatsAppText(row) {
  const url = installUrl(row.token);
  const size = Number(row.teamSize) || 4;
  return [
    `Hunt — ${row.teamCode}`,
    '',
    'One link for your team. Leader opens it (not the CrwdCtrl website).',
    'Add the Hunt icon so the game still opens with data off.',
    '',
    'TODAY on Wi‑Fi — leader phone:',
    url,
    `Password: ${row.password || '(ask organizer)'}`,
    '',
    '1. Open the link',
    '2. Tap ⋮ → Open in Chrome (leave WhatsApp)',
    '3. Wait until Pack saved',
    '4. Chrome → Install app / Add to Home screen → name must be Hunt',
    '',
    'HOW TO PLAY (all teammates walk together · one phone)',
    '• Login → Rounds → Round 1',
    '• Leader types clue answers',
    `• At each stop: find ${size} clues written nearby, join them into one word, type it, then scan the place QR once`,
    '• Enter your team code → next location',
    '',
    'TEST OFFLINE (data off)',
    'Turn off Wi‑Fi + mobile data → Hunt icon → password → Round 1',
    'If Hunt does not open, you added CrwdCtrl by mistake — delete that shortcut and add Hunt again on Wi‑Fi.',
    '',
    'At the fest: Hunt icon on the leader phone. No laptop.',
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
        WhatsApp — one link per team (leader phone)
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
