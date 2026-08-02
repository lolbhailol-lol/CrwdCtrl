import { Route } from 'react-router-dom';
import {
    FestOrganizerLoginPage,
    FestOrganizerSignupPage,
    FestOrganizerLayout,
    FestOrganizerProtectedRoute,
    FestOrganizerHomePage,
    FestOrganizerDashboardPage,
    FestOrganizerParticipantsPage,
    FestOrganizerScanPage,
    FestOrganizerNotificationsPage,
    FestOrganizerCompetitionsPage,
    FestOrganizerRevenuePage,
    FestOrganizerInfoPage,
    FestOrganizerLeadsPage,
} from './lazyPages';

export const festOrganizerRoutes = (
    <>
        <Route path="/fest-organizer/login" element={<FestOrganizerLoginPage />} />
        <Route path="/fest-organizer/signup" element={<FestOrganizerSignupPage />} />
        <Route
            path="/fest-organizer"
            element={
                <FestOrganizerProtectedRoute>
                    <FestOrganizerLayout />
                </FestOrganizerProtectedRoute>
            }
        >
            <Route index element={<FestOrganizerHomePage />} />
            <Route path="fests/:festId" element={<FestOrganizerDashboardPage />} />
            <Route path="fests/:festId/leads" element={<FestOrganizerLeadsPage />} />
            <Route path="fests/:festId/competitions" element={<FestOrganizerCompetitionsPage />} />
            <Route path="fests/:festId/participants" element={<FestOrganizerParticipantsPage />} />
            <Route path="fests/:festId/scan" element={<FestOrganizerScanPage />} />
            <Route path="fests/:festId/revenue" element={<FestOrganizerRevenuePage />} />
            <Route path="fests/:festId/notifications" element={<FestOrganizerNotificationsPage />} />
            <Route path="fests/:festId/info" element={<FestOrganizerInfoPage />} />
        </Route>
    </>
);
