# Cursor Automations — prompty do wklejenia

W edytorze Cursor **nie ma pola „Instructions”** — szukaj sekcji **Prompt** (pod Trigger i Tools).

Kolejność w UI:
1. **Trigger** (np. CI completed, Slack, Webhook)
2. **Tools** (Comment on PR, Slack, MCP…)
3. **Prompt** ← tutaj wklej tekst z pliku `*.prompt.md`
4. **Repository** → `owedykpatryk-oss/MySafeOps`, branch `main`
5. **Save** → **Enable**

Pliki `*.prompt.md` w tym folderze = gotowe instrukcje. Repo też ma `AGENTS.md` i `.cursor/rules/cloud-mobile-ops.mdc` — agent je czyta sam.
