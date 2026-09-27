const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getFestPlugin,
  shouldAutoConfirmRegistration,
  defaultFestPlugin,
} = require('../src/modules/fest/plugins');

test('Kshitij requires organizer approval for free registrations', () => {
  const plugin = getFestPlugin({
    slug: 'kshitij-pune-multicity-event-2026',
    festName: 'Kshitij Pune Multicity Event 2026',
  });

  assert.equal(plugin.id, 'kshitij');
  assert.equal(plugin.manualApprovalRequired, true);
  assert.equal(shouldAutoConfirmRegistration(plugin, 'free'), false);
  assert.equal(shouldAutoConfirmRegistration(plugin, 'paid'), false);
});

test('standard free registrations retain their existing auto-confirm behavior', () => {
  assert.equal(shouldAutoConfirmRegistration(defaultFestPlugin, 'free'), true);
});
