const test = require('node:test');
const assert = require('node:assert/strict');

const {
  isMobileUserAgent,
  parseDeviceSignals,
  looksLikePhoneFromSignals,
  assertLaptopClient,
} = require('../../../src/modules/campus-hunt/grid/laptopOnly');

function mockReq(headers = {}) {
  return {
    get(name) {
      const key = String(name || '').toLowerCase();
      const found = Object.entries(headers).find(([k]) => k.toLowerCase() === key);
      return found ? found[1] : undefined;
    },
  };
}

test('mobile UA is detected', () => {
  assert.equal(isMobileUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'), true);
  assert.equal(isMobileUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120'), false);
});

test('Desktop-site style signals still look like a phone', () => {
  const signals = parseDeviceSignals('sw=390;sh=844;tp=5;coarse=1;hover=0;dmax=1');
  assert.equal(looksLikePhoneFromSignals(signals), true);
});

test('real laptop signals are allowed', () => {
  const signals = parseDeviceSignals('sw=1080;sh=1920;tp=0;coarse=0;hover=1;dmax=0');
  assert.equal(looksLikePhoneFromSignals(signals), false);
});

test('assertLaptopClient rejects phone client header even with desktop UA', () => {
  assert.throws(
    () => assertLaptopClient(mockReq({
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120',
      'x-campus-hunt-client': 'phone',
    })),
    (err) => err.code === 'LAPTOP_ONLY' && err.status === 403,
  );
});

test('assertLaptopClient rejects device-narrow touch signals with desktop UA', () => {
  assert.throws(
    () => assertLaptopClient(mockReq({
      'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) Chrome/120',
      'x-campus-hunt-client': 'laptop',
      'x-campus-hunt-device': 'sw=412;sh=915;tp=5;coarse=1;hover=0;dmax=1',
    })),
    (err) => err.code === 'LAPTOP_ONLY',
  );
});

test('assertLaptopClient allows clean desktop request', () => {
  assert.doesNotThrow(() => assertLaptopClient(mockReq({
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120',
    'x-campus-hunt-client': 'laptop',
    'x-campus-hunt-device': 'sw=1440;sh=900;tp=0;coarse=0;hover=1;dmax=0',
  })));
});
