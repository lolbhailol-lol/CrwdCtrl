import { Navigate, useLocation } from 'react-router-dom';
import {
    clearRunClubOrganizerSession,
    getRunClubOrganizerToken,
    isRunClubOrganizerTokenExpired,
} from '../../utils/runClubOrganizerSession';

export default function RunClubOrganizerProtectedRoute({ children }) {
    const location = useLocation();
    const token = getRunClubOrganizerToken();

    if (!token || isRunClubOrganizerTokenExpired(token)) {
        if (token) clearRunClubOrganizerSession();
        return <Navigate to="/run-club-organizer/login" replace state={{ from: location.pathname }} />;
    }

    return children;
}
