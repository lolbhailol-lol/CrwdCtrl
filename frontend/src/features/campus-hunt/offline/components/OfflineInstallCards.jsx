import { useState } from 'react';
import { CAMPUS_HUNT_PATHS } from '../../config';

function installUrl(token) {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://crwdctrl.in';
  return `${origin}${CAMPUS_HUNT_PATHS.offlineInstall(token)}`;
}

export function teamWhatsAppText(row) {
  const url = installUrl(row.token);
  return [
    `Hunt — ${row.teamCode}`,
    '',
    'This is a NEW Hunt icon. It is not the CrwdCtrl website.',
    'Add Hunt so the game still opens after you turn data off.',
    '',
    'TODAY on Wi-Fi — all 4 phones:',
    url,
    `Password: ${row.password || '(ask your leader)'}`,
    '',
    '1. Open the link',
    '2. Tap ⋮ → Open in Chrome (leave WhatsApp)',
    '3. Wait until it says Pack saved AND airplane-mode pages are on this phone',
    '4. Chrome menu → Install app / Add to Home screen',
    '5. The name must be Hunt. If it says CrwdCtrl, cancel and stay on this page',
    '',
    'HOW TO PLAY',
    '• Login → team page → Rounds → Round 1',
    '• Leader starts at the desk, then shows Team QR. Others scan it',
    '• Leader types answers. All 4 scan the color poster',
    '• Members show proof QR. Leader collects, types team code, shows Team QR again',
    '',
    'TEST OFFLINE NOW (data off)',
    'Turn off Wi-Fi + mobile data → tap the Hunt icon',
    'Password → your name → team page → Rounds → Round 1',
    'Leader: Start Round 1 → Show Team QR',
    'Others: Scan leader QR',
    'Camera still works with data off — try a poster scan, then a proof QR',
    'If Hunt does not open, you added CrwdCtrl by mistake. Delete that shortcut and add Hunt again on Wi-Fi.',
    '',
    'At the fest: airplane mode → Hunt icon only. No laptop.',
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
        WhatsApp one link per team — that is the “one APK” for the website
      </p>
      {installs.map((row) => (
        <div
          key={row.token}
          className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2"
        >
          <span className="font-mono text-xs font-bold text-[#0ECCEE]">{row.teamCode}</span>
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
