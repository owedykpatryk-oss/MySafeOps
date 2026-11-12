/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import LoginPage from "./LoginPage";

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

let host;
let root;

beforeEach(async () => {
  vi.stubEnv("VITE_TURNSTILE_SITE_KEY", "");
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(<MemoryRouter initialEntries={["/login"]}><LoginPage /></MemoryRouter>));
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllEnvs();
});

it("shows password guidance and legal consent only for account creation", async () => {
  const password = host.querySelector("#login-password");
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(password, "A test password 123!");
    password.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(host.textContent).not.toContain("Password strength");
  expect(host.querySelector(".login-legal-checkbox")).toBeNull();
  expect(password.autocomplete).toBe("current-password");

  await act(async () => [...host.querySelectorAll("button")].find((button) => button.textContent === "Create account").click());
  expect(host.querySelector(".login-legal-checkbox")).not.toBeNull();
  expect(host.querySelector(".login-age-checkbox")).not.toBeNull();
  expect(password.autocomplete).toBe("new-password");
  expect(host.textContent).toContain("Password strength");
  expect(host.textContent).toContain("Create your MySafeOps account");
  const createButton = [...host.querySelectorAll("button")].find((button) => button.textContent === "Create account");
  expect(createButton.disabled).toBe(true);
  await act(async () => host.querySelector(".login-legal-checkbox input").click());
  expect(createButton.disabled).toBe(true);
  await act(async () => host.querySelector(".login-age-checkbox input").click());
  expect(createButton.disabled).toBe(false);

  await act(async () => [...host.querySelectorAll("button")].find((button) => button.textContent === "Back to sign in").click());
  expect(host.querySelector(".login-legal-checkbox")).toBeNull();
  expect(password.autocomplete).toBe("current-password");
  expect(host.textContent).toContain("Welcome back to MySafeOps");
});
