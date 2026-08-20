import { Instagram } from 'lucide-react';
import { useDarkMode } from '../../context/DarkModeContext';
import { Link } from 'react-router-dom';
import {
  LEGAL_EMAIL,
  LEGAL_NAME,
  LEGAL_OPERATOR_LINE,
  LEGAL_PHONE_DISPLAY,
  LEGAL_PHONE_TEL,
  LEGAL_POLICY_LINKS,
} from '../../constants/legalEntity';

export default function Footer() {
  const { isDark } = useDarkMode();
  const muted = isDark ? 'text-gray-400' : 'text-gray-600';
  const linkClass = isDark
    ? 'text-gray-300 hover:text-[#0ECCEE]'
    : 'text-gray-700 hover:text-[#0ECCEE]';

  return (
    <footer
      className={`crwdctrl-footer mt-auto w-full max-w-full overflow-x-clip border-t pt-8 pb-(--footer-nav-clearance) md:pb-10 lg:pb-10 ${
        isDark ? 'border-gray-800 bg-[#161718]' : 'border-gray-200 bg-white'
      }`}
    >
      <div className="crwdctrl-container max-w-7xl">
        <div className="flex flex-col items-center gap-6 md:flex-row md:items-start md:justify-between">
          <div className="text-center md:text-left">
            <h2 className="text-xl font-bold text-[#0ECCEE]">CrwdCtrl</h2>
            <p className={`mt-1 text-sm ${muted}`}>
              Fests, clubs &amp; meetups near you
            </p>
            <p className={`mt-3 text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              {LEGAL_OPERATOR_LINE}
            </p>
            <p className={`mt-1 text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Legal name: {LEGAL_NAME}
            </p>
            <p className={`mt-1 text-sm ${muted}`}>
              Email:{' '}
              <a href={`mailto:${LEGAL_EMAIL}`} className="underline">
                {LEGAL_EMAIL}
              </a>
            </p>
            <p className={`mt-1 text-sm ${muted}`}>
              Phone:{' '}
              <a href={`tel:${LEGAL_PHONE_TEL}`} className="underline">
                {LEGAL_PHONE_DISPLAY}
              </a>
            </p>
            <a
              href="https://www.instagram.com/crwdctrl.in?igsh=ODZpb2tpaGR4Y2Rn"
              target="_blank"
              rel="noopener noreferrer"
              className={`mt-4 inline-flex items-center gap-2 text-sm transition-colors ${linkClass}`}
            >
              <Instagram className="h-4 w-4 text-pink-600" />
              @crwdctrl.in
            </a>
          </div>

          <nav className="flex flex-col items-center gap-2 md:items-end" aria-label="Legal">
            {LEGAL_POLICY_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`text-sm font-medium transition-colors ${
                  isDark ? 'text-white hover:text-[#0ECCEE]' : 'text-gray-900 hover:text-[#0ECCEE]'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <p
          className={`mt-6 border-t pt-4 text-center text-xs md:text-left ${
            isDark ? 'border-gray-800 text-gray-500' : 'border-gray-200 text-gray-500'
          }`}
        >
          © 2026 CrwdCtrl. Owned and operated by {LEGAL_NAME}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
