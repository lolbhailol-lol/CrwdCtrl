import { Navigate, useLocation } from 'react-router-dom';
import { getFestOrganizerToken } from '../../utils/festOrganizerSession';

export default function FestOrganizerProtectedRoute({ children }) {
    const location = useLocation();
    const token = getFestOrganizerToken();
    if (!token) {
        return <Navigate to="/fest-organizer/login" replace state={{ from: location.pathname }} />;
    }
    return children;
}
