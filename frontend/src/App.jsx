import React, { useState, useEffect, Suspense, useCallback } from 'react'
import { BrowserRouter as Router, Routes, Route, useLocation, Navigate } from 'react-router-dom'
import { DarkModeProvider, useDarkMode } from './context/DarkModeContext'
import { FavoritesProvider } from './context/FavoritesContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import { RegisteredEventsProvider } from './context/RegisteredEventsContext'
import { NotificationsProvider } from './context/NotificationsContext'
import ConnectionStatus from './components/ConnectionStatus'
import EmailVerificationBanner from './components/EmailVerificationBanner'
import MobileBottomNav from './components/MobileBottomNav'
import Footer from './components/Footer'
import Navbar from './components/Navbar'
import Sidebar from './components/Sidebar'
import ProfileSidebar from './components/ProfileSidebar'
import AuthLoadingPage from './components/AuthLoadingPage'
import { shouldShowBootSplash, removeHtmlBootSplash, BOOT_SPLASH_MS } from './utils/bootSplash'
import { clearChunkReloadFlag } from './utils/chunkError'
import { isNativeApp } from './utils/capacitorPlatform'
import AdminProtectedRoute from './components/admin/AdminProtectedRoute'
import ErrorBoundary from './components/ErrorBoundary'
import AdSenseLoader from './components/AdSense'
import PWAInstallPrompt from './components/PWAInstallPrompt'
import RouteTracker from './components/RouteTracker'
import CapacitorInit from './components/CapacitorInit'
import PageTransitionProvider, { PageTransitionContent, usePageTransition } from './components/PageTransition'
import PageTransitionSkeleton from './components/PageTransitionSkeleton'
import { useGlobalSmoothScroll } from './hooks/useGlobalSmoothScroll'

import { lazyWithRetry } from './utils/lazyWithRetry'

import './App.css'

// Home route eager-loaded for fastest first paint; other pages stay lazy
import Dashboard from './components/pages/Dashboard'
import Booking from './components/pages/profile-pages/booking'

