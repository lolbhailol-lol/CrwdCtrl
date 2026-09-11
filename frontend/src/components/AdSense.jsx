import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const ADSENSE_CLIENT = 'ca-pub-9437984398379289';

const isLocalHost =
    typeof window !== 'undefined'
    && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

// Only load AdSense on pages with real, substantial publisher content.
// Pages NOT in this list will never have Google ads injected.
const CONTENT_PAGES = [
  '/',                    // Dashboard - fest listings
  '/cultural-fest',       // Cultural fest listings
  '/tech-fest',           // Tech fest listings
  '/sports-fest',         // Sports fest listings (cultural/tech/sports subsection)
  '/sports',              // Sports category hub (home banner)
  '/about',               // About Us page
  '/privacy-policy',      // Privacy Policy
  '/terms-and-conditions',// Terms and Conditions
  '/refunds-and-cancellations', // Refunds & Cancellations
  '/shipping-policy',     // Shipping Policy
  '/products-and-services', // Products & Services (INR pricing)
  '/contact-us',          // Contact Us
  '/help-center',         // Help Center
];

// Prefix patterns — any path starting with these has content
const CONTENT_PREFIXES = [
  '/view-details/',               // Fest detail pages
  '/competitions-view-details/',  // Competition detail pages
  '/competition-list/',           // Competition list pages
];

function isContentPage(pathname) {
  if (CONTENT_PAGES.includes(pathname)) return true;
  return CONTENT_PREFIXES.some(prefix => pathname.startsWith(prefix));
}

let scriptInjected = false;

/**
 * Conditionally loads the AdSense script only on content-rich pages.
 * On pages like login, register, admin, loading, or registration forms
 * no ad code is present — preventing the "ads on screens without
 * publisher-content" policy violation.
 */
export default function AdSenseLoader() {
  const { pathname } = useLocation();
  const shouldLoad = isContentPage(pathname);

  useEffect(() => {
    // AdSense iframes (doubleclick.net) run in Quirks Mode — skip on localhost/dev audits
    if (!shouldLoad || import.meta.env.DEV || isLocalHost) return;
    if (scriptInjected) return;

    // Dynamically inject the adsbygoogle script
    const script = document.createElement('script');
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;
    script.async = true;
    script.crossOrigin = 'anonymous';
    document.head.appendChild(script);
    scriptInjected = true;
  }, [shouldLoad]);

  return null; // This component renders nothing
}
