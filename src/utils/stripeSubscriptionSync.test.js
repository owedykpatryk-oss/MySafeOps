import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Stripe from "stripe";
import { applySubscription, clearSubscription, processStripeEvent } from "../../supabase/functions/_shared/stripeSubscriptionSync.ts";
import { constructStripeEvent } from "../../supabase/functions/_shared/stripeWebhookSignature.ts";

function database({ market = "uk", primary = true, mode = "live", fail = null, subscriptionId = "sub_current" } = {}) {
  const rows = {
    billing_checkout_locks: [],
    org_country_workspaces: [{ id: "workspace", org_id: "org", market_id: market, is_primary: primary }],
    organizations: [{ id: "org", stripe_customer_id: "cus_live", stripe_test_customer_id: "cus_test", stripe_subscription_id: "sub_current", billing_plan: "team", subscription_status: "active" }],
    org_country_workspace_subscriptions: [{ workspace_id: "workspace", stripe_mode: mode, stripe_customer_id: `cus_${mode}`, stripe_subscription_id: subscriptionId, subscription_status: "active" }],
  };
  let failure = fail;
  const calls = [];
  const rpc = vi.fn(async () => ({ data: "lock-token", error: null }));
  return { rows, calls, rpc, from(table) {
    let filters = [], action = "select", payload;
    const execute = (single = false) => {
      calls.push({ table, action, payload });
      if (failure === `${table}:${action}`) { failure = null; return { data: null, error: { message: "temporary database failure" } }; }
      const matches = (rows[table] || []).filter(row => filters.every(([key,value]) => row[key] === value));
      if (action === "upsert") {
        const existing = rows[table].find(row => row.workspace_id === payload.workspace_id && row.stripe_mode === payload.stripe_mode);
        if (existing) Object.assign(existing, payload); else rows[table].push({ ...payload });
      }
      if (action === "update") for (const row of matches) Object.assign(row, payload);
      return { data: single ? matches[0] ?? null : matches, error: null };
    };
    const query = {
      select() { return query; }, eq(key,value) { filters.push([key,value]); return query; },
      or() { return query; }, limit() { return query; }, maybeSingle() { return Promise.resolve(execute(true)); },
      upsert(value) { action="upsert"; payload=value; return query; }, update(value) { action="update"; payload=value; return query; },
      delete() { action="delete"; return query; },
      then(resolve,reject) { return Promise.resolve(execute()).then(resolve,reject); },
    };
    return query;
  } };
}

function subscription(overrides = {}) {
  return { id: "sub_current", metadata: { org_id: "org", workspace_id: "workspace" }, customer: "cus_live", items: { data: [{ price: { id: "price_uk" } }] }, status: "active", current_period_end: 1800000000, ...overrides };
}

