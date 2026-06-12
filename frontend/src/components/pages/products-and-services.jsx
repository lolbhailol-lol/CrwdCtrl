import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, IndianRupee, Calendar, Trophy, Mountain, Theater, Users } from 'lucide-react';
import { useDarkMode } from '../../context/DarkModeContext';

const SERVICES = [
  {
    icon: Calendar,
    title: 'Fest discovery & listings',
    description: 'Browse cultural, technical, and sports college fests across India.',
    pricing: 'Free for users',
  },
  {
    icon: Trophy,
    title: 'Competition registration',
    description: 'Register for individual competitions within fests (singing, dance, sports, etc.).',
    pricing: 'Organizer-defined fee in ₹ (INR); shown before checkout',
  },
  {
    icon: Calendar,
    title: 'Fest registration',
    description: 'Sign up for fest passes or multi-event packages listed by organizers.',
    pricing: 'Organizer-defined fee in ₹ (INR); shown before checkout',
  },
  {
    icon: Mountain,
    title: 'Trek & outdoor bookings',
    description: 'Book guided treks and outdoor experiences listed on CrwdCtrl.',
    pricing: 'Per-person fee in ₹ (INR); total shown before payment',
  },
  {
    icon: Theater,
    title: 'Theatre & show tickets',
    description: 'Book seats for theatre performances and campus shows.',
    pricing: 'Ticket price in ₹ (INR) per show',
  },
  {
    icon: Users,
    title: 'Community & club events',
    description: 'Discover and join running clubs, meetups, and student communities.',
    pricing: 'Free or paid in ₹ (INR) as listed by the host',
  },
];

const PRICING_EXAMPLES = [
  { item: 'Free competition / event', ticket: '₹0', platformFee: '₹0', total: '₹0' },
  { item: 'Competition registration (example)', ticket: '₹500', platformFee: '₹15', total: '₹515' },
  { item: 'Fest pass (example)', ticket: '₹1,000', platformFee: '₹30', total: '₹1,030' },
  { item: 'Trek booking — 2 people (example)', ticket: '₹2,400', platformFee: '₹72', total: '₹2,472' },
];

export default function ProductsAndServices() {
  const { isDark } = useDarkMode();
  const navigate = useNavigate();

  const card = isDark ? 'bg-[#111111] border-gray-800' : 'bg-white border-gray-200';

  return (
    <div
      className={`min-h-screen ${isDark ? 'bg-[#161718] text-white' : 'bg-[#EDEDF2] text-gray-900'} transition-colors duration-300`}
    >
      <div className={`${isDark ? 'bg-[#111111] border-gray-800' : 'bg-white border-gray-200'} border-b sticky top-0 z-10`}>
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
              <h1 className="text-xl font-bold">Products &amp; Services</h1>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                All prices in Indian Rupees (INR / ₹)
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <div className={`${card} border rounded-lg p-6`}>
          <div className="flex items-center gap-3 mb-3">
            <IndianRupee className="w-6 h-6 text-green-600" />
            <h2 className="text-lg font-semibold">Currency</h2>
          </div>
          <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            CrwdCtrl operates in India. Every price, fee, and payment on our website and mobile app is
            displayed and processed in <strong>Indian Rupees (INR / ₹)</strong> only. The exact amount
            for your registration is always shown on the checkout screen before you pay.
          </p>
        </div>

        <div className={`${card} border rounded-lg p-6`}>
          <h2 className="text-lg font-semibold mb-4">Services we offer</h2>
          <div className="space-y-4">
            {SERVICES.map(({ icon, title, description, pricing }) => {
              const Icon = icon;
              return (
              <div
                key={title}
                className={`rounded-lg p-4 ${isDark ? 'bg-gray-800/50' : 'bg-gray-50'}`}
              >
                <div className="flex gap-3">
                  <Icon className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-medium text-sm">{title}</h3>
                    <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      {description}
                    </p>
                    <p className={`text-xs mt-2 font-medium ${isDark ? 'text-green-400' : 'text-green-700'}`}>
                      Pricing: {pricing}
                    </p>
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        </div>

        <div className={`${card} border rounded-lg p-6 overflow-x-auto`}>
          <h2 className="text-lg font-semibold mb-2">Sample pricing (INR)</h2>
          <p className={`text-xs mb-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Actual event fees are set by organizers. Platform fee is 3% of the ticket price (rounded up).
            Live events show the exact breakdown before payment.
          </p>
          <table className="w-full text-sm text-left min-w-[320px]">
            <thead>
              <tr className={isDark ? 'text-gray-400 border-b border-gray-700' : 'text-gray-600 border-b border-gray-200'}>
                <th className="py-2 pr-4 font-medium">Service</th>
                <th className="py-2 pr-4 font-medium">Ticket (₹)</th>
                <th className="py-2 pr-4 font-medium">Platform fee (₹)</th>
                <th className="py-2 font-medium">Total (₹)</th>
              </tr>
            </thead>
            <tbody className={isDark ? 'text-gray-300' : 'text-gray-800'}>
              {PRICING_EXAMPLES.map((row) => (
                <tr key={row.item} className={isDark ? 'border-b border-gray-800' : 'border-b border-gray-100'}>
                  <td className="py-3 pr-4">{row.item}</td>
                  <td className="py-3 pr-4">{row.ticket}</td>
                  <td className="py-3 pr-4">{row.platformFee}</td>
                  <td className="py-3 font-semibold">{row.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={`${isDark ? 'bg-blue-900/20 border-blue-800' : 'bg-blue-50 border-blue-200'} border rounded-lg p-6`}>
          <h3 className="font-semibold mb-3">Browse live events &amp; prices</h3>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/fests"
              className={`px-4 py-2 rounded-lg text-sm font-medium ${isDark ? 'bg-blue-900/40 text-blue-200 hover:bg-blue-800/50' : 'bg-blue-100 text-blue-800 hover:bg-blue-200'}`}
            >
              View Fests
            </Link>
            <Link
              to="/treks"
              className={`px-4 py-2 rounded-lg text-sm font-medium ${isDark ? 'bg-blue-900/40 text-blue-200 hover:bg-blue-800/50' : 'bg-blue-100 text-blue-800 hover:bg-blue-200'}`}
            >
              View Treks
            </Link>
            <Link
              to="/contact-us"
              className={`px-4 py-2 rounded-lg text-sm font-medium ${isDark ? 'bg-blue-900/40 text-blue-200 hover:bg-blue-800/50' : 'bg-blue-100 text-blue-800 hover:bg-blue-200'}`}
            >
              Contact Us
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
