# Cloudflare Deployment Runbook

## 0. Governance precheck

```bash
npm run docs:governance
```

- Must pass before touching deployment steps.

## 1. Authenticate

```bash
npx wrangler whoami
```

Confirm it shows the expected account and email before making changes.

## 2. Verify zone ownership

Confirm `shippex.app` appears in the Cloudflare Dashboard > account overview and is managed by the authenticated account.

> This installed Wrangler version does not expose a `zones list` command. Use dashboard verification before custom domain attach.

## 3. Set secrets

```bash
npx wrangler secret put DATABASE_URL
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put STORAGE_ACCESS_KEY_ID
npx wrangler secret put STORAGE_SECRET_ACCESS_KEY
npx wrangler secret put READER_SHIELD_SECRET
npx wrangler secret put SESSION_SECRET
```

Optional:

```bash
npx wrangler secret put TURNSTILE_SECRET_KEY
```

## 4. Set non-secret vars

Edit `wrangler.jsonc` vars or deploy with `--var`:

- `APP_BASE_URL`
- `RESEND_FROM_EMAIL`
- `STORAGE_BUCKET`
- `STORAGE_ENDPOINT`
- `STORAGE_PUBLIC_BASE_URL`
- `STORAGE_REGION`
- `TURNSTILE_SITE_KEY` (optional)

## 5. Deploy worker baseline

```bash
npm run cf:deploy
```

## 6. Attach custom domain only after baseline is healthy

Use the migration runbook at `docs/CUSTOM_DOMAIN_MIGRATION_RUNBOOK.md`.

- If `shippex.app` and `www.shippex.app` DNS are clean:

```bash
npx wrangler deploy --domain shippex.app --domain www.shippex.app
```

- If attach fails with `code:100117` (`externally managed DNS records`):
  - This means legacy DNS for the hostname exists in the zone.
  - Confirm with DoH:
    - `curl -s 'https://cloudflare-dns.com/dns-query?name=www.shippex.app&type=A' -H 'accept: application/dns-json'`
  - Confirm zone id: `49d6b3c84f37226ca505433768c762a4` and account id: `73711a4e0ed22fe53395252395a22c60`.
  - Confirm `GET /zones/{zone}/dns_records` capability before API-driven cleanup (DNS permissions required).
  - Remove the conflicting DNS `A/CNAME` record in DNS management, then retry attach.
  - Wrangler is already sending `override_existing_dns_record: true`; API can still fail when record is externally managed.

## 7. Validate on both hosts

```bash
curl -I https://shippex.app
curl -I https://www.shippex.app
curl https://shippex.app/robots.txt
curl https://www.shippex.app/ai-policy.txt
```

## 8. Post-deploy checks (required)

- Confirm HTTP success (200/302 where expected) for both hosts.
- Confirm chapter endpoints enforce protected access.
- Confirm `/robots.txt` and `/ai-policy.txt` are unchanged on custom domain.
- Update `docs/IMPLEMENTATION_STATUS.md` with date + result.
- If deployment includes copy/security edits, add a `docs/DECISIONS.md` entry.
