const { query } = require('./database');

const insertSession = async ({ tokenHash, userId, csrfToken, ipHash, userAgent, expiresAt }) => {
  await query(
    `
      INSERT INTO sessions (token_hash, user_id, csrf_token, ip_hash, user_agent, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6)
    `,
    [tokenHash, userId, csrfToken, ipHash, userAgent, expiresAt]
  );
};

const findSessionWithUser = async (tokenHash) => {
  const result = await query(
    `
      SELECT
        s.token_hash,
        s.csrf_token,
        s.expires_at,
        u.id AS user_id,
        u.username,
        u.email,
        u.email_verified,
        u.bio,
        u.created_at
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1
      LIMIT 1
    `,
    [tokenHash]
  );

  return result.rows[0] || null;
};

const deleteSession = async (tokenHash) => {
  await query(
    `
      DELETE FROM sessions
      WHERE token_hash = $1
    `,
    [tokenHash]
  );
};

const deleteExpiredSessions = async () => {
  await query(
    `
      DELETE FROM sessions
      WHERE expires_at < NOW()
    `
  );
};

module.exports = {
  insertSession,
  findSessionWithUser,
  deleteSession,
  deleteExpiredSessions,
};
