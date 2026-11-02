/** @vitest-environment jsdom */
import { beforeEach, expect, it } from "vitest";
import { ramsDraftScope } from "./ramsBuilderDraft";
import { consumeAiRamsPrefill, writeAiRamsPrefill } from "./ramsAiPrefill";
beforeEach(() => sessionStorage.clear());
it("preserves an AI draft across attempts by other users, organisations and countries", () => {
  const owner = { userId: "alice", storageScope: "rams_builder_docs_org-a" };
  const scope = ramsDraftScope(owner);
  writeAiRamsPrefill(scope, { title: "Private A" });
  for (const other of [{ ...owner, userId: "bob" }, { ...owner, storageScope: "rams_builder_docs_org-b" }, { ...owner, storageScope: "rams_builder_docs_org-a__country_pl" }]) {
    expect(consumeAiRamsPrefill(ramsDraftScope(other))).toBeNull();
  }
  expect(consumeAiRamsPrefill(scope)).toEqual({ title: "Private A" });
  expect(consumeAiRamsPrefill(scope)).toBeNull();
});
it("does not adopt or delete legacy unowned AI drafts", () => {
  sessionStorage.setItem("mysafeops_ai_rams_prefill", JSON.stringify({ title: "Unowned" }));
  expect(consumeAiRamsPrefill(ramsDraftScope({ localOnly: true, storageScope: "a" }))).toBeNull();
  expect(sessionStorage.getItem("mysafeops_ai_rams_prefill")).not.toBeNull();
});
