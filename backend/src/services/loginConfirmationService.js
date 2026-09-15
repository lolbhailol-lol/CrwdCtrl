const User = require('../model/usermodel');
const { sendLoginConfirmationEmail } = require('./emailService');

const CLAIM_TIMEOUT_MS = 10 * 60 * 1000;

async function sendLoginConfirmationOnce(user, {
  UserModel = User,
  send = sendLoginConfirmationEmail,
  now = new Date(),
} = {}) {
  if (!user?._id || !user?.email) return { sent: false, reason: 'missing-user-email' };

  const staleBefore = new Date(now.getTime() - CLAIM_TIMEOUT_MS);
  const claimed = await UserModel.findOneAndUpdate(
    {
      _id: user._id,
      loginConfirmationEmailSentAt: null,
      $or: [
        { loginConfirmationEmailClaimedAt: null },
        { loginConfirmationEmailClaimedAt: { $lt: staleBefore } },
      ],
    },
    { $set: { loginConfirmationEmailClaimedAt: now } },
    { new: true },
  );

  if (!claimed) return { sent: false, reason: 'already-sent-or-claimed' };

  try {
    const result = await send({ name: user.name, email: user.email });
    if (result?.success === false || result?.error) {
      throw new Error(result.error || 'Login confirmation delivery failed');
    }
    await UserModel.updateOne(
      { _id: user._id, loginConfirmationEmailClaimedAt: now },
      {
        $set: { loginConfirmationEmailSentAt: new Date() },
        $unset: { loginConfirmationEmailClaimedAt: '' },
      },
    );
    return { sent: true };
  } catch (error) {
    await UserModel.updateOne(
      { _id: user._id, loginConfirmationEmailClaimedAt: now },
      { $unset: { loginConfirmationEmailClaimedAt: '' } },
    ).catch(() => {});
    throw error;
  }
}

module.exports = { sendLoginConfirmationOnce };
