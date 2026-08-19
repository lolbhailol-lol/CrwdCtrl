import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveBrowseBackPath } from '../src/utils/categoryHubRoutes.js';

test('booking and register URLs go to the parent page', () => {
  assert.equal(resolveBrowseBackPath('/events/community-event/touch-grass-5/book'), '/events/community-event/touch-grass-5');
  assert.equal(resolveBrowseBackPath('/sports/run/sunrise-5k/book'), '/sports/run/sunrise-5k');
  assert.equal(resolveBrowseBackPath('/trek/himalayan-trail/book'), '/trek/himalayan-trail');
  assert.equal(resolveBrowseBackPath('/events/abc/register'), '/events/abc');
  assert.equal(resolveBrowseBackPath('/fest/fest123/register'), '/view-details/fest123');
  assert.equal(resolveBrowseBackPath('/competition-list/fest123'), '/view-details/fest123');
});

test('shared detail links go to the category hub', () => {
  assert.equal(resolveBrowseBackPath('/events/community-event/touch-grass-5'), '/events');
  assert.equal(resolveBrowseBackPath('/events/community/pune-runners'), '/events');
  assert.equal(resolveBrowseBackPath('/view-details/mindspark'), '/fests');
  assert.equal(resolveBrowseBackPath('/competitions-view-details/game-of-innovation'), '/fests');
  assert.equal(resolveBrowseBackPath('/sports/run/sunrise-5k'), '/sports');
  assert.equal(resolveBrowseBackPath('/trek/himalayan-trail'), '/treks');
});

test('hubs go home; organizer shells stay unmanaged', () => {
  assert.equal(resolveBrowseBackPath('/events'), '/');
  assert.equal(resolveBrowseBackPath('/fests'), '/');
  assert.equal(resolveBrowseBackPath('/fest-organizer/fests/abc/edit-listing'), null);
  assert.equal(resolveBrowseBackPath('/'), null);
});
