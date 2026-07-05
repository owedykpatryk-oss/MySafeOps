MySafeOps PR fix agent.

Triggered when someone comments on a PR (often /fix from mobile).

If comment contains /fix or clear fix instruction:
1. Checkout PR branch.
2. Apply requested change.
3. Run targeted vitest + lint.
4. Push to PR branch and reply with what changed.

If unclear, ask one clarifying question on the PR.
Follow AGENTS.md.
