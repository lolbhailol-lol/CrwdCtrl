const test = require('node:test');
const assert = require('node:assert/strict');

const { layoutCoverUrl, primaryCoverUrl, sanitizeCoverImages } = require('../src/utils/sanitizeCoverImages');

const covers = sanitizeCoverImages({
  portrait: 'https://cdn.example/portrait.jpg',
  hero: 'https://cdn.example/hero.jpg',
  wide: 'https://cdn.example/wide.jpg',
});
const legacyPortrait = 'https://cdn.example/portrait.jpg';

test('legacy coverImage stays portrait-first for cards', () => {
  assert.equal(primaryCoverUrl(covers, legacyPortrait), 'https://cdn.example/portrait.jpg');
});

test('hero layout prefers coverImages.hero over portrait coverImage', () => {
  assert.equal(
    layoutCoverUrl(covers, 'hero', legacyPortrait),
    'https://cdn.example/hero.jpg',
  );
});

test('wide layout prefers coverImages.wide over portrait coverImage', () => {
  assert.equal(
    layoutCoverUrl(covers, 'wide', legacyPortrait),
    'https://cdn.example/wide.jpg',
  );
});

test('hero falls back to legacy only when no wide/hero crop exists', () => {
  assert.equal(
    layoutCoverUrl({ portrait: 'https://cdn.example/portrait.jpg' }, 'hero', legacyPortrait),
    legacyPortrait,
  );
});
