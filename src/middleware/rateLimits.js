const rateLimit = require('express-rate-limit');
const { isCloudflareRuntime } = require('../config/runtimePaths');

const { ipKeyGenerator } = rateLimit;

const normalizeIp = (ip) => {
  if (!ip || typeof ip !== 'string') {
    return 'unknown';
  }

  return ip.trim().toLowerCase();
};

const requestKey = (req) => {
  if (req.user?.id) {
    return `user:${req.user.id}`;
  }

  if (isCloudflareRuntime) {
    return `ip:${normalizeIp(req.ip || '')}`;
  }

  return `ip:${ipKeyGenerator(req.ip || '')}`;
};

const createCloudflareLimiter = ({ windowMs, limit, keyGenerator, message }) => {
  const counters = new Map();
  let gcCounter = 0;

  return (req, res, next) => {
    const now = Date.now();
    const key = keyGenerator ? keyGenerator(req) : requestKey(req);
    const existing = counters.get(key);

    if (!existing || existing.resetAt <= now) {
      counters.set(key, {
        count: 1,
        resetAt: now + windowMs,
      });
    } else {
      existing.count += 1;
    }

    const current = counters.get(key);
    const remaining = Math.max(0, limit - current.count);

    res.setHeader('RateLimit-Limit', String(limit));
    res.setHeader('RateLimit-Remaining', String(remaining));
    res.setHeader('RateLimit-Reset', String(Math.ceil((current.resetAt - now) / 1000)));

    gcCounter += 1;

    if (gcCounter % 200 === 0 && counters.size > 2000) {
      for (const [storedKey, state] of counters) {
        if (state.resetAt <= now) {
          counters.delete(storedKey);
        }
      }
    }

    if (current.count > limit) {
      return res.status(429).render('error', {
        statusCode: 429,
        message,
      });
    }

    return next();
  };
};

const createLimiter = ({ windowMs, limit, keyGenerator, message }) => {
  if (isCloudflareRuntime) {
    return createCloudflareLimiter({
      windowMs,
      limit,
      keyGenerator,
      message,
    });
  }

  return rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator,
    message,
  });
};

const authLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 25,
  message: 'Too many authentication attempts. Try again in 15 minutes.',
});

const createWriteLimiter = createLimiter({
  windowMs: 10 * 60 * 1000,
  limit: 30,
  message: 'Too many write requests. Slow down and try again shortly.',
});

const uploadLimiter = createLimiter({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  message: 'Upload limit reached. Try again in a few minutes.',
});

const readLimiter = createLimiter({
  windowMs: 60 * 1000,
  limit: 120,
  message: 'Reading rate limit reached. Please pause for a minute and retry.',
});

const fullReadLimiter = createLimiter({
  windowMs: 60 * 1000,
  limit: 30,
  keyGenerator: requestKey,
  message: 'Too many chapter views in a short burst. Please slow down and retry.',
});

const humanCheckLimiter = createLimiter({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  keyGenerator: requestKey,
  message: 'Too many verification attempts. Please wait a few minutes and try again.',
});

const resendVerificationLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  keyGenerator: requestKey,
  message: 'Too many verification email requests. Please wait before retrying.',
});

module.exports = {
  authLimiter,
  createLimiter: createWriteLimiter,
  uploadLimiter,
  readLimiter,
  fullReadLimiter,
  humanCheckLimiter,
  resendVerificationLimiter,
};
