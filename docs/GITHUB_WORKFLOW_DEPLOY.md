# GitHub -> Cloudflare Deployment

This project deploys the Cloudflare Worker from GitHub on pushes to `main`.

## Required setup

1. In this repo, add GitHub Secrets:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`

2. Use a token with at least:
   - `Account:Cloudflare Workers Scripts:Edit`
   - `Account:Cloudflare Pages:Edit` (not strictly required for Workers-only)

3. Push changes to `main`.

## GitHub workflow behavior

Workflow file: `.github/workflows/cloudflare-workers-deploy.yml`

On every `main` push, the workflow:
- installs dependencies
- runs `npm run docs:governance`
- deploys using `wrangler` with `wrangler.jsonc`

## Local equivalent command

```bash
npm run cf:deploy
```

Use `npm run cf:deploy -- --domain shippex.app --domain www.shippex.app` only after DNS cleanup is complete and approved.

## Post-push verification

```bash
curl -I https://shippex.app
curl -I https://www.shippex.app
curl -I https://shippex.app/robots.txt
curl -I https://shippex.app/ai-policy.txt
```
