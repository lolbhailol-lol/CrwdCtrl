import React from 'react';
import { Link } from 'react-router-dom';
import { useInAppBack } from '../../hooks/useInAppBack';
import { ArrowLeft, Truck, Mail, Smartphone } from 'lucide-react';
import { useDarkMode } from '../../context/DarkModeContext';
import Seo from '../../components/Seo';
import { breadcrumbSchema, webPageSchema } from '../../utils/seo';
import {
  LEGAL_EMAIL,
  LEGAL_NAME,
  LEGAL_OPERATOR_LINE,
  LEGAL_PHONE_DISPLAY,
  LEGAL_PHONE_TEL,
  WEBSITE_URL,
} from '../../constants/legalEntity';

export default function ShippingPolicy() {
  const { isDark } = useDarkMode();
  const goBack = useInAppBack();
  const card = isDark ? 'bg-[#111111] border-gray-800' : 'bg-white border-gray-200';

  return (
    <div className="crwdctrl-page crwdctrl-page--content min-h-screen transition-colors duration-300">
      <Seo
        title="Shipping Policy"
        description="CrwdCtrl shipping and delivery policy. Tickets and confirmations are delivered digitally. No physical products are shipped."
        canonical="/shipping-policy"
        jsonLd={[
          webPageSchema({ name: 'CrwdCtrl Shipping Policy', url: '/shipping-policy' }),
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Shipping Policy', path: '/shipping-policy' },
          ]),
        ]}
      />
      <div className={`crwdctrl-sticky-header ${isDark ? 'bg-[#111111] border-gray-800' : 'bg-white border-gray-200'} border-b`}>
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-center relative">
            <button
              type="button"
              onClick={goBack}
              className={`lg:hidden absolute left-0 p-2 rounded-lg ${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-100'} transition-colors`}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="text-center">
              <h1 className="text-xl font-bold">Shipping Policy</h1>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Last updated: 20 August 2026
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <div className={`${card} border rounded-lg p-6`}>
          <p className={`${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            {LEGAL_OPERATOR_LINE} CrwdCtrl ({WEBSITE_URL}) is a digital event discovery and
            registration platform. We do not sell or ship physical goods.
          </p>
        </div>

        <div className={`${card} border rounded-lg p-6`}>
          <div className="flex items-center gap-3 mb-4">
            <Truck className="w-6 h-6 text-blue-500" />
            <h2 className="text-lg font-semibold">No physical shipping</h2>
          </div>
          <ul className={`space-y-3 text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            <li>
              CrwdCtrl does not dispatch parcels, merchandise, or any physical products.
            </li>
            <li>
              There are no shipping charges, courier partners, or delivery addresses required
              for purchases made on this website.
            </li>
          </ul>
        </div>

        <div className={`${card} border rounded-lg p-6`}>
          <div className="flex items-center gap-3 mb-4">
            <Smartphone className="w-6 h-6 text-green-500" />
            <h2 className="text-lg font-semibold">Digital delivery</h2>
          </div>
          <ul className={`space-y-3 text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            <li>
              After a successful payment, your registration, ticket, or booking confirmation is
              delivered electronically through the CrwdCtrl app or website and by email.
            </li>
            <li>
              Digital delivery is typically instant. In rare cases it may take up to a few minutes
              after payment confirmation.
            </li>
            <li>
              You can view tickets and booking details anytime from your CrwdCtrl account.
            </li>
          </ul>
        </div>

        <div className={`${isDark ? 'bg-blue-900/20 border-blue-800' : 'bg-blue-50 border-blue-200'} border rounded-lg p-6`}>
          <div className="flex items-center gap-3 mb-3">
            <Mail className="w-5 h-5 text-blue-500" />
            <h2 className="text-lg font-semibold">Questions about delivery</h2>
          </div>
          <p className={`text-sm ${isDark ? 'text-blue-300' : 'text-blue-800'}`}>
            Legal name: {LEGAL_NAME}
          </p>
          <p className={`text-sm mt-1 ${isDark ? 'text-blue-300' : 'text-blue-800'}`}>
            Email:{' '}
            <a href={`mailto:${LEGAL_EMAIL}`} className="underline font-medium">
              {LEGAL_EMAIL}
            </a>
          </p>
          <p className={`text-sm mt-1 ${isDark ? 'text-blue-300' : 'text-blue-800'}`}>
            Phone:{' '}
            <a href={`tel:${LEGAL_PHONE_TEL}`} className="underline font-medium">
              {LEGAL_PHONE_DISPLAY}
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
