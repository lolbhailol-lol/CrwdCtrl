import { Route } from 'react-router-dom';
import { GarbaDashboardPage, EventOrganizerProtectedRoute } from './lazyPages';

export const garbaRoutes = (
    <>
        <Route
            path="/garba-dashboard"
            element={
                <EventOrganizerProtectedRoute>
                    <GarbaDashboardPage />
                </EventOrganizerProtectedRoute>
            }
        />
    </>
);
