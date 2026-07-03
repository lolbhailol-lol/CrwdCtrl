import { Navigate, useLocation } from 'react-router-dom';
import { getRunClubOrganizerToken } from '../../utils/runClubOrganizerSession';

export default function RunClubOrganizerProtectedRoute({ children }) {
    const location = useLocation();
    const token = getRunClubOrganizerToken();

    if (!token) {
        return <Navigate to="/run-club-organizer/login" replace state={{ from: location.pathname }} />;
    }

    return children;
}
