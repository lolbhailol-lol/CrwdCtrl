import test from 'node:test';
import assert from 'node:assert/strict';

import { toCardText } from '../src/utils/cardText.js';

test('preserves IIT as an uppercase institute acronym on cards', () => {
  assert.equal(toCardText('IIT Bombay'), 'IIT Bombay');
  assert.equal(toCardText('iit bombay'), 'IIT Bombay');
});

test('continues converting ordinary all-caps card labels to title case', () => {
  assert.equal(toCardText('TECHFEST'), 'Techfest');
});
