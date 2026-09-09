import { Navigate, useLocation } from 'react-router-dom';
import {
    getEventOrganizerToken,
    isEventOrganizerTokenExpired,
    clearEventOrganizerSession,
} from '../../utils/eventShowOrganizerSession';

export default function EventOrganizerProtectedRoute({ children }) {
    const location = useLocation();
    const token = getEventOrganizerToken();

    if (!token || isEventOrganizerTokenExpired(token)) {
        if (token) clearEventOrganizerSession();
        return <Navigate to="/event-organizer/login" replace state={{ from: location.pathname }} />;
    }

    return children;
}
