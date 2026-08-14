import React, { useState, useEffect, Suspense, useCallback } from 'react'
import { BrowserRouter as Router, Routes, useLocation, useNavigate } from 'react-router-dom'
import { DarkModeProvider } from './context/DarkModeContext'
import { DialogProvider } from './context/DialogContext'
import { FavoritesProvider } from './context/FavoritesContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import { RegisteredEventsProvider } from './context/RegisteredEventsContext'
import { NotificationsProvider } from './context/NotificationsContext'
import MobileBottomNav from './components/layout/MobileBottomNav'
import Footer from './components/layout/Footer'
import Navbar from './components/layout/Navbar'
import Sidebar from './components/layout/Sidebar'
import ProfileSidebar from './components/layout/ProfileSidebar'
import { removeHtmlBootSplash, BOOT_SPLASH_MS, BOOT_SPLASH_SHORT_MAX_MS, shouldShowBootSplash, isShortBootSplash } from './utils/bootSplash'
import { isCategoryHubRoute } from './utils/categoryHubRoutes'
import { MobileSearchProvider, useMobileSearchOptional } from './context/MobileSearchContext'
import MobileSearchHost from './components/MobileSearchHost'
import { clearChunkReloadFlag } from './utils/chunkError'
import ErrorBoundary from './components/ErrorBoundary'
import AdSenseLoader from './components/AdSense'
import PWAInstallPrompt from './components/PWAInstallPrompt'
import RouteTracker from './components/RouteTracker'
import GoogleOneTap from './components/GoogleOneTap'
import CapacitorInit from './components/CapacitorInit'
import OfflineHuntBootGate from './features/campus-hunt/offline/OfflineHuntBootGate'
import PageTransitionProvider, { PageTransitionContent, usePageTransition } from './components/layout/PageTransition'
import { useGlobalSmoothScroll } from './hooks/useGlobalSmoothScroll'
import { prepareLogin, resolvePostLoginRedirect, currentAppPath } from './utils/loginFlow'
import { showLoginPopup } from './utils/appPopup'
import { appRoutes, CrwdCtrlLogin, CrwdCtrlRegister } from './app/router'
import { resolveUrl } from './services/api/client'

import './App.css'

// Component to conditionally render MobileBottomNav
function ConditionalMobileBottomNav({ onShowLogin, isProfileOpen, onProfileClick, onProfileClose }) {
  const location = useLocation();
  const navigate = useNavigate();
  const mobileSearch = useMobileSearchOptional();
  const { prepareRouteNavigation, startOverlayTransition } = usePageTransition();

  const handleNavFromProfile = useCallback((path) => {
    if (path === '/profile') return;

    const alreadyThere = path === '/'
      ? location.pathname === '/' || location.pathname === '/dashboard'
      : location.pathname === path;

    if (alreadyThere) {
      startOverlayTransition(path, onProfileClose);
      return;
    }

    prepareRouteNavigation(path);
    navigate(path);
    onProfileClose();
  }, [location.pathname, navigate, onProfileClose, prepareRouteNavigation, startOverlayTransition]);

  const shouldHideMobileBottomNav = location.pathname === '/login' ||
    location.pathname === '/register' ||
    location.pathname === '/verify-email' ||
    location.pathname === '/profile' ||
    location.pathname === '/notifications' ||
    isCategoryHubRoute(location.pathname) ||
    mobileSearch?.isOpen ||
    location.pathname.startsWith('/admin') ||
    location.pathname.startsWith('/organizer') ||
    location.pathname.startsWith('/trek-organizer') ||
    location.pathname.startsWith('/fest-organizer') ||
    location.pathname.startsWith('/stall') ||
    location.pathname.startsWith('/s/') ||
    location.pathname.startsWith('/run-club-organizer') ||
    location.pathname.startsWith('/event-organizer') ||
    location.pathname.startsWith('/campus-hunt') ||
    location.pathname.startsWith('/campus-hunt-volunteer') ||
    location.pathname.startsWith('/view-details') ||
    location.pathname.startsWith('/events/') ||
    location.pathname.startsWith('/trek/') ||
    location.pathname.startsWith('/treks/community/') ||
    location.pathname.startsWith('/sports/run-club/') ||
    location.pathname.startsWith('/sports/run/') ||
    location.pathname.startsWith('/competitions-view-details') ||
    location.pathname.startsWith('/competition') ||
    location.pathname.includes('/fest/') && location.pathname.includes('/register') ||
    location.pathname.startsWith('/competition-registration');

  if (shouldHideMobileBottomNav) {
    return null;
  }

  return (
    <MobileBottomNav
      onShowLogin={onShowLogin}
      onProfileClick={onProfileClick}
      onProfileClose={onProfileClose}
      isProfileOpen={isProfileOpen}
      onNavigate={isProfileOpen ? handleNavFromProfile : undefined}
    />
  );
}

