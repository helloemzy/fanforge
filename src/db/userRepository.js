const { query } = require('./database');

const createUser = async ({ username, email, passwordHash }) => {
  const result = await query(
    `
      INSERT INTO users (username, email, password_hash)
      VALUES ($1, $2, $3)
      RETURNING id, username, email, email_verified, created_at
    `,
    [username, email.toLowerCase(), passwordHash]
  );

  return result.rows[0];
};

const findUserByEmail = async (email) => {
  const result = await query(
    `
      SELECT id, username, email, password_hash, email_verified, created_at
      FROM users
      WHERE email = $1
      LIMIT 1
    `,
    [email.toLowerCase()]
  );

  return result.rows[0] || null;
};

const findUserByUsername = async (username) => {
  const result = await query(
    `
      SELECT id, username, email, password_hash, email_verified, created_at
      FROM users
      WHERE username = $1
      LIMIT 1
    `,
    [username]
  );

  return result.rows[0] || null;
};

const findUserById = async (id) => {
  const result = await query(
    `
      SELECT id, username, email, email_verified, verification_sent_at, bio, created_at
      FROM users
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );

  return result.rows[0] || null;
};

const markUserEmailVerified = async (userId) => {
  const result = await query(
    `
      UPDATE users
      SET email_verified = TRUE
      WHERE id = $1
    `,
    [userId]
  );

  return result.rowCount > 0;
};

const markVerificationSent = async (userId) => {
  await query(
    `
      UPDATE users
      SET verification_sent_at = NOW()
      WHERE id = $1
    `,
    [userId]
  );
};

module.exports = {
  createUser,
  findUserByEmail,
  findUserByUsername,
  findUserById,
  markUserEmailVerified,
  markVerificationSent,
};
