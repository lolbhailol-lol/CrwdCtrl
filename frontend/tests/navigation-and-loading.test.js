import test from 'node:test';
import assert from 'node:assert/strict';

import {
  competitionRegistrationPath,
  entityMatchesRouteParam,
  trekPath,
} from '../src/utils/slugRoutes.js';
import { classifyDetailLoadError } from '../src/utils/detailPageLoad.js';

test('public detail routes prefer stable persisted slugs', () => {
  assert.equal(trekPath({ _id: 'abc', slug: 'kalsubai-night-trek' }), '/trek/kalsubai-night-trek');
  assert.equal(
    competitionRegistrationPath({ _id: 'abc', name: 'Code Sprint' }),
    '/competition-registration/code-sprint',
  );
});

test('route matching accepts ids, persisted slugs, and previous slugs', () => {
  const entity = {
    _id: '507f1f77bcf86cd799439011',
    slug: 'current-name',
    previousSlugs: ['old-name'],
  };

  assert.equal(entityMatchesRouteParam(entity, entity._id), true);
  assert.equal(entityMatchesRouteParam(entity, 'current-name'), true);
  assert.equal(entityMatchesRouteParam(entity, 'old-name'), true);
  assert.equal(entityMatchesRouteParam(entity, 'another-name'), false);
});

test('detail loading errors distinguish missing records from retryable failures', () => {
  assert.equal(classifyDetailLoadError({ status: 404 }), 'not_found');
  assert.equal(classifyDetailLoadError({ isNetworkError: true }), 'network');
  assert.equal(classifyDetailLoadError({ status: 503 }), 'server');
  assert.equal(classifyDetailLoadError(new Error('Unknown failure')), 'failed');
});
