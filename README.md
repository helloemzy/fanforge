# FanForge

FanForge is a fanfiction platform focused on writer trust and reader UX.

- Public titles and metadata are indexable for discovery.
- Full chapter text is protected behind trusted member access.
- Known AI crawlers are blocked and fanworks are not licensed for model training.

## Stack

- Node.js + Express + EJS
- Cloudflare Workers runtime via `cloudflare:node` + `httpServerHandler`
- Managed PostgreSQL (`pg`)
- `pg-mem` fallback for local/dev smoke runs when `DATABASE_URL` is missing
- S3-compatible object storage for cover uploads (`@aws-sdk/client-s3`)
- Session + CSRF + rate limiting + human verification controls

## Core behavior

- Public discovery: title-level SEO and searchable listings.
- Protected reading: full text requires login + verified email + human check.
- Publishing: verified members can publish/edit works with tags and cover images.
- Social features: kudos, comments, bookmarks.

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Environment variables

Copy `.env.example` and set values for local development.

Required for production:

- `DATABASE_URL`
- `APP_BASE_URL` (e.g. `https://www.shippex.app`)
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL` (e.g. `reply@shippex.app`)
- `STORAGE_BUCKET`
- `STORAGE_ENDPOINT`
- `STORAGE_ACCESS_KEY_ID`
- `STORAGE_SECRET_ACCESS_KEY`
- `STORAGE_PUBLIC_BASE_URL`

Optional but recommended:

- `TURNSTILE_SITE_KEY`
- `TURNSTILE_SECRET_KEY`
- `READER_SHIELD_SECRET`
- `SESSION_SECRET`

## Deploy to Cloudflare Workers

```bash
npm run cf:deploy
```

For Cloudflare production configuration use:

- `wrangler secret put DATABASE_URL`
- `wrangler secret put RESEND_API_KEY`
- `wrangler secret put STORAGE_ACCESS_KEY_ID`
- `wrangler secret put STORAGE_SECRET_ACCESS_KEY`
- `wrangler secret put READER_SHIELD_SECRET`
- `wrangler secret put SESSION_SECRET`
- `wrangler secret put TURNSTILE_SECRET_KEY` (if enabled)

Set non-secret vars in `wrangler.jsonc` or with `wrangler deploy --var`:

- `APP_BASE_URL`
- `RESEND_FROM_EMAIL`
- `STORAGE_BUCKET`
- `STORAGE_ENDPOINT`
- `STORAGE_PUBLIC_BASE_URL`
- `STORAGE_REGION`
- `TURNSTILE_SITE_KEY` (if enabled)

## Verification commands

```bash
npm run docs:governance
npm run check
```

## Product governance docs

- Product context: `.agents/product-marketing-context.md`
- Claim guardrails: `docs/CLAIMS_AND_GUARDRAILS.md`
- Decision log: `docs/DECISIONS.md`
- Implementation status: `docs/IMPLEMENTATION_STATUS.md`
- Custom domain runbook: `docs/CUSTOM_DOMAIN_MIGRATION_RUNBOOK.md`
- Cloudflare runbook: `docs/CLOUDFLARE_DEPLOYMENT.md`
- Release governance checklist: `docs/RELEASE_GOVERNANCE_CHECKLIST.md`
- Execution roadmap: `docs/EXECUTION_ROADMAP.md`
- Repository instructions: `AGENTS.md`
