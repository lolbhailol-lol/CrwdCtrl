import { Route } from 'react-router-dom';
import {
  AdminLayout,
  AdminDashboardPage,
  AdminFestsPage,
  CompetitionsPage,
  RegistrationsPage,
  UserLoginsPage,
  UserActivityPage,
  AnalyticsDashboardPage,
  PaymentsSettlementPage,
  ScannerAccessPage,
  SportsPage,
  TreksPage,
  AdminEventsPage,
  SectionManager,
  PageSectionsPage,
  AppCopyPage,
  CouponsPage,
  AdminNotificationsPage,
  AdminProtectedRoute,
  TrekOrganizersPage,
  RunClubOrganizersPage,
  EventCommunityOrganizersPage,
  FestOrganizersPage,
  EventOrganizersPage,
} from './lazyPages';
import { adminTheatreRedirect } from './redirects';
import { campusHuntAdminChildRoutes } from './campusHuntRoutes';

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
      <Route path="user-activity" element={<UserActivityPage />} />
      <Route path="analytics" element={<AnalyticsDashboardPage />} />
      <Route path="payments" element={<PaymentsSettlementPage />} />
      <Route path="scanner-access" element={<ScannerAccessPage />} />
      <Route path="sports" element={<SportsPage />} />
      <Route path="treks" element={<TreksPage />} />
      <Route path="trek-organizers" element={<TrekOrganizersPage />} />
      <Route path="fest-organizers" element={<FestOrganizersPage />} />
      <Route path="run-club-organizers" element={<RunClubOrganizersPage />} />
      <Route path="event-community-organizers" element={<EventCommunityOrganizersPage />} />
      <Route path="event-organizers" element={<EventOrganizersPage />} />
      <Route path="events" element={<AdminEventsPage />} />
      {adminTheatreRedirect}
      <Route path="sections" element={<SectionManager />} />
      <Route path="page-sections" element={<PageSectionsPage />} />
      <Route path="app-copy" element={<AppCopyPage />} />
      <Route path="coupons" element={<CouponsPage />} />
      <Route path="notifications" element={<AdminNotificationsPage />} />
      {campusHuntAdminChildRoutes()}
    </Route>
);
