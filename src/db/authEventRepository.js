const { query } = require('./database');

const insertAuthEvent = async ({ eventType, userId, email, ipHash, uaHash }) => {
  await query(
    `
      INSERT INTO auth_events (event_type, user_id, email, ip_hash, ua_hash)
      VALUES ($1, $2, $3, $4, $5)
    `,
    [eventType, userId || null, email || null, ipHash || null, uaHash || null]
  );
};

const countAuthEventsByIpAndType = async ({ eventType, ipHash, sinceIso }) => {
  if (!ipHash) {
    return 0;
  }

  const result = await query(
    `
      SELECT COUNT(*)::INT AS count
      FROM auth_events
      WHERE event_type = $1
        AND ip_hash = $2
        AND created_at >= $3::timestamptz
    `,
    [eventType, ipHash, sinceIso]
  );

  return result.rows[0]?.count || 0;
};

const countAuthEventsByEmailAndType = async ({ eventType, email, sinceIso }) => {
  if (!email) {
    return 0;
  }

  const result = await query(
    `
      SELECT COUNT(*)::INT AS count
      FROM auth_events
      WHERE event_type = $1
        AND email = $2
        AND created_at >= $3::timestamptz
    `,
    [eventType, email.toLowerCase(), sinceIso]
  );

  return result.rows[0]?.count || 0;
};

module.exports = {
  insertAuthEvent,
  countAuthEventsByIpAndType,
  countAuthEventsByEmailAndType,
};
