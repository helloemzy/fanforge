# Decisions Log

## 2026-03-06: Governance Automation Precondition

- Decision: enforce anti-drift checks as a hard precondition before deployment and release.
- Why: manual review alone has already shown drift risk around domain and anti-scrape claims.
- Implementation:
  - Added `scripts/check-governance.js` to scan docs/templates for forbidden absolute anti-scrape language outside policy files.
  - Added `npm run docs:governance` script.
  - Added `docs/RELEASE_GOVERNANCE_CHECKLIST.md` and `docs/CLOUDFLARE_DEPLOYMENT.md` step 0 references.

## 2026-03-06: Deployment Evidence Before Completion

- Decision: treat custom-domain migration as complete only after live DNS+HTTP validation on both `shippex.app` and `www.shippex.app`.
- Why: both hosts can have different binding states in Cloudflare and old provider records can cause false assumptions.
- Implementation:
  - Added mandatory DNS/HTTP validation requirement in runbooks.
  - Added explicit post-deploy status logging in `docs/IMPLEMENTATION_STATUS.md`.
- Implementation addendum: block final migration completion when API token lacks DNS cleanup scope, even if `shippex.app` succeeds; `www.shippex.app` requires DNS-manage credentials to clear legacy A/CNAME records.

## 2026-03-06: No Absolute Anti-Scrape Claims

- Decision: never promise absolute prevention of AI scraping or copying.
- Why: absolute guarantees are unverifiable and legally risky.
- Implementation:
  - `docs/CLAIMS_AND_GUARDRAILS.md` now enforces required wording (`harder to scrape`, `actively blocked`, `verified access`).
  - `.agents/product-marketing-context.md` and all visible claim surfaces reference this boundary.

## 2026-03-05: Public SEO + Protected Chapters

- Decision: allow indexing for public discovery, but restrict full chapter access.
- Why: growth requires search discovery; writer trust requires text protection.
- Implementation:
  - Public pages `index,follow` with no-snippet/noai directives.
  - AI crawler deny in middleware and `robots.txt`.
  - Full chapters gated by auth + email verification + human check.

## 2026-03-05: No Absolute Anti-Scrape Claims

- Decision: ban absolute language ("cannot scrape", "impossible").
- Why: technically undefensible and trust-risky.
- Implementation:
  - Added product context memory and claims guardrails docs.
  - Standardized copy to "public titles, protected chapters."

## 2026-03-05: Verification Email Is Mandatory For Trusted Access

- Decision: verification email required for publishing and full reads.
- Why: reduce throwaway bot accounts and scripted abuse.
- Implementation:
  - Verification token flow + provider-backed email delivery.
  - Manual-link fallback disabled by default.

## 2026-03-05: Runtime Reliability Cutover To Postgres + Object Storage

- Decision: replace local SQLite and disk-based upload reliance in production path.
- Why: Vercel filesystem is ephemeral; writer content and session flows need durable infrastructure.
- Implementation:
  - Added async Postgres data layer (`pg`) with schema migrations.
  - Added `pg-mem` fallback for local development without managed DB.
  - Converted auth/work/home data callsites to async-safe repository usage.
  - Switched cover uploads to memory + S3-compatible object storage.
  - Disabled Vercel local upload fallback when storage env vars are missing.

## 2026-03-05: Deployment Platform Migrated To Cloudflare Workers

- Decision: switch deployment target from Vercel to Cloudflare Workers.
- Why: consolidate edge security posture and runtime controls with Cloudflare routing and bot controls.
- Implementation:
  - Added `wrangler.jsonc` with `nodejs_compat` Worker runtime config.
  - Added Worker entrypoint using `httpServerHandler` adapter.
  - Added Cloudflare runtime path handling for `/bundle/public` and `/bundle/views`.
  - Updated docs/scripts for `wrangler` deployment workflow.

## 2026-03-05: Cloudflare Worker Runtime Compatibility Hardening

- Decision: keep Express/EJS architecture, but add Worker-compatible runtime adaptations.
- Why: Worker global-scope restrictions and request-time eval restrictions break default middleware/template behavior.
- Implementation:
  - Replaced Worker runtime rate limiting with interval-free in-memory limiter.
  - Added startup EJS template precompilation cache to avoid request-time code generation.
  - Registered EJS engine explicitly to avoid dynamic runtime requires in Worker bundle.
