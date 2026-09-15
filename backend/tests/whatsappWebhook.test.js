const test = require('node:test');
const assert = require('node:assert/strict');

const {
  validateWhatsAppWebhookSubscription,
  summarizeWhatsAppWebhook,
  classifyWhatsAppWebhookEvents,
} = require('../src/utils/whatsappWebhookEvents');
const { verifyWhatsAppWebhook } = require('../src/controllers/whatsappWebhookController');

function createMockRes() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    send(payload) {
      this.body = payload;
      return this;
    },
    sendStatus(code) {
      this.statusCode = code;
      this.body = null;
      return this;
    },
  };
}

test('validateWhatsAppWebhookSubscription accepts subscribe with matching token', () => {
  const result = validateWhatsAppWebhookSubscription({
    mode: 'subscribe',
    verifyToken: 'crwdctrl-verify-secret',
    challenge: '1234567890',
    expectedVerifyToken: 'crwdctrl-verify-secret',
  });
  assert.equal(result.ok, true);
  assert.equal(result.challenge, '1234567890');
});

test('validateWhatsAppWebhookSubscription rejects wrong verify token', () => {
  const result = validateWhatsAppWebhookSubscription({
    mode: 'subscribe',
    verifyToken: 'wrong-token',
    challenge: '1234567890',
    expectedVerifyToken: 'crwdctrl-verify-secret',
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'verification_failed');
});

test('verifyWhatsAppWebhook GET handler returns challenge with HTTP 200', () => {
  const previous = process.env.WHATSAPP_VERIFY_TOKEN;
  process.env.WHATSAPP_VERIFY_TOKEN = 'test-verify-token';

  try {
    const req = {
      query: {
        'hub.mode': 'subscribe',
        'hub.verify_token': 'test-verify-token',
        'hub.challenge': '9876543210',
      },
    };
    const res = createMockRes();

    verifyWhatsAppWebhook(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body, '9876543210');
  } finally {
    if (previous === undefined) {
      delete process.env.WHATSAPP_VERIFY_TOKEN;
    } else {
      process.env.WHATSAPP_VERIFY_TOKEN = previous;
    }
  }
});

test('verifyWhatsAppWebhook GET handler returns HTTP 403 for invalid token', () => {
  const previous = process.env.WHATSAPP_VERIFY_TOKEN;
  process.env.WHATSAPP_VERIFY_TOKEN = 'test-verify-token';

  try {
    const req = {
      query: {
        'hub.mode': 'subscribe',
        'hub.verify_token': 'bad-token',
        'hub.challenge': '9876543210',
      },
    };
    const res = createMockRes();

    verifyWhatsAppWebhook(req, res);

    assert.equal(res.statusCode, 403);
    assert.equal(res.body, null);
  } finally {
    if (previous === undefined) {
      delete process.env.WHATSAPP_VERIFY_TOKEN;
    } else {
      process.env.WHATSAPP_VERIFY_TOKEN = previous;
    }
  }
});

test('summarizeWhatsAppWebhook logs safe metadata only', () => {
  const summary = summarizeWhatsAppWebhook({
    object: 'whatsapp_business_account',
    entry: [{
      id: '1052145781018202',
      changes: [{
        field: 'messages',
        value: {
          messaging_product: 'whatsapp',
          metadata: {
            display_phone_number: '15551971468',
            phone_number_id: '1267504323121382',
          },
          contacts: [{ wa_id: '919370890446', profile: { name: 'Karan' } }],
          messages: [{
            from: '919370890446',
            id: 'wamid.test',
            timestamp: '1710000000',
            type: 'text',
            text: { body: 'Hello secret message' },
          }],
          statuses: [{
            id: 'wamid.test',
            status: 'delivered',
            timestamp: '1710000001',
            recipient_id: '919370890446',
          }],
        },
      }],
    }],
  });

  assert.equal(summary.object, 'whatsapp_business_account');
  assert.equal(summary.entryCount, 1);
  assert.equal(summary.events[0].field, 'messages');
  assert.equal(summary.events[0].messageCount, 1);
  assert.equal(summary.events[0].statusCount, 1);
  assert.deepEqual(summary.events[0].messageTypes, ['text']);
  assert.deepEqual(summary.events[0].statusTypes, ['delivered']);
  assert.equal(JSON.stringify(summary).includes('919370890446'), false);
  assert.equal(JSON.stringify(summary).includes('Hello secret message'), false);
});

test('classifyWhatsAppWebhookEvents separates messages and statuses without PII', () => {
  const classified = classifyWhatsAppWebhookEvents({
    entry: [{
      id: '1052145781018202',
      changes: [{
        field: 'messages',
        value: {
          metadata: { phone_number_id: '1267504323121382' },
          messages: [{
            from: '919370890446',
            id: 'wamid.inbound',
            timestamp: '1710000000',
            type: 'text',
            text: { body: 'secret' },
          }],
          statuses: [{
            id: 'wamid.outbound',
            status: 'read',
            timestamp: '1710000002',
            recipient_id: '919370890446',
          }],
        },
      }],
    }],
  });

  assert.equal(classified.messages.length, 1);
  assert.equal(classified.messages[0].type, 'text');
  assert.equal(classified.messages[0].messageId, 'wamid.inbound');
  assert.equal(classified.statuses.length, 1);
  assert.equal(classified.statuses[0].status, 'read');
  assert.equal(JSON.stringify(classified).includes('919370890446'), false);
  assert.equal(JSON.stringify(classified).includes('secret'), false);
});
