-- Separate Stripe test-mode customer id so live checkout is unaffected by QA test payments.

alter table public.organizations
  add column if not exists stripe_test_customer_id text;

comment on column public.organizations.stripe_test_customer_id is
  'Stripe Customer id from test-mode Checkout (cus_...); live customers use stripe_customer_id.';
