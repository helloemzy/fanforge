const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const ejs = require('ejs');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');

require('./db/database');

const authRoutes = require('./routes/authRoutes');
const workRoutes = require('./routes/workRoutes');
const {
  listWorks,
  listTrendingTags,
  listFandoms,
  getCommunitySnapshot,
} = require('./db/workRepository');
const { attachCurrentUser } = require('./middleware/authentication');
const { attachCsrfToken } = require('./middleware/csrfProtection');
const { textToParagraphs, shortDate } = require('./utils/textFormatting');
const { readLimiter } = require('./middleware/rateLimits');
const {
  attachAiShieldHeaders,
  blockKnownAiCrawlers,
} = require('./middleware/aiShield');
const {
  isCloudflareRuntime,
  uploadsDirectory,
  publicDirectory,
  viewsDirectory,
} = require('./config/runtimePaths');

const listEjsTemplates = (rootDirectory) => {
  const templates = [];
  const stack = [rootDirectory];

  while (stack.length > 0) {
    const current = stack.pop();

    if (!fs.existsSync(current)) {
      continue;
    }

    const entries = fs.readdirSync(current, { withFileTypes: true });

    for (const entry of entries) {
      const absolutePath = path.join(current, entry.name);

      if (entry.isDirectory()) {
        stack.push(absolutePath);
        continue;
      }

      if (entry.isFile() && entry.name.endsWith('.ejs')) {
        templates.push(absolutePath);
      }
    }
  }

  return templates;
};

const primeEjsTemplateCache = () => {
  if (!isCloudflareRuntime) {
    return;
  }

  try {
    const templates = listEjsTemplates(viewsDirectory);

    for (const templatePath of templates) {
      const source = fs.readFileSync(templatePath, 'utf8');
      const compiled = ejs.compile(source, {
        filename: templatePath,
        cache: true,
      });

      ejs.cache.set(templatePath, compiled);
    }

    console.log(`[FanForge] Primed EJS template cache with ${templates.length} templates.`);
  } catch (error) {
    console.error('[FanForge] Failed to prime EJS template cache in Cloudflare runtime', error);
  }
};

primeEjsTemplateCache();

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.engine('ejs', ejs.__express);
app.set('view engine', 'ejs');
app.set('views', viewsDirectory);
app.enable('view cache');

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'same-origin' },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", 'https://challenges.cloudflare.com'],
        styleSrc: ["'self'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:'],
        frameSrc: ["'self'", 'https://challenges.cloudflare.com'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
  })
);

app.use(express.urlencoded({ extended: false, limit: '250kb' }));
app.use(express.json({ limit: '250kb' }));
app.use(cookieParser());
app.use(attachAiShieldHeaders);
app.use(blockKnownAiCrawlers);

app.use('/public', express.static(publicDirectory));
app.use('/uploads', express.static(uploadsDirectory));

app.use(attachCurrentUser);
app.use(attachCsrfToken);

app.locals.textToParagraphs = textToParagraphs;
app.locals.shortDate = shortDate;

const allowedRatings = new Set(['General', 'Teen', 'Mature', 'Explicit']);
const allowedStatuses = new Set(['WIP', 'Complete']);

app.get('/robots.txt', (_req, res) => {
  res.type('text/plain');
  res.send(
    `User-agent: *\nAllow: /\nDisallow: /auth/\nDisallow: /works/new\nDisallow: /works/*/edit\nDisallow: /uploads/\n\nUser-agent: GPTBot\nDisallow: /\n\nUser-agent: ClaudeBot\nDisallow: /\n\nUser-agent: ChatGPT-User\nDisallow: /\n\nUser-agent: CCBot\nDisallow: /\n\nUser-agent: Google-Extended\nDisallow: /\n\nUser-agent: anthropic-ai\nDisallow: /\n`
  );
});

app.get('/ai-policy.txt', (_req, res) => {
  res.type('text/plain');
  res.send(`FanForge AI Shield Policy

- Public discovery supports title indexing, not full-text exposure.
- No crawler permission for AI training ingestion.
- No licensing of fanworks for model training.
- Known AI crawlers and automation clients are actively blocked.
- Full chapter access requires verified-email + human-verified sessions.
- Reader views contain invisible provenance signatures.
`);
});

app.get('/', readLimiter, async (req, res, next) => {
  try {
    const search = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
    const fandom = typeof req.query.fandom === 'string' ? req.query.fandom.trim().slice(0, 80) : '';
    const tag = typeof req.query.tag === 'string' ? req.query.tag.trim().slice(0, 40) : '';

    const rating =
      typeof req.query.rating === 'string' && allowedRatings.has(req.query.rating)
        ? req.query.rating
        : '';

    const status =
      typeof req.query.status === 'string' && allowedStatuses.has(req.query.status)
        ? req.query.status
        : '';

    const [works, trendingTags, fandoms, snapshot] = await Promise.all([
      listWorks({
        search: search || null,
        fandom: fandom || null,
        rating: rating || null,
        status: status || null,
        tag: tag || null,
        limit: 40,
        offset: 0,
      }),
      listTrendingTags(12),
      listFandoms(20),
      getCommunitySnapshot(),
    ]);

    res.render('home', {
      works,
      trendingTags,
      fandoms,
      snapshot,
      filters: {
        q: search,
        fandom,
        rating,
        status,
        tag,
      },
    });
  } catch (error) {
    next(error);
  }
});

app.use('/auth', authRoutes);
app.use('/works', workRoutes);

app.use((_req, res) => {
  res.status(404).render('error', {
    statusCode: 404,
    message: 'That page does not exist.',
  });
});

app.use((error, req, res, _next) => {
  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).render('error', {
      statusCode: 400,
      message: 'Upload must be 2MB or smaller.',
    });
  }

  if (error.message?.includes('Only JPG, PNG, WEBP, and GIF')) {
    return res.status(400).render('error', {
      statusCode: 400,
      message: error.message,
    });
  }

  console.error(error);

  if (res.headersSent) {
    return;
  }

  return res.status(500).render('error', {
    statusCode: 500,
    message: 'Something failed on the server.',
  });
});

module.exports = app;
