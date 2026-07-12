import { Route } from 'react-router-dom';
import {
  AdminLayout,
  AdminDashboardPage,
  AdminFestsPage,
  CompetitionsPage,
  RegistrationsPage,
  UserLoginsPage,
  AnalyticsDashboardPage,
  ScannerAccessPage,
  SportsPage,
  TreksPage,
  AdminEventsPage,
  SectionManager,
  PageSectionsPage,
  CouponsPage,
  AdminNotificationsPage,
  AdminProtectedRoute,
  TrekOrganizersPage,
  RunClubOrganizersPage,
} from './lazyPages';
import { adminTheatreRedirect } from './redirects';

export const adminRoutes = (
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
      <Route path="user-logins" element={<UserLoginsPage />} />
      <Route path="analytics" element={<AnalyticsDashboardPage />} />
      <Route path="scanner-access" element={<ScannerAccessPage />} />
      <Route path="sports" element={<SportsPage />} />
      <Route path="treks" element={<TreksPage />} />
      <Route path="trek-organizers" element={<TrekOrganizersPage />} />
      <Route path="run-club-organizers" element={<RunClubOrganizersPage />} />
      <Route path="events" element={<AdminEventsPage />} />
      {adminTheatreRedirect}
      <Route path="sections" element={<SectionManager />} />
      <Route path="page-sections" element={<PageSectionsPage />} />
      <Route path="coupons" element={<CouponsPage />} />
      <Route path="notifications" element={<AdminNotificationsPage />} />
    </Route>
);
