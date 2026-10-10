import React from 'react';
import { Link } from 'react-router-dom';
import {
  Instagram,
  Linkedin,
  Mail,
} from 'lucide-react';
import { useDarkMode } from '../../context/DarkModeContext';
import AppLogo from '../AppLogo';

export default function FooterDesktop() {
  const { isDark } = useDarkMode();

  const navColumns = [
    {
      title: 'Discover',
      links: [
        { label: 'College Fests', path: '/fests' },
        { label: 'Sports & Fitness', path: '/sports' },
        { label: 'Treks & Adventure', path: '/treks' },
        { label: 'Events & Shows', path: '/events' },
      ],
    },
    {
      title: 'For Organizers',
      links: [
        { label: 'List Your Fest / Event', path: '/list-your-fest' },
        { label: 'Organizer Portal', path: '/organizer' },
      ],
    },
    {
      title: 'Company & Support',
      links: [
        { label: 'About CrwdCtrl', path: '/about' },
        { label: 'Help Center & FAQs', path: '/help-center' },
        { label: 'Notification Center', path: '/notifications' },
        { label: 'Contact Us', path: '/contact-us' },
      ],
    },
  ];

  const socialLinks = [
    {
      name: 'Instagram',
      href: 'https://www.instagram.com/crwdctrl.in?igsh=ODZpb2tpaGR4Y2Rn',
      icon: Instagram,
      hoverClass: 'hover:text-pink-500 hover:bg-pink-500/10',
    },
    {
      name: 'LinkedIn',
      href: 'https://linkedin.com/company/crwdctrl',
      icon: Linkedin,
      hoverClass: 'hover:text-blue-500 hover:bg-blue-500/10',
    },
    {
      name: 'Support Mail',
      href: 'mailto:support@crwdctrl.com',
      icon: Mail,
      hoverClass: 'hover:text-teal-400 hover:bg-teal-400/10',
    },
  ];

  return (
    <footer
      className={`relative mt-12 mb-6 mx-3 sm:mx-6 lg:ml-2 lg:mr-4 rounded-2xl lg:rounded-3xl border transition-all duration-300 overflow-hidden shadow-xl ${
        isDark
          ? 'bg-[#111213] border-gray-800/90 text-gray-200 shadow-black/60'
          : 'bg-white border-gray-200 text-gray-800 shadow-gray-200/70'
      }`}
    >
      {/* SECTION 1: MAIN NAVIGATION & BRAND GRID */}
      <div className="relative mx-auto max-w-7xl px-5 sm:px-8 pt-7 sm:pt-8 pb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 lg:gap-5 items-start">

          {/* Brand Info Column */}
          <div className="lg:col-span-2 flex flex-col space-y-2.5">
            <div className="flex items-center space-x-2 -mt-2.5">
              <AppLogo size={52} className="-mt-1" />
            </div>

            <p className={`text-xs leading-relaxed max-w-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
              Discover, register and attend college fests, sports tournaments, marathons, treks, and student communities near you across India.
            </p>

            {/* Social Icons Bar */}
            <div className="pt-1 flex items-center gap-2">
              {socialLinks.map((s) => {
                const IconComponent = s.icon;
                return (
                  <a
                    key={s.name}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={s.name}
                    className={`w-8 h-8 rounded-xl flex items-center justify-center border transition-all duration-200 ${
                      isDark
                        ? 'bg-white/5 border-white/10 text-gray-200 hover:border-[#0ECCEE] hover:text-[#0ECCEE] hover:bg-[#0ECCEE]/15'
                        : 'bg-gray-100/90 border-gray-200 text-gray-700 hover:border-[#007BFF] hover:text-[#007BFF] hover:bg-[#007BFF]/10 shadow-2xs'
                    } ${s.hoverClass}`}
                  >
                    <IconComponent className="w-4 h-4" />
                  </a>
                );
              })}
            </div>
          </div>

          {/* Navigation Link Columns */}
          {navColumns.map((col) => (
            <div key={col.title} className="flex flex-col space-y-2">
              <h3 className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-[#0ECCEE]' : 'text-[#007BFF]'}`}>
                {col.title}
              </h3>
              <ul className="space-y-1.5 text-xs">
                {col.links.map((link) => (
                  <li key={link.label}>
                    {link.isExternal ? (
                      <a
                        href={link.path}
                        className={`transition-all duration-200 inline-flex items-center gap-1 font-medium ${
                          isDark ? 'text-gray-300 hover:text-white hover:translate-x-0.5' : 'text-gray-600 hover:text-gray-950 hover:translate-x-0.5'
                        }`}
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        to={link.path}
                        className={`transition-all duration-200 inline-flex items-center gap-1 font-medium ${
                          isDark ? 'text-gray-300 hover:text-white hover:translate-x-0.5' : 'text-gray-600 hover:text-gray-950 hover:translate-x-0.5'
                        }`}
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}

        </div>
      </div>

      {/* SECTION 2: BOTTOM COPYRIGHT & LEGAL POLICIES BAR */}
      <div className={`relative border-t ${isDark ? 'border-gray-800/80 bg-[#09090b]' : 'border-gray-200/90 bg-slate-50'}`}>
        <div className="mx-auto max-w-7xl px-5 sm:px-8 py-3 flex flex-col md:flex-row items-center justify-between gap-2 text-xs">

          {/* Left: Copyright */}
          <div className={`flex items-center gap-2 text-center md:text-left font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            <span>© 2026 CrwdCtrl Technologies. All rights reserved.</span>
          </div>

          {/* Right: Policy Links */}
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 font-semibold">
            <Link
              to="/privacy-policy"
              className={`transition-colors ${isDark ? 'text-gray-300 hover:text-[#0ECCEE]' : 'text-gray-600 hover:text-[#007BFF]'}`}
            >
              Privacy Policy
            </Link>
            <Link
              to="/terms-and-conditions"
              className={`transition-colors ${isDark ? 'text-gray-300 hover:text-[#0ECCEE]' : 'text-gray-600 hover:text-[#007BFF]'}`}
            >
              Terms of Service
            </Link>
            <Link
              to="/contact-us"
              className={`transition-colors ${isDark ? 'text-gray-300 hover:text-[#0ECCEE]' : 'text-gray-600 hover:text-[#007BFF]'}`}
            >
              Contact Us
            </Link>
          </div>

        </div>
      </div>
    </footer>
  );
}
