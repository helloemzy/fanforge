const crypto = require('node:crypto');
const {
  insertVerificationToken,
  findVerificationToken,
  consumeVerificationToken,
  deleteUserVerificationTokens,
  deleteExpiredVerificationTokens,
} = require('../db/emailVerificationRepository');
const { markUserEmailVerified, markVerificationSent } = require('../db/userRepository');

const VERIFICATION_TOKEN_TTL_HOURS = 24;

const toHash = (value) => {
  return crypto.createHash('sha256').update(value).digest('hex');
};

const toIpHash = (ipAddress) => {
  if (!ipAddress) {
    return null;
  }

  return toHash(ipAddress);
};

const issueEmailVerificationToken = async ({ userId, ipAddress, userAgent }) => {
  await deleteExpiredVerificationTokens();

  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + VERIFICATION_TOKEN_TTL_HOURS);

  await insertVerificationToken({
    tokenHash: toHash(token),
    userId,
    expiresAt: expiresAt.toISOString(),
    ipHash: toIpHash(ipAddress),
    userAgent: userAgent ? userAgent.slice(0, 255) : null,
  });

  await markVerificationSent(userId);

  return {
    token,
    expiresAt,
  };
};

const verifyEmailToken = async (token) => {
  if (!token || typeof token !== 'string') {
    return { ok: false, reason: 'invalid-token' };
  }

  const stored = await findVerificationToken(toHash(token));

  if (!stored) {
    return { ok: false, reason: 'not-found' };
  }

  if (stored.consumed_at) {
    return { ok: false, reason: 'already-used' };
  }

  if (new Date(stored.expires_at) <= new Date()) {
    return { ok: false, reason: 'expired' };
  }

  const consumed = await consumeVerificationToken(stored.token_hash);

  if (!consumed) {
    return { ok: false, reason: 'race-condition' };
  }

  const updated = await markUserEmailVerified(stored.user_id);

  if (!updated) {
    return { ok: false, reason: 'user-update-failed' };
  }

  await deleteUserVerificationTokens(stored.user_id);

  return {
    ok: true,
    userId: stored.user_id,
  };
};

module.exports = {
  issueEmailVerificationToken,
  verifyEmailToken,
};
