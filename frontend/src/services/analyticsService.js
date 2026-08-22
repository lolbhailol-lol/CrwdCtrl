// Analytics tracking service for CrwdCtrl
// Uses fetch keepalive (with auth when logged in) or sendBeacon for anonymous hits.

import { resolveUrl } from './api/client.js';
import { resolveAuthToken, getBearerAuthHeaders } from '../utils/authToken.js';

// Generate/retrieve session ID
const getSessionId = () => {
  let sessionId = sessionStorage.getItem('crwdctrl_session_id');
  if (!sessionId) {
    sessionId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    sessionStorage.setItem('crwdctrl_session_id', sessionId);
  }
  return sessionId;
};

export { getSessionId };

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
    const token = resolveAuthToken();
    const headers = token
      ? getBearerAuthHeaders(token)
      : { 'Content-Type': 'application/json' };

    // Prefer authenticated fetch so logged-in users tie to email in admin activity.
    if (token || !navigator.sendBeacon) {
      fetch(url, {
        method: 'POST',
        headers,
        body: payload,
        keepalive: true,
        credentials: 'include',
      }).catch(() => { /* silent fail */ });
      return;
    }

    const blob = new Blob([payload], { type: 'application/json' });
    navigator.sendBeacon(url, blob);
  } catch (_) {
    // Analytics should never break the app
  }
};

// Mirror page views to Google Analytics 4 (gtag.js) when configured.
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

export const trackPageView = (page, { previousPage } = {}) => {
  sendEvent('page_view', {
    page,
    previousPage: previousPage || null,
    durationSeconds: 0,
  });
  sendGaPageView(page);
};

/** Send time-on-page when leaving (tab close, background, or SPA navigation). */
export const trackPageEngagement = (page, durationSeconds, previousPage = null) => {
  if (!page || durationSeconds <= 0) return;
  sendEvent('page_view', {
    page,
    previousPage,
    durationSeconds: Math.max(0, Math.round(durationSeconds)),
    engagement: true,
  });
};

export const trackFestView = (festId) => {
  sendEvent('fest_view', { festId, page: window.location.pathname || '' });
};

export const trackCompetitionView = (competitionId) => {
  sendEvent('competition_view', { competitionId, page: window.location.pathname || '' });
};

export const trackRegistration = (festId, competitionId = null) => {
  sendEvent('registration', { festId, competitionId, page: window.location.pathname || '' });
};

export const trackSearch = (query) => {
  sendEvent('search', { query, page: window.location.pathname || '' });
};

export const trackLogin = () => {
  sendEvent('login', { page: window.location.pathname || '' });
};

export const trackSignup = () => {
  sendEvent('signup', { page: window.location.pathname || '' });
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
