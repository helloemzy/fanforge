const { query } = require('./database');

const listCommentsByWork = async (workId) => {
  const result = await query(
    `
      SELECT
        c.id,
        c.body,
        c.created_at,
        u.username
      FROM comments c
      JOIN users u ON u.id = c.user_id
      WHERE c.work_id = $1
      ORDER BY c.created_at ASC
    `,
    [workId]
  );

  return result.rows;
};

const insertComment = async ({ workId, userId, body }) => {
  await query(
    `
      INSERT INTO comments (work_id, user_id, body)
      VALUES ($1, $2, $3)
    `,
    [workId, userId, body]
  );
};

const insertKudos = async ({ workId, userId }) => {
  await query(
    `
      INSERT INTO kudos (work_id, user_id)
      VALUES ($1, $2)
      ON CONFLICT (work_id, user_id) DO NOTHING
    `,
    [workId, userId]
  );
};

const hasKudos = async ({ workId, userId }) => {
  const result = await query(
    `
      SELECT 1
      FROM kudos
      WHERE work_id = $1 AND user_id = $2
      LIMIT 1
    `,
    [workId, userId]
  );

  return result.rows.length > 0;
};

const upsertBookmark = async ({ workId, userId, note }) => {
  await query(
    `
      INSERT INTO bookmarks (work_id, user_id, note)
      VALUES ($1, $2, $3)
      ON CONFLICT (work_id, user_id)
      DO UPDATE SET
        note = EXCLUDED.note,
        updated_at = NOW()
    `,
    [workId, userId, note]
  );
};

const findBookmark = async ({ workId, userId }) => {
  const result = await query(
    `
      SELECT note, created_at, updated_at
      FROM bookmarks
      WHERE work_id = $1 AND user_id = $2
      LIMIT 1
    `,
    [workId, userId]
  );

  return result.rows[0] || null;
};

module.exports = {
  listCommentsByWork,
  insertComment,
  insertKudos,
  hasKudos,
  upsertBookmark,
  findBookmark,
};
