const crypto = require('node:crypto');

const GUEST_CSRF_COOKIE = 'fanforge_csrf';

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

const issueGuestCsrf = (req, res) => {
  const existing = req.cookies[GUEST_CSRF_COOKIE];

  if (existing) {
    return existing;
  }

  const token = crypto.randomBytes(24).toString('base64url');

  res.cookie(GUEST_CSRF_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });

  return token;
};

const attachCsrfToken = (req, res, next) => {
  const token = req.session?.csrfToken || issueGuestCsrf(req, res);
  res.locals.csrfToken = token;
  next();
};

const verifyCsrf = (req, res, next) => {
  const submittedToken = req.body?._csrf || req.get('x-csrf-token');
  const expectedToken = req.session?.csrfToken || req.cookies[GUEST_CSRF_COOKIE];

  if (!safeCompare(submittedToken, expectedToken)) {
    return res.status(403).render('error', {
      statusCode: 403,
      message: 'Security check failed. Please refresh and retry.',
    });
  }

  return next();
};

module.exports = {
  attachCsrfToken,
  verifyCsrf,
};
