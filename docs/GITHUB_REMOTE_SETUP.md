# GitHub Remote Setup (for Cloudflare CI)

Current local state:
- `fanforge` codebase is now a git repo in `/Users/emily/fanforge`.
- Initial commit exists: `4ae98eb`.
- No matching GitHub remote named `origin` exists yet.

## Next required action

Create one of these repos and attach this code:

1. Create GitHub repository:
   - `fanforge` (recommended), or
   - another name you prefer.

2. Add remote:
   
   ```bash
   git remote add origin <repo-ssh-or-https-url>
   git branch -M main
   git push -u origin main
   ```

3. In that repo, add GitHub Secrets:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`

4. In Cloudflare Workers dashboard, keep the existing deployed worker/script `fanforge` and custom domain `shippex.app` binding as configured.
5. Confirm every merge/push to `main` triggers `.github/workflows/cloudflare-workers-deploy.yml` and deploy succeeds.

## One-shot fallback for new repo creation via curl (requires token)

```bash
curl -X POST https://api.github.com/user/repos \
  -H "Authorization: token <GITHUB_TOKEN>" \
  -H "Accept: application/vnd.github+json" \
  -d '{"name":"fanforge","private":false,"description":"Cloudflare Worker fanfiction platform"}'
```
