import { Navigate } from 'react-router-dom';
import { CAMPUS_HUNT_PATHS } from '../../config';
import { useOfflineHuntSession } from '../useOfflineHuntSession';

/** Team hub removed — go straight to play. */
export default function OfflineHuntTeamPage() {
  const { bundle, session, loading } = useOfflineHuntSession();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b0c0d] text-white/60">
        Loading…
      </div>
    );
  }

  if (!bundle || !session) {
    return <Navigate to={CAMPUS_HUNT_PATHS.offlineLogin} replace />;
  }

  return <Navigate to={CAMPUS_HUNT_PATHS.offlinePlay} replace />;
}
