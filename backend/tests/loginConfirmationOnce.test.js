const test = require('node:test');
const assert = require('node:assert/strict');

const { sendLoginConfirmationOnce } = require('../src/services/loginConfirmationService');

test('login confirmation is sent and permanently marked once', async () => {
  const updates = [];
  const UserModel = {
    findOneAndUpdate: async () => ({ _id: 'user-1' }),
    updateOne: async (...args) => updates.push(args),
  };
  let sends = 0;
  const result = await sendLoginConfirmationOnce(
    { _id: 'user-1', name: 'User', email: 'user@example.com' },
    { UserModel, send: async () => { sends += 1; return { success: true }; } },
  );

  assert.equal(result.sent, true);
  assert.equal(sends, 1);
  assert.ok(updates[0][1].$set.loginConfirmationEmailSentAt instanceof Date);
});

test('login confirmation does not send when already sent or claimed', async () => {
  const UserModel = {
    findOneAndUpdate: async () => null,
    updateOne: async () => assert.fail('should not update'),
  };
  let sends = 0;
  const result = await sendLoginConfirmationOnce(
    { _id: 'user-1', email: 'user@example.com' },
    { UserModel, send: async () => { sends += 1; } },
  );

  assert.equal(result.sent, false);
  assert.equal(result.reason, 'already-sent-or-claimed');
  assert.equal(sends, 0);
});

test('failed delivery releases the claim for a later retry', async () => {
  const updates = [];
  const UserModel = {
    findOneAndUpdate: async () => ({ _id: 'user-1' }),
    updateOne: async (...args) => updates.push(args),
  };

  await assert.rejects(
    sendLoginConfirmationOnce(
      { _id: 'user-1', email: 'user@example.com' },
      { UserModel, send: async () => ({ success: false, error: 'quota exceeded' }) },
    ),
    /quota exceeded/,
  );
  assert.deepEqual(updates[0][1], { $unset: { loginConfirmationEmailClaimedAt: '' } });
});
