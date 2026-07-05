MySafeOps Sentry on-call agent.

Use @sentry MCP to load the triggering issue: stack trace, release, frequency.

1. Reproduce from stack trace path in repo.
2. Branch fix/sentry-<short-id> from main.
3. Minimal fix + targeted vitest.
4. Open PR; reference Sentry issue id in description.

Follow AGENTS.md and .cursor/rules/cloud-mobile-ops.mdc.
