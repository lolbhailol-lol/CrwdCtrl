import { Instagram } from 'lucide-react';
import { useDarkMode } from '../context/DarkModeContext';
import { Link } from 'react-router-dom';

export default function Footer() {
  const { isDark } = useDarkMode();

  return (
    <footer
      className={`crwdctrl-footer mt-auto w-full max-w-full overflow-x-clip border-t pt-8 pb-[var(--footer-nav-clearance)] md:pb-10 lg:pb-10 ${
        isDark ? 'border-gray-800 bg-[#161718]' : 'border-gray-200 bg-white'
      }`}
    >
      <div className="crwdctrl-container max-w-7xl">
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

          <nav className="flex flex-col items-center gap-2 md:items-end" aria-label="Legal and support">
            {[
              { to: '/contact-us', label: 'Contact Us' },
              { to: '/terms-and-conditions', label: 'Terms & Conditions' },
              { to: '/refunds-and-cancellations', label: 'Refunds & Cancellations' },
              { to: '/products-and-services', label: 'Products & Services' },
              { to: '/privacy-policy', label: 'Privacy Policy' },
            ].map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className={`text-sm font-medium transition-colors ${
                  isDark ? 'text-white hover:text-blue-400' : 'text-gray-900 hover:text-blue-600'
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>
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
