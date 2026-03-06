const { query, withTransaction } = require('./database');

const listTagsForWork = async (workId, client = null) => {
  const executor = client || { query };
  const result = await executor.query(
    `
      SELECT t.name
      FROM tags t
      JOIN work_tags wt ON wt.tag_id = t.id
      WHERE wt.work_id = $1
      ORDER BY t.name ASC
    `,
    [workId]
  );

  return result.rows.map((row) => row.name);
};

const listWorks = async ({ search, fandom, rating, status, tag, limit = 30, offset = 0 }) => {
  const clauses = [];
  const params = [];

  if (search) {
    params.push(`%${search}%`);
    const index = params.length;
    clauses.push(
      `(w.title ILIKE $${index} OR w.summary ILIKE $${index} OR w.content ILIKE $${index} OR w.fandom ILIKE $${index})`
    );
  }

  if (fandom) {
    params.push(fandom);
    clauses.push(`LOWER(w.fandom) = LOWER($${params.length})`);
  }

  if (rating) {
    params.push(rating);
    clauses.push(`w.rating = $${params.length}`);
  }

  if (status) {
    params.push(status);
    clauses.push(`w.status = $${params.length}`);
  }

  if (tag) {
    params.push(tag);
    clauses.push(`
      EXISTS (
        SELECT 1
        FROM work_tags wt
        JOIN tags t ON t.id = wt.tag_id
        WHERE wt.work_id = w.id
          AND t.normalized_name = LOWER($${params.length})
      )
    `);
  }

  params.push(limit);
  const limitIndex = params.length;
  params.push(offset);
  const offsetIndex = params.length;

  const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  const result = await query(
    `
      SELECT
        w.id,
        w.slug,
        w.title,
        w.summary,
        w.fandom,
        w.rating,
        w.status,
        w.word_count,
        w.cover_path,
        w.cover_storage_key,
        w.created_at,
        u.username AS author,
        COALESCE(k.kudos_count, 0)::INT AS kudos_count,
        COALESCE(c.comments_count, 0)::INT AS comments_count
      FROM works w
      JOIN users u ON u.id = w.author_id
      LEFT JOIN (
        SELECT work_id, COUNT(*)::INT AS kudos_count
        FROM kudos
        GROUP BY work_id
      ) k ON k.work_id = w.id
      LEFT JOIN (
        SELECT work_id, COUNT(*)::INT AS comments_count
        FROM comments
        GROUP BY work_id
      ) c ON c.work_id = w.id
      ${whereClause}
      ORDER BY w.created_at DESC
      LIMIT $${limitIndex} OFFSET $${offsetIndex}
    `,
    params
  );

  const works = result.rows;

  await Promise.all(
    works.map(async (work) => {
      work.tags = await listTagsForWork(work.id);
    })
  );

  return works;
};

const createWork = async ({
  authorId,
  slug,
  title,
  summary,
  content,
  fandom,
  rating,
  status,
  wordCount,
  coverPath,
  coverStorageKey,
  tags,
}) => {
  return withTransaction(async (client) => {
    const created = await client.query(
      `
        INSERT INTO works (
          author_id,
          slug,
          title,
          summary,
          content,
          fandom,
          rating,
          status,
          word_count,
          cover_path,
          cover_storage_key
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id
      `,
      [
        authorId,
        slug,
        title,
        summary,
        content,
        fandom,
        rating,
        status,
        wordCount,
        coverPath || null,
        coverStorageKey || null,
      ]
    );

    const workId = created.rows[0].id;

    for (const tagName of tags) {
      const normalizedName = tagName.toLowerCase();
      const tag = await client.query(
        `
          INSERT INTO tags (name, normalized_name)
          VALUES ($1, $2)
          ON CONFLICT (normalized_name)
          DO UPDATE SET name = EXCLUDED.name
          RETURNING id
        `,
        [tagName, normalizedName]
      );

      await client.query(
        `
          INSERT INTO work_tags (work_id, tag_id)
          VALUES ($1, $2)
          ON CONFLICT (work_id, tag_id) DO NOTHING
        `,
        [workId, tag.rows[0].id]
      );
    }

    return workId;
  });
};

