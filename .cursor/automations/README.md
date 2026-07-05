# Cursor Automations — Agent Instructions (copy-paste)

W edytorze pole nazywa się **Agent Instructions** (nie „Prompt”).

**Prefill z agenta często nie wypełnia tego pola** — wklej ręcznie z `*.prompt.md` poniżej.

Kolejność w UI:
1. **Triggers**
2. **Tools**
3. **Agent Instructions** ← wklej tekst z pliku
4. **Repository** → `owedykpatryk-oss/MySafeOps`, branch `main`
5. **Save** → włącz przełącznik **Active**

| Automacja | Plik |
|-----------|------|
| CI auto-fix | `ci-auto-fix.prompt.md` |
| Mobile webhook | `mobile-webhook.prompt.md` |
| Slack | `slack-fix.prompt.md` |
| Sentry | `sentry-auto-fix.prompt.md` |
| Daily health | `daily-health.prompt.md` |
| PR review | `pr-review.prompt.md` |
| PR /fix | `pr-fix-command.prompt.md` |
| Vercel deploy | `vercel-deploy.prompt.md` |

Repo: `AGENTS.md` + `.cursor/rules/cloud-mobile-ops.mdc` — agent czyta sam.
