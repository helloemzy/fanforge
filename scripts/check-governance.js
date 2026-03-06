const fs = require('fs');
const path = require('path');

const FORBIDDEN_PATTERNS = [
  { label: 'cannot be scraped', regex: /\bcannot be scraped\b/gi },
  { label: 'cannot scrape', regex: /\bcannot scrape\b/gi },
  { label: 'AI cannot scrape', regex: /\bAI\s+cannot\s+scrape\b/gi },
  { label: 'impossible to scrape', regex: /\bimpossible to scrape\b/gi },
  { label: 'impossible to copy', regex: /\bimpossible to copy\b/gi },
  { label: 'guaranteed impossible', regex: /\bguaranteed\s+impossible\b/gi },
  { label: 'zero scraping', regex: /\bzero\s+scraping\b/gi },
];

const CWD = process.cwd();

const ALLOWED_FILES = new Set([
  'AGENTS.md',
  path.join('.agents', 'product-marketing-context.md'),
  path.join('docs', 'CLAIMS_AND_GUARDRAILS.md'),
  path.join('docs', 'DECISIONS.md'),
]);

const FILES_TO_SCAN = [
  'README.md',
  'AGENTS.md',
  path.join('.agents', 'product-marketing-context.md'),
  path.join('docs'),
  path.join('views'),
];

const walk = (dir) => {
  const full = path.join(CWD, dir);

  if (!fs.existsSync(full)) {
    return [];
  }

  const entries = fs.readdirSync(full, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...walk(entryPath));
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const isMd = entry.name.endsWith('.md');
    const isEjs = entry.name.endsWith('.ejs');

    if (isMd || isEjs) {
      files.push(entryPath);
    }
  }

  return files;
};

const normalize = (p) => path.relative(CWD, path.resolve(CWD, p));

const scanFile = (fileRel) => {
  const abs = path.join(CWD, fileRel);
  const content = fs.readFileSync(abs, 'utf8');
  const found = [];

  for (const pattern of FORBIDDEN_PATTERNS) {
    const matches = [...content.matchAll(pattern.regex)];

    if (matches.length > 0 && !ALLOWED_FILES.has(normalize(fileRel))) {
      found.push({ label: pattern.label, count: matches.length });
    }
  }

  return found;
};

const requiredFiles = [
  'README.md',
  path.join('docs', 'IMPLEMENTATION_STATUS.md'),
  path.join('docs', 'CLAIMS_AND_GUARDRAILS.md'),
  path.join('docs', 'CLOUDFLARE_DEPLOYMENT.md'),
  path.join('docs', 'CUSTOM_DOMAIN_MIGRATION_RUNBOOK.md'),
  path.join('docs', 'DECISIONS.md'),
  path.join('docs', 'EXECUTION_ROADMAP.md'),
  path.join('docs', 'RELEASE_GOVERNANCE_CHECKLIST.md'),
  path.join('.agents', 'product-marketing-context.md'),
  'AGENTS.md',
];

const missing = requiredFiles.filter((f) => !fs.existsSync(path.join(CWD, f)));

if (missing.length > 0) {
  console.error('Missing required governance docs:');
  for (const file of missing) {
    console.error(`- ${file}`);
  }
  process.exitCode = 1;
}

const targets = [
  ...FILES_TO_SCAN.flatMap((entry) => {
    const abs = path.join(CWD, entry);

    if (!fs.existsSync(abs)) {
      return [];
    }

    const stat = fs.statSync(abs);
    return stat.isDirectory() ? walk(entry) : [entry];
  }),
];

const violations = [];

for (const file of targets) {
  if (!fs.existsSync(file)) {
    continue;
  }

  const issues = scanFile(file);
  for (const issue of issues) {
    violations.push({
      file,
      label: issue.label,
      count: issue.count,
    });
  }
}

if (violations.length > 0) {
  console.error('Governance scan failed: forbidden public-claim language detected.');
  for (const violation of violations) {
    const line = `${violation.file}: ${violation.label} (${violation.count})`;
    console.error(`- ${line}`);
  }
  console.error('Allowed in policy docs only (AGENTS, claims docs, decisions).');
  process.exitCode = 1;
}

if (process.exitCode === 1) {
  process.exit(process.exitCode);
}

if (violations.length === 0 && missing.length === 0) {
  console.log('Governance check passed: required docs present and no forbidden claim text outside policy docs.');
}
