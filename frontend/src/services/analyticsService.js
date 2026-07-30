// Analytics tracking service for CrwdCtrl
// Uses navigator.sendBeacon for non-blocking tracking, falls back to fetch

import { resolveUrl } from './api/client.js';

// Generate/retrieve session ID
const getSessionId = () => {
  let sessionId = sessionStorage.getItem('crwdctrl_session_id');
  if (!sessionId) {
    sessionId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    sessionStorage.setItem('crwdctrl_session_id', sessionId);
  }
  return sessionId;
};

// Detect device type
const getDevice = () => {
  const ua = navigator.userAgent;
  if (/Mobi|Android|iPhone|iPad/i.test(ua)) return 'mobile';
  if (/Tablet|iPad/i.test(ua)) return 'tablet';
  return 'desktop';
};

// Core: send analytics event
const sendEvent = (eventType, metadata = {}) => {
  try {
    const payload = JSON.stringify({
      eventType,
      sessionId: getSessionId(),
      metadata: {
        ...metadata,
        device: getDevice(),
        referrer: document.referrer || null,
        userAgent: navigator.userAgent,
      },
    });

    const url = resolveUrl('/analytics/track');

    // Prefer sendBeacon (non-blocking, survives page unload)
    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' });
      const sent = navigator.sendBeacon(url, blob);
      if (sent) return;
    }

    // Fallback: fire-and-forget fetch
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
      credentials: 'include',
    }).catch(() => { /* silent fail */ });
  } catch (_) {
    // Analytics should never break the app
  }
};

// ===== Public API =====

// Mirror page views to Google Analytics 4 (gtag.js) when configured.
// gtag is loaded in index.html with send_page_view=false, so SPA route
// changes are reported here — including the initial load.
const sendGaPageView = (page) => {
  try {
    if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
      window.gtag('event', 'page_view', {
        page_path: page,
        page_location: window.location.href,
        page_title: document.title,
      });
    }
  } catch (_) {
    /* analytics should never break the app */
  }
};

export const trackPageView = (page) => {
  sendEvent('page_view', { page });
  sendGaPageView(page);
};

export const trackFestView = (festId) => {
  sendEvent('fest_view', { festId });
};

export const trackCompetitionView = (competitionId) => {
  sendEvent('competition_view', { competitionId });
};

export const trackRegistration = (festId, competitionId = null) => {
  sendEvent('registration', { festId, competitionId });
};

export const trackSearch = (query) => {
  sendEvent('search', { query });
};

export const trackLogin = () => {
  sendEvent('login', {});
};

export const trackSignup = () => {
  sendEvent('signup', {});
};

export const trackBookNowClick = ({
  entityType = '',
  entityId = '',
  mode = '',
  destination = '',
  page = '',
} = {}) => {
  sendEvent('book_now_click', {
    entityType,
    entityId,
    mode,
    destination,
    page: page || window.location.pathname || '',
  });
};
