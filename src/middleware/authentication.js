const {
  readSessionFromToken,
  runSessionCleanup,
} = require('../services/sessionService');

const SESSION_COOKIE_NAME = 'fanforge_session';

let requestCounter = 0;

const attachCurrentUser = async (req, res, next) => {
  try {
    requestCounter += 1;

    if (requestCounter % 100 === 0) {
      runSessionCleanup().catch((error) => {
        console.error('[FanForge] Session cleanup failed', error);
      });
    }

    const token = req.cookies[SESSION_COOKIE_NAME];
    const session = await readSessionFromToken(token);

    req.session = session;
    req.user = session?.user || null;

    res.locals.currentUser = req.user;

    next();
  } catch (error) {
    next(error);
  }
};

const requireAuthentication = (req, res, next) => {
  if (!req.user) {
    return res.redirect('/auth/login?next=' + encodeURIComponent(req.originalUrl));
  }

  return next();
};

const requireVerifiedEmail = (req, res, next) => {
  if (!req.user) {
    return res.redirect('/auth/login?next=' + encodeURIComponent(req.originalUrl));
  }

  if (!req.user.emailVerified) {
    return res.redirect('/auth/verify-email/sent?next=' + encodeURIComponent(req.originalUrl));
  }

  return next();
};

module.exports = {
  SESSION_COOKIE_NAME,
  attachCurrentUser,
  requireAuthentication,
  requireVerifiedEmail,
};
