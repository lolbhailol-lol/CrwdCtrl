import React from 'react';
import { Instagram, Sun, Moon } from 'lucide-react';
import { useDarkMode } from '../context/DarkModeContext';
import { Link } from 'react-router-dom';

export default function Footer() {
  const { isDark } = useDarkMode();

  return (
    <footer className={`w-full max-w-7xl mx-auto ${isDark ? 'bg-[#0a0a0a]' : 'bg-gray-50'} py-8 md:py-12 transition-colors duration-300 mt-auto`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Mobile Layout */}
        <div className="md:hidden">
          {/* Brand Section - Mobile */}
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold text-blue-600 mb-4">CrwdCtrl</h2>

            <div className="mb-6">
              <p className={`${isDark ? 'text-gray-300' : 'text-gray-700'} font-medium mb-3 text-sm`}>Follow us on</p>
              <a
                href="https://www.instagram.com/crwdctrl.in?igsh=MTBpNm9ta2ptMmc2dA=="
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-2 ${isDark ? 'text-gray-300 hover:text-blue-400' : 'text-gray-700 hover:text-blue-600'} transition-colors`}
              >
                <Instagram className="w-4 h-4 text-pink-600" />
                <span className="text-sm">@crwdctrl.in</span>
              </a>
            </div>
          </div>

          {/* Footer Links - Mobile (Stacked) */}
          <div className="flex flex-col items-center gap-4 mb-6">
            <Link
              to="/terms-and-conditions"
              className={`${isDark ? 'text-white' : 'text-gray-900'} font-medium hover:text-blue-600 cursor-pointer transition-colors text-sm`}
            >
              Terms and Conditions
            </Link>
            <Link
              to="/privacy-policy"
              className={`${isDark ? 'text-white' : 'text-gray-900'} font-medium hover:text-blue-600 cursor-pointer transition-colors text-sm`}
            >
              Privacy Policy
            </Link>
            <Link
              to="/contact-us"
              className={`${isDark ? 'text-white' : 'text-gray-900'} font-medium hover:text-blue-600 cursor-pointer transition-colors text-sm`}
            >
              Contact Us
            </Link>
            <Link
              to="/about"
              className={`${isDark ? 'text-white' : 'text-gray-900'} font-medium hover:text-blue-600 cursor-pointer transition-colors text-sm`}
            >
              About Us
            </Link>
          </div>
        </div>

        {/* Desktop/Laptop Layout - Unchanged */}
        <div className="hidden md:flex flex-wrap items-start justify-between gap-8 mb-8">
          {/* Brand Section with Theme Toggle */}
          <div className="flex flex-col">
            <div className="flex items-center gap-4 mb-6">
              <h2 className="text-2xl font-bold text-blue-600">CrwdCtrl</h2>

            </div>

            <div>
              <p className={`${isDark ? 'text-gray-300' : 'text-gray-700'} font-medium mb-2`}>Follow us on</p>
              <a
                href="https://www.instagram.com/crwdctrl.in?igsh=MTBpNm9ta2ptMmc2dA=="
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-2 ${isDark ? 'text-gray-300 hover:text-blue-400' : 'text-gray-700 hover:text-blue-600'} transition-colors`}
              >
                <Instagram className="w-5 h-5 text-pink-600" />
                <span>@crwdctrl</span>
              </a>
            </div>
          </div>

          {/* Footer Links */}
          <div className="flex flex-wrap gap-8 md:gap-16">
            {/* Terms and Conditions */}
            <div>
              <Link
                to="/terms-and-conditions"
                className={`${isDark ? 'text-white' : 'text-gray-900'} font-medium hover:text-blue-600 cursor-pointer transition-colors`}
              >
                Terms and Conditions
              </Link>
            </div>

            {/* Privacy Policy */}
            <div>
              <Link
                to="/privacy-policy"
                className={`${isDark ? 'text-white' : 'text-gray-900'} font-medium hover:text-blue-600 cursor-pointer transition-colors`}
              >
                Privacy Policy
              </Link>
            </div>

            {/* Contact Us */}
            <div>
              <Link
                to="/contact-us"
                className={`${isDark ? 'text-white' : 'text-gray-900'} font-medium hover:text-blue-600 cursor-pointer transition-colors`}
              >
                Contact Us
              </Link>
            </div>

            {/* About Us */}
            <div>
              <Link
                to="/about"
                className={`${isDark ? 'text-white' : 'text-gray-900'} font-medium hover:text-blue-600 cursor-pointer transition-colors`}
              >
                About Us
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom Text */}
        <div className={`border-t ${isDark ? 'border-gray-700' : 'border-gray-200'} pt-4 md:pt-6`}>
          <p className={`text-xs md:text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'} leading-relaxed text-center md:text-left`}>
            By accessing this page, you confirm that you have read, understood, and agreed to CrwdCtrl's Terms of Service, Privacy Policy, Cookie Policy, and Content Guidelines. CrwdCtrl All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}