const path = require('node:path');
const { Pool } = require('pg');
const { newDb } = require('pg-mem');
const { isVercelRuntime, isCloudflareRuntime } = require('../config/runtimePaths');

const getConnectionConfig = () => {
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_SSL === 'disable' ? false : { rejectUnauthorized: false },
      max: Number.parseInt(process.env.DATABASE_POOL_MAX || '12', 10),
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
    };
  }

  return null;
};

const createPool = () => {
  const config = getConnectionConfig();

  if (config) {
    return {
      pool: new Pool(config),
      mode: 'postgres',
    };
  }

  const inMemoryDb = newDb({ autoCreateForeignKeyIndices: true });
  const pgAdapter = inMemoryDb.adapters.createPg();

  return {
    pool: new pgAdapter.Pool(),
    mode: 'pg-mem',
  };
};

const { pool, mode } = createPool();

pool.on('error', (error) => {
  console.error('[FanForge] Database pool error', error);
});

const migrationStatements = [
  `
  CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(24) NOT NULL UNIQUE,
    email VARCHAR(160) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    verification_sent_at TIMESTAMPTZ,
    bio TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    csrf_token TEXT NOT NULL,
    ip_hash TEXT,
    user_agent VARCHAR(255),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS works (
    id BIGSERIAL PRIMARY KEY,
    author_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    slug VARCHAR(90) NOT NULL UNIQUE,
    title VARCHAR(140) NOT NULL,
    summary TEXT NOT NULL,
    content TEXT NOT NULL,
    fandom VARCHAR(80) NOT NULL,
    rating VARCHAR(16) NOT NULL,
    status VARCHAR(16) NOT NULL,
    word_count INTEGER NOT NULL,
    cover_path TEXT,
    cover_storage_key TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS tags (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(40) NOT NULL,
    normalized_name VARCHAR(40) NOT NULL UNIQUE
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS work_tags (
    work_id BIGINT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
    tag_id BIGINT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (work_id, tag_id)
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS comments (
    id BIGSERIAL PRIMARY KEY,
    work_id BIGINT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS kudos (
    work_id BIGINT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (work_id, user_id)
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS bookmarks (
    work_id BIGINT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    note TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (work_id, user_id)
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS reading_progress (
    work_id BIGINT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    progress_percent INTEGER NOT NULL DEFAULT 0,
    words_read INTEGER NOT NULL DEFAULT 0,
    last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (work_id, user_id)
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS email_verification_tokens (
    token_hash TEXT PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    ip_hash TEXT,
    user_agent VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS auth_events (
    id BIGSERIAL PRIMARY KEY,
    event_type TEXT NOT NULL,
    user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    email VARCHAR(160),
    ip_hash TEXT,
    ua_hash TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  `,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_sent_at TIMESTAMPTZ;`,
  `ALTER TABLE works ADD COLUMN IF NOT EXISTS cover_storage_key TEXT;`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);`,
  `CREATE INDEX IF NOT EXISTS idx_works_created_at ON works(created_at DESC);`,
  `CREATE INDEX IF NOT EXISTS idx_works_fandom ON works(fandom);`,
  `CREATE INDEX IF NOT EXISTS idx_comments_work ON comments(work_id);`,
  `CREATE INDEX IF NOT EXISTS idx_reading_progress_user_last_read ON reading_progress(user_id, last_read_at DESC);`,
  `CREATE INDEX IF NOT EXISTS idx_verification_tokens_user ON email_verification_tokens(user_id);`,
  `CREATE INDEX IF NOT EXISTS idx_verification_tokens_expiry ON email_verification_tokens(expires_at);`,
  `CREATE INDEX IF NOT EXISTS idx_auth_events_ip_type ON auth_events(ip_hash, event_type, created_at DESC);`,
  `CREATE INDEX IF NOT EXISTS idx_auth_events_email_type ON auth_events(email, event_type, created_at DESC);`,
];

let initializationPromise;

const initializeDatabase = async () => {
  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    const client = await pool.connect();

    try {
      for (const statement of migrationStatements) {
        await client.query(statement);
      }

      if ((isVercelRuntime || isCloudflareRuntime) && mode !== 'postgres') {
        console.warn(
          '[FanForge] Running without DATABASE_URL in a serverless runtime. Reliability is degraded until managed Postgres is configured.'
        );
      }
    } finally {
      client.release();
    }
  })();

  return initializationPromise;
};

const query = async (text, params = []) => {
  await initializeDatabase();
  return pool.query(text, params);
};

const withTransaction = async (callback) => {
  await initializeDatabase();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const closeDatabase = async () => {
  await pool.end();
};

module.exports = {
  mode,
  initializeDatabase,
  query,
  withTransaction,
  closeDatabase,
};