function ConditionalFooter() {
  const location = useLocation();
  const { hideChrome } = usePageTransition();

  const shouldHideFooter =
    hideChrome ||
    location.pathname === '/login' ||
    location.pathname === '/register' ||
    location.pathname === '/verify-email' ||
    location.pathname.startsWith('/admin') ||
    location.pathname.startsWith('/organizer') ||
    location.pathname.startsWith('/trek-organizer') ||
    location.pathname.startsWith('/fest-organizer') ||
    location.pathname.startsWith('/stall') ||
    location.pathname.startsWith('/s/') ||
    location.pathname.startsWith('/run-club-organizer') ||
    location.pathname.startsWith('/event-organizer') ||
    location.pathname.startsWith('/campus-hunt') ||
    location.pathname.startsWith('/campus-hunt-volunteer') ||
    location.pathname.startsWith('/competition-registration') ||
    location.pathname.startsWith('/competitions-view-details') ||
    location.pathname.startsWith('/competition') ||
    location.pathname.startsWith('/view-details') ||
    location.pathname.startsWith('/qr-ticket') ||
    location.pathname.startsWith('/payment-invoice') ||
    (location.pathname.includes('/fest/') && location.pathname.includes('/register')) ||
    location.pathname.startsWith('/events/') ||
    location.pathname.startsWith('/trek/') ||
    location.pathname.startsWith('/treks/community/') ||
    location.pathname.startsWith('/sports/run-club/') ||
    location.pathname.startsWith('/sports/run/');

  if (shouldHideFooter) {
    return null;
  }

  return <Footer />;
}

function RouteSuspenseFallback() {
  return (
    <div className="min-h-[40vh] w-full bg-transparent" aria-busy="true" aria-label="Loading page" />
  );
}

