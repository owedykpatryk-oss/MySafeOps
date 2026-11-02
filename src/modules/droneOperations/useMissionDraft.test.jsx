/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, it, expect, vi } from "vitest";
import { useMissionDraft } from "./useMissionDraft.js";
const environment = vi.hoisted(() => ({ scope: "org-a:uk" }));
vi.mock("../../hooks/useOverlayFormDraft.js", async (importOriginal) => ({
  ...(await importOriginal()),
  overlayDraftKey: (purpose, id) => `${environment.scope}:${purpose}:${id}`,
}));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let host, root, draft;
function Probe({ id = "m1", revision = 1, user = "u1" }) {
  draft = useMissionDraft("test", { id, revision }, { id: user }, { note: "" });
  return <textarea readOnly value={draft.values.note} />;
}
beforeEach(() => {
  sessionStorage.clear();
  environment.scope = "org-a:uk";
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
});
const render = async (props = {}) => act(async () => root.render(<Probe {...props} />));
it("recovers immediately saved typing after unmount and requires review for a changed plan", async () => {
  await render();
  await act(async () => draft.set({ note: "Do not lose this note" }));
  await act(async () => root.unmount());
  root = createRoot(host);
  await render({ revision: 2 });
  expect(draft.values.note).toBe("Do not lose this note");
  expect(draft.restored).toBe(true);
  expect(draft.revisionChanged).toBe(true);
  await act(async () => draft.confirmRevision());
  expect(draft.revisionChanged).toBe(false);
  await act(async () => draft.reset());
  expect(sessionStorage.length).toBe(0);
  expect(draft.values.note).toBe("");
});
it("keeps drafts separate by mission, account and country and adopts the current revision before typing", async () => {
  await render();
  await render({ revision: 3 });
  await act(async () => draft.set({ note: "Only UK user 1 mission 1" }));
  expect(draft.revisionChanged).toBe(false);
  await render({ id: "m2" });
  expect(draft.values.note).toBe("");
  await render({ user: "u2" });
  expect(draft.values.note).toBe("");
  environment.scope = "org-a:au";
  await render();
  expect(draft.values.note).toBe("");
  environment.scope = "org-b:uk";
  await render();
  expect(draft.values.note).toBe("");
  environment.scope = "org-a:uk";
  await render({ revision: 3 });
  expect(draft.values.note).toBe("Only UK user 1 mission 1");
});
it("retains in-memory typing and reports when recovery storage is unavailable", async () => {
  await render();
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw Error("full");
  });
  await act(async () => draft.set({ note: "Still visible" }));
  expect(draft.values.note).toBe("Still visible");
  expect(draft.storageError).toBe(true);
});
