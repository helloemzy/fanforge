# Custom Domain Migration Runbook

_Last updated: 2026-03-06_

## Objective
Move traffic to `shippex.app` while keeping `www.shippex.app` and `shippex.app` behavior consistent.

## Preconditions

- Cloudflare auth with active zone for `shippex.app` (confirm via `npx wrangler whoami` and Cloudflare Dashboard).
- DNS for `shippex.app` points to Cloudflare nameservers.
- Legacy `www.shippex.app` DNS records are removed from old platform.
- Current zone ID has been validated as `49d6b3c84f37226ca505433768c762a4`.

## Mandatory Sequence

1. Verify zone visibility
   - Confirm zone ownership via `npx wrangler whoami` and Cloudflare Dashboard.
2. Deploy without custom domain first
   - `npm run cf:deploy`
3. Validate baseline on worker subdomain
   - `curl -I https://<worker-subdomain>.workers.dev/`
4. Attach custom domain
   - If zone has no conflicts, deploy with domain flags in one command:
     - `npx wrangler deploy --domain shippex.app --domain www.shippex.app`
5. Resolve conflicts
   - Verify auth can read zone metadata:
     - `curl -sS -H "Authorization: Bearer <token>" https://api.cloudflare.com/client/v4/zones?name=shippex.app`
     - Expect zone id `49d6b3c84f37226ca505433768c762a4`.
   - If Cloudflare reports conflict:
     - `www.shippex.app` still using external DNS (error code 100117)
     - Run DNS checks:
        - `curl -s 'https://cloudflare-dns.com/dns-query?name=www.shippex.app&type=A' -H 'accept: application/dns-json'`
      - Remove conflicting DNS from the `shippex.app` zone before re-running attach.
    - Ensure the API token has DNS permissions:
        - `GET /zones/{zone}/dns_records` must succeed before cleanup.
        - Current Wrangler OAuth token lacks DNS scope; use a token with `zone:read` + `zone:edit`/`dns:edit` equivalent.
      - Cleanup command pattern (with DNS-capable token):
        - Fastest: `CLOUDFLARE_TOKEN=<your token> scripts/cleanup-www-dns.sh`
        ```bash
        export CLOUDFLARE_TOKEN=<your token>
        export ZONE_ID=49d6b3c84f37226ca505433768c762a4
        WRITABLE_RECORDS=$(curl -sS -H "Authorization: Bearer $CLOUDFLARE_TOKEN" \
          "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records?name=www.shippex.app&type=A" \
          | jq -r '.result[]?.id')
        for rid in $WRITABLE_RECORDS; do
          curl -sS -X DELETE -H "Authorization: Bearer $CLOUDFLARE_TOKEN" \
            "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records/$rid";
        done
        ```
      - If so, switch to DNS-capable token/credentials before `www` attempt.
6. Verify both hosts
   - `curl -I https://shippex.app`
   - `curl -I https://www.shippex.app`
   - Confirm app payload on both, no Vercel error headers.
7. Update doc status
   - Record successful domain binding and validation in `docs/IMPLEMENTATION_STATUS.md` with date/time.

## Hard Learnings (From This Migration)

- Wrangler auth token and access can expire; refresh with `npx wrangler whoami` before deploy.
- Domain conflicts are common if old DNS records remain in-zone.
- `shippex.app` can attach before `www.shippex.app`; `www` requires explicit DNS cleanup when conflict exists.
- `override_existing_dns_record` can fail if record type is externally managed by prior platform DNS.
- DNS conflicts must be handled through DNS provider/zone editing before migration can complete.
- Never assume `www` and apex bind automatically.
- Never assume zone ownership without lookup success.
- Never claim route is done without confirming HTTP response for both hosts.
