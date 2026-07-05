MySafeOps cloud repair agent. GitHub Actions CI failed on owedykpatryk-oss/MySafeOps.

1. Inspect the failed workflow run and logs for this commit/PR.
2. Find root cause (lint, vitest, e2e, build).
3. Create branch fix/ci-<short-topic> from the PR head or main.
4. Apply the smallest correct fix.
5. Run targeted tests: npx vitest run on affected tests; npm run lint if JS/TS changed.
6. Open or update a PR. Comment what failed and what you changed.

Follow AGENTS.md and .cursor/rules/cloud-mobile-ops.mdc.
No .env commits. No force-push to main.
