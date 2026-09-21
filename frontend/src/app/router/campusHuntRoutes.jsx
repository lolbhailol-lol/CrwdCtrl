import { Route } from 'react-router-dom';
import { isCampusHuntEnabled, isCampusHuntAdminEnabled } from '../../features/campus-hunt/config';
import {
  CampusHuntLandingPage,
  CampusHuntEnterPage,
  CampusHuntPlayPage,
  CampusHuntGridPage,
  CampusHuntTeamLoginPage,
  CampusHuntLoginHubPage,
  CampusHuntLeaderboardPage,
  VolunteerLoginPage,
  VolunteerCheckpointPage,
  CampusHuntAdminDashboard,
  CampusHuntEventControl,
} from './lazyPages';
// Eager (not lazy): airplane-mode Hunt must not hang on Suspense waiting for /assets/*.js
import OfflineHuntLandingPage from '../../features/campus-hunt/offline/pages/OfflineHuntLandingPage';
import OfflineHuntLoginPage from '../../features/campus-hunt/offline/pages/OfflineHuntLoginPage';
import OfflineHuntTeamPage from '../../features/campus-hunt/offline/pages/OfflineHuntTeamPage';
import OfflineHuntRoundsPage from '../../features/campus-hunt/offline/pages/OfflineHuntRoundsPage';
import OfflineHuntPlayPage from '../../features/campus-hunt/offline/pages/OfflineHuntPlayPage';
import OfflineHuntInstallPage from '../../features/campus-hunt/offline/pages/OfflineHuntInstallPage';

/**
 * Campus Hunt player routes — only when VITE_ENABLE_CAMPUS_HUNT=true.
 * Admin child routes stay available so the control room is never hidden by env.
 */
export const campusHuntRoutes = isCampusHuntEnabled() ? (
  <>
    <Route path="/campus-hunt/offline/i/:token" element={<OfflineHuntInstallPage />} />
    <Route path="/campus-hunt/offline" element={<OfflineHuntLandingPage />} />
    <Route path="/campus-hunt/offline/login" element={<OfflineHuntLoginPage />} />
    <Route path="/campus-hunt/offline/team" element={<OfflineHuntTeamPage />} />
    <Route path="/campus-hunt/offline/rounds" element={<OfflineHuntRoundsPage />} />
    <Route path="/campus-hunt/offline/play" element={<OfflineHuntPlayPage />} />
    <Route path="/campus-hunt/leaderboard" element={<CampusHuntLeaderboardPage />} />
    <Route path="/campus-hunt/enter" element={<CampusHuntEnterPage />} />
    <Route path="/campus-hunt/grid" element={<CampusHuntGridPage />} />
    <Route path="/campus-hunt/:slug/team/:teamCode" element={<CampusHuntTeamLoginPage />} />
    <Route path="/campus-hunt/:slug/login" element={<CampusHuntLoginHubPage />} />
    <Route path="/campus-hunt/:slug" element={<CampusHuntLandingPage />} />
    <Route path="/campus-hunt/:slug/play" element={<CampusHuntPlayPage />} />
    <Route path="/campus-hunt-volunteer/login" element={<VolunteerLoginPage />} />
    <Route path="/campus-hunt-volunteer/checkpoint" element={<VolunteerCheckpointPage />} />
  </>
) : null;

export function campusHuntAdminChildRoutes() {
  if (!isCampusHuntAdminEnabled()) return null;
  return (
    <>
      <Route path="campus-hunt" element={<CampusHuntAdminDashboard />} />
      <Route path="campus-hunt/:eventId" element={<CampusHuntEventControl />} />
    </>
  );
}
