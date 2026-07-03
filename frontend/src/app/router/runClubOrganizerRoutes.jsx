import { Route } from 'react-router-dom';
import {
    RunClubOrganizerLoginPage,
    RunClubOrganizerLayout,
    RunClubOrganizerProtectedRoute,
    RunClubOrganizerHomePage,
    RunClubOrganizerDashboardPage,
    RunClubOrganizerParticipantsPage,
    RunClubOrganizerScanPage,
    RunClubOrganizerNotificationsPage,
} from './lazyPages';

export const runClubOrganizerRoutes = (
    <>
        <Route path="/run-club-organizer/login" element={<RunClubOrganizerLoginPage />} />
        <Route
            path="/run-club-organizer"
            element={
                <RunClubOrganizerProtectedRoute>
                    <RunClubOrganizerLayout />
                </RunClubOrganizerProtectedRoute>
            }
        >
            <Route index element={<RunClubOrganizerHomePage />} />
            <Route path="events/:eventId" element={<RunClubOrganizerDashboardPage />} />
            <Route path="events/:eventId/participants" element={<RunClubOrganizerParticipantsPage />} />
            <Route path="events/:eventId/scan" element={<RunClubOrganizerScanPage />} />
            <Route path="events/:eventId/notifications" element={<RunClubOrganizerNotificationsPage />} />
        </Route>
    </>
);