const CulturalFestPage = lazyWithRetry(() => import('./components/pages/cultural-fest'))
const TechFestPage = lazyWithRetry(() => import('./components/pages/tech-fest'))
const SportsFestPage = lazyWithRetry(() => import('./components/pages/sports-fest'))
const SportsCategoryPage = lazyWithRetry(() => import('./components/pages/sports-category'))
const ViewDetailsPage = lazyWithRetry(() => import('./components/pages/view-details'))
const FavoritesPage = lazyWithRetry(() => import('./components/pages/favorites'))
const EditProfile = lazyWithRetry(() => import('./components/pages/profile-pages/edit-profile'))
const HelpCenter = lazyWithRetry(() => import('./components/pages/profile-pages/help-center'))
const ListYourFest = lazyWithRetry(() => import('./components/pages/profile-pages/list-your-fest'))
const NotificationsPanel = lazyWithRetry(() => import('./components/pages/profile-pages/notification-panel'))
const ProfilePage = lazyWithRetry(() => import('./components/pages/profile-page'))
const CrwdCtrlLogin = lazyWithRetry(() => import('./components/pages/login'))
const CrwdCtrlRegister = lazyWithRetry(() => import('./components/pages/register'))
const EmailVerification = lazyWithRetry(() => import('./components/pages/EmailVerification'))
const CompetitionsViewDetails = lazyWithRetry(() => import('./components/pages/Competitions-view-details'))
const CompetitionListPage = lazyWithRetry(() => import('./components/pages/competition-list'))
const CompetitionRegisterPage = lazyWithRetry(() => import('./components/pages/compition-register-page/compition-register-page'))
const TermsAndConditions = lazyWithRetry(() => import('./components/pages/terms-and-conditions'))
const PrivacyPolicy = lazyWithRetry(() => import('./components/pages/privacy-policy'))
const ContactUs = lazyWithRetry(() => import('./components/pages/contact-us'))
const RefundsAndCancellations = lazyWithRetry(() => import('./components/pages/refunds-and-cancellations'))
const ProductsAndServices = lazyWithRetry(() => import('./components/pages/products-and-services'))
const About = lazyWithRetry(() => import('./components/pages/about'))
const FestsPage = lazyWithRetry(() => import('./components/pages/FestsPage'))
const FestRegistration = lazyWithRetry(() => import('./components/pages/FestRegistration'))
const CompetitionRegistration = lazyWithRetry(() => import('./components/pages/CompetitionRegistration'))
const RegistrationDetails = lazyWithRetry(() => import('./components/pages/RegistrationDetails'))
const AdminLayout = lazyWithRetry(() => import('./components/admin/AdminLayout'))
const AdminDashboardPage = lazyWithRetry(() => import('./components/admin/AdminDashboardPage'))
const AdminFestsPage = lazyWithRetry(() => import('./components/admin/FestsPage'))
const CompetitionsPage = lazyWithRetry(() => import('./components/admin/CompetitionsPage'))
const RegistrationsPage = lazyWithRetry(() => import('./components/admin/RegistrationsPage'))
const AnalyticsDashboardPage = lazyWithRetry(() => import('./components/admin/AnalyticsDashboardPage'))
const ScannerAccessPage = lazyWithRetry(() => import('./components/admin/ScannerAccessPage'))
const SportsPage = lazyWithRetry(() => import('./components/admin/SportsPage'))
const TreksPage = lazyWithRetry(() => import('./components/admin/TreksPage'))
const TheatrePage = lazyWithRetry(() => import('./components/admin/TheatrePage'))
const SectionManager = lazyWithRetry(() => import('./components/admin/SectionManager'))
const PageSectionsPage = lazyWithRetry(() => import('./components/admin/PageSectionsPage'))
const TrekDetailPage  = lazyWithRetry(() => import('./components/pages/TrekDetailPage'))
const TrekBookingPage = lazyWithRetry(() => import('./components/pages/TrekBookingPage'))
const QRTicketPage = lazyWithRetry(() => import('./components/pages/QRTicketPage'))
const PaymentInvoicePage = lazyWithRetry(() => import('./components/pages/PaymentInvoicePage'))
const PublicTreksPage = lazyWithRetry(() => import('./components/pages/treks-page'))
const PublicTheatrePage = lazyWithRetry(() => import('./components/pages/theatre-page'))
const CommunityDetailPage = lazyWithRetry(() => import('./components/pages/CommunityDetailPage'))
const RunClubDetailPage = lazyWithRetry(() => import('./components/pages/RunClubDetailPage'))
const RunEventDetailPage = lazyWithRetry(() => import('./components/pages/RunEventDetailPage'))
const RunEventBookingPage = lazyWithRetry(() => import('./components/pages/RunEventBookingPage'))
const TrekCategoryPage = lazyWithRetry(() => import('./components/pages/TrekCategoryPage'))
const PaymentCheckoutPage = lazyWithRetry(() => import('./components/pages/PaymentCheckoutPage'))
const OrganizerProtectedRoute = lazyWithRetry(() => import('./components/organizer/OrganizerProtectedRoute'))
const OrganizerFestListPage = lazyWithRetry(() => import('./components/organizer/OrganizerFestListPage'))
const OrganizerCheckinPage = lazyWithRetry(() => import('./components/organizer/OrganizerCheckinPage'))
const OrganizerScannerLoginPage = lazyWithRetry(() => import('./components/organizer/OrganizerScannerLoginPage'))
const OrganizerScanPage = lazyWithRetry(() => import('./components/organizer/OrganizerScanPage'))
const OrganizerEntryPage = lazyWithRetry(() => import('./components/organizer/OrganizerEntryPage'))

