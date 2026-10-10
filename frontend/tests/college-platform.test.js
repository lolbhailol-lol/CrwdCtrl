import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('college platform owns the home, games, rankings, pass, invite, and profile routes', () => {
  const routes = read('../src/app/router/publicRoutes.jsx');
  for (const route of ['<CollegeHomePage />', '/games/:id/register', '/game-pass/:id', '/game-invite/:token', '/rankings', '/host-a-game', '<CrwdCtrlIdPage />']) {
    assert.match(routes, new RegExp(route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.doesNotMatch(routes, /path="\/" element={<Dashboard/);
});

test('consumer navigation and unified search no longer expose Treks', () => {
  const navbar = read('../src/components/layout/Navbar.jsx');
  const searchController = read('../../backend/src/controllers/searchKeywordsController.js');
  assert.doesNotMatch(navbar.split('const NAV_ITEMS =')[1].split('];')[0], /Treks|\/treks/);
  assert.doesNotMatch(searchController, /result\(x, 'trek'|result\(x, 'community'/);
});

test('college platform includes dark theme and offline ranking cache states', () => {
  const page = read('../src/features/college-platform/CollegePlatform.jsx');
  const styles = read('../src/features/college-platform/collegePlatform.css');
  const api = read('../src/features/college-platform/api.js');
  assert.match(styles, /college-page--dark/);
  assert.match(page, /updates after connectivity returns|cached/i);
  assert.match(api, /crwdctrl_college_rankings_v1/);
});

test('completed Campus Hunt games expose their event leaderboard', () => {
  const page = read('../src/features/college-platform/CollegePlatform.jsx');
  const leaderboard = read('../src/features/campus-hunt/pages/CampusHuntLeaderboardPage.jsx');
  const portalThemes = read('../src/utils/organizerPortalPaths.js');
  const controller = read('../../backend/src/modules/college-platform/controller.js');
  const backfill = read('../../backend/scripts/backfill-campus-hunt-games.js');
  assert.match(page, /<h2>Completed<\/h2>/);
  assert.match(page, /View leaderboard/);
  assert.match(page, /fetchCampusHuntColleges/);
  assert.match(leaderboard, /searchParams\.get\('event'\)/);
  assert.match(portalThemes, /path === '\/campus-hunt\/leaderboard'\) return false/);
  assert.match(controller, /\['published', 'completed'\]/);
  assert.match(backfill, /coep-campus-hunt/);
});

test('host game requests capture club details and remain actionable in admin', () => {
  const page = read('../src/features/college-platform/CollegePlatform.jsx');
  const admin = read('../src/pages/admin/CollegePlatformPage.jsx');
  const controller = read('../../backend/src/modules/college-platform/controller.js');
  const models = read('../../backend/src/modules/college-platform/models/index.js');
  for (const field of ['collegeName', 'clubName', 'gameName', 'gameIdea', 'expectedTeams']) {
    assert.match(page, new RegExp(field));
    assert.match(models, new RegExp(field));
  }
  assert.match(controller, /HostGameRequest\.create/);
  assert.match(admin, /Host requests/);
  assert.match(admin, />Approve</);
  assert.match(admin, />Reject</);
});

test('verified hosts get a clean preset workspace and scoped operations', () => {
  const host = read('../src/features/college-platform/CampusHuntHostPage.jsx');
  const api = read('../src/features/college-platform/api.js');
  const routes = read('../src/app/router/publicRoutes.jsx');
  const control = read('../src/features/campus-hunt/admin/CampusHuntEventControl.jsx');
  const workflow = read('../src/features/campus-hunt/admin/AdminWorkflowNav.jsx');
  const guard = read('../src/features/campus-hunt/admin/CampusHuntAdminGuard.jsx');
  const hostRoutes = read('../../backend/src/modules/college-platform/routes.js');
  const huntAuth = read('../../backend/src/modules/campus-hunt/middleware/adminAuth.js');
  for (const copy of ['Places', 'Clues', 'Teams', 'Links', 'Live']) {
    assert.match(workflow, new RegExp(copy));
  }
  assert.match(control, /AdminWorkflowNav/);
  for (const copy of ['Campus Hunt', 'Offline pass check-in', 'Delete draft']) assert.match(host, new RegExp(copy));
  assert.match(api, /check-in-pack\/activate/);
  assert.match(host, /1\. Close registration/);
  assert.match(host, /3\. Start Hunt/);
  assert.match(host, /Complete &amp; finalize/);
  assert.doesNotMatch(host, /Emergency operator and volunteers|Announcements|Edit draft \/ submit revision|Submit setup for approval/);
  assert.doesNotMatch(host, /Campus Hunt admin password|admin credentials/i);
  assert.match(api, /college\.id \|\| college\._id/);
  assert.match(host, /Type your college name/);
  assert.match(host, /Create from start/);
  assert.match(host, /Open Campus Hunt control/);
  assert.match(api, /method: 'DELETE'/);
  assert.match(api, /control-session/);
  assert.match(hostRoutes, /control-session/);
  assert.match(read('../../backend/src/modules/college-platform/hostController.js'), /allowIncomplete: true/);
  assert.match(guard, /campus_hunt_host/);
  assert.match(huntAuth, /Hunt access is limited to your event/);
  assert.doesNotMatch(host, /getHostedHuntSetup/);
  assert.doesNotMatch(host, /Event permission/);
  assert.doesNotMatch(host, /Your college email proves affiliation/);
});

test('host workspace owns its mobile chrome without stacked navigation', () => {
  const app = read('../src/App.jsx');
  const styles = read('../src/features/college-platform/campusHuntHost.css');
  assert.match(app, /isCampusHuntRoute = location\.pathname\.startsWith\('\/host-a-game'\)/);
  assert.match(styles, /padding-bottom: calc\(28px \+ env\(safe-area-inset-bottom, 0px\)\)/);
  assert.match(styles, /bottom: max\(8px, env\(safe-area-inset-bottom, 0px\)\)/);
});

test('games preview includes the MIT-WPU coming-soon Campus Hunt', () => {
  const page = read('../src/features/college-platform/CollegePlatform.jsx');
  assert.match(page, /Campus Hunt: MIT-WPU/);
  assert.match(page, /40/);
  assert.match(page, /Date coming soon/);
  assert.match(page, /Entry fee TBA/);
  assert.match(page, /Pre-register your team name/);
});

test('game pass provides explicit online and offline Campus Hunt handoff', () => {
  const platform = read('../src/features/college-platform/CollegePlatform.jsx');
  const controller = read('../../backend/src/modules/college-platform/controller.js');
  assert.match(platform, /Play online/);
  assert.match(platform, /Install offline pack/);
  assert.match(controller, /CampusHuntTeam\.findById/);
  assert.match(controller, /CampusHuntOfflineInstall\.findOne/);
  assert.match(controller, /offlineInstallPath/);
});

test('participants can receive announcements and request moderated support', () => {
  const page = read('../src/features/college-platform/CollegePlatform.jsx');
  const controller = read('../../backend/src/modules/college-platform/controller.js');
  for (const copy of ['Host announcements', 'Request full refund', 'Dispute result within 48 hours', 'Report an issue']) {
    assert.match(page, new RegExp(copy));
  }
  assert.match(controller, /GameAnnouncement\.find/);
  assert.match(controller, /GameResultDispute\.find/);
});

test('admin moderation covers provisioning, emergency, refunds, disputes, and host suspension', () => {
  const admin = read('../src/pages/admin/CollegePlatformPage.jsx');
  for (const copy of ['Approve 1 year', 'Approve and provision', 'Emergency stop', 'Full refund']) {
    assert.match(admin, new RegExp(copy));
  }
  assert.match(admin, /Resolve \+ suspend host/);
});
