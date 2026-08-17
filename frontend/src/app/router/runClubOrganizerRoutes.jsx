import { Route } from 'react-router-dom';
import {
    RunClubOrganizerLoginPage,
    RunClubOrganizerSignupPage,
    RunClubOrganizerProtectedRoute,
    RunClubOrganizerParticipantsPage,
    RunClubOrganizerScanPage,
    OrganizerLayoutGate,
    OrganizerHomeGate,
    OrganizerDashboardGate,
    OrganizerNotificationsGate,
} from './lazyPages';

export const runClubOrganizerRoutes = (
    <>
        <Route path="/run-club-organizer/login" element={<RunClubOrganizerLoginPage />} />
        <Route path="/run-club-organizer/signup" element={<RunClubOrganizerSignupPage />} />
        <Route
            path="/run-club-organizer"
            element={
                <RunClubOrganizerProtectedRoute>
                    <OrganizerLayoutGate />
                </RunClubOrganizerProtectedRoute>
            }
        >
            <Route index element={<OrganizerHomeGate />} />
            <Route path="events/:eventId" element={<OrganizerDashboardGate />} />
            <Route path="events/:eventId/participants" element={<RunClubOrganizerParticipantsPage />} />
            <Route path="events/:eventId/scan" element={<RunClubOrganizerScanPage />} />
            <Route path="events/:eventId/notifications" element={<OrganizerNotificationsGate />} />
        </Route>
    </>
);