// Component to conditionally render MobileBottomNav
function ConditionalMobileBottomNav({ onShowLogin, isProfileOpen, onProfileClick, onProfileClose }) {
  const location = useLocation();
  const { isTransitioning } = usePageTransition();

  // Hide MobileBottomNav on specific pages where it shouldn't appear OR when profile sidebar is open
  const shouldHideMobileBottomNav = location.pathname === '/login' ||
    location.pathname === '/register' ||
    location.pathname === '/verify-email' ||
    location.pathname === '/notifications' ||
    location.pathname.startsWith('/admin') ||
    location.pathname.startsWith('/organizer') ||
    location.pathname.startsWith('/view-details') ||
    location.pathname.startsWith('/trek/') ||
    location.pathname.startsWith('/treks/community/') ||
    location.pathname.startsWith('/sports/run-club/') ||
    location.pathname.startsWith('/sports/run/') ||
    location.pathname.startsWith('/competitions-view-details') ||
    location.pathname.startsWith('/competition') ||
    location.pathname.includes('/fest/') && location.pathname.includes('/register') ||
    location.pathname.startsWith('/competition-registration') ||
    isProfileOpen || // Hide when profile sidebar is open (ProfileSidebar has its own bottom nav)
    isTransitioning; // Hide during page transitions on every route

  if (shouldHideMobileBottomNav) {
    return null;
  }

  return (
    <MobileBottomNav
      onShowLogin={onShowLogin}
      onProfileClick={onProfileClick}
      onProfileClose={onProfileClose}
      isProfileOpen={isProfileOpen}
    />
  );
}

function ConditionalFooter() {
  const location = useLocation();
  const { isTransitioning } = usePageTransition();

  const shouldHideFooter =
    isTransitioning ||
    location.pathname === '/login' ||
    location.pathname === '/register' ||
    location.pathname === '/verify-email' ||
    location.pathname.startsWith('/admin') ||
    location.pathname.startsWith('/organizer') ||
    location.pathname.startsWith('/competition-registration') ||
    location.pathname.startsWith('/qr-ticket') ||
    location.pathname.startsWith('/payment-invoice') ||
    (location.pathname.includes('/fest/') && location.pathname.includes('/register')) ||
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
  const location = useLocation();
  const { isTransitioning } = usePageTransition();

  if (isTransitioning) return null;

  return <PageTransitionSkeleton pathname={location.pathname} />;
}

