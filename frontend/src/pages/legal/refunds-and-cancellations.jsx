import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, XCircle, Clock, Mail } from 'lucide-react';
import { useDarkMode } from '../../context/DarkModeContext';

export default function RefundsAndCancellations() {
  const { isDark } = useDarkMode();
  const navigate = useNavigate();

  const card = isDark ? 'bg-[#111111] border-gray-800' : 'bg-white border-gray-200';

  return (
    <div
      className="crwdctrl-page crwdctrl-page--content min-h-screen transition-colors duration-300"
    >
      <div className={`crwdctrl-sticky-header ${isDark ? 'bg-[#111111] border-gray-800' : 'bg-white border-gray-200'} border-b`}>
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-center relative">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className={`lg:hidden absolute left-0 p-2 rounded-lg ${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-100'} transition-colors`}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="text-center">
              <h1 className="text-xl font-bold">Refunds &amp; Cancellations</h1>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Last updated: 9 June 2026
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <div className={`${card} border rounded-lg p-6`}>
          <p className={`${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            CrwdCtrl (operated at{' '}
            <a href="https://www.crwdctrl.in" className="text-blue-500 underline">
              www.crwdctrl.in
            </a>
            ) is a discovery and registration platform for college fests, competitions, treks, live events,
            shows, and community events. Refund and cancellation terms depend on the type of registration
            and the event organizer&apos;s policy. All amounts on CrwdCtrl are displayed and charged in{' '}
            <strong>Indian Rupees (INR / ₹)</strong>.
          </p>
        </div>

        <div className={`${card} border rounded-lg p-6`}>
          <div className="flex items-center gap-3 mb-4">
            <RefreshCw className="w-6 h-6 text-blue-500" />
            <h2 className="text-lg font-semibold">General refund policy</h2>
          </div>
          <ul className={`space-y-3 text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            <li>
              Registration fees are collected on behalf of event organizers unless stated otherwise on the
              event page. CrwdCtrl adds a platform service fee (currently 3% of the ticket price, rounded
              up) shown in INR before you pay.
            </li>
            <li>
              If an event is <strong>cancelled by the organizer</strong>, eligible refunds are processed as
              per the organizer&apos;s policy. CrwdCtrl will assist in coordinating refunds to the original
              payment method where applicable.
            </li>
            <li>
              If you <strong>cancel your registration</strong>, refund eligibility is determined by the
              organizer&apos;s rules and the timing of cancellation. Many competitions and fests are
              non-refundable once registration closes.
            </li>
            <li>
              <strong>Free events</strong> do not involve payment; no refund applies.
            </li>
          </ul>
        </div>

        <div className={`${card} border rounded-lg p-6`}>
          <div className="flex items-center gap-3 mb-4">
            <XCircle className="w-6 h-6 text-red-500" />
            <h2 className="text-lg font-semibold">Non-refundable cases</h2>
          </div>
          <ul className={`list-disc pl-5 space-y-2 text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            <li>No-show or failure to attend the event without prior approved cancellation</li>
            <li>Disqualification due to rule violations stated by the organizer</li>
            <li>Registrations marked non-refundable on the event or competition detail page</li>
            <li>Change of mind after the organizer&apos;s stated refund deadline</li>
          </ul>
        </div>

        <div className={`${card} border rounded-lg p-6`}>
          <div className="flex items-center gap-3 mb-4">
            <Clock className="w-6 h-6 text-amber-500" />
            <h2 className="text-lg font-semibold">Refund processing time</h2>
          </div>
          <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            Approved refunds are initiated within <strong>7–10 business days</strong> to the original
            payment method (UPI, card, net banking, etc.) via our payment partner Cashfree. Bank or wallet
            settlement may take additional time depending on your provider.
          </p>
        </div>

        <div className={`${isDark ? 'bg-blue-900/20 border-blue-800' : 'bg-blue-50 border-blue-200'} border rounded-lg p-6`}>
          <div className="flex items-center gap-3 mb-3">
            <Mail className="w-5 h-5 text-blue-500" />
            <h2 className="text-lg font-semibold">Request a refund or cancellation</h2>
          </div>
          <p className={`text-sm mb-4 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            Email us with your registered name, event name, order ID, and payment reference. We will
            coordinate with the organizer and respond within 2–3 business days.
          </p>
          <p className={`text-sm ${isDark ? 'text-blue-300' : 'text-blue-800'}`}>
            Email:{' '}
            <a href="mailto:Karan@crwdctrl.in" className="underline font-medium">
              Karan@crwdctrl.in
            </a>
          </p>
          <p className={`text-sm mt-2 ${isDark ? 'text-blue-300' : 'text-blue-800'}`}>
            Or visit our{' '}
            <Link to="/contact-us" className="underline font-medium">
              Contact Us
            </Link>{' '}
            page.
          </p>
        </div>
      </div>
    </div>
  );
}
