import test from 'node:test';
import assert from 'node:assert/strict';
import { competitionRegistrationUrl } from '../src/utils/competitionRegistrationUrl.js';

test('fest-day competition QR opens the direct registration route', () => {
  assert.equal(
    competitionRegistrationUrl('fest id', { _id: 'competition/id', name: 'Robowars' }),
    'https://www.crwdctrl.in/fest/fest%20id/register/competition%2Fid?festDay=1',
  );
});

test('fest-day competition QR falls back to the public detail page without ids', () => {
  assert.equal(
    competitionRegistrationUrl('', { name: 'Line Follower' }),
    'https://www.crwdctrl.in/competitions-view-details/line-follower',
  );
});