// Component to conditionally render Navbar and Sidebar
function ConditionalNavigation({ isProfileOpen, setIsProfileOpen, onOpenProfile }) {
  const location = useLocation();

  // Hide navigation on login, register, and email verification pages
  const shouldHideNavigation = location.pathname === '/login' || location.pathname === '/register' || location.pathname === '/verify-email'||  location.pathname.startsWith('/admin');

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
        <Navbar isProfileOpen={isProfileOpen} setIsProfileOpen={setIsProfileOpen} onOpenProfile={onOpenProfile} />
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
  handleSwitchToRegister,
  handleSwitchToLogin,
}) {
  const location = useLocation();
  const { isAuthProcessing, isLoading, isAuthenticated, isRedirectProcessing } = useAuth();
  const { isDark } = useDarkMode();
  const { startOverlayTransition } = usePageTransition();
  const isAdminRoute = location.pathname.startsWith('/admin');

  useGlobalSmoothScroll();

  const openProfile = useCallback(() => {
    startOverlayTransition('/profile', () => setIsProfileOpen(true));
  }, [startOverlayTransition, setIsProfileOpen]);

  useEffect(() => {
    if (isAuthenticated && showLogin) {
      setShowLogin(false);
    }
    if (isAuthenticated && showRegister) {
      setShowRegister(false);
    }
  }, [isAuthenticated, showLogin, showRegister, setShowLogin, setShowRegister]);

  // Only block UI during an active OAuth redirect — not background session sync
  if (!isNativeApp() && isRedirectProcessing) {
    return <AuthLoadingPage />;
  }

  return (
    <div className={`crwdctrl-app-shell relative min-h-screen overflow-x-clip ${!isAdminRoute ? (isDark ? 'bg-[#161718]' : 'bg-white') : ''}`}>
      {!isAdminRoute && <EmailVerificationBanner />}

      <ConditionalNavigation
        isProfileOpen={isProfileOpen}
        setIsProfileOpen={setIsProfileOpen}
        onOpenProfile={openProfile}
      />

      <div className={isAdminRoute ? '' : 'lg:ml-20'}>
        <div className={isAdminRoute ? '' : 'lg:pt-20'}>
          <ErrorBoundary>
            <PageTransitionContent>
              <Suspense fallback={<RouteSuspenseFallback />}>
                <Routes>
                <Route path="/payment/checkout" element={<PaymentCheckoutPage />} />
                <Route path="/payment/return" element={<Navigate to="/booking" replace />} />
                <Route path="/" element={<Dashboard />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/login" element={<CrwdCtrlLogin />} />
                <Route path="/admin/login" element={<CrwdCtrlLogin />} />
                <Route path="/register" element={<CrwdCtrlRegister />} />
                <Route path="/verify-email" element={<EmailVerification />} />
                <Route path="/fests" element={<FestsPage />} />
                <Route path="/cultural-fest" element={<CulturalFestPage />} />
                <Route path="/tech-fest" element={<TechFestPage />} />
                <Route path="/sports" element={<SportsCategoryPage />} />
                <Route path="/sports-fest" element={<SportsFestPage />} />
                <Route path="/treks" element={<PublicTreksPage />} />
                <Route path="/theatre" element={<PublicTheatrePage />} />
                <Route path="/treks/community/:id" element={<CommunityDetailPage />} />
                <Route path="/sports/run-club/:id" element={<RunClubDetailPage />} />
                <Route path="/sports/run/:id" element={<RunEventDetailPage />} />
                <Route path="/sports/run/:id/book" element={<RunEventBookingPage />} />
                <Route path="/treks/category/:category" element={<TrekCategoryPage />} />
                <Route path="/trek/:id" element={<TrekDetailPage />} />
                <Route path="/trek/:id/book" element={<TrekBookingPage />} />
                <Route path="/favorites" element={<FavoritesPage />} />
                <Route path="/view-details/:eventId" element={<ViewDetailsPage />} />
                <Route path="/view-details" element={<ViewDetailsPage />} />
                <Route path="/competitions-view-details/:competitionId" element={<CompetitionsViewDetails />} />
                <Route path="/competitions-view-details" element={<CompetitionsViewDetails />} />
                <Route path="/competition-list/:eventId" element={<CompetitionListPage />} />
                <Route path="/competition-register" element={<CompetitionRegisterPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/edit-profile" element={<EditProfile />} />
                <Route path="/booking" element={<Booking />} />
                <Route path="/registered-fest" element={<Navigate to="/booking" replace />} />
                <Route path="/help-center" element={<HelpCenter />} />
                <Route path="/list-your-fest" element={<ListYourFest />} />
                <Route path="/notifications" element={<NotificationsPanel />} />
                <Route path="/connection-status" element={<ConnectionStatus />} />
                <Route path="/terms-and-conditions" element={<TermsAndConditions />} />
                <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                <Route path="/contact-us" element={<ContactUs />} />
                <Route path="/refunds-and-cancellations" element={<RefundsAndCancellations />} />
                <Route path="/products-and-services" element={<ProductsAndServices />} />
                <Route path="/about" element={<About />} />
                <Route path="/fest/:festId/register" element={<FestRegistration />} />
                <Route path="/competition-registration/:competitionId" element={<CompetitionRegistration />} />
                <Route path="/registration-details/:registrationId" element={<RegistrationDetails />} />
                <Route path="/qr-ticket/:registrationId" element={<QRTicketPage />} />
                <Route path="/payment-invoice/:id" element={<PaymentInvoicePage />} />
                <Route path="/organizer/login" element={<OrganizerScannerLoginPage />} />
                <Route path="/organizer/scan" element={<OrganizerScanPage />} />
                <Route path="/organizer" element={<OrganizerEntryPage />} />
                <Route
                  path="/organizer/account"
                  element={
                    <OrganizerProtectedRoute>
                      <OrganizerFestListPage />
                    </OrganizerProtectedRoute>
                  }
                />
                <Route
                  path="/organizer/:festId/checkin"
                  element={
                    <OrganizerProtectedRoute>
                      <OrganizerCheckinPage />
                    </OrganizerProtectedRoute>
                  }
                />
                <Route
                  path="/admin"
                  element={
                    <AdminProtectedRoute>
                      <AdminLayout />
                    </AdminProtectedRoute>
                  }
                >
                  <Route index element={<AdminDashboardPage />} />
                  <Route path="fests" element={<AdminFestsPage />} />
                  <Route path="competitions" element={<CompetitionsPage />} />
                  <Route path="registrations" element={<RegistrationsPage />} />
                  <Route path="analytics" element={<AnalyticsDashboardPage />} />
                  <Route path="scanner-access" element={<ScannerAccessPage />} />
                  <Route path="sports" element={<SportsPage />} />
                  <Route path="treks" element={<TreksPage />} />
                  <Route path="theatre" element={<TheatrePage />} />
                  <Route path="sections" element={<SectionManager />} />
                  <Route path="page-sections" element={<PageSectionsPage />} />
                </Route>
                </Routes>
              </Suspense>
            </PageTransitionContent>
          </ErrorBoundary>
          {!isAdminRoute && <ConditionalFooter />}
        </div>
      </div>

      {!isAdminRoute && (
        <ConditionalMobileBottomNav
          onShowLogin={() => setShowLogin(true)}
          isProfileOpen={isProfileOpen}
          onProfileClick={openProfile}
          onProfileClose={() => setIsProfileOpen(false)}
        />
      )}

      {!isAdminRoute && (
        <ProfileSidebar
          isOpen={isProfileOpen}
          onClose={() => setIsProfileOpen(false)}
          onShowLogin={() => setShowLogin(true)}
          onShowRegister={() => setShowRegister(true)}
        />
      )}

      {showLogin && !isAuthProcessing && !isLoading && !isRedirectProcessing && (
        <div className="fixed inset-0 z-50">
          <CrwdCtrlLogin onClose={handleCloseLogin} onSwitchToRegister={handleSwitchToRegister} />
        </div>
      )}

      {showRegister && !isAuthProcessing && !isLoading && !isRedirectProcessing && (
        <div className="fixed inset-0 z-50">
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
  const [showBootSplash, setShowBootSplash] = useState(() => shouldShowBootSplash());

  useEffect(() => {
    if (showBootSplash) return undefined;
    clearChunkReloadFlag();
    removeHtmlBootSplash();
    return undefined;
  }, [showBootSplash]);

  useEffect(() => {
    if (!showBootSplash) return undefined;
    const timer = setTimeout(() => {
      setShowBootSplash(false);
      removeHtmlBootSplash();
    }, BOOT_SPLASH_MS);
    return () => clearTimeout(timer);
  }, [showBootSplash]);

  useEffect(() => {
    // Fire-and-forget backend wake-up — never blocks first paint
    const api = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';
    const markReady = () => {
      window.__backendReady = true;
      window.dispatchEvent(new Event('backendReady'));
    };

    fetch(`${api}/health`, { method: 'GET', mode: 'cors', credentials: 'omit' })
      .then((r) => { if (r.ok) markReady(); })
      .catch(() => {});

    // Background retries for cold starts without delaying the UI
    const retryDelays = [3000, 8000, 15000];
    const timers = retryDelays.map((delay) =>
      setTimeout(() => {
        if (window.__backendReady) return;
        fetch(`${api}/health`, { method: 'GET', mode: 'cors', credentials: 'omit' })
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
    setShowLogin(true);
  };

  if (showBootSplash) {
    // index.html #boot-splash is already visible — avoid stacking a second React logo
    return (
      <DarkModeProvider>
        <div className="sr-only" aria-live="polite">Loading CrwdCtrl</div>
      </DarkModeProvider>
    );
  }

  return (
    <AuthProvider>
      <DarkModeProvider>
        <FavoritesProvider>
          <RegisteredEventsProvider>
            <NotificationsProvider>
              <Router>
                <PageTransitionProvider>
                  <CapacitorInit />
                  <RouteTracker />
                  <AdSenseLoader />
                  <PWAInstallPrompt />
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
                  />
                </PageTransitionProvider>
              </Router>
            </NotificationsProvider>
          </RegisteredEventsProvider>
        </FavoritesProvider>
      </DarkModeProvider>
    </AuthProvider>
  )
}

export default App
