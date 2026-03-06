const { query } = require('./database');

const insertVerificationToken = async ({ tokenHash, userId, expiresAt, ipHash, userAgent }) => {
  await query(
    `
      INSERT INTO email_verification_tokens (token_hash, user_id, expires_at, ip_hash, user_agent)
      VALUES ($1, $2, $3, $4, $5)
    `,
    [tokenHash, userId, expiresAt, ipHash, userAgent]
  );
};

const findVerificationToken = async (tokenHash) => {
  const result = await query(
    `
      SELECT token_hash, user_id, expires_at, consumed_at
      FROM email_verification_tokens
      WHERE token_hash = $1
      LIMIT 1
    `,
    [tokenHash]
  );

  return result.rows[0] || null;
};

const consumeVerificationToken = async (tokenHash) => {
  const result = await query(
    `
      UPDATE email_verification_tokens
      SET consumed_at = NOW()
      WHERE token_hash = $1
        AND consumed_at IS NULL
    `,
    [tokenHash]
  );

  return result.rowCount > 0;
};

const deleteUserVerificationTokens = async (userId) => {
  await query(
    `
      DELETE FROM email_verification_tokens
      WHERE user_id = $1
    `,
    [userId]
  );
};

const deleteExpiredVerificationTokens = async () => {
  await query(
    `
      DELETE FROM email_verification_tokens
      WHERE expires_at < NOW()
    `
  );
};

module.exports = {
  insertVerificationToken,
  findVerificationToken,
  consumeVerificationToken,
  deleteUserVerificationTokens,
  deleteExpiredVerificationTokens,
};
