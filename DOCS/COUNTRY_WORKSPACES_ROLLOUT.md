# Country workspaces — kolejność wdrożenia

Jedna organizacja może prowadzić kilka **płatnych obszarów krajowych** (UK / PL / AU).
Każdy kraj ma własną subskrypcję Stripe w swojej walucie, własne dane operacyjne i własny
domyślny język dokumentów. Login, organizacja i uprawnienia pozostają wspólne.

## Zasada rozliczeń: jeden kraj = jeden klient Stripe

Stripe przypina walutę do **klienta** przy pierwszej subskrypcji i odrzuca każdą kolejną
w innej walucie. Dlatego:

- **kraj podstawowy** (`is_primary`) korzysta z istniejącego `organizations.stripe_customer_id`
  — dotychczasowi klienci UK zachowują historię płatności bez migracji;
- **każdy kolejny kraj** dostaje własnego klienta Stripe, zapisanego w
  `org_country_workspace_subscriptions.stripe_customer_id`;
- kraj wtórny **nigdy** nie nadpisuje `organizations.stripe_customer_id` ani pól
  rozliczeniowych organizacji — inaczej webhook odrzuciłby jego subskrypcję jako
  „binding mismatch”, a jego plan wyciekłby na całą organizację.

Wspólna logika: `resolveWorkspaceStripeCustomerId()` w
`supabase/functions/_shared/stripeWebhookMapping.ts` (używana przez checkout, portal i webhook).

Ceny nie mają fallbacku międzywalutowego: brak kompletu `STRIPE_PRICE_*_PLN` / `*_AUD`
oznacza, że checkout dla tego kraju **jest blokowany** (503), zamiast obciążyć klienta w GBP.

## Kolejność wdrożenia (nie zamieniać kroków)

1. **Migracje Supabase** — `20260804173623_org_country_workspaces.sql`
   (+ `20260804163415_management_workspace_shared_state.sql`).
   Migracja rozszerza `organizations_subscription_status_check` o `incomplete`,
   `incomplete_expired` i `paused` oraz zakłada bramki `user_can_*_org_country_kv`.
2. **Cennik Stripe** — ceny **live** GBP/PLN/AUD są już założone (sekrety `STRIPE_PRICE_*_PLN`
   i `*_AUD` z 12.07.2026). Jeśli kiedyś trzeba je odtworzyć: `npm run stripe:seed-prices`,
   potem `npm run stripe:sync-secrets`. Sprawdź `marketBilling` w `GET /stripe-checkout`.
   Do **próby generalnej w trybie testowym** uruchom najpierw `npm run stripe:setup-test`
   — zakłada testowe ceny w PLN i AUD, bez których checkout tych krajów fail-close'uje.
3. **Funkcje Edge** — `stripe-checkout`, `stripe-portal`, `stripe-webhook`.
4. **Worker D1** — `npm run d1:deploy`.
5. **Frontend**.

Dlaczego ta kolejność:

- worker D1 **fail-close'uje** klucze `country:<uuid>:` dopóki bramek SQL nie ma w bazie —
  wdrożenie workera przed migracją zablokuje zapisy krajów wtórnych;
- checkout dla kraju wtórnego wymaga tabeli `org_country_workspace_subscriptions`;
- webhook zapisuje do organizacji status przez `mapLegacyOrgStatus()`, więc wdrożenie
  funkcji przed migracją nie wywróci webhooków na check constraincie — ale gating
  krajów wtórnych będzie działał dopiero po migracji.

## Weryfikacja po wdrożeniu

- `GET /functions/v1/stripe-checkout` jako admin → `marketBilling: { uk, pl, au }` = `true`
  dla krajów, które sprzedajesz.
- Test checkoutu drugiego kraju w trybie testowym: powinien utworzyć **nowego** klienta
  Stripe w walucie tego kraju, a nie dopiąć się do klienta GBP.
- „Manage billing” przy wybranym kraju otwiera portal tego kraju (inny klient niż UK).
- Przełączenie kraju w topbarze przeładowuje aplikację i pokazuje wyłącznie dane tego kraju
  (localStorage `..__country_<uuid>`, D1 `country:<uuid>:<key>`).
