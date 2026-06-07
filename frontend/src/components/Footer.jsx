import { Instagram } from 'lucide-react';
import { useDarkMode } from '../context/DarkModeContext';
import { Link } from 'react-router-dom';

export default function Footer() {
  const { isDark } = useDarkMode();

  return (
    <footer
      className={`crwdctrl-footer mt-auto w-full border-t pb-[calc(72px+env(safe-area-inset-bottom))] pt-8 md:pb-10 lg:pb-10 ${
        isDark ? 'border-gray-800 bg-[#161718]' : 'border-gray-200 bg-white'
      }`}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex flex-col items-center gap-6 md:flex-row md:items-start md:justify-between">
          <div className="text-center md:text-left">
            <h2 className="text-xl font-bold text-blue-600">CrwdCtrl</h2>
            <p className={`mt-1 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Fests, clubs &amp; meetups near you
            </p>
            <a
              href="https://www.instagram.com/crwdctrl.in?igsh=MTBpNm9ta2ptMmc2dA=="
              target="_blank"
              rel="noopener noreferrer"
              className={`mt-4 inline-flex items-center gap-2 text-sm transition-colors ${
                isDark ? 'text-gray-300 hover:text-blue-400' : 'text-gray-700 hover:text-blue-600'
              }`}
            >
              <Instagram className="h-4 w-4 text-pink-600" />
              @crwdctrl.in
            </a>
          </div>

          <div className="flex flex-col items-center">
            <Link
              to="/contact-us"
              className={`text-sm font-medium transition-colors ${
                isDark ? 'text-white hover:text-blue-400' : 'text-gray-900 hover:text-blue-600'
              }`}
            >
              Contact Us
            </Link>
          </div>
        </div>

        <p
          className={`mt-6 border-t pt-4 text-center text-xs md:text-left ${
            isDark ? 'border-gray-800 text-gray-500' : 'border-gray-200 text-gray-500'
          }`}
        >
          © 2026 CrwdCtrl. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
