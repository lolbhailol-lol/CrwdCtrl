import { Route } from 'react-router-dom';
import {
    TrekOrganizerLoginPage,
    TrekOrganizerSignupPage,
    TrekOrganizerLayout,
    TrekOrganizerProtectedRoute,
    TrekOrganizerHomePage,
    TrekOrganizerDashboardPage,
    TrekOrganizerParticipantsPage,
    TrekOrganizerScanPage,
    TrekOrganizerNotificationsPage,
} from './lazyPages';

export const trekOrganizerRoutes = (
    <>
        <Route path="/trek-organizer/login" element={<TrekOrganizerLoginPage />} />
        <Route path="/trek-organizer/signup" element={<TrekOrganizerSignupPage />} />
        <Route
            path="/trek-organizer"
            element={
                <TrekOrganizerProtectedRoute>
                    <TrekOrganizerLayout />
                </TrekOrganizerProtectedRoute>
            }
        >
            <Route index element={<TrekOrganizerHomePage />} />
            <Route path="treks/:trekId" element={<TrekOrganizerDashboardPage />} />
            <Route path="treks/:trekId/participants" element={<TrekOrganizerParticipantsPage />} />
            <Route path="treks/:trekId/scan" element={<TrekOrganizerScanPage />} />
            <Route path="treks/:trekId/notifications" element={<TrekOrganizerNotificationsPage />} />
        </Route>
    </>
);
