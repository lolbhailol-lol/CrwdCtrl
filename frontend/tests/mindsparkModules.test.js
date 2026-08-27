import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveMindSparkModule,
  normalizeMindSparkModule,
} from '../src/features/fests/mindspark/modules.js';
import { isCompetitionRegistrationClosed } from '../src/utils/teamSize.js';

test('stored module wins over an unknown event name', () => {
  assert.equal(
    resolveMindSparkModule({ name: 'Codifica Combined', module: 'CODIFICA' }),
    'CODIFICA',
  );
  assert.equal(normalizeMindSparkModule('codifica'), 'CODIFICA');
});

test('name map still groups Fox Hunt when module is empty', () => {
  assert.equal(resolveMindSparkModule({ name: 'FOX HUNT' }), 'VOLTUS');
  assert.equal(resolveMindSparkModule({ name: 'Hackathon' }), 'HACKATHON');
});

test('unknown name without module is Other', () => {
  assert.equal(resolveMindSparkModule({ name: 'Brand New Event 2026' }), 'OTHER');
});

test('registration_closed is closed even when slots remain', () => {
  assert.equal(isCompetitionRegistrationClosed({
    slotsAllotted: 50,
    slotsLeft: 12,
    registration: { status: 'registration_closed' },
  }), true);
  assert.equal(isCompetitionRegistrationClosed({
    registration: { status: 'not_started' },
  }), false);
  assert.equal(isCompetitionRegistrationClosed({ registrationsOpen: false }), true);
});
