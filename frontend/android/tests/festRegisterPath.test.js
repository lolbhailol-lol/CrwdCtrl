import test from 'node:test';
import assert from 'node:assert/strict';
import {
  festRegisterPath,
  parseFestRegisterPath,
  shouldDelayAnalyticsPageView,
  isLegacyIdSlugPath,
} from '../src/utils/slugRoutes.js';

test('fest register URL includes the competition slug', () => {
  const fest = { _id: '6a7f1010ed26d983b34e55c2', festName: 'MindSpark 2026' };
  assert.equal(festRegisterPath(fest), '/fest/mindspark-2026/register');
  assert.equal(
    festRegisterPath(fest, { _id: '6a7f15900e5ff505e2a4c4e6', name: 'FOX HUNT' }),
    '/fest/mindspark-2026/register/fox-hunt',
  );
});

test('legacy ?competition= query still parses', () => {
  const fromQuery = parseFestRegisterPath('/fest/mindspark-2026/register?competition=6a7f15900e5ff505e2a4c4e6');
  assert.equal(fromQuery.festId, 'mindspark-2026');
  assert.equal(fromQuery.competitionSlug, '6a7f15900e5ff505e2a4c4e6');

  const fromPath = parseFestRegisterPath('/fest/mindspark-2026/register/hackathon');
  assert.equal(fromPath.festId, 'mindspark-2026');
  assert.equal(fromPath.competitionSlug, 'hackathon');
});

test('GA waits for slug rewrite of fest competition register', () => {
  assert.equal(shouldDelayAnalyticsPageView('/fest/mindspark-2026/register', '?competition=6a7f15900e5ff505e2a4c4e6'), true);
  assert.equal(isLegacyIdSlugPath('/fest/mindspark-2026/register/6a7f15900e5ff505e2a4c4e6'), true);
  assert.equal(shouldDelayAnalyticsPageView('/fest/mindspark-2026/register/hackathon', ''), false);
});
