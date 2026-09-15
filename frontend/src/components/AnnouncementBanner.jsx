import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { useDarkMode } from '../context/DarkModeContext';

const DISMISS_KEY = 'crwdctrl_announcement_dismissed';

function isSafeHref(href) {
  if (!href || typeof href !== 'string') return false;
  if (href.startsWith('/') && !href.startsWith('//')) return true;
  try {
    const url = new URL(href);
    if (url.protocol !== 'https:') return false;
    const host = url.hostname.replace(/^www\./i, '').toLowerCase();
    return host === 'crwdctrl.in';
  } catch {
    return false;
  }
}

export default function AnnouncementBanner({ announcement }) {
  const { isDark } = useDarkMode();
  const enabled = announcement?.enabled === true && Boolean(announcement?.text);
  const dismissKey = enabled ? `${announcement.text}|${announcement.href || ''}` : '';
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!dismissKey) {
      setDismissed(false);
      return;
    }
    try {
      setDismissed(sessionStorage.getItem(DISMISS_KEY) === dismissKey);
    } catch {
      setDismissed(false);
    }
  }, [dismissKey]);

  const href = useMemo(() => {
    const raw = announcement?.href || '';
    return isSafeHref(raw) ? raw : '';
  }, [announcement?.href]);

  if (!enabled || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, dismissKey);
    } catch {
      /* ignore */
    }
  };

  const textClass = `text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`;
  const body = href ? (
    href.startsWith('/') ? (
      <Link to={href} className={`${textClass} underline-offset-2 hover:underline`}>
        {announcement.text}
      </Link>
    ) : (
      <a href={href} className={`${textClass} underline-offset-2 hover:underline`}>
        {announcement.text}
      </a>
    )
  ) : (
    <p className={textClass}>{announcement.text}</p>
  );

  return (
    <div
      className={`mx-(--page-gutter) mt-3 mb-1 rounded-2xl px-4 py-3 flex items-start gap-3 ${
        isDark ? 'bg-[#0ECCEE]/15 border border-[#0ECCEE]/30' : 'bg-[#E6FBFF] border border-[#0ECCEE]/25'
      }`}
      role="status"
    >
      <div className="flex-1 min-w-0">{body}</div>
      {announcement.dismissible !== false && (
        <button
          type="button"
          onClick={dismiss}
          className={`shrink-0 p-1 rounded-lg ${isDark ? 'text-gray-400 hover:bg-white/10' : 'text-gray-500 hover:bg-black/5'}`}
          aria-label="Dismiss announcement"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
