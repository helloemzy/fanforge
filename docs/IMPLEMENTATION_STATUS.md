# Implementation Status (2026-03-06)

## Completed

- [x] Async Postgres repository layer is in place.
- [x] Auth/work/home routes migrated to async-safe DB usage.
- [x] Cover upload pipeline switched to memory upload + S3-compatible object storage.
- [x] Vercel and Cloudflare runtimes both block silent local upload fallback.
- [x] Dependency updates: `pg`, `pg-mem`, `@aws-sdk/client-s3`.
- [x] Cloudflare Worker adapter added (`worker/index.mjs`).
- [x] Wrangler deployment config added (`wrangler.jsonc`).
- [x] Cloudflare-safe rate limiting (no global startup timers in Worker runtime).
- [x] Cloudflare-safe EJS rendering via startup template precompilation.
- [x] Docs/env templates updated for Cloudflare deployment.
- [x] Local smoke check passed.
- [x] Cloudflare deployment succeeded: `https://fanforge.emily-737.workers.dev`.
- [x] Cloudflare deployment runbook documented.
- [x] Custom-domain migration runbook documented.
- [x] Execution roadmap created for remaining build phases.
- [x] Governance automation added (`scripts/check-governance.js`) and `docs:governance` npm script.
- [x] Release governance checklist documented.
- [x] Persistent reading progress added with server-backed sync for trusted reader sessions.
- [x] Continue-reading shelf added to home feed for signed-in readers.
- [x] Reader resume UI added with saved-place indicator, resume button, and sync status.
- [x] `shippex.app` custom domain attached and returns HTTP 200.
- [x] Confirmed Cloudflare zone ID for `shippex.app` is `49d6b3c84f37226ca505433768c762a4`.
- [x] GitHub remote configured: `https://github.com/helloemzy/fanforge`.
- [x] Git repository pushed to GitHub `main` and deployment workflow wired.
- [x] GitHub secret wiring to Cloudflare is complete:
  - `CLOUDFLARE_API_TOKEN`
  - `CLOUDFLARE_ACCOUNT_ID`
- [x] Verified GitHub workflow run `22750990026` completed successfully on latest docs/metadata push.
- [x] Smoke test now verifies progress save and continue-reading shelf behavior.

## Live Cloudflare Route Checks

- `GET /` -> `200` (`https://fanforge.emily-737.workers.dev/`)
- `GET /auth/register` -> `200`
- `GET /auth/login` -> `200`
- `GET /works/new` -> `302`
- `GET /robots.txt` -> `200`
- `GET /ai-policy.txt` -> `200`
- `GET https://shippex.app/` -> `200`
  - Resolved via DoH to Vercel edge IPs: `172.67.183.14`, `104.21.36.13` but headers indicate request still reaching FanForge stack (no Vercel error header).
- `GET https://shippex.app/robots.txt` -> `200`
- `GET https://shippex.app/ai-policy.txt` -> `200`
- `GET https://www.shippex.app/` -> `404` (`x-vercel-error: DEPLOYMENT_NOT_FOUND`)
- DNS nameserver answer from Cloudflare DNS for both hosts currently returns Vercel A records.

## Latest Verification

- `npx wrangler deploy` baseline succeeds.
- `npx wrangler deploy --domain shippex.app --domain www.shippex.app` re-run at 2026-03-06 06:19:23 UTC still fails with Cloudflare API 100117:
  - Hostname `'www.shippex.app'` already has externally managed DNS records (A/CNAME).
- Re-run attempt after prior cleanup confirmation also fails with code 100117.
- Cloudflare API token used is OAuth token with `zone:read` but no DNS write/edit scope.
- `GET /accounts/73711a4e0ed22fe53395252395a22c60/workers/scripts/fanforge/domains/records` returns only:
  - `shippex.app`
  - (no `www.shippex.app` binding)

## Current Status

- `shippex.app` custom domain is live and reachable.
- `www.shippex.app` is blocked by residual DNS at DNS level.
  - `www.shippex.app` still resolves to Vercel A-record targets (`172.67.183.14`, `104.21.36.13`) across repeated checks.
  - Route binding for `www.shippex.app` cannot be attached without clearing legacy DNS records.
- GitHub Actions deploy pipeline is healthy and latest run is successful.

## Pending Production Configuration

- [ ] `DATABASE_URL`
- [ ] `APP_BASE_URL`
- [ ] `RESEND_API_KEY`
- [ ] `RESEND_FROM_EMAIL`
- [ ] `STORAGE_BUCKET`
- [ ] `STORAGE_ENDPOINT`
- [ ] `STORAGE_ACCESS_KEY_ID`
- [ ] `STORAGE_SECRET_ACCESS_KEY`
- [ ] `STORAGE_PUBLIC_BASE_URL`
- [ ] Remove legacy `www.shippex.app` DNS records (A/CNAME) so Cloudflare can attach.
- [ ] Provision a DNS-edit-capable Cloudflare token and remove conflicting records.
- [ ] Re-run `npx wrangler deploy --domain shippex.app --domain www.shippex.app`.
- [ ] Re-run `curl -I https://www.shippex.app` verification.
- [ ] Run `npm run check` in production-equivalent environment after each deploy.

## Notes

- `www.shippex.app` remains blocked by externally managed DNS (`A` records pointing to Vercel) after zone migration.
- Domain attach is complete only after both hosts validate and return the application payload.
- All evidence for this blocker is captured in deployment logs, DNS lookups, and API responses.

## Git Repo Status (2026-03-06)

- [x] Initialized `/Users/emily/fanforge` as a git repository.
- [x] GitHub remote exists and repo is pushed: `helloemzy/fanforge`.
- [x] GitHub-hosted deploy trigger to Cloudflare is active in `.github/workflows/cloudflare-workers-deploy.yml`.
- [x] GitHub secret wiring to Cloudflare is complete: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.