const updateWork = async ({
  workId,
  authorId,
  title,
  summary,
  content,
  fandom,
  rating,
  status,
  wordCount,
  coverPath,
  coverStorageKey,
  tags,
}) => {
  await withTransaction(async (client) => {
    await client.query(
      `
        UPDATE works
        SET
          title = $3,
          summary = $4,
          content = $5,
          fandom = $6,
          rating = $7,
          status = $8,
          word_count = $9,
          cover_path = COALESCE($10, cover_path),
          cover_storage_key = COALESCE($11, cover_storage_key),
          updated_at = NOW()
        WHERE id = $1
          AND author_id = $2
      `,
      [
        workId,
        authorId,
        title,
        summary,
        content,
        fandom,
        rating,
        status,
        wordCount,
        coverPath || null,
        coverStorageKey || null,
      ]
    );

    await client.query(
      `
        DELETE FROM work_tags
        WHERE work_id = $1
      `,
      [workId]
    );

    for (const tagName of tags) {
      const normalizedName = tagName.toLowerCase();
      const tag = await client.query(
        `
          INSERT INTO tags (name, normalized_name)
          VALUES ($1, $2)
          ON CONFLICT (normalized_name)
          DO UPDATE SET name = EXCLUDED.name
          RETURNING id
        `,
        [tagName, normalizedName]
      );

      await client.query(
        `
          INSERT INTO work_tags (work_id, tag_id)
          VALUES ($1, $2)
          ON CONFLICT (work_id, tag_id) DO NOTHING
        `,
        [workId, tag.rows[0].id]
      );
    }
  });
};

const findWorkById = async (workId) => {
  const result = await query(
    `
      SELECT
        w.id,
        w.author_id,
        w.slug,
        w.title,
        w.summary,
        w.content,
        w.fandom,
        w.rating,
        w.status,
        w.word_count,
        w.cover_path,
        w.cover_storage_key,
        w.created_at,
        w.updated_at,
        u.username AS author,
        COALESCE(k.kudos_count, 0)::INT AS kudos_count,
        COALESCE(c.comments_count, 0)::INT AS comments_count,
        COALESCE(b.bookmarks_count, 0)::INT AS bookmarks_count
      FROM works w
      JOIN users u ON u.id = w.author_id
      LEFT JOIN (
        SELECT work_id, COUNT(*)::INT AS kudos_count
        FROM kudos
        GROUP BY work_id
      ) k ON k.work_id = w.id
      LEFT JOIN (
        SELECT work_id, COUNT(*)::INT AS comments_count
        FROM comments
        GROUP BY work_id
      ) c ON c.work_id = w.id
      LEFT JOIN (
        SELECT work_id, COUNT(*)::INT AS bookmarks_count
        FROM bookmarks
        GROUP BY work_id
      ) b ON b.work_id = w.id
      WHERE w.id = $1
      LIMIT 1
    `,
    [workId]
  );

  const work = result.rows[0];

  if (!work) {
    return null;
  }

  work.tags = await listTagsForWork(workId);
  return work;
};

const slugExists = async (slug) => {
  const result = await query(
    `
      SELECT 1
      FROM works
      WHERE slug = $1
      LIMIT 1
    `,
    [slug]
  );

  return result.rows.length > 0;
};

const listTrendingTags = async (limit = 10) => {
  const result = await query(
    `
      SELECT t.name, COUNT(*)::INT AS usage_count
      FROM tags t
      JOIN work_tags wt ON wt.tag_id = t.id
      GROUP BY t.id
      ORDER BY usage_count DESC, t.name ASC
      LIMIT $1
    `,
    [limit]
  );

  return result.rows;
};

const listFandoms = async (limit = 20) => {
  const result = await query(
    `
      SELECT fandom, COUNT(*)::INT AS work_count
      FROM works
      GROUP BY fandom
      ORDER BY work_count DESC, fandom ASC
      LIMIT $1
    `,
    [limit]
  );

  return result.rows;
};

const getCommunitySnapshot = async () => {
  const result = await query(
    `
      SELECT
        (SELECT COUNT(*)::INT FROM works) AS work_count,
        (SELECT COUNT(*)::INT FROM users) AS writer_count,
        (SELECT COUNT(*)::INT FROM comments) AS comment_count,
        (SELECT COUNT(*)::INT FROM kudos) AS kudos_count
    `
  );

  return result.rows[0] || {
    work_count: 0,
    writer_count: 0,
    comment_count: 0,
    kudos_count: 0,
  };
};

module.exports = {
  createWork,
  updateWork,
  findWorkById,
  listWorks,
  listTrendingTags,
  listFandoms,
  getCommunitySnapshot,
  slugExists,
};
