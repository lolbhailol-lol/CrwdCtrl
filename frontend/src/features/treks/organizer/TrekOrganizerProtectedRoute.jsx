import { Navigate, useLocation } from 'react-router-dom';
import {
    getTrekOrganizerToken,
    isTrekOrganizerTokenExpired,
    clearTrekOrganizerSession,
} from '../../utils/trekOrganizerSession';

export default function TrekOrganizerProtectedRoute({ children }) {
    const location = useLocation();
    const token = getTrekOrganizerToken();

    if (!token || isTrekOrganizerTokenExpired(token)) {
        if (token) clearTrekOrganizerSession();
        return <Navigate to="/trek-organizer/login" replace state={{ from: location.pathname }} />;
    }

    return children;
}
