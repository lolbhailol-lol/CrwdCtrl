import test from 'node:test';
import assert from 'node:assert/strict';
import { mergePublicConfig, DEFAULT_PUBLIC_CONFIG } from '../src/constants/publicAppConfig.js';
import { buildCloudinarySrcSet, optimizeImageUrl } from '../src/utils/imageOptimizer.js';

test('mergePublicConfig preserves defaults when payload is empty', () => {
  const config = mergePublicConfig(null);
  assert.equal(config.labels.home.ongoing, DEFAULT_PUBLIC_CONFIG.labels.home.ongoing);
  assert.equal(config.announcement.enabled, false);
  assert.equal(config.emptyStates.fests.none, DEFAULT_PUBLIC_CONFIG.emptyStates.fests.none);
});

test('mergePublicConfig ignores unknown keys and empty strings', () => {
  const config = mergePublicConfig({
    labels: { home: { ongoing: 'Live now', secret: 'nope' }, extra: { x: 'y' } },
    emptyStates: { fests: { none: '   ' } },
    mongoUri: 'mongodb://secret',
  });
  assert.equal(config.labels.home.ongoing, 'Live now');
  assert.equal(config.labels.home.secret, undefined);
  assert.equal(config.labels.extra, undefined);
  assert.equal(config.emptyStates.fests.none, DEFAULT_PUBLIC_CONFIG.emptyStates.fests.none);
  assert.equal(config.mongoUri, undefined);
});

test('optimizeImageUrl and srcset only rewrite Cloudinary URLs', () => {
  const other = 'https://cdn.example/photo.jpg';
  assert.equal(optimizeImageUrl(other, 'hero'), other);
  assert.equal(buildCloudinarySrcSet(other, 'hero'), undefined);

  const cloud = 'https://res.cloudinary.com/demo/image/upload/v1/cover.jpg';
  const src = optimizeImageUrl(cloud, 'hero');
  assert.match(src, /c_fill,w_960,h_448/);
  assert.match(src, /dpr_2\.0/);

  const srcset = buildCloudinarySrcSet(cloud, 'hero');
  assert.ok(srcset.includes('480w'));
  assert.ok(srcset.includes('960w'));
  assert.ok(!srcset.includes('dpr_'));
});
