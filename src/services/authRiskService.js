const crypto = require('node:crypto');
const {
  insertAuthEvent,
  countAuthEventsByIpAndType,
  countAuthEventsByEmailAndType,
} = require('../db/authEventRepository');

const AUTOMATION_AGENT_MATCHERS = [
  /HeadlessChrome/i,
  /Playwright/i,
  /Puppeteer/i,
  /Selenium/i,
  /curl\//i,
  /Wget\//i,
  /python-requests/i,
];

const DISPOSABLE_EMAIL_DOMAINS = new Set([
  'mailinator.com',
  'tempmail.com',
  '10minutemail.com',
  'guerrillamail.com',
  'yopmail.com',
  'trashmail.com',
  'sharklasers.com',
  'getnada.com',
  'maildrop.cc',
  'dispostable.com',
  'moakt.com',
  'temp-mail.org',
]);

const AuthEventType = {
  RegisterAttempt: 'register_attempt',
  RegisterRejected: 'register_rejected',
  RegisterSuccess: 'register_success',
  LoginAttempt: 'login_attempt',
  LoginRejected: 'login_rejected',
  LoginSuccess: 'login_success',
};

const toHash = (value) => {
  if (!value) {
    return null;
  }

  return crypto.createHash('sha256').update(String(value)).digest('hex');
};

const sinceIso = (millisecondsAgo) => {
  return new Date(Date.now() - millisecondsAgo).toISOString();
};

const normalizeEmail = (email) => {
  if (!email || typeof email !== 'string') {
    return '';
  }

  return email.trim().toLowerCase();
};

const getEmailDomain = (email) => {
  const normalized = normalizeEmail(email);
  const separator = normalized.lastIndexOf('@');

  if (separator < 0) {
    return '';
  }

  return normalized.slice(separator + 1);
};

const recordAuthSecurityEvent = async ({ eventType, userId, email, ipAddress, userAgent }) => {
  await insertAuthEvent({
    eventType,
    userId,
    email: normalizeEmail(email) || null,
    ipHash: toHash(ipAddress),
    uaHash: toHash(userAgent),
  });
};

const assessRegistrationRisk = async ({ email, ipAddress, userAgent }) => {
  const domain = getEmailDomain(email);

  if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
    return {
      allowed: false,
      message: 'Disposable email domains are blocked for community safety.',
    };
  }

  if (AUTOMATION_AGENT_MATCHERS.some((matcher) => matcher.test(userAgent || ''))) {
    return {
      allowed: false,
      message: 'Automated registration is blocked. Please use a normal browser session.',
    };
  }

  const ipHash = toHash(ipAddress);
  const registrationsFromIp = await countAuthEventsByIpAndType({
    eventType: AuthEventType.RegisterSuccess,
    ipHash,
    sinceIso: sinceIso(24 * 60 * 60 * 1000),
  });

  if (registrationsFromIp >= 3) {
    return {
      allowed: false,
      message: 'Too many accounts were created from this network in 24 hours. Try again later.',
    };
  }

  const rejectedFromIp = await countAuthEventsByIpAndType({
    eventType: AuthEventType.RegisterRejected,
    ipHash,
    sinceIso: sinceIso(60 * 60 * 1000),
  });

  if (rejectedFromIp >= 10) {
    return {
      allowed: false,
      message: 'Registration is temporarily paused from this network. Try again in an hour.',
    };
  }

  const attemptsByEmail = await countAuthEventsByEmailAndType({
    eventType: AuthEventType.RegisterAttempt,
    email,
    sinceIso: sinceIso(30 * 60 * 1000),
  });

  if (attemptsByEmail >= 6) {
    return {
      allowed: false,
      message: 'Too many attempts for this email. Please wait before retrying.',
    };
  }

  return { allowed: true };
};

const assessLoginRisk = async ({ email, ipAddress }) => {
  const ipHash = toHash(ipAddress);

  const failedLoginsFromIp = await countAuthEventsByIpAndType({
    eventType: AuthEventType.LoginRejected,
    ipHash,
    sinceIso: sinceIso(15 * 60 * 1000),
  });

  if (failedLoginsFromIp >= 12) {
    return {
      allowed: false,
      message: 'Login temporarily blocked from this network. Please try again in 15 minutes.',
    };
  }

  const failedLoginsForEmail = await countAuthEventsByEmailAndType({
    eventType: AuthEventType.LoginRejected,
    email,
    sinceIso: sinceIso(15 * 60 * 1000),
  });

  if (failedLoginsForEmail >= 8) {
    return {
      allowed: false,
      message: 'Too many failed login attempts for this account. Please wait and retry.',
    };
  }

  return { allowed: true };
};

module.exports = {
  AuthEventType,
  recordAuthSecurityEvent,
  assessRegistrationRisk,
  assessLoginRisk,
};
