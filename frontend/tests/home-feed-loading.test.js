import test from 'node:test';
import assert from 'node:assert/strict';

import { shouldShowHomeSectionLoading } from '../src/utils/homeFeedLoading.js';

test('home section keeps its loading skeleton until cold-start feeds settle', () => {
  assert.equal(shouldShowHomeSectionLoading({
    itemCount: 0,
    isFestsLoading: true,
    isHomeAuxLoaded: false,
    hasError: false,
  }), true);

  assert.equal(shouldShowHomeSectionLoading({
    itemCount: 0,
    isFestsLoading: false,
    isHomeAuxLoaded: false,
    hasError: false,
  }), true);
});

test('home section never hides real items or retry errors behind a skeleton', () => {
  assert.equal(shouldShowHomeSectionLoading({
    itemCount: 1,
    isFestsLoading: true,
    isHomeAuxLoaded: false,
    hasError: false,
  }), false);

  assert.equal(shouldShowHomeSectionLoading({
    itemCount: 0,
    isFestsLoading: false,
    isHomeAuxLoaded: true,
    hasError: false,
  }), false);

  assert.equal(shouldShowHomeSectionLoading({
    itemCount: 0,
    isFestsLoading: true,
    isHomeAuxLoaded: false,
    hasError: true,
  }), false);
});
