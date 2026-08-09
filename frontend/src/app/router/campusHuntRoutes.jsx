import { Route } from 'react-router-dom';
import { isCampusHuntEnabled } from '../../features/campus-hunt/config';
import {
  CampusHuntLandingPage,
  CampusHuntPlayPage,
  CampusHuntTeamLoginPage,
  CampusHuntLeaderboardPage,
  VolunteerLoginPage,
  VolunteerCheckpointPage,
  CampusHuntAdminDashboard,
  CampusHuntEventControl,
} from './lazyPages';

/**
 * Campus Hunt routes — only registered when VITE_ENABLE_CAMPUS_HUNT=true.
 * Admin child routes are composed into adminRoutes separately when enabled.
 * Leaderboard / team login registered before :slug catch-alls.
 */
export const campusHuntRoutes = isCampusHuntEnabled() ? (
  <>
    <Route path="/campus-hunt/leaderboard" element={<CampusHuntLeaderboardPage />} />
    <Route path="/campus-hunt/:slug/team/:teamCode" element={<CampusHuntTeamLoginPage />} />
    <Route path="/campus-hunt/:slug" element={<CampusHuntLandingPage />} />
    <Route path="/campus-hunt/:slug/play" element={<CampusHuntPlayPage />} />
    <Route path="/campus-hunt-volunteer/login" element={<VolunteerLoginPage />} />
    <Route path="/campus-hunt-volunteer/checkpoint" element={<VolunteerCheckpointPage />} />
  </>
) : null;

export function campusHuntAdminChildRoutes() {
  if (!isCampusHuntEnabled()) return null;
  return (
    <>
      <Route path="campus-hunt" element={<CampusHuntAdminDashboard />} />
      <Route path="campus-hunt/:eventId" element={<CampusHuntEventControl />} />
    </>
  );
}
