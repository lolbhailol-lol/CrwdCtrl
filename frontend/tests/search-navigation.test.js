import test from 'node:test';
import assert from 'node:assert/strict';
import { navigateToSearchResult } from '../src/utils/searchNavigation.js';

const CASES = [
  ['fest', 'College Fest', '/view-details/college-fest'],
  ['competition', 'Robo Race', '/competitions-view-details/robo-race'],
  ['trek', 'Hill Trek', '/trek/abc123'],
  ['community', 'Hikers Club', '/treks/community/hikers-club'],
  ['runclub', 'City Runners', '/sports/run-club/city-runners'],
  ['sport', 'Sunday 5K', '/sports/run/run-5k'],
  ['events', 'Comedy Night', '/events/comedy-night'],
];

test('every unified search result type opens its matching detail route', () => {
  for (const [resultType, title, expectedPath] of CASES) {
    const calls = [];
    const common = { resultType, id: 'abc123', title };
    if (resultType === 'community') common.slug = 'hikers-club';
    if (resultType === 'sport') common.slug = 'run-5k';

    navigateToSearchResult((...args) => calls.push(args), common);

    assert.equal(calls.length, 1, `${resultType} should navigate once`);
    assert.equal(calls[0][0], expectedPath, `${resultType} should use its detail route`);
  }
});

test('event-hub communities and activities retain event routes', () => {
  const calls = [];
  const navigate = (...args) => calls.push(args);

  navigateToSearchResult(navigate, {
    resultType: 'runclub', id: 'club1', title: 'Event Community', listingHub: 'events',
  });
  navigateToSearchResult(navigate, {
    resultType: 'sport', id: 'run1', title: 'Community Meetup', listingHub: 'events',
  });

  assert.equal(calls[0][0], '/events/community/event-community');
  assert.equal(calls[1][0], '/events/community-event/run1');
});
