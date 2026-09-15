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
    EventCommunityOrganizerLayout,
    EventCommunityOrganizerHomePage,
    EventCommunityOrganizerDashboardPage,
    EventCommunityOrganizerNotificationsPage,
} from './lazyPages';

const eventCommunityOrganizerRoutes = (
    <>
        <Route path="/event-community-organizer/login" element={<RunClubOrganizerLoginPage />} />
        <Route path="/event-community-organizer/signup" element={<RunClubOrganizerSignupPage />} />
        <Route
            path="/event-community-organizer"
            element={
                <RunClubOrganizerProtectedRoute forcedHub="events">
                    <EventCommunityOrganizerLayout />
                </RunClubOrganizerProtectedRoute>
            }
        >
            <Route index element={<EventCommunityOrganizerHomePage />} />
            <Route path="events/:eventId" element={<EventCommunityOrganizerDashboardPage />} />
            <Route path="events/:eventId/participants" element={<RunClubOrganizerParticipantsPage />} />
            <Route path="events/:eventId/scan" element={<RunClubOrganizerScanPage />} />
            <Route path="events/:eventId/notifications" element={<EventCommunityOrganizerNotificationsPage />} />
        </Route>
    </>
);

export const runClubOrganizerRoutes = (
    <>
        {eventCommunityOrganizerRoutes}
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
