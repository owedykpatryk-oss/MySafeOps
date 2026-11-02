import type { SupabaseClient } from "npm:@supabase/supabase-js@2.49.1";
import type Stripe from "npm:stripe@14.21.0";
import { planFromPriceId } from "./stripeConfig.ts";
import { isCustomerOrgBindingMismatch, mapLegacyOrgStatus, mapStripeStatus, resolveWorkspaceStripeCustomerId, stripeUnixToIso } from "./stripeWebhookMapping.ts";
export async function applySubscription(
  supabase: SupabaseClient,
  sub: Stripe.Subscription,
  livemode: boolean,
) {
  const metadataOrgId = sub.metadata?.org_id;
  const metadataWorkspaceId = sub.metadata?.workspace_id;
  let workspaceQuery = supabase
    .from("org_country_workspaces")
    .select("id, org_id, market_id, is_primary");
  workspaceQuery = metadataWorkspaceId
    ? workspaceQuery.eq("id", metadataWorkspaceId)
    : workspaceQuery.eq("org_id", metadataOrgId || "").eq("is_primary", true);
  const { data: workspace, error: workspaceErr } = await workspaceQuery.limit(1).maybeSingle();
  if (workspaceErr || !workspace?.id || (metadataOrgId && workspace.org_id !== metadataOrgId)) {
    throw new Error(`Subscription ${sub.id} has no valid country workspace: ${workspaceErr?.message || "mapping mismatch"}`);
  }
  const orgId = workspace.org_id;

  const priceId = sub.items.data[0]?.price?.id;
  const mapped = priceId ? planFromPriceId(priceId, workspace.market_id, livemode ? "live" : "test") : null;
  if (!mapped || mapped.market !== workspace.market_id) {
    console.error("stripe-webhook: unknown price or market/workspace mismatch — refusing entitlement", {
      subscriptionId: sub.id,
      workspaceId: workspace.id,
      workspaceMarket: workspace.market_id,
      priceMarket: mapped?.market ?? null,
    });
    throw new Error(`Unknown price or country mismatch for subscription ${sub.id}`);
  }
  const plan = mapped.plan;
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;

  // Defend against a subscription whose `metadata` doesn't actually belong to the Stripe
  // customer that owns it (metadata can be edited via the Stripe dashboard/API). The
  // binding is per country workspace, because each country bills its own customer — only
  // the primary workspace falls back to the legacy organisation-level customer.
  const { data: existingOrg, error: existingOrgErr } = await supabase
    .from("organizations")
    .select("id, stripe_customer_id, stripe_test_customer_id")
    .eq("id", orgId)
    .maybeSingle();
  if (existingOrgErr || !existingOrg) {
    throw new Error(`Organisation lookup failed for ${sub.id}: ${existingOrgErr?.message || "not found"}`);
  }

  const stripeMode = livemode ? "live" : "test";
  const { data: existingBilling, error: billingReadErr } = await supabase
    .from("org_country_workspace_subscriptions")
    .select("subscription_status, past_due_since, stripe_customer_id, stripe_subscription_id")
    .eq("workspace_id", workspace.id)
    .eq("stripe_mode", stripeMode)
    .maybeSingle();
  if (billingReadErr) throw new Error(`Billing lookup failed: ${billingReadErr.message}`);
  if (
    existingBilling?.stripe_subscription_id && existingBilling.stripe_subscription_id !== sub.id &&
    !["canceled", "incomplete_expired", "none"].includes(existingBilling.subscription_status)
  ) {
    if (["canceled", "incomplete_expired"].includes(sub.status)) return;
    throw new Error(`Workspace already bound to another subscription: ${workspace.id}`);
  }

  const boundCustomerId = resolveWorkspaceStripeCustomerId({
    workspaceCustomerId: existingBilling?.stripe_customer_id as string | null | undefined,
    orgCustomerId: livemode ? existingOrg.stripe_customer_id : existingOrg.stripe_test_customer_id,
    isPrimary: workspace.is_primary,
  });
  if (isCustomerOrgBindingMismatch(boundCustomerId, customerId)) {
    console.error(
      "stripe-webhook: customer/workspace binding mismatch — refusing to apply subscription",
      { subscriptionId: sub.id, orgId, workspaceId: workspace.id, boundCustomerId, customerId, livemode },
    );
    throw new Error(`Customer binding mismatch for subscription ${sub.id}`);
  }

  const mappedStatus = mapStripeStatus(sub.status);
  const firstItem = sub.items.data[0] as (Stripe.SubscriptionItem & { current_period_end?: number }) | undefined;
  const periodEnd = stripeUnixToIso(sub.current_period_end ?? firstItem?.current_period_end);
  const trialEnd = stripeUnixToIso(sub.trial_end);

  const row: Record<string, unknown> = {
    workspace_id: workspace.id,
    stripe_mode: stripeMode,
    market_id: workspace.market_id,
    currency:
      workspace.market_id === "pl"
        ? "PLN"
        : workspace.market_id === "au"
          ? "AUD"
          : workspace.market_id === "de" || workspace.market_id === "at"
            ? "EUR"
            : workspace.market_id === "ch"
              ? "CHF"
              : "GBP",
    stripe_customer_id: customerId ?? null,
    stripe_subscription_id: sub.id,
    subscription_status: mappedStatus,
    billing_plan: plan,
    stripe_price_id: priceId ?? null,
    current_period_end: periodEnd,
    cancel_at_period_end: Boolean(sub.cancel_at_period_end),
    stripe_trial_end: trialEnd,
  };

  if (mappedStatus === "past_due") {
    row.past_due_since = existingBilling?.subscription_status === "past_due" && existingBilling?.past_due_since
      ? existingBilling.past_due_since : new Date().toISOString();
  } else {
    row.past_due_since = null;
  }

  if (sub.status === "canceled" || sub.status === "unpaid") {
    row.billing_plan = null;
  }

  const { error } = await supabase
    .from("org_country_workspace_subscriptions")
    .upsert(row, { onConflict: "workspace_id,stripe_mode" });
  if (error) {
    throw new Error(`Could not save workspace subscription: ${error.message}`);
  }

  // Keep legacy organisation billing fields in sync for the primary workspace only.
  // A secondary country must never touch them: its customer id would overwrite the
  // primary binding, and its plan would leak into the organisation-wide entitlement.
  if (!workspace.is_primary || !livemode) return;

  const legacyRow: Record<string, unknown> = {
    stripe_subscription_id: sub.id,
    subscription_status: mapLegacyOrgStatus(mappedStatus),
    billing_plan: row.billing_plan,
    stripe_current_period_end: periodEnd,
    stripe_cancel_at_period_end: Boolean(sub.cancel_at_period_end),
    stripe_trial_end: trialEnd,
    subscription_past_due_since: row.past_due_since,
    [livemode ? "stripe_customer_id" : "stripe_test_customer_id"]: customerId ?? null,
  };
  const { error: legacyErr } = await supabase.from("organizations").update(legacyRow).eq("id", orgId);
  if (legacyErr) throw new Error(`Could not save organisation subscription: ${legacyErr.message}`);
}

