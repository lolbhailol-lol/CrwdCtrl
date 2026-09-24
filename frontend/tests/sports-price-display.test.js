import test from 'node:test';
import assert from 'node:assert/strict';

import { sportsDiscountPercent, sportsOriginalFee } from '../src/utils/sportsTiers.js';

test('Ritrovo Rush shows ₹149 MRP, ₹98 payable, and 34.22% off', () => {
  const event = { registrationFee: 98, originalFee: 149, pricingMode: 'single' };
  assert.equal(sportsOriginalFee(event), 149);
  assert.equal(sportsDiscountPercent(event), 34.22);
});

test('does not show a discount when MRP is missing or not higher', () => {
  assert.equal(sportsOriginalFee({ registrationFee: 98, originalFee: 0 }), 0);
  assert.equal(sportsDiscountPercent({ registrationFee: 98, originalFee: 98 }), 0);
});
