import { Navigate, useLocation } from 'react-router-dom';
import {
    getFestOrganizerToken,
    isFestOrganizerTokenExpired,
    clearFestOrganizerSession,
} from '../../utils/festOrganizerSession';

export default function FestOrganizerProtectedRoute({ children }) {
    const location = useLocation();
    const token = getFestOrganizerToken();

    if (!token || isFestOrganizerTokenExpired(token)) {
        // Eject stale tokens client-side so the portal doesn't hit the API
        // and flash a burst of 401s before the login redirect.
        if (token) clearFestOrganizerSession();
        return <Navigate to="/fest-organizer/login" replace state={{ from: location.pathname }} />;
    }

    return children;
}
