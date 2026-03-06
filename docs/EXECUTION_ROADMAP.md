# FanForge 4-Week Build Roadmap (Execution Plan)

_Last updated: 2026-03-06_

## Phase 0 (Current): Trust + Platform Baseline

- Keep title-level SEO and protect chapter rendering behind verified member context.
- Avoid absolute anti-scrape promises in all public copy.
- Ensure all critical env/secrets and custom-domain routing are configured before launch.

## Week 1 — Core Product Foundation (Reader + Writer Trust)

- [ ] Author onboarding and identity hardening
  - Verify user flow for signup, email verification, and session trust scoring.
  - Add writer profile setup and public-facing creator identity cards.
- [ ] Content model completion
  - Story/work schema support title, summary, genres, tags, explicitness, warnings, and chapter ordering.
  - Cover upload reliability across Worker runtime/storage.
- [ ] Publish/unpublish lifecycle
  - Draft → review flag → public states with admin-safe moderation hooks.
- [ ] Chapter read access gating
  - Enforced session + verified email + human check + reader throttles.

## Week 2 — Reader UX Differentiation (Web + Mobile)

- [ ] Reading surface rewrite for first 3-viewport speed
  - Sticky controls, chapter progress bar, adaptive font stack, spacing controls.
  - Mobile-first typographic scale and line-length controls.
- [ ] Discovery UX improvements
  - Fandom-based discovery board, filters, sort by freshness/popularity/trending.
  - Search ranking tuned for titles and metadata quality.
- [ ] Reader habit loops
  - Continue reading, bookmarks, follow list, read queue, notifications.

## Week 3 — Growth + SEO Without Exposing Text

- [ ] Public title pages only
  - Ensure title/metadata pages are crawlable with clear summary and intent.
  - Ensure chapter bodies are never fully indexable.
- [ ] Social/SEO packaging
  - Canonical metadata, OG tags, structured data for works and profiles.
  - XML sitemaps focused on discovery pages.
- [ ] Anti-scrape posture (best effort + legal notice)
  - Enforce anti-bot gates, request friction, per-session delivery checks.
  - Watermark or trace IDs in rendered chapter responses.

## Week 4 — Monetization + Hardening + Launch

- [ ] Writer growth mechanics
  - Supporter/paid chapter gating and premium unlocks.
  - Optional donations/tipping path.
- [ ] Moderation and trust operations
  - Report queue, takedown actioning, abuse alerts.
- [ ] Performance and security hardening
  - Load + abuse metrics dashboards, incident runbook, release checklist.
- [ ] Launch readiness
  - Final proofread of all public claims against code and middleware.
  - Final smoke test: search indexing + protected read flow + login integrity.

## Build Rules (Mandatory)

1. Every public claim must pass the claim matrix in `docs/CLAIMS_AND_GUARDRAILS.md`.
2. Any change touching verification, access checks, or crawl controls updates `src/middleware`, then the claim matrix immediately.
3. Custom domain and DNS edits are a release gate, not afterthought.
4. If any risk appears, ship guardrail docs before feature expansion.

## Acceptance Definition for End of Week 4

- Readers can discover by titles from search and open rich landing metadata without chapter text leakage.
- Verified member sessions can read, resume, and bookmark chapters with low friction.
- Writers can publish with safe storage, consistent metadata, and stable URLs.
- Anti-abuse controls and claims are aligned and cannot be said to promise impossible protection.
