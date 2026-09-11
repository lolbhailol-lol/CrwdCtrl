const test = require('node:test');
const assert = require('node:assert/strict');
const { assertCapacityCounts } = require('../../src/modules/campus-hunt/services/capacityService');

test('capacity accepts teams while both event and route have room', () => {
  assert.doesNotThrow(() => assertCapacityCounts({
    eventCount: 10,
    eventCapacity: 40,
    routeCount: 3,
    routeCapacity: 10,
    routeKey: 'A',
  }));
});

test('capacity rejects an event overflow', () => {
  assert.throws(() => assertCapacityCounts({
    eventCount: 40,
    eventCapacity: 40,
  }), /Event capacity reached/);
});

test('capacity rejects route overflow even when event has room', () => {
  assert.throws(() => assertCapacityCounts({
    eventCount: 10,
    eventCapacity: 40,
    routeCount: 10,
    routeCapacity: 10,
    routeKey: 'A',
  }), /Route A capacity reached/);
});
