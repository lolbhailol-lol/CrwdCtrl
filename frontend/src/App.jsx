import React, { useState, useEffect, Suspense } from 'react'
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom'
import { DarkModeProvider } from './context/DarkModeContext'
import { FavoritesProvider } from './context/FavoritesContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import { RegisteredEventsProvider } from './context/RegisteredEventsContext'
import { NotificationsProvider } from './context/NotificationsContext'
import ConnectionStatus from './components/ConnectionStatus'
import EmailVerificationBanner from './components/EmailVerificationBanner'
import MobileBottomNav from './components/MobileBottomNav'
import Navbar from './components/Navbar'
import Sidebar from './components/Sidebar'
import ProfileSidebar from './components/ProfileSidebar'
import AppLoadingPage from './components/AppLoadingPage'
import AuthLoadingPage from './components/AuthLoadingPage'
import LoadingBar from './components/LoadingBar'
import AdminStatsCard from './components/admin/AdminStatsCard'
import Competiton_Modal from './components/admin/Competition_Modal'
import AdminProtectedRoute from './components/admin/AdminProtectedRoute'

import './App.css'

// Lazy load components for code splitting
const Dashboard = React.lazy(() => import('./components/pages/Dashboard'))
const CulturalFestPage = React.lazy(() => import('./components/pages/cultural-fest'))
const TechFestPage = React.lazy(() => import('./components/pages/tech-fest'))
const SportsFestPage = React.lazy(() => import('./components/pages/sports-fest'))
const ViewDetailsPage = React.lazy(() => import('./components/pages/view-details'))
const FavoritesPage = React.lazy(() => import('./components/pages/favorites'))
const EditProfile = React.lazy(() => import('./components/pages/profile-pages/edit-profile'))
const RegisteredFest = React.lazy(() => import('./components/pages/profile-pages/registered-fest'))
const HelpCenter = React.lazy(() => import('./components/pages/profile-pages/help-center'))
const ListYourFest = React.lazy(() => import('./components/pages/profile-pages/list-your-fest'))
const NotificationsPanel = React.lazy(() => import('./components/pages/profile-pages/notification-panel'))
const CrwdCtrlRegister = React.lazy(() => import('./components/pages/register'))
const ResponsiveRegisteredEvents = React.lazy(() => import('./components/pages/ResponsiveRegisteredEvents'))
const ProfilePage = React.lazy(() => import('./components/pages/profile-page'))
const CrwdCtrlLogin = React.lazy(() => import('./components/pages/login'))
const EmailVerification = React.lazy(() => import('./components/pages/EmailVerification'))
const CompetitionsViewDetails = React.lazy(() => import('./components/pages/Competitions-view-details'))
const CompetitionListPage = React.lazy(() => import('./components/pages/competition-list'))
const CompetitionRegisterPage = React.lazy(() => import('./components/pages/compition-register-page/compition-register-page'))
const TermsAndConditions = React.lazy(() => import('./components/pages/terms-and-conditions'))
const PrivacyPolicy = React.lazy(() => import('./components/pages/privacy-policy'))
const ContactUs = React.lazy(() => import('./components/pages/contact-us'))
const FestRegistration = React.lazy(() => import('./components/pages/FestRegistration'))
const CompetitionRegistration = React.lazy(() => import('./components/pages/CompetitionRegistration'))
const RegistrationDetails = React.lazy(() => import('./components/pages/RegistrationDetails'))
const AdminLayout = React.lazy(() => import('./components/admin/AdminLayout'))
const AdminDashboardPage = React.lazy(() => import('./components/admin/AdminDashboardPage'))
const FestsPage = React.lazy(() => import('./components/admin/FestsPage'))
const CompetitionsPage = React.lazy(() => import('./components/admin/CompetitionsPage'))
const RegistrationsPage = React.lazy(() => import('./components/admin/RegistrationsPage'))