// Component to conditionally render Navbar and Sidebar
function ConditionalNavigation({ isProfileOpen, setIsProfileOpen, onOpenProfile, onShowLogin }) {
  const location = useLocation();

  // Hide navigation on login, register, and email verification pages
  const shouldHideNavigation = location.pathname === '/login' || location.pathname === '/register' || location.pathname === '/verify-email'||  location.pathname.startsWith('/admin') || location.pathname.startsWith('/trek-organizer') || location.pathname.startsWith('/fest-organizer') || location.pathname.startsWith('/stall') || location.pathname.startsWith('/s/') || location.pathname.startsWith('/run-club-organizer') || location.pathname.startsWith('/event-organizer') || location.pathname.startsWith('/campus-hunt') || location.pathname.startsWith('/campus-hunt-volunteer');

  if (shouldHideNavigation) {
    return null;
  }

  return (
    <>
      {/* Desktop Sidebar - Hidden on mobile */}
      <div className="hidden lg:block fixed left-0 top-0 z-40">
        <Sidebar />
      </div>
      {/* Navbar - Fixed position for all pages except login/register */}
      <div className="hidden lg:block">
        <Navbar
          isProfileOpen={isProfileOpen}
          setIsProfileOpen={setIsProfileOpen}
          onOpenProfile={onOpenProfile}
          onShowLogin={onShowLogin}
        />
      </div>
    </>
  );
}
function AppContent({
  isProfileOpen,
  setIsProfileOpen,
  showLogin,
  setShowLogin,
  showRegister,
  setShowRegister,
  handleCloseLogin,
  handleCloseRegister,
  handleSwitchToRegister: _handleSwitchToRegister,
  handleSwitchToLogin,
  openLoginFromProfile,
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthProcessing, isLoading, isAuthenticated, isRedirectProcessing } = useAuth();
  const isAdminRoute = location.pathname.startsWith('/admin');
  const isTrekOrganizerRoute = location.pathname.startsWith('/trek-organizer');
  const isFestOrganizerRoute = location.pathname.startsWith('/fest-organizer');
  const isStallRoute = location.pathname.startsWith('/stall') || location.pathname.startsWith('/s/');
  const isRunClubOrganizerRoute = location.pathname.startsWith('/run-club-organizer');
  const isEventOrganizerRoute = location.pathname.startsWith('/event-organizer');
  const isCampusHuntRoute = location.pathname.startsWith('/campus-hunt') || location.pathname.startsWith('/campus-hunt-volunteer');
  const isStandaloneRoute = isAdminRoute || isTrekOrganizerRoute || isFestOrganizerRoute || isStallRoute || isRunClubOrganizerRoute || isEventOrganizerRoute || isCampusHuntRoute;

  useGlobalSmoothScroll();

  const openProfile = useCallback(() => {
    setIsProfileOpen(true);
  }, [setIsProfileOpen]);

  useEffect(() => {
    if (isAuthenticated && showLogin) {
      setShowLogin(false);
    }
    if (isAuthenticated && showRegister) {
      setShowRegister(false);
    }
  }, [isAuthenticated, showLogin, showRegister, setShowLogin, setShowRegister]);

  useEffect(() => {
    if (location.pathname === '/favorites' || location.pathname === '/booking') {
      setShowLogin(false);
      setShowRegister(false);
    }
  }, [location.pathname, setShowLogin, setShowRegister]);

  useEffect(() => {
    const onUserLogin = () => {
      let fromProfile = false;
      let stayInProfile = false;
      try {
        const raw = sessionStorage.getItem('crwdctrl_login_context');
        if (raw) {
          const ctx = JSON.parse(raw);
          fromProfile = Boolean(ctx.fromProfile);
          stayInProfile = Boolean(ctx.stayInProfile);
        }
      } catch {
        /* ignore */
      }

      setShowLogin(false);
      setShowRegister(false);

      const destination = resolvePostLoginRedirect();
      const here = currentAppPath();

      // Profile Google sheet: stay on Profile, toast “Login successful”, then they tap Hunt.
      if (stayInProfile || fromProfile) {
        setIsProfileOpen(true);
        window.requestAnimationFrame(() => showLoginPopup());
        return;
      }

      setIsProfileOpen(false);

      if (destination && destination !== here) {
        navigate(destination, { replace: true });
      }

      window.requestAnimationFrame(() => showLoginPopup());
    };

    window.addEventListener('crwdctrl:user-login', onUserLogin);
    return () => window.removeEventListener('crwdctrl:user-login', onUserLogin);
  }, [navigate, setIsProfileOpen, setShowLogin, setShowRegister]);

  return (
    <div className={`crwdctrl-app-shell relative min-h-screen overflow-x-clip ${!isStandaloneRoute ? '' : ''}`}>
      <ConditionalNavigation
        isProfileOpen={isProfileOpen}
        setIsProfileOpen={setIsProfileOpen}
        onOpenProfile={openProfile}
        onShowLogin={openLoginFromProfile}
      />

        <div className={isStandaloneRoute ? '' : 'lg:ml-20'}>
        <div className={isStandaloneRoute ? '' : 'desktop-navbar-clearance'}>
          <ErrorBoundary>
            <PageTransitionContent>
              <Suspense fallback={<RouteSuspenseFallback />}>
                <Routes>
                  {appRoutes}
                </Routes>
              </Suspense>
            </PageTransitionContent>
          </ErrorBoundary>
          {!isStandaloneRoute && <ConditionalFooter />}
        </div>
      </div>

      {!isStandaloneRoute && (
        <ConditionalMobileBottomNav
          onShowLogin={openLoginFromProfile}
          isProfileOpen={isProfileOpen}
          onProfileClick={openProfile}
          onProfileClose={() => setIsProfileOpen(false)}
        />
      )}

      {!isStandaloneRoute && location.pathname !== '/profile' && (
        <ProfileSidebar
          isOpen={isProfileOpen}
          onClose={() => setIsProfileOpen(false)}
          onShowLogin={openLoginFromProfile}
          onShowRegister={() => setShowRegister(true)}
          embedBottomNav={false}
        />
      )}

      {showLogin && !isAuthProcessing && !isLoading && !isRedirectProcessing && (
        <CrwdCtrlLogin
          googleOnly
          title="Continue with Google"
          subtitle="Sign in — then you can open Campus Hunt from Profile"
          onClose={handleCloseLogin}
        />
      )}

      {showRegister && !isAuthProcessing && !isLoading && !isRedirectProcessing && (
        <div className="fixed inset-0 z-[100050]">
          <CrwdCtrlRegister onClose={handleCloseRegister} onSwitchToLogin={handleSwitchToLogin} />
        </div>
      )}
    </div>
  );
}

