import { Route } from 'react-router-dom';
import {
  OrganizerProtectedRoute,
  OrganizerFestListPage,
  OrganizerCheckinPage,
  OrganizerScannerLoginPage,
  OrganizerScanPage,
  OrganizerEntryPage,
} from './lazyPages';

export const organizerRoutes = (
  <>
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
  </>
);
