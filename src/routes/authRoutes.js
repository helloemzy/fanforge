const express = require('express');
const {
  createUser,
  findUserByEmail,
  findUserByUsername,
  findUserById,
} = require('../db/userRepository');
const { hashPassword, verifyPassword } = require('../services/passwordService');
const {
  createSession,
  destroySessionByToken,
} = require('../services/sessionService');
const {
  parseOrThrow,
  registrationSchema,
  loginSchema,
} = require('../utils/validators');
const {
  authLimiter,
  humanCheckLimiter,
  resendVerificationLimiter,
} = require('../middleware/rateLimits');
const { verifyCsrf } = require('../middleware/csrfProtection');
const {
  SESSION_COOKIE_NAME,
  requireAuthentication,
} = require('../middleware/authentication');
const {
  createHumanChallenge,
  validateHumanChallenge,
  setReaderPass,
  clearReaderPass,
  hasValidReaderPass,
  isTurnstileConfigured,
  verifyTurnstileToken,
} = require('../middleware/readerShield');
const {
  issueEmailVerificationToken,
  verifyEmailToken,
} = require('../services/emailVerificationService');
const { sendEmailVerification } = require('../services/emailDeliveryService');
const {
  AuthEventType,
  recordAuthSecurityEvent,
  assessRegistrationRisk,
  assessLoginRisk,
} = require('../services/authRiskService');

const router = express.Router();
const allowManualVerificationLink =
  process.env.NODE_ENV !== 'production' || process.env.ALLOW_MANUAL_VERIFY_LINK === '1';

const getSafeNextPath = (value) => {
  if (!value || typeof value !== 'string') {
    return '/';
  }

  if (!value.startsWith('/') || value.startsWith('//')) {
    return '/';
  }

  return value;
};

const buildAbsoluteUrl = (req, path) => {
  const base = process.env.APP_BASE_URL || `${req.protocol}://${req.get('host')}`;
  return new URL(path, base).toString();
};

const setSessionCookie = (res, token, expiresAt) => {
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    expires: expiresAt,
  });
};

const renderVerifyEmailSent = (res, { nextPath, error, notice, manualVerificationPath }) => {
  res.render('verify-email-sent', {
    nextPath,
    error,
    notice,
    manualVerificationPath: manualVerificationPath || null,
  });
};

const recordAuthEventSafely = async (payload) => {
  try {
    await recordAuthSecurityEvent(payload);
  } catch (error) {
    console.error('[FanForge] Unable to record auth event', error);
  }
};

const issueAndSendVerification = async ({ req, user, nextPath }) => {
  const issued = await issueEmailVerificationToken({
    userId: user.id,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });

  const verificationPath = `/auth/verify-email?token=${encodeURIComponent(issued.token)}&next=${encodeURIComponent(nextPath)}`;
  const verificationUrl = buildAbsoluteUrl(req, verificationPath);

  const delivery = await sendEmailVerification({
    toEmail: user.email,
    username: user.username,
    verificationUrl,
  });

  return {
    delivery,
    manualVerificationPath: delivery.sent ? null : verificationPath,
  };
};

const renderHumanCheck = (req, res, { nextPath, error }) => {
  const challenge = createHumanChallenge(req.user.id, req.get('user-agent'));

  res.render('human-check', {
    nextPath,
    error,
    challenge,
    turnstileSiteKey: process.env.TURNSTILE_SITE_KEY || '',
    turnstileEnabled: isTurnstileConfigured(),
  });
};

router.get('/register', (req, res) => {
  res.render('register', {
    values: { username: '', email: '' },
    error: null,
    nextPath: getSafeNextPath(req.query.next),
  });
});