function App() {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);

  const openLoginFromProfile = useCallback((options = {}) => {
    prepareLogin({
      fromProfile: true,
      stayInProfile: options.stayInProfile !== false,
      returnPath: options.stayInProfile === false ? options.returnPath : undefined,
    });
    setShowLogin(true);
  }, []);

  // HTML boot splash covers first paint — never defer mounting Router/Auth behind it.
  // Shared trek/fest/club links skip the logo entirely so content paints immediately.
  useEffect(() => {
    if (!shouldShowBootSplash()) {
      removeHtmlBootSplash();
      clearChunkReloadFlag();
      return undefined;
    }
    if (isShortBootSplash()) {
      const finish = () => {
        removeHtmlBootSplash();
        clearChunkReloadFlag();
      };
      window.addEventListener('crwdctrl:detail-ready', finish);
      const maxWait = window.setTimeout(finish, BOOT_SPLASH_SHORT_MAX_MS);
      return () => {
        window.removeEventListener('crwdctrl:detail-ready', finish);
        window.clearTimeout(maxWait);
      };
    }
    const delay = Math.max(0, BOOT_SPLASH_MS - performance.now());
    const timer = window.setTimeout(() => {
      removeHtmlBootSplash();
      clearChunkReloadFlag();
    }, delay);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Fire-and-forget backend wake-up — never blocks first paint
    const markReady = () => {
      window.__backendReady = true;
      window.dispatchEvent(new Event('backendReady'));
    };

    fetch(resolveUrl('/health'), { method: 'GET', mode: 'cors', credentials: 'omit' })
      .then((r) => { if (r.ok) markReady(); })
      .catch(() => {});

    // Background retries for cold starts without delaying the UI
    const retryDelays = [3000, 8000, 15000];
    const timers = retryDelays.map((delay) =>
      setTimeout(() => {
        if (window.__backendReady) return;
        fetch(resolveUrl('/health'), { method: 'GET', mode: 'cors', credentials: 'omit' })
          .then((r) => { if (r.ok) markReady(); })
          .catch(() => markReady());
      }, delay),
    );

    const fallback = setTimeout(markReady, 20000);
    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(fallback);
    };
  }, []);

  // Modal handlers
  const handleCloseLogin = () => {
    setShowLogin(false);
  };

  const handleCloseRegister = () => {
    setShowRegister(false);
  };

  const handleSwitchToRegister = () => {
    setShowLogin(false);
    setShowRegister(true);
  };

  const handleSwitchToLogin = () => {
    setShowRegister(false);
    try {
      if (!sessionStorage.getItem('crwdctrl_login_context')) {
        prepareLogin({ fromProfile: false });
      }
    } catch {
      prepareLogin({ fromProfile: false });
    }
    setShowLogin(true);
  };

  return (
    <AuthProvider>
      <DarkModeProvider>
        <DialogProvider>
        <FavoritesProvider>
          <RegisteredEventsProvider>
              <Router>
                <NotificationsProvider>
                <MobileSearchProvider>
                <PageTransitionProvider>
                  <CapacitorInit />
                  <OfflineHuntBootGate />
                  <RouteTracker />
                  <GoogleOneTap />
                  <AdSenseLoader />
                  <PWAInstallPrompt />
                  <MobileSearchHost />
                  <AppContent
                    isProfileOpen={isProfileOpen}
                    setIsProfileOpen={setIsProfileOpen}
                    showLogin={showLogin}
                    setShowLogin={setShowLogin}
                    showRegister={showRegister}
                    setShowRegister={setShowRegister}
                    handleCloseLogin={handleCloseLogin}
                    handleCloseRegister={handleCloseRegister}
                    handleSwitchToRegister={handleSwitchToRegister}
                    handleSwitchToLogin={handleSwitchToLogin}
                    openLoginFromProfile={openLoginFromProfile}
                  />
                </PageTransitionProvider>
                </MobileSearchProvider>
                </NotificationsProvider>
              </Router>
          </RegisteredEventsProvider>
        </FavoritesProvider>
        </DialogProvider>
      </DarkModeProvider>
    </AuthProvider>
  )
}

export default App
