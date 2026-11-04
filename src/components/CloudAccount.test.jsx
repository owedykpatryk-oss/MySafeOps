/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import CloudAccount from "./CloudAccount";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
vi.mock("../lib/supabase", () => ({ isSupabaseConfigured: () => true }));
vi.mock("../config/turnstile", () => ({
  isTurnstileEnabled: () => false,
  isTurnstileTestKeyOnProductionHost: () => false,
  TURNSTILE_SITE_KEY: "",
}));
vi.mock("../context/SupabaseAuthContext", () => ({
  useSupabaseAuth: () => ({ supabase: { auth: {} }, user: null, loading: false, ready: true }),
}));
vi.mock("../context/AppContext", () => ({
  useApp: () => ({ caps: {}, orgId: null, billing: null, trialStatus: null, isPlatformOwner: false }),
}));

let host;
let root;
beforeEach(async () => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(<MemoryRouter><CloudAccount /></MemoryRouter>));
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

it("keeps registration guidance and consent out of the cloud sign-in view", async () => {
  const password = host.querySelector('input[type="password"]');
  expect(password.autocomplete).toBe("current-password");
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(password, "A test password 123!");
    password.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(host.textContent).not.toContain("Password strength");
  expect(host.textContent).not.toContain("I have read and agree to the");

  await act(async () => [...host.querySelectorAll("button")].find((button) => button.textContent === "Create account").click());
  expect(host.textContent).toContain("Password strength");
  expect(host.textContent).toContain("I have read and agree to the");
  expect(host.textContent).toContain("Create an account with your work email");
  expect(password.autocomplete).toBe("new-password");
  await act(async () => [...host.querySelectorAll("button")].find((button) => button.textContent === "Back to sign in").click());
  expect(host.textContent).not.toContain("Password strength");
  expect(host.textContent).not.toContain("I have read and agree to the");
  expect(password.autocomplete).toBe("current-password");
});
