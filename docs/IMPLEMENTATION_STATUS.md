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
- [x] Execution roadmap created for the remaining build phases.
- [x] Governance automation added (`scripts/check-governance.js`) and `docs:governance` npm script.
- [x] Release governance checklist documented.
- [x] `shippex.app` custom domain attached and returns HTTP 200.
- [x] Confirmed Cloudflare zone ID for `shippex.app` is `49d6b3c84f37226ca505433768c762a4`.

## Live Cloudflare Route Checks

- `GET /` -> `200` (`https://fanforge.emily-737.workers.dev/`)
- `GET /auth/register` -> `200`
- `GET /auth/login` -> `200`
- `GET /works/new` -> `302`
- `GET /robots.txt` -> `200`
- `GET /ai-policy.txt` -> `200`
- `GET https://shippex.app/` -> `200`
- `GET https://shippex.app/robots.txt` -> `200`
- `GET https://shippex.app/ai-policy.txt` -> `200`
- `GET https://www.shippex.app/` -> `404` (`x-vercel-error: DEPLOYMENT_NOT_FOUND`)
- `shippex.app` zone DNS currently resolves through Cloudflare nameservers `cash.ns.cloudflare.com` and `sarah.ns.cloudflare.com`.

## Latest Verification

- `npx wrangler deploy` succeeded (baseline worker + base domain)
  - `shippex.app` attached to Workers with HTTP 200
- `npx wrangler deploy --domain shippex.app --domain www.shippex.app` failed with Cloudflare API 100117
  - Hostname `'www.shippex.app'` already has externally managed DNS records
- Re-run on 2026-03-06 02:24 UTC after reported cleanup still failed with API 100117.
- Direct check confirms `www.shippex.app` resolves to Vercel IPs
  - `172.67.183.14` and `104.21.36.13`
- Re-trying with explicit `override_existing_dns_record: true` payload to Cloudflare API also fails with 100117.
- Latest retry (2026-03-06 02:24 UTC) still reports 100117.
- Direct API verification using current OAuth token:
  - `GET /zones?name=shippex.app` returns zone id `49d6b3c84f37226ca505433768c762a4`.
  - `GET /zones/{zone}/dns_records` returns auth error (DNS scope missing).
  - `GET /accounts/{account}/workers/scripts/fanforge/domains/records` currently returns only `shippex.app` binding.

## Current Status

- `shippex.app` custom domain is live and correct.
- `www.shippex.app` is blocked by residual DNS at DNS level:
  - Cloudflare nameserver check shows zone `shippex.app` is active on Cloudflare.
  - DNS query to public resolvers shows `www.shippex.app` resolves to Vercel edge A records, not `fanforge` Worker.
- This is now a DNS cleanup blocker, not a Wrangler routing/deploy blocker.

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
- [ ] Ensure DNS-capable Cloudflare credentials are available (`zone:read`, `DNS:Edit` or equivalent) before retrying `www` attach.
- [ ] Run DNS cleanup verification: `curl -I https://www.shippex.app` and `curl -s '...dns-query?name=www.shippex.app&type=A'` after cleanup.
- [ ] Run `curl -I https://www.shippex.app` in a dry deploy check and re-run attach command.
- [ ] Run `npm run check` in production-equivalent environment after each deploy.

## Notes

- `www.shippex.app` remains blocked by externally managed DNS (`A` records pointing to Vercel) after zone migration.
- Domain attach is complete only after both hosts validate and return the application payload.
- All evidence for this blocker is captured in deployment logs and DNS lookups.
