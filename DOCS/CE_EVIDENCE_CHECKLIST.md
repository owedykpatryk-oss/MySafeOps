# Cyber Essentials — checklist dowodów (MySafeOps)

Skrót operacyjny. Pełny plan: [CYBER_ESSENTIALS_PLAN.md](./CYBER_ESSENTIALS_PLAN.md).

Zbierz zrzuty do folderu **poza repo** (np. `CE-2026-evidence/` na dysku zespołu).

## A — MFA (kontrola dostępu)

| Konto | MFA włączone | Zrzut ekranu | Data |
|-------|--------------|--------------|------|
| Supabase (owner) | ☐ | `access/supabase-mfa.png` | |
| Cloudflare | ☐ | `access/cloudflare-mfa.png` | |
| Vercel | ☐ | `access/vercel-mfa.png` | |
| GitHub (org/repo) | ☐ | `access/github-mfa.png` | |

## B — CSP / hosting

- ☐ `curl -sI https://mysafeops.com | findstr /i content-security` (lub DevTools → Network → document)
- ☐ Zrzut: nagłówki na produkcji (`vercel.json` + `public/_headers`)
- ☐ Data redeploy po zmianach CSP: ___________

## C — Backup D1 → R2

```bash
npm run d1:backup:test-restore
```

- ☐ Wynik polecenia (tekst) zapisany jako `backup/d1-restore-test-YYYY-MM-DD.txt`
- ☐ Zrzut R2: bucket `mysafeops-files`, prefix `d1-snapshots/`
- ☐ Cron `mysafeops-d1-backup` — `npm run d1:doctor` ✓ backup worker

## D — Turnstile / login

- ☐ Wejście na `https://mysafeops.com/login` — captcha widoczna gdy skonfigurowana
- ☐ Udane logowanie testowym kontem
- ☐ Zrzut Supabase → Auth → Bot and Abuse Protection
- ☐ `npm run setup:turnstile:all` (prawdziwy widget Cloudflare, nie klucz testowy)

## G — Szyfrowanie cloud backup (`app_sync`)

- ☐ Upload backupu w aplikacji — w DB widać `_mysafeops_enc`, nie jawny JSON
- ☐ Pobranie na tym samym urządzeniu działa
- ☐ Kod: `src/lib/backupCrypto.js` (AES-GCM, klucz w przeglądarce)

## E — Rate limiting

- ☐ Worker D1: `org_api_rate` (PUT 120/min, audit 90/min per user) — `npm run d1:deploy`
- ☐ Opcjonalnie Cloudflare Dashboard → Security → WAF → rate rule na `*mysafeops-d1-api*.workers.dev`

## J–N — Polityki i proces

| Dokument | Plik | Właściciel | Data rewizji |
|----------|------|------------|--------------|
| Polityka haseł / MFA | `policies/password-mfa.pdf` | | |
| Incydenty | `policies/incident-response.pdf` | | |
| Urządzenia końcowe | `policies/endpoints.pdf` | | |
| Backup / restore | `policies/backup-restore.pdf` | | |
| Rejestr aktywów | `assets/register.xlsx` | | |
| SLA patchowania (14 dni) | `patching/sla.pdf` | | |

## DPA / subprocessors

- ☐ Supabase DPA
- ☐ Vercel DPA
- ☐ Cloudflare DPA
- ☐ Stripe DPA
- ☐ Lista zgodna ze stroną `/security`

## CI (dowód patchowania)

- ☐ Zrzut GitHub Actions `CI` — zielony, krok `npm audit` + `Security doctor`
- ☐ Link do ostatniego successful run: ___________
