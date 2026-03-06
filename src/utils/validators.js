const { z } = require('zod');

const usernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(24)
  .regex(/^[a-zA-Z0-9_]+$/, 'Use only letters, numbers, and underscore.');

const emailSchema = z.string().trim().email().max(160);

const passwordSchema = z
  .string()
  .min(12, 'Use at least 12 characters for stronger account security.')
  .max(128);

const registrationSchema = z.object({
  username: usernameSchema,
  email: emailSchema,
  password: passwordSchema,
});

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
});

const workSchema = z.object({
  title: z.string().trim().min(3).max(140),
  summary: z.string().trim().min(10).max(1400),
  content: z.string().trim().min(50).max(200000),
  fandom: z.string().trim().min(2).max(80),
  rating: z.enum(['General', 'Teen', 'Mature', 'Explicit']),
  status: z.enum(['WIP', 'Complete']),
  tags: z.string().trim().max(500).default(''),
});

const commentSchema = z.object({
  body: z.string().trim().min(2).max(1500),
});

const bookmarkSchema = z.object({
  note: z.string().trim().max(300).default(''),
});

const parseOrThrow = (schema, payload) => {
  const parsed = schema.safeParse(payload);

  if (parsed.success) {
    return parsed.data;
  }

  throw new Error(parsed.error.issues[0]?.message || 'Invalid form input.');
};

module.exports = {
  parseOrThrow,
  registrationSchema,
  loginSchema,
  workSchema,
  commentSchema,
  bookmarkSchema,
};
