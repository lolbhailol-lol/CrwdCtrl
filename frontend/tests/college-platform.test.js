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