async function findOrgIdByCustomerId(
  supabase: SupabaseClient,
  customerId: string | null | undefined,
): Promise<string | null> {
  if (!customerId) return null;
  const { data, error } = await supabase
    .from("organizations")
    .select("id")
    .or(`stripe_customer_id.eq.${customerId},stripe_test_customer_id.eq.${customerId}`)
    .maybeSingle();
  if (error) {
    throw new Error(`Organisation customer lookup failed: ${error.message}`);
  }
  return data?.id ?? null;
}

/**
 * Secondary-country customers are never written to `organizations`, so a subscription
 * without workspace metadata is resolved from the workspace billing rows first.
 */
async function findWorkspaceIdByCustomerId(
  supabase: SupabaseClient,
  customerId: string | null | undefined,
  stripeMode: "live" | "test",
): Promise<string | null> {
  if (!customerId) return null;
  const { data, error } = await supabase
    .from("org_country_workspace_subscriptions")
    .select("workspace_id")
    .eq("stripe_customer_id", customerId)
    .eq("stripe_mode", stripeMode)
    .limit(1)
    .maybeSingle();
  if (error) {
    throw new Error(`Workspace customer lookup failed: ${error.message}`);
  }
  return data?.workspace_id ?? null;
}

export async function clearSubscription(
  supabase: SupabaseClient,
  workspaceId: string,
  opts: { customerId?: string | null; livemode?: boolean; subscriptionId?: string } = {},
) {
  const stripeMode = opts.livemode === false ? "test" : "live";
  const { data: workspace, error: workspaceErr } = await supabase
    .from("org_country_workspaces")
    .select("id, org_id, is_primary")
    .eq("id", workspaceId)
    .maybeSingle();
  if (workspaceErr) {
    throw new Error(`Workspace lookup failed during cancellation: ${workspaceErr.message}`);
  }
  if (!workspace?.id) {
    // Stripe can deliver cancellation after a workspace (and its billing rows) was
    // deleted. Acknowledge only when no entitlement remains bound to this subscription.
    if (!opts.subscriptionId) throw new Error("Workspace lookup failed during cancellation: not found");
    const { data: binding, error: bindingErr } = await supabase
      .from("org_country_workspace_subscriptions")
      .select("workspace_id")
      .eq("stripe_subscription_id", opts.subscriptionId)
      .eq("stripe_mode", stripeMode)
      .limit(1).maybeSingle();
    if (bindingErr) throw new Error(`Cancellation billing lookup failed: ${bindingErr.message}`);
    if (binding) throw new Error("Cancellation workspace mapping mismatch: subscription still bound");
    if (stripeMode === "live") {
      const { data: legacyBinding, error: legacyErr } = await supabase
        .from("organizations").select("id")
        .eq("stripe_subscription_id", opts.subscriptionId).limit(1).maybeSingle();
      if (legacyErr) throw new Error(`Cancellation organisation lookup failed: ${legacyErr.message}`);
      if (legacyBinding) throw new Error("Cancellation workspace mapping mismatch: organisation still bound");
    }
    return;
  }

  if (opts.customerId) {
    const { data: existingBilling, error: existingBillingErr } = await supabase
      .from("org_country_workspace_subscriptions")
      .select("stripe_customer_id, stripe_subscription_id")
      .eq("workspace_id", workspaceId)
      .eq("stripe_mode", stripeMode)
      .maybeSingle();
    if (existingBillingErr) {
      throw new Error(`Cancellation billing lookup failed: ${existingBillingErr.message}`);
    }
    if (existingBilling?.stripe_subscription_id && existingBilling.stripe_subscription_id !== opts.subscriptionId) return;
    const { data: existingOrg, error: orgErr } = await supabase
      .from("organizations")
      .select("stripe_customer_id, stripe_test_customer_id")
      .eq("id", workspace.org_id)
      .maybeSingle();
    if (orgErr) throw new Error(`Cancellation organisation lookup failed: ${orgErr.message}`);
    const boundCustomerId = resolveWorkspaceStripeCustomerId({
      workspaceCustomerId: existingBilling?.stripe_customer_id as string | null | undefined,
      orgCustomerId: stripeMode === "live" ? existingOrg?.stripe_customer_id : existingOrg?.stripe_test_customer_id,
      isPrimary: workspace.is_primary,
    });
    if (isCustomerOrgBindingMismatch(boundCustomerId, opts.customerId)) {
      console.error(
        "stripe-webhook: customer/workspace binding mismatch — refusing to clear subscription",
        { workspaceId, boundCustomerId, customerId: opts.customerId, stripeMode },
      );
      throw new Error(`Customer binding mismatch during cancellation: ${workspaceId}`);
    }
  }

  let clearQuery = supabase
    .from("org_country_workspace_subscriptions")
    .update({
      stripe_subscription_id: opts.subscriptionId,
      subscription_status: "canceled",
      billing_plan: null,
      stripe_price_id: null,
      current_period_end: null,
      cancel_at_period_end: false,
      stripe_trial_end: null,
      past_due_since: null,
    })
    .eq("workspace_id", workspaceId)
    .eq("stripe_mode", stripeMode);
  if (opts.subscriptionId) clearQuery = clearQuery.eq("stripe_subscription_id", opts.subscriptionId);
  const { data: cleared, error } = await clearQuery.select("workspace_id");
  if (error) throw new Error(`Could not cancel workspace subscription: ${error.message}`);
  if (!cleared?.length) return;

  if (workspace.is_primary && stripeMode === "live") {
    const { error: legacyErr } = await supabase
      .from("organizations")
      .update({
        stripe_subscription_id: null,
        subscription_status: "canceled",
        billing_plan: null,
        stripe_current_period_end: null,
        stripe_cancel_at_period_end: false,
        stripe_trial_end: null,
        subscription_past_due_since: null,
      })
      .eq("id", workspace.org_id)
      .eq("stripe_subscription_id", opts.subscriptionId);
    if (legacyErr) throw new Error(`Could not cancel organisation subscription: ${legacyErr.message}`);
  }
}


