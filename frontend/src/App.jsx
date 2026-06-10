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
import AppLoadingPage from './components/AppLoadingPage'
import LoadingBar from './components/LoadingBar'
import { shouldShowBootSplash, removeHtmlBootSplash, BOOT_SPLASH_MS } from './utils/bootSplash'
import { isNativeApp } from './utils/capacitorPlatform'
import AdminProtectedRoute from './components/admin/AdminProtectedRoute'
import ErrorBoundary from './components/ErrorBoundary'
import AdSenseLoader from './components/AdSense'
import PWAInstallPrompt from './components/PWAInstallPrompt'
import RouteTracker from './components/RouteTracker'
import CapacitorInit from './components/CapacitorInit'
import PageTransitionProvider, { PageTransitionContent, usePageTransition } from './components/PageTransition'
import { useGlobalSmoothScroll } from './hooks/useGlobalSmoothScroll'

import './App.css'

// Home route eager-loaded for fastest first paint; other pages stay lazy
import Dashboard from './components/pages/Dashboard'
const CulturalFestPage = React.lazy(() => import('./components/pages/cultural-fest'))
const TechFestPage = React.lazy(() => import('./components/pages/tech-fest'))
const SportsFestPage = React.lazy(() => import('./components/pages/sports-fest'))
const SportsCategoryPage = React.lazy(() => import('./components/pages/sports-category'))
const ViewDetailsPage = React.lazy(() => import('./components/pages/view-details'))
const FavoritesPage = React.lazy(() => import('./components/pages/favorites'))
const EditProfile = React.lazy(() => import('./components/pages/profile-pages/edit-profile'))
const Booking = React.lazy(() => import('./components/pages/profile-pages/booking'))
const HelpCenter = React.lazy(() => import('./components/pages/profile-pages/help-center'))
const ListYourFest = React.lazy(() => import('./components/pages/profile-pages/list-your-fest'))
const NotificationsPanel = React.lazy(() => import('./components/pages/profile-pages/notification-panel'))
const ProfilePage = React.lazy(() => import('./components/pages/profile-page'))
const CrwdCtrlLogin = React.lazy(() => import('./components/pages/login'))
const CrwdCtrlRegister = React.lazy(() => import('./components/pages/register'))
const EmailVerification = React.lazy(() => import('./components/pages/EmailVerification'))
const CompetitionsViewDetails = React.lazy(() => import('./components/pages/Competitions-view-details'))
const CompetitionListPage = React.lazy(() => import('./components/pages/competition-list'))
const CompetitionRegisterPage = React.lazy(() => import('./components/pages/compition-register-page/compition-register-page'))
const TermsAndConditions = React.lazy(() => import('./components/pages/terms-and-conditions'))
const PrivacyPolicy = React.lazy(() => import('./components/pages/privacy-policy'))
const ContactUs = React.lazy(() => import('./components/pages/contact-us'))
const RefundsAndCancellations = React.lazy(() => import('./components/pages/refunds-and-cancellations'))
const ProductsAndServices = React.lazy(() => import('./components/pages/products-and-services'))
const About = React.lazy(() => import('./components/pages/about'))
const FestsPage = React.lazy(() => import('./components/pages/FestsPage'))
const FestRegistration = React.lazy(() => import('./components/pages/FestRegistration'))
const CompetitionRegistration = React.lazy(() => import('./components/pages/CompetitionRegistration'))
const RegistrationDetails = React.lazy(() => import('./components/pages/RegistrationDetails'))
const AdminLayout = React.lazy(() => import('./components/admin/AdminLayout'))
const AdminDashboardPage = React.lazy(() => import('./components/admin/AdminDashboardPage'))
const AdminFestsPage = React.lazy(() => import('./components/admin/FestsPage'))
const CompetitionsPage = React.lazy(() => import('./components/admin/CompetitionsPage'))
const RegistrationsPage = React.lazy(() => import('./components/admin/RegistrationsPage'))
const AnalyticsDashboardPage = React.lazy(() => import('./components/admin/AnalyticsDashboardPage'))
const CheckinScannerPage = React.lazy(() => import('./components/admin/CheckinScannerPage'))
const SportsPage = React.lazy(() => import('./components/admin/SportsPage'))
const TreksPage = React.lazy(() => import('./components/admin/TreksPage'))
const TheatrePage = React.lazy(() => import('./components/admin/TheatrePage'))
const SectionManager = React.lazy(() => import('./components/admin/SectionManager'))
const TrekDetailPage  = React.lazy(() => import('./components/pages/TrekDetailPage'))
const TrekBookingPage = React.lazy(() => import('./components/pages/TrekBookingPage'))
const QRTicketPage = React.lazy(() => import('./components/pages/QRTicketPage'))
const PublicTreksPage = React.lazy(() => import('./components/pages/treks-page'))
const PublicTheatrePage = React.lazy(() => import('./components/pages/theatre-page'))
const CommunityDetailPage = React.lazy(() => import('./components/pages/CommunityDetailPage'))
const TrekCategoryPage = React.lazy(() => import('./components/pages/TrekCategoryPage'))
const PaymentCheckoutPage = React.lazy(() => import('./components/pages/PaymentCheckoutPage'))

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
    location.pathname.startsWith('/view-details') ||
    location.pathname.startsWith('/trek/') ||
    location.pathname.startsWith('/treks/community/') ||
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

  const shouldHideFooter =
    location.pathname === '/login' ||
    location.pathname === '/register' ||
    location.pathname === '/verify-email' ||
    location.pathname.startsWith('/admin') ||
    location.pathname.startsWith('/competition-registration') ||
    location.pathname.startsWith('/qr-ticket') ||
    (location.pathname.includes('/fest/') && location.pathname.includes('/register')) ||
    location.pathname.startsWith('/trek/') ||
    location.pathname.startsWith('/treks/community/');

  if (shouldHideFooter) {
    return null;
  }

  return <Footer />;
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

  // Only block UI during OAuth return on web — native app uses native Google Sign-In
  if (!isNativeApp() && (isRedirectProcessing || isAuthProcessing)) {
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
              <Suspense fallback={<LoadingBar />}>
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
                  <Route path="checkin" element={<CheckinScannerPage />} />
                  <Route path="sports" element={<SportsPage />} />
                  <Route path="treks" element={<TreksPage />} />
                  <Route path="theatre" element={<TheatrePage />} />
                  <Route path="sections" element={<SectionManager />} />
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
    return (
      <DarkModeProvider>
        <AppLoadingPage />
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