router.post('/register', authLimiter, verifyCsrf, async (req, res) => {
  const nextPath = getSafeNextPath(req.body.next);

  try {
    const form = parseOrThrow(registrationSchema, req.body);
    const normalizedEmail = form.email.toLowerCase();

    await recordAuthEventSafely({
      eventType: AuthEventType.RegisterAttempt,
      email: normalizedEmail,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    const risk = await assessRegistrationRisk({
      email: normalizedEmail,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    if (!risk.allowed) {
      await recordAuthEventSafely({
        eventType: AuthEventType.RegisterRejected,
        email: normalizedEmail,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      return res.status(429).render('register', {
        values: { username: form.username, email: form.email },
        error: risk.message,
        nextPath,
      });
    }

    if (await findUserByEmail(normalizedEmail)) {
      await recordAuthEventSafely({
        eventType: AuthEventType.RegisterRejected,
        email: normalizedEmail,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      return res.status(409).render('register', {
        values: { username: form.username, email: form.email },
        error: 'Email is already registered.',
        nextPath,
      });
    }

    if (await findUserByUsername(form.username)) {
      await recordAuthEventSafely({
        eventType: AuthEventType.RegisterRejected,
        email: normalizedEmail,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      return res.status(409).render('register', {
        values: { username: form.username, email: form.email },
        error: 'Username is already taken.',
        nextPath,
      });
    }

    const user = await createUser({
      username: form.username,
      email: normalizedEmail,
      passwordHash: hashPassword(form.password),
    });

    const session = await createSession({
      userId: user.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    setSessionCookie(res, session.token, session.expiresAt);

    await recordAuthEventSafely({
      eventType: AuthEventType.RegisterSuccess,
      userId: user.id,
      email: normalizedEmail,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    const { delivery, manualVerificationPath: rawManualVerificationPath } = await issueAndSendVerification({
      req,
      user: {
        id: user.id,
        username: form.username,
        email: normalizedEmail,
      },
      nextPath,
    });
    const manualVerificationPath = allowManualVerificationLink ? rawManualVerificationPath : null;
    const notice = delivery.sent
      ? 'Verification email sent. Confirm your email to unlock full chapter access.'
      : manualVerificationPath
        ? 'Email provider is not configured yet. Use the one-time verification link below.'
        : 'Verification email delivery is unavailable right now. Please retry in a moment.';

    return renderVerifyEmailSent(res, {
      nextPath,
      error: null,
      notice,
      manualVerificationPath,
    });
  } catch (error) {
    await recordAuthEventSafely({
      eventType: AuthEventType.RegisterRejected,
      email: req.body.email || null,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    return res.status(400).render('register', {
      values: {
        username: req.body.username || '',
        email: req.body.email || '',
      },
      error: error.message || 'Unable to create account right now.',
      nextPath,
    });
  }
});

router.get('/login', (req, res) => {
  res.render('login', {
    values: { email: '' },
    error: null,
    nextPath: getSafeNextPath(req.query.next),
  });
});

router.post('/login', authLimiter, verifyCsrf, async (req, res) => {
  const nextPath = getSafeNextPath(req.body.next);

  try {
    const form = parseOrThrow(loginSchema, req.body);
    const normalizedEmail = form.email.toLowerCase();

    await recordAuthEventSafely({
      eventType: AuthEventType.LoginAttempt,
      email: normalizedEmail,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    const risk = await assessLoginRisk({
      email: normalizedEmail,
      ipAddress: req.ip,
    });

    if (!risk.allowed) {
      return res.status(429).render('login', {
        values: { email: form.email },
        error: risk.message,
        nextPath,
      });
    }

    const user = await findUserByEmail(normalizedEmail);

    if (!user || !verifyPassword(form.password, user.password_hash)) {
      await recordAuthEventSafely({
        eventType: AuthEventType.LoginRejected,
        email: normalizedEmail,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      return res.status(401).render('login', {
        values: { email: form.email },
        error: 'Invalid email or password.',
        nextPath,
      });
    }

    const session = await createSession({
      userId: user.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    setSessionCookie(res, session.token, session.expiresAt);

    await recordAuthEventSafely({
      eventType: AuthEventType.LoginSuccess,
      userId: user.id,
      email: normalizedEmail,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    if (!user.email_verified) {
      return res.redirect('/auth/verify-email/sent?next=' + encodeURIComponent(nextPath));
    }

    return res.redirect(nextPath);
  } catch (error) {
    return res.status(400).render('login', {
      values: { email: req.body.email || '' },
      error: error.message || 'Unable to sign in right now.',
      nextPath,
    });
  }
});

router.get('/verify-email/sent', requireAuthentication, (req, res) => {
  const nextPath = getSafeNextPath(req.query.next);

  if (req.user.emailVerified) {
    return res.redirect(nextPath);
  }

  return renderVerifyEmailSent(res, {
    nextPath,
    error: null,
    notice: 'Verify your email to unlock full chapter reading and publishing tools.',
    manualVerificationPath: null,
  });
});

router.post(
  '/verify-email/resend',
  requireAuthentication,
  resendVerificationLimiter,
  verifyCsrf,
  async (req, res) => {
    const nextPath = getSafeNextPath(req.body.next);

    if (req.user.emailVerified) {
      return res.redirect(nextPath);
    }

    const user = await findUserById(req.user.id);

    if (!user) {
      return res.status(404).render('error', {
        statusCode: 404,
        message: 'User not found.',
      });
    }

    const { delivery, manualVerificationPath: rawManualVerificationPath } = await issueAndSendVerification({
      req,
      user,
      nextPath,
    });
    const manualVerificationPath = allowManualVerificationLink ? rawManualVerificationPath : null;
    const notice = delivery.sent
      ? 'Verification email sent again. Check your inbox.'
      : manualVerificationPath
        ? 'Email provider is not configured yet. Use the one-time verification link below.'
        : 'Verification email delivery is unavailable right now. Please retry in a moment.';

    return renderVerifyEmailSent(res, {
      nextPath,
      error: null,
      notice,
      manualVerificationPath,
    });
  }
);

router.get('/verify-email', async (req, res) => {
  const nextPath = getSafeNextPath(req.query.next);
  const token = typeof req.query.token === 'string' ? req.query.token : '';
  const result = await verifyEmailToken(token);

  if (!result.ok) {
    return renderVerifyEmailSent(res, {
      nextPath,
      error: 'This verification link is invalid or expired. Request a new link.',
      notice: null,
      manualVerificationPath: null,
    });
  }

  return res.redirect(nextPath);
});

router.get('/human-check', requireAuthentication, (req, res) => {
  const nextPath = getSafeNextPath(req.query.next);

  if (!req.user.emailVerified) {
    return res.redirect('/auth/verify-email/sent?next=' + encodeURIComponent(nextPath));
  }

  if (hasValidReaderPass(req, req.user.id)) {
    return res.redirect(nextPath);
  }

  return renderHumanCheck(req, res, { nextPath, error: null });
});

router.post('/human-check', requireAuthentication, humanCheckLimiter, verifyCsrf, async (req, res) => {
  const nextPath = getSafeNextPath(req.body.next);
  const honeypot = typeof req.body.website === 'string' ? req.body.website.trim() : '';

  if (!req.user.emailVerified) {
    return res.redirect('/auth/verify-email/sent?next=' + encodeURIComponent(nextPath));
  }

  try {
    if (honeypot) {
      return renderHumanCheck(req, res, {
        nextPath,
        error: 'Verification failed. Please retry from a normal browser session.',
      });
    }

    let solved = false;

    if (isTurnstileConfigured()) {
      solved = await verifyTurnstileToken({
        token: req.body['cf-turnstile-response'],
        remoteIp: req.ip,
      });
    } else {
      solved = validateHumanChallenge({
        token: req.body.challengeToken,
        answer: req.body.challengeAnswer,
        userId: req.user.id,
        userAgent: req.get('user-agent'),
      });
    }

    if (!solved) {
      return renderHumanCheck(req, res, {
        nextPath,
        error: 'Could not verify human reader status. Please try again.',
      });
    }

    setReaderPass(res, req.user.id, req.get('user-agent'));
    return res.redirect(nextPath);
  } catch (_error) {
    return renderHumanCheck(req, res, {
      nextPath,
      error: 'Verification service is temporarily unavailable. Please try again.',
    });
  }
});

router.post('/logout', verifyCsrf, async (req, res) => {
  const token = req.cookies[SESSION_COOKIE_NAME];
  await destroySessionByToken(token);

  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
  clearReaderPass(res);

  return res.redirect('/');
});

module.exports = router;
