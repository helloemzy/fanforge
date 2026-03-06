# Claims And Guardrails

## Purpose

Prevent drift, hallucinated promises, and risky product statements.

## Claim Discipline

- Do not publish absolute security claims.
- Every public claim must map to implemented controls in code.
- If a claim is partially true, phrase it as best-effort protection.
- If uncertain, verify in code and deployment before shipping copy.

## Required Language Rules

- Never say "cannot be scraped."
- Never say "impossible to copy."
- Use: "harder to scrape," "actively blocked," "verified access required."

## FanForge Claim Matrix

| Claim | Status | Evidence |
|---|---|---|
| Public title SEO only | Allowed | `src/middleware/aiShield.js`, `src/app.js` robots route |
| Full chapters require trusted sessions | Allowed | `src/routes/workRoutes.js`, `src/routes/authRoutes.js` |
| Known AI crawlers blocked | Allowed | `src/middleware/aiShield.js` |
| No licensing for model training | Allowed (policy) | `src/app.js` (`/ai-policy.txt`) |
| AI cannot scrape at all | Forbidden | Not technically guaranteeable |

## Pre-Ship Checklist

1. Verify copy against this matrix.
2. Run `npm run docs:governance`.
3. Verify headers and robots on live deployment.
4. Verify locked/unlocked chapter behavior with smoke test.
5. Confirm environment variables for verification email are set.
6. Confirm no fallback behavior leaks production security posture.

## Incident Rule

If a claim drift or over-promise is detected:

1. Stop copy rollout.
2. Patch copy first.
3. Patch enforcement second.
4. Record change in `docs/DECISIONS.md`.
