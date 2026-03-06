# Release Governance Checklist

_Last updated: 2026-03-06_

## Mandatory Pre-Deploy Checklist

1. Governance checks
   - `npm run docs:governance`
   - Confirm output: `Governance check passed`.
2. Runtime checks
   - `npm run check`
   - Confirm protected chapter behavior is still enforced in the smoke run.
3. Deployment readiness
   - `npx wrangler whoami`
   - Confirm `shippex.app` is managed by this account in Cloudflare Dashboard.
4. Cloudflare deployment (baseline)
   - `npm run cf:deploy`
5. Custom domain attach (if required)
   - `npx wrangler deploy --domain shippex.app --domain www.shippex.app`
   - If it fails, follow `docs/CUSTOM_DOMAIN_MIGRATION_RUNBOOK.md`.
6. Dual-host HTTP validation
   - `curl -I https://shippex.app`
   - `curl -I https://www.shippex.app`
   - `curl -I https://shippex.app/robots.txt`
   - `curl -I https://www.shippex.app/robots.txt`
7. Security copy validation
   - Re-check any changed user-facing copy against `docs/CLAIMS_AND_GUARDRAILS.md`.
   - Ensure no absolute anti-scrape promises remain.
8. Evidence logging
   - Update `docs/IMPLEMENTATION_STATUS.md` with status and date/time.
   - If a domain proof step changed, append date and result notes.

## Required Non-Negotiables

- Do not launch with unresolved forbidden claim language.
- Do not mark domain migration complete without passing both host checks.
- Do not ship copy changes without `docs/DECISIONS.md` entry when enforcement or messaging changed.
