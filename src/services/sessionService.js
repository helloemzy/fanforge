const crypto = require('node:crypto');
const {
  insertSession,
  findSessionWithUser,
  deleteSession,
  deleteExpiredSessions,
} = require('../db/sessionRepository');

const SESSION_LIFETIME_DAYS = 30;

const toHash = (value) => {
  return crypto.createHash('sha256').update(value).digest('hex');
};

const toIpHash = (ipAddress) => {
  if (!ipAddress) {
    return null;
  }

  return toHash(ipAddress);
};

const createSession = async ({ userId, ipAddress, userAgent }) => {
  const token = crypto.randomBytes(32).toString('base64url');
  const csrfToken = crypto.randomBytes(24).toString('base64url');
  const expiresAtDate = new Date();

  expiresAtDate.setDate(expiresAtDate.getDate() + SESSION_LIFETIME_DAYS);

  await insertSession({
    tokenHash: toHash(token),
    userId,
    csrfToken,
    ipHash: toIpHash(ipAddress),
    userAgent: userAgent ? userAgent.slice(0, 255) : null,
    expiresAt: expiresAtDate.toISOString(),
  });

  return {
    token,
    csrfToken,
    expiresAt: expiresAtDate,
  };
};

const readSessionFromToken = async (token) => {
  if (!token) {
    return null;
  }

  const tokenHash = toHash(token);
  const session = await findSessionWithUser(tokenHash);

  if (!session) {
    return null;
  }

  if (new Date(session.expires_at) <= new Date()) {
    await deleteSession(tokenHash);
    return null;
  }

  return {
    token,
    csrfToken: session.csrf_token,
    expiresAt: new Date(session.expires_at),
    user: {
      id: session.user_id,
      username: session.username,
      email: session.email,
      emailVerified: Boolean(session.email_verified),
      bio: session.bio,
      createdAt: session.created_at,
    },
  };
};

const destroySessionByToken = async (token) => {
  if (!token) {
    return;
  }

  await deleteSession(toHash(token));
};

const runSessionCleanup = async () => {
  await deleteExpiredSessions();
};

module.exports = {
  createSession,
  readSessionFromToken,
  destroySessionByToken,
  runSessionCleanup,
};
