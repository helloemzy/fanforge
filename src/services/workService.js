const { slugExists } = require('../db/workRepository');

const slugify = (value) => {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
};

const generateUniqueSlug = async (title) => {
  const base = slugify(title) || 'untitled-work';

  if (!(await slugExists(base))) {
    return base;
  }

  let counter = 2;

  while (counter < 5000) {
    const candidate = `${base}-${counter}`;

    if (!(await slugExists(candidate))) {
      return candidate;
    }

    counter += 1;
  }

  return `${base}-${Date.now()}`;
};

const countWords = (content) => {
  const trimmed = content.trim();

  if (!trimmed) {
    return 0;
  }

  return trimmed.split(/\s+/u).length;
};

const normalizeTags = (tagInput) => {
  const uniqueTags = new Set();

  for (const rawTag of tagInput.split(',')) {
    const cleaned = rawTag.trim().replace(/\s+/g, ' ').slice(0, 40);

    if (cleaned.length > 1 && cleaned.length <= 40) {
      uniqueTags.add(cleaned);
    }

    if (uniqueTags.size >= 10) {
      break;
    }
  }

  return Array.from(uniqueTags);
};

module.exports = {
  generateUniqueSlug,
  countWords,
  normalizeTags,
};
