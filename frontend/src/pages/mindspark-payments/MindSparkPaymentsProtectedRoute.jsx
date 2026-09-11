import { Navigate, useLocation } from 'react-router-dom';
import {
    getMindSparkPaymentsToken,
    isMindSparkPaymentsTokenExpired,
    clearMindSparkPaymentsSession,
} from '../../utils/mindsparkPaymentsSession';

export default function MindSparkPaymentsProtectedRoute({ children }) {
    const location = useLocation();
    const token = getMindSparkPaymentsToken();

    if (!token || isMindSparkPaymentsTokenExpired(token)) {
        if (token) clearMindSparkPaymentsSession();
        return <Navigate to="/mindspark-payments/login" replace state={{ from: location.pathname }} />;
    }

    return children;
}
