const crypto = require('node:crypto');

const READER_PASS_COOKIE_NAME = 'fanforge_reader_pass';

const READER_PASS_TTL_MS = 24 * 60 * 60 * 1000;
const HUMAN_CHALLENGE_TTL_MS = 15 * 60 * 1000;
const MIN_HUMAN_SOLVE_MS = 1800;

const readerShieldSecret =
  process.env.READER_SHIELD_SECRET || process.env.SESSION_SECRET || 'fanforge-dev-reader-shield';

const safeCompare = (left, right) => {
  if (!left || !right) {
    return false;
  }

  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

const hashUserAgent = (userAgent) => {
  return crypto
    .createHash('sha256')
    .update(userAgent || 'unknown')
    .digest('hex')
    .slice(0, 24);
};

const sign = (payload) => {
  return crypto.createHmac('sha256', readerShieldSecret).update(payload).digest('hex');
};

const buildSignedToken = (parts) => {
  const payload = parts.join('.');
  const signature = sign(payload);
  return `${payload}.${signature}`;
};

const setReaderPass = (res, userId, userAgent) => {
  const expiresAt = Date.now() + READER_PASS_TTL_MS;
  const token = buildSignedToken([String(userId), String(expiresAt), hashUserAgent(userAgent)]);

  res.cookie(READER_PASS_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: READER_PASS_TTL_MS,
    path: '/',
  });
};

const clearReaderPass = (res) => {
  res.clearCookie(READER_PASS_COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });
};

const hasValidReaderPass = (req, userId) => {
  const token = req.cookies?.[READER_PASS_COOKIE_NAME];

  if (!token || !userId) {
    return false;
  }

  const segments = token.split('.');

  if (segments.length !== 4) {
    return false;
  }

  const [tokenUserId, expiresAtRaw, uaHash, signature] = segments;

  if (tokenUserId !== String(userId)) {
    return false;
  }

  const expiresAt = Number(expiresAtRaw);

  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    return false;
  }

  if (uaHash !== hashUserAgent(req.get('user-agent'))) {
    return false;
  }

  const expectedSignature = sign(`${tokenUserId}.${expiresAtRaw}.${uaHash}`);

  return safeCompare(signature, expectedSignature);
};

const createHumanChallenge = (userId, userAgent) => {
  const first = crypto.randomInt(7, 40);
  const second = crypto.randomInt(3, 18);
  const issuedAt = Date.now();
  const expiresAt = issuedAt + HUMAN_CHALLENGE_TTL_MS;
  const uaHash = hashUserAgent(userAgent);
  const challengeId = crypto.randomBytes(6).toString('hex');
  const token = buildSignedToken([
    String(userId),
    String(first),
    String(second),
    String(issuedAt),
    String(expiresAt),
    challengeId,
    uaHash,
  ]);

  return {
    question: `${first} + ${second}`,
    token,
  };
};

const validateHumanChallenge = ({ token, answer, userId, userAgent }) => {
  if (!token) {
    return false;
  }

  const segments = token.split('.');

  if (segments.length !== 8) {
    return false;
  }

  const [tokenUserId, firstRaw, secondRaw, issuedAtRaw, expiresAtRaw, challengeId, uaHash, signature] =
    segments;

  const payload = [tokenUserId, firstRaw, secondRaw, issuedAtRaw, expiresAtRaw, challengeId, uaHash].join(
    '.'
  );
  const expectedSignature = sign(payload);

  if (!safeCompare(signature, expectedSignature)) {
    return false;
  }

  if (tokenUserId !== String(userId)) {
    return false;
  }

  if (uaHash !== hashUserAgent(userAgent)) {
    return false;
  }

  const issuedAt = Number(issuedAtRaw);
  const expiresAt = Number(expiresAtRaw);
  const first = Number(firstRaw);
  const second = Number(secondRaw);

  if (
    !Number.isFinite(issuedAt) ||
    !Number.isFinite(expiresAt) ||
    !Number.isFinite(first) ||
    !Number.isFinite(second)
  ) {
    return false;
  }

  const now = Date.now();

  if (expiresAt <= now || now - issuedAt < MIN_HUMAN_SOLVE_MS) {
    return false;
  }

  const submittedAnswer = Number(String(answer || '').trim());

  if (!Number.isFinite(submittedAnswer)) {
    return false;
  }

  return submittedAnswer === first + second;
};

const isTurnstileConfigured = () => {
  return Boolean(process.env.TURNSTILE_SECRET_KEY && process.env.TURNSTILE_SITE_KEY);
};

const verifyTurnstileToken = async ({ token, remoteIp }) => {
  if (!isTurnstileConfigured() || !token) {
    return false;
  }

  const formData = new URLSearchParams({
    secret: process.env.TURNSTILE_SECRET_KEY,
    response: token,
    remoteip: remoteIp || '',
  });

  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: formData,
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
    },
  });

  if (!response.ok) {
    return false;
  }

  const payload = await response.json();
  return Boolean(payload?.success);
};

module.exports = {
  READER_PASS_COOKIE_NAME,
  createHumanChallenge,
  validateHumanChallenge,
  setReaderPass,
  clearReaderPass,
  hasValidReaderPass,
  isTurnstileConfigured,
  verifyTurnstileToken,
};
