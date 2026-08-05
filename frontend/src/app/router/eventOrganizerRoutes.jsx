import { Route } from 'react-router-dom';
import {
    EventOrganizerLoginPage,
    EventOrganizerSignupPage,
    EventOrganizerLayout,
    EventOrganizerProtectedRoute,
    EventOrganizerHomePage,
    EventOrganizerDashboardPage,
    EventOrganizerParticipantsPage,
    EventOrganizerScanPage,
    EventOrganizerNotificationsPage,
} from './lazyPages';

export const eventOrganizerRoutes = (
    <>
        <Route path="/event-organizer/login" element={<EventOrganizerLoginPage />} />
        <Route path="/event-organizer/signup" element={<EventOrganizerSignupPage />} />
        <Route
            path="/event-organizer"
            element={
                <EventOrganizerProtectedRoute>
                    <EventOrganizerLayout />
                </EventOrganizerProtectedRoute>
            }
        >
            <Route index element={<EventOrganizerHomePage />} />
            <Route path="events/:eventId" element={<EventOrganizerDashboardPage />} />
            <Route path="events/:eventId/participants" element={<EventOrganizerParticipantsPage />} />
            <Route path="events/:eventId/scan" element={<EventOrganizerScanPage />} />
            <Route path="events/:eventId/notifications" element={<EventOrganizerNotificationsPage />} />
        </Route>
    </>
);
