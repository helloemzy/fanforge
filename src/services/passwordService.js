const crypto = require('node:crypto');

const PBKDF2_ITERATIONS = 210000;
const HASH_LENGTH = 32;
const DIGEST = 'sha256';

const hashPassword = (password) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto
    .pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, HASH_LENGTH, DIGEST)
    .toString('hex');

  return `${salt}:${derivedKey}`;
};

const verifyPassword = (password, storedHash) => {
  const [salt, expectedHash] = storedHash.split(':');

  if (!salt || !expectedHash) {
    return false;
  }

  const candidateHash = crypto
    .pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, HASH_LENGTH, DIGEST)
    .toString('hex');

  const expected = Buffer.from(expectedHash, 'hex');
  const candidate = Buffer.from(candidateHash, 'hex');

  if (expected.length !== candidate.length) {
    return false;
  }

  return crypto.timingSafeEqual(expected, candidate);
};

module.exports = {
  hashPassword,
  verifyPassword,
};
