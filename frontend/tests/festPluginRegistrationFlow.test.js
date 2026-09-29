import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function pluginSource(name) {
  return readFile(new URL(`../src/features/fests/plugins/${name}Plugin.js`, import.meta.url), 'utf8');
}

for (const name of ['aarohan', 'mindspark']) {
  test(`${name} uses the wide lazy-mounted roster registration flow`, async () => {
    const source = await pluginSource(name);
    assert.match(source, /hasRosterPersonStep:\s*true/);
    assert.match(source, /registrationLayout:\s*'roster-wide'/);
    assert.match(source, /lazyMountRegistrationSteps:\s*true/);
  });
}

test('Aarohan keeps its own final-step fields while MindSpark retains referral input', async () => {
  assert.match(await pluginSource('aarohan'), /showRegistrationReferral:\s*false/);
  assert.match(await pluginSource('mindspark'), /showRegistrationReferral:\s*true/);
});

test('payment amount and coupon stay on the final registration step', async () => {
  const source = await readFile(new URL('../src/features/fests/pages/FestRegistration/FestRegistrationForm.jsx', import.meta.url), 'utf8');
  assert.match(source, /currentStep === getTotalSteps\(\)/);
  assert.match(source, /Enter coupon code/);
  assert.match(source, /Amount payable/);
});

test('Aarohan base registration routes users into a competition roster flow', async () => {
  const source = await readFile(new URL('../src/features/fests/pages/FestRegistration/index.jsx', import.meta.url), 'utf8');
  assert.match(source, /isAarohanFest\(festId, fest\).*?!isCompetitionRegistration/s);
  assert.match(source, /Choose your competition/);
  assert.match(source, /festRegisterPath\(fest, item\)/);
});