// Component to conditionally render MobileBottomNav
function ConditionalMobileBottomNav({ onShowLogin, isProfileOpen, onProfileClick }) {
  const location = useLocation();

  // Hide MobileBottomNav on specific pages where it shouldn't appear OR when profile sidebar is open
  const shouldHideMobileBottomNav = location.pathname === '/login' ||
    location.pathname === '/register' ||
    location.pathname === '/verify-email' ||
    location.pathname.startsWith('/admin') ||
    location.pathname.startsWith('/view-details') ||
    location.pathname.startsWith('/competitions-view-details') ||
    location.pathname.startsWith('/competition') ||
    location.pathname.includes('/fest/') && location.pathname.includes('/register') ||
    location.pathname.startsWith('/competition-registration') ||
    isProfileOpen; // Hide when profile sidebar is open (ProfileSidebar has its own bottom nav)
  
  // ✅ FIXED: Show mobile nav on view-details so users can navigate from shared links

  if (shouldHideMobileBottomNav) {
    return null;
  }

  return <MobileBottomNav onShowLogin={onShowLogin} onProfileClick={onProfileClick} />;
}

// Component to conditionally render Navbar and Sidebar
function ConditionalNavigation({ isProfileOpen, setIsProfileOpen }) {
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
        <Navbar isProfileOpen={isProfileOpen} setIsProfileOpen={setIsProfileOpen} />
      </div>
    </>
  );
}
function App() {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isPageRefresh, setIsPageRefresh] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);

  useEffect(() => {
    // Check if this is a page refresh by checking if performance.navigation exists
    // and its type or checking if sessionStorage has our flag
    const checkIfPageRefresh = () => {
      // ✅ CRITICAL FIX: Don't show loading page if we have Firebase auth parameters
      const urlParams = new URLSearchParams(window.location.search);
      const hasAuthParams = urlParams.has('apiKey') || urlParams.has('oobCode') || 
                          window.location.hash.includes('access_token') ||
                          window.location.search.includes('state=') ||
                          window.location.search.includes('code=');
      
      if (hasAuthParams) {
        console.log('🔄 Firebase auth redirect detected, skipping loading page');
        return false; // Don't show loading page for auth redirects
      }

      // Method 1: Check performance navigation API
      if (performance.navigation && performance.navigation.type === 1) {
        return true;
      }

      // Method 2: Check newer performance API
      if (performance.getEntriesByType) {
        const navigationEntries = performance.getEntriesByType('navigation');
        if (navigationEntries.length > 0 && navigationEntries[0].type === 'reload') {
          return true;
        }
      }

      // Method 3: Check if sessionStorage flag exists (this helps detect fresh loads)
      const wasInitialized = sessionStorage.getItem('app_initialized');
      if (!wasInitialized) {
        sessionStorage.setItem('app_initialized', 'true');
        return true;
      }

      return false;
    };

    const isRefresh = checkIfPageRefresh();
    setIsPageRefresh(isRefresh);

    if (isRefresh) {
      // Show loading for page refresh
      const timer = setTimeout(() => {
        setIsInitialLoading(false);
      }, 2000); // 2 second minimum loading time

      return () => clearTimeout(timer);
    } else {
      // No loading for navigation or auth redirects
      setIsInitialLoading(false);
    }
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

  // Show loading page only on initial page refresh
  if (isInitialLoading && isPageRefresh) {
    return (
      <AuthProvider>
        <DarkModeProvider>
          <AppLoadingPage />
        </DarkModeProvider>
      </AuthProvider>
    );
  }

  const AppContent = () => {
    const location = useLocation();
    const { isAuthProcessing, isLoading, isAuthenticated, isRedirectProcessing } = useAuth();
    const isAdminRoute = location.pathname.startsWith('/admin');

    // ✅ CRITICAL FIX: Auto-close login modal when user becomes authenticated
    useEffect(() => {
      if (isAuthenticated && showLogin) {
        console.log('✅ User authenticated, closing login modal');
        setShowLogin(false);
      }
      if (isAuthenticated && showRegister) {
        console.log('✅ User authenticated, closing register modal');
        setShowRegister(false);
      }
    }, [isAuthenticated]);

    // ✅ CRITICAL FIX: Show auth loading page when processing OAuth redirect OR during initial loading
    // This prevents modal from showing during redirect
    if (isAuthProcessing || isLoading || isRedirectProcessing) {
      return <AuthLoadingPage />;
    }

    return (
      <div className="relative min-h-screen">
        {!isAdminRoute && <EmailVerificationBanner />}

        <ConditionalNavigation
          isProfileOpen={isProfileOpen}
          setIsProfileOpen={setIsProfileOpen}
        />

        <div className={isAdminRoute ? '' : 'lg:ml-20'}>
          <div className={isAdminRoute ? '' : 'lg:pt-20'}>
            <Suspense fallback={<LoadingBar />}>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/login" element={<CrwdCtrlLogin />} />
                <Route path="/admin/login" element={<CrwdCtrlLogin />} />
                <Route path="/register" element={<CrwdCtrlRegister />} />
                <Route path="/verify-email" element={<EmailVerification />} />
                <Route path="/cultural-fest" element={<CulturalFestPage />} />
                <Route path="/tech-fest" element={<TechFestPage />} />
                <Route path="/sports-fest" element={<SportsFestPage />} />
                <Route path="/favorites" element={<FavoritesPage />} />
                <Route path="/view-details/:eventId" element={<ViewDetailsPage />} />
                <Route path="/view-details" element={<ViewDetailsPage />} />
                <Route path="/competitions-view-details/:competitionId" element={<CompetitionsViewDetails />} />
                <Route path="/competitions-view-details" element={<CompetitionsViewDetails />} />
                <Route path="/competition-list/:eventId" element={<CompetitionListPage />} />
                <Route path="/competition-register" element={<CompetitionRegisterPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/edit-profile" element={<EditProfile />} />
                <Route path="/registered-fest" element={<RegisteredFest />} />
                <Route path="/help-center" element={<HelpCenter />} />
                <Route path="/list-your-fest" element={<ListYourFest />} />
                <Route path="/notifications" element={<NotificationsPanel />} />
                <Route path="/connection-status" element={<ConnectionStatus />} />
                <Route path="/terms-and-conditions" element={<TermsAndConditions />} />
                <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                <Route path="/contact-us" element={<ContactUs />} />
                <Route path="/fest/:festId/register" element={<FestRegistration />} />
                <Route path="/competition-registration/:competitionId" element={<CompetitionRegistration />} />
                <Route path="/registration-details/:registrationId" element={<RegistrationDetails />} />
                <Route
                  path="/admin"
                  element={
                    <AdminProtectedRoute>
                      <AdminLayout />
                    </AdminProtectedRoute>
                  }
                >
                  <Route index element={<AdminDashboardPage />} />
                  <Route path="fests" element={<FestsPage />} />
                  <Route path="competitions" element={<CompetitionsPage />} />
                  <Route path="registrations" element={<RegistrationsPage />} />
                </Route>

              </Routes>
            </Suspense>
          </div>
        </div>

        {!isAdminRoute && <ConditionalMobileBottomNav onShowLogin={() => setShowLogin(true)} isProfileOpen={isProfileOpen} onProfileClick={() => setIsProfileOpen(true)} />}

        {!isAdminRoute && (
          <ProfileSidebar
            isOpen={isProfileOpen}
            onClose={() => setIsProfileOpen(false)}
            onShowLogin={() => setShowLogin(true)}
            onShowRegister={() => setShowRegister(true)}
          />
        )}

        {/* Login Modal - Don't show while auth is processing or loading */}
        {showLogin && !isAuthProcessing && !isLoading && !isRedirectProcessing && (
          <div className="fixed inset-0 z-50">
            <CrwdCtrlLogin onClose={handleCloseLogin} onSwitchToRegister={handleSwitchToRegister} />
          </div>
        )}

        {/* Register Modal - Don't show while auth is processing or loading */}
        {showRegister && !isAuthProcessing && !isLoading && !isRedirectProcessing && (
          <div className="fixed inset-0 z-50">
            <CrwdCtrlRegister onClose={handleCloseRegister} onSwitchToLogin={handleSwitchToLogin} />
          </div>
        )}
      </div>
    );
  };

  return (
    <AuthProvider>
      <DarkModeProvider>
        <FavoritesProvider>
          <RegisteredEventsProvider>
            <NotificationsProvider>
              <Router>
                <AppContent />
              </Router>
            </NotificationsProvider>
          </RegisteredEventsProvider>
        </FavoritesProvider>
      </DarkModeProvider>
    </AuthProvider>
  )
}

export default App
