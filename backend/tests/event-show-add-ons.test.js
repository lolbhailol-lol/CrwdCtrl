const test = require('node:test');
const assert = require('node:assert/strict');

const {
  sanitizeEventAddOns,
  resolveEventAddOns,
} = require('../src/utils/sportsPricing');

const event = {
  addOns: [
    {
      id: 'experience_ride',
      name: 'Experience Ride',
      vehicles: 'Fronx & Gypsy',
      description: 'One lap with a professional racing driver.',
      fee: 1500,
      enabled: true,
    },
    {
      id: 'rent_and_drive',
      name: 'Rent & Drive',
      vehicles: 'Esteem',
      description: 'Drive a race-prepared vehicle.',
      fee: 2000,
      enabled: true,
    },
  ],
};

test('sanitizes event add-ons and preserves display details', () => {
  const addOns = sanitizeEventAddOns(event.addOns);
  assert.equal(addOns.length, 2);
  assert.deepEqual(addOns[0], {
    id: 'experience_ride',
    name: 'Experience Ride',
    vehicles: 'Fronx & Gypsy',
    description: 'One lap with a professional racing driver.',
    fee: 1500,
    enabled: true,
    order: 0,
  });
});

test('prices multiple selected add-ons once per booking', () => {
  const result = resolveEventAddOns(event, ['experience_ride', 'rent_and_drive']);
  assert.equal(result.total, 3500);
  assert.deepEqual(result.selected.map((addOn) => addOn.id), [
    'experience_ride',
    'rent_and_drive',
  ]);
});

test('rejects stale or client-invented add-on ids', () => {
  assert.throws(
    () => resolveEventAddOns(event, ['not_configured']),
    /unavailable/i,
  );
});
