import { Navigate } from 'react-router-dom';
import { getFestScannerSession } from '../../utils/festScannerSession';

/** /organizer → scanner if logged in, else login page */
export default function OrganizerEntryPage() {
  const session = getFestScannerSession();
  if (session?.festId || session?.trekId || session?.sportEventId) {
    return <Navigate to="/organizer/scan" replace />;
  }
  return <Navigate to="/organizer/login" replace />;
}
