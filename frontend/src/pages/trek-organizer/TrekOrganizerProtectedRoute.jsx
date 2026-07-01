import { Navigate, useLocation } from 'react-router-dom';
import { getTrekOrganizerToken } from '../../utils/trekOrganizerSession';

export default function TrekOrganizerProtectedRoute({ children }) {
    const location = useLocation();
    const token = getTrekOrganizerToken();

    if (!token) {
        return <Navigate to="/trek-organizer/login" replace state={{ from: location.pathname }} />;
    }

    return children;
}