/** Re-read Stripe's current state: deliveries may arrive late or out of order. */
export async function processStripeEvent(supabase: SupabaseClient, stripe: Stripe, event: Stripe.Event) {
  const object = event.data.object as Record<string, any>;
  let subscriptionId: string | undefined;
  if (["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(event.type)) {
    if (!["paid", "no_payment_required"].includes(object.payment_status)) return;
    subscriptionId = typeof object.subscription === "string" ? object.subscription : object.subscription?.id;
  } else if (["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted", "customer.subscription.paused", "customer.subscription.resumed"].includes(event.type)) {
    subscriptionId = object.id;
  } else if (["invoice.paid", "invoice.payment_failed", "invoice.payment_action_required"].includes(event.type)) {
    const subscription = object.subscription ?? object.parent?.subscription_details?.subscription;
    subscriptionId = typeof subscription === "string" ? subscription : subscription?.id;
  } else return;
  if (!subscriptionId) return;
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
  let workspaceId: string | undefined = sub.metadata?.workspace_id;
  if (!workspaceId) {
    workspaceId = await findWorkspaceIdByCustomerId(supabase, customerId, event.livemode ? "live" : "test") ?? undefined;
  }
  if (!workspaceId && !sub.metadata?.org_id) {
    const orgId = await findOrgIdByCustomerId(supabase, customerId);
    // A shared Stripe account may also serve other applications.
    if (!orgId) return;
    sub.metadata = { ...sub.metadata, org_id: orgId };
  }
  if (!workspaceId && sub.metadata?.org_id) {
    const { data, error } = await supabase.from("org_country_workspaces").select("id")
      .eq("org_id", sub.metadata.org_id).eq("is_primary", true).maybeSingle();
    if (error) throw new Error(error.message);
    workspaceId = data?.id;
  }
  if (!workspaceId) throw new Error("Subscription has no workspace mapping");
  const { data: workspace, error: workspaceError } = await supabase.from("org_country_workspaces")
    .select("id").eq("id", workspaceId).maybeSingle();
  if (workspaceError) throw new Error(workspaceError.message);
  if (!workspace && sub.status === "canceled") {
    await clearSubscription(supabase, workspaceId, { customerId, subscriptionId: sub.id, livemode: event.livemode });
    return;
  }
  if (!workspace) throw new Error("Subscription workspace not found");

  // Two distinct webhook events can race even though each event is idempotent.
  // Share checkout's workspace lock, then retrieve Stripe again *inside* the lock.
  const { data: lockToken, error: lockError } = await supabase.rpc("acquire_billing_checkout_lock", {
    p_workspace_id: workspaceId, p_stripe_mode: event.livemode ? "live" : "test",
  });
  if (lockError || !lockToken) throw new Error("Workspace billing synchronization is busy; retry this event");
  try {
    const current = await stripe.subscriptions.retrieve(subscriptionId, {}, { timeout: 15000, maxNetworkRetries: 0 });
    if (current.metadata?.workspace_id && current.metadata.workspace_id !== workspaceId) throw new Error("Subscription workspace mapping changed");
    current.metadata = { ...current.metadata, workspace_id: workspaceId };
    const currentCustomer = typeof current.customer === "string" ? current.customer : current.customer?.id;
    if (current.status === "canceled") {
      await clearSubscription(supabase, workspaceId, { customerId: currentCustomer, subscriptionId: current.id, livemode: event.livemode });
    } else {
      await applySubscription(supabase, current, event.livemode);
    }
  } finally {
    const { error } = await supabase.from("billing_checkout_locks").delete().eq("token", lockToken);
    if (error) throw new Error("Could not release workspace billing synchronization lock");
  }
}
