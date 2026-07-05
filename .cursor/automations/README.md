# Cursor Automations — Agent Instructions (copy-paste)

## API (zalecane — bez UI Automations)

Jeśli pole **Agent Instructions** w UI jest puste i prefill nie działa, użyj **Cloud Agents API**:

1. **Cursor Dashboard → Integrations → API Keys** — wygeneruj klucz.
2. Lokalnie: `CURSOR_API_KEY=...` w `.env.local` (nigdy nie commituj).
3. GitHub: **Settings → Secrets → Actions** → `CURSOR_API_KEY` (dla auto-fix po CI fail).

### Komendy

```bash
# Z telefonu / terminala (mobile ticket)
npm run fix:mobile -- "Hot work PDF missing fire watch"

# Ręcznie — typ agenta + kontekst
npm run cursor:agent -- ci-fix --run-url "https://github.com/.../actions/runs/123"
npm run cursor:agent -- mobile --message "Survey simple mode broken"
npm run cursor:agent -- sentry --message "https://sentry.io/..."
npm run cursor:agent -- pr-review --pr-url "https://github.com/.../pull/1"
npm run cursor:agent -- --list
```

Po starcie skrypt wypisze URL agenta w Cursor (`https://cursor.com/agents/bc-...`).

CI: workflow `.github/workflows/cursor-ci-fix.yml` odpala `ci-fix` gdy workflow **CI** się wywali (wymaga secretu).

### Harmonogram nocny (GitHub Actions)

| Co | Kiedy | Workflow |
|----|-------|----------|
| Health + Vercel + Sentry (pon.) + review PR | **Pn–Pt 02:00 UTC** | `cursor-nightly.yml` |
| Lekki health (bez e2e) | **Sob 03:00 UTC** | `cursor-nightly.yml` |
| Auto-fix po failu CI | od razu | `cursor-ci-fix.yml` |
| Auto-fix po failu Billing Smoke | od razu | `cursor-billing-fix.yml` |
| Sentry alert (webhook) | od razu | `cursor-sentry.yml` |
| `/fix` w komentarzu PR (tylko collaborator) | na żądanie | `cursor-pr-fix.yml` |
| Mobile z telefonu | ręcznie | `npm run fix:mobile` |

**Limity:** max 4 agenty / noc; Sentry w `--all` tylko w poniedziałki; PR review tylko z ostatnich 7 dni.

**Status agenta:**

```bash
npm run cursor:status -- bc-xxxxxxxx
# lub pełny URL z Cursor Dashboard
```

### Sentry webhook (opcjonalnie)

Sentry → Integrations → Webhooks → wyślij `repository_dispatch` na GitHub:

- `event_type`: `sentry-issue`
- `client_payload`: `{ "issue_url": "https://...", "title": "...", "level": "error" }`

Ręczny test: **Actions → Cursor Sentry auto-fix → Run workflow**.

Jednorazowo — secret w GitHub (z lokalnego klucza, bez wklejania w czat):

```bash
npm run cursor:push-secret
```

Ręczny test nocnego pakietu (bez odpalania agentów):

```bash
node scripts/cursor-nightly.mjs --dry-run --all
```

Ręczny trigger w GitHub: **Actions → Cursor nightly → Run workflow**.

Slack wymaga osobnej integracji (Slack Events / webhook URL) — na razie użyj `npm run fix:mobile` lub `cursor:agent -- slack --message "..."`.

---

## UI Automations (opcjonalnie)

W edytorze pole nazywa się **Agent Instructions** (nie „Prompt”).

**Prefill z agenta często nie wypełnia tego pola** — wklej ręcznie z `*.prompt.md` poniżej.

Kolejność w UI:
1. **Triggers**
2. **Tools**
3. **Agent Instructions** ← wklej tekst z pliku
4. **Repository** → `owedykpatryk-oss/MySafeOps`, branch `main`
5. **Save** → włącz przełącznik **Active**

| Automacja | Plik | API type (`npm run cursor:agent --`) |
|-----------|------|--------------------------------------|
| CI auto-fix | `ci-auto-fix.prompt.md` | `ci-fix` |
| Mobile webhook | `mobile-webhook.prompt.md` | `mobile` |
| Slack | `slack-fix.prompt.md` | `slack` |
| Sentry | `sentry-auto-fix.prompt.md` | `sentry` |
| Daily health | `daily-health.prompt.md` | `daily-health` |
| PR review | `pr-review.prompt.md` | `pr-review` |
| PR /fix | `pr-fix-command.prompt.md` | `pr-fix` |
| Vercel deploy | `vercel-deploy.prompt.md` | `vercel` |
| Billing Smoke | `billing-auto-fix.prompt.md` | `billing` |

Repo: `AGENTS.md` + `.cursor/rules/cloud-mobile-ops.mdc` — agent czyta sam.