describe("Stripe subscription processing", () => {
  beforeEach(() => vi.stubGlobal("Deno", { env: { get: key => ({
    STRIPE_SECRET_KEY: "sk_live_fixture", STRIPE_SECRET_KEY_TEST: "sk_test_fixture",
    STRIPE_PRICE_STARTER: "price_uk", STRIPE_PRICE_STARTER_EUR: "price_eur",
    STRIPE_PRICE_STARTER_TEST: "price_test", STRIPE_WEBHOOK_SECRET: "whsec_live_fixture",
    STRIPE_WEBHOOK_SECRET_TEST: "whsec_test_fixture",
  })[key] } }));
  afterEach(() => vi.unstubAllGlobals());

  it("activates the Austrian workspace with the shared EUR price", async () => {
    const db=database({market:"at"});
    await applySubscription(db,subscription({items:{data:[{price:{id:"price_eur"}}]}}),true);
    expect(db.rows.org_country_workspace_subscriptions[0]).toMatchObject({billing_plan:"starter",currency:"EUR",market_id:"at"});
  });
  it("propagates storage failure and succeeds when the event is retried", async () => {
    const db=database({fail:"org_country_workspace_subscriptions:upsert"});
    await expect(applySubscription(db,subscription(),true)).rejects.toThrow("Could not save");
    await applySubscription(db,subscription(),true);
    expect(db.rows.organizations[0].billing_plan).toBe("starter");
  });
  it("retries a failed organisation mirror too", async () => {
    const db=database({fail:"organizations:update"});
    await expect(applySubscription(db,subscription(),true)).rejects.toThrow("organisation subscription");
    await applySubscription(db,subscription(),true);
    expect(db.rows.organizations[0].billing_plan).toBe("starter");
  });
  it("keeps test payments out of the live organisation fields", async () => {
    const db=database({mode:"test"});const original={...db.rows.organizations[0]};
    await applySubscription(db,subscription({customer:"cus_test",items:{data:[{price:{id:"price_test"}}]}}),false);
    expect(db.rows.organizations[0]).toEqual(original);
    expect(db.rows.org_country_workspace_subscriptions[0].billing_plan).toBe("starter");
    await clearSubscription(db,"workspace",{customerId:"cus_test",subscriptionId:"sub_current",livemode:false});
    expect(db.rows.organizations[0]).toEqual(original);
  });
  it("ignores cancellation of an older subscription", async () => {
    const db=database();
    await clearSubscription(db,"workspace",{customerId:"cus_live",subscriptionId:"sub_old",livemode:true});
    expect(db.rows.org_country_workspace_subscriptions[0].subscription_status).toBe("active");
    expect(db.rows.organizations[0].subscription_status).toBe("active");
  });
  it("can retry cancellation after a failed legacy mirror", async () => {
    const db=database({fail:"organizations:update"});
    const opts={customerId:"cus_live",subscriptionId:"sub_current",livemode:true};
    await expect(clearSubscription(db,"workspace",opts)).rejects.toThrow("organisation subscription");
    await clearSubscription(db,"workspace",opts);
    expect(db.rows.organizations[0].subscription_status).toBe("canceled");
  });
  it.each([false, true])("acknowledges cancellation after workspace deletion (live=%s)", async (livemode) => {
    const db=database({mode:livemode ? "live" : "test"});
    db.rows.org_country_workspaces=[];
    db.rows.org_country_workspace_subscriptions=[];
    if(livemode) db.rows.organizations=[];
    const stripe={subscriptions:{retrieve:vi.fn().mockResolvedValue(subscription({status:"canceled"}))}};
    await processStripeEvent(db,stripe,{type:"customer.subscription.deleted",livemode,data:{object:{id:"sub_current"}}});
    expect(db.calls.every(c=>c.action==="select")).toBe(true);
  });
  it("does not hide a database failure as a deleted workspace", async () => {
    const db=database({fail:"org_country_workspaces:select"});
    await expect(clearSubscription(db,"workspace",{subscriptionId:"sub_current",livemode:false})).rejects.toThrow("temporary database failure");
  });
  it("does not ignore cancellation mapped to a missing workspace while another binding exists", async () => {
    const db=database({mode:"test"});
    await expect(clearSubscription(db,"wrong-workspace",{subscriptionId:"sub_current",livemode:false})).rejects.toThrow("subscription still bound");
    expect(db.rows.org_country_workspace_subscriptions[0].subscription_status).toBe("active");
  });
  it("keeps retrying if the deleted workspace binding check fails", async () => {
    const db=database({fail:"org_country_workspace_subscriptions:select"});
    await expect(clearSubscription(db,"missing-workspace",{subscriptionId:"sub_current",livemode:false})).rejects.toThrow("Cancellation billing lookup failed");
  });
  it("does not ignore a live cancellation while the legacy organisation remains bound", async () => {
    const db=database();
    db.rows.org_country_workspaces=[];
    db.rows.org_country_workspace_subscriptions=[];
    await expect(clearSubscription(db,"workspace",{subscriptionId:"sub_current",livemode:true})).rejects.toThrow("organisation still bound");
    expect(db.rows.organizations[0].subscription_status).toBe("active");
  });
  it("does not write through a failed subscription lookup", async () => {
    const db=database({fail:"org_country_workspace_subscriptions:select"});
    await expect(applySubscription(db,subscription(),true)).rejects.toThrow("Billing lookup failed");
    expect(db.calls.some(c=>c.action==="upsert")).toBe(false);
  });
  it("rejects another customer's subscription", async () => {
    await expect(applySubscription(database(),subscription({customer:"cus_other"}),true)).rejects.toThrow("binding mismatch");
  });
  it("uses current Stripe state instead of a late active snapshot", async () => {
    const db=database();const stripe={subscriptions:{retrieve:vi.fn().mockResolvedValue(subscription({status:"unpaid"}))}};
    await processStripeEvent(db,stripe,{type:"customer.subscription.updated",livemode:true,data:{object:subscription()}});
    expect(db.rows.organizations[0]).toMatchObject({subscription_status:"unpaid",billing_plan:null});
  });
  it("retrieves state again after acquiring the workspace lock", async () => {
    const db = database();
    const stripe = { subscriptions: { retrieve: vi.fn().mockResolvedValueOnce(subscription()).mockResolvedValueOnce(subscription({ status: "unpaid" })) } };
    await processStripeEvent(db, stripe, { type: "customer.subscription.updated", livemode: true, data: { object: subscription() } });
    expect(db.rpc).toHaveBeenCalledWith("acquire_billing_checkout_lock", { p_workspace_id: "workspace", p_stripe_mode: "live" });
    expect(db.rows.organizations[0]).toMatchObject({ subscription_status: "unpaid", billing_plan: null });
    expect(db.calls).toContainEqual({ table: "billing_checkout_locks", action: "delete", payload: undefined });
  });
  it("retries a concurrent event without applying a stale snapshot", async () => {
    const db = database(); db.rpc.mockResolvedValue({ data: null });
    const stripe = { subscriptions: { retrieve: vi.fn().mockResolvedValue(subscription()) } };
    await expect(processStripeEvent(db, stripe, { type: "customer.subscription.updated", livemode: true, data: { object: subscription() } })).rejects.toThrow("busy");
    expect(db.calls.some((c) => c.action === "upsert")).toBe(false);
  });
  it("handles invoice renewal using current subscription state", async () => {
    const db=database();const stripe={subscriptions:{retrieve:vi.fn().mockResolvedValue(subscription())}};
    await processStripeEvent(db,stripe,{type:"invoice.paid",livemode:true,data:{object:{parent:{subscription_details:{subscription:"sub_current"}}}}});
    expect(stripe.subscriptions.retrieve).toHaveBeenCalledWith("sub_current");
    expect(db.rows.organizations[0].billing_plan).toBe("starter");
  });
  it("waits for asynchronous payment success", async () => {
    const db=database();const stripe={subscriptions:{retrieve:vi.fn().mockResolvedValue(subscription())}};
    const object={payment_status:"unpaid",subscription:"sub_current"};
    await processStripeEvent(db,stripe,{type:"checkout.session.completed",livemode:true,data:{object}});
    expect(stripe.subscriptions.retrieve).not.toHaveBeenCalled();
    await processStripeEvent(db,stripe,{type:"checkout.session.async_payment_succeeded",livemode:true,data:{object:{...object,payment_status:"paid"}}});
    expect(db.rows.organizations[0].billing_plan).toBe("starter");
  });
  it("verifies a real signature using asynchronous Web Crypto", async () => {
    const stripe=new Stripe("sk_live_fixture");
    const body=JSON.stringify({id:"evt_fixture",livemode:true,type:"customer.subscription.updated"});
    const signature=stripe.webhooks.generateTestHeaderString({payload:body,secret:"whsec_live_fixture"});
    expect((await constructStripeEvent(Stripe,body,signature)).event.id).toBe("evt_fixture");
    await expect(constructStripeEvent(Stripe,body+" ",signature)).rejects.toThrow();
  });
  it("rejects a live event signed with the test secret", async () => {
    const stripe=new Stripe("sk_test_fixture");const body=JSON.stringify({id:"evt_fixture",livemode:true});
    const signature=stripe.webhooks.generateTestHeaderString({payload:body,secret:"whsec_test_fixture"});
    await expect(constructStripeEvent(Stripe,body,signature)).rejects.toThrow("mode mismatch");
  });
});
