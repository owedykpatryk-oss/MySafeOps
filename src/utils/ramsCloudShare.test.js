/** @vitest-environment jsdom */
import { expect, it, vi } from "vitest";
import { fetchPublishedRams, isPublishedRamsShare, publishRamsShare, publishAndCommitRamsShare, revokeRamsShare } from "./ramsCloudShare";

const TOKEN = `r_${"a".repeat(32)}`;

function fakeCloud() {
  const rows = new Map();
  const rpc = vi.fn(async (_name, { p_token }) => {
    const row = rows.get(p_token);
    return { data: row ? { document: row.document, expiresAt: row.expires_at } : null, error: null };
  });
  function mutation(patch) {
    const filters = [];
    const query = {
      eq(key, value) { filters.push([key, value]); return query; },
      then(resolve) {
        for (const [token, row] of rows) {
          if (!filters.every(([key, value]) => row[key] === value)) continue;
          if (patch) rows.set(token, { ...row, ...patch }); else rows.delete(token);
        }
        return Promise.resolve({ error: null }).then(resolve);
      },
    };
    return query;
  }
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: "user-1" } }, error: null }) },
    rpc,
    from: (table) => {
      expect(table).toBe("rams_public_shares");
      return {
        upsert: async (row) => { rows.set(row.token, row); return { error: null }; },
        delete: () => mutation(),
        update: (patch) => mutation(patch),
      };
    },
  };
  return { client, rows, rpc };
}

it("publishes a RAMS snapshot, verifies public retrieval, and revokes it", async () => {
  const { client, rows, rpc } = fakeCloud();
  const doc = { id: "rams-1", title: "Site RAMS", updatedAt: "2026-11-02T12:00:00.000Z", rows: [{ id: "hazard-1" }], shareToken: TOKEN };
  const published = await publishRamsShare(client, doc, "qa-org");
  expect(published.token).toBe(TOKEN);
  expect(rows.get(TOKEN)).toMatchObject({ user_id: "user-1", org_slug: "qa-org", active: true });
  expect(await fetchPublishedRams(client, TOKEN)).toMatchObject({ id: "rams-1", shareToken: TOKEN });
  expect(isPublishedRamsShare({ ...doc, sharePublishedAt: published.publishedAt, shareExpiresAt: published.expiresAt, shareSourceUpdatedAt: published.shareSourceUpdatedAt })).toBe(true);
  expect(isPublishedRamsShare({ ...doc, updatedAt: "2026-11-02T13:00:00.000Z", sharePublishedAt: published.publishedAt, shareExpiresAt: published.expiresAt, shareSourceUpdatedAt: published.shareSourceUpdatedAt })).toBe(false);
  expect(rpc).toHaveBeenCalledWith("fetch_rams_public_share", { p_token: TOKEN });
  await revokeRamsShare(client, { ...doc, sharePublishedAt: published.publishedAt });
  expect(await fetchPublishedRams(client, TOKEN)).toBeNull();
});

it("does not treat an expired or unpublished local token as a public share", () => {
  expect(isPublishedRamsShare({ shareToken: TOKEN, sharePublishedAt: "2026-01-01", shareExpiresAt: "2026-01-02" }, Date.parse("2026-01-03"))).toBe(false);
  expect(isPublishedRamsShare({ shareToken: TOKEN, shareExpiresAt: "2099-01-01" })).toBe(false);
});

it("requires a signed-in publisher", async () => {
  const client = { auth: { getUser: async () => ({ data: { user: null }, error: null }) }, from: vi.fn() };
  await expect(publishRamsShare(client, { id: "rams-1", rows: [] })).rejects.toThrow("Sign in");
  expect(client.from).not.toHaveBeenCalled();
});

it("revokes a new publication when local metadata persistence fails", async () => {
  const { client, rows } = fakeCloud();
  const doc = { id: "r1", rows: [], updatedAt: "2026-11-02", shareToken: TOKEN };
  await expect(publishAndCommitRamsShare(client, doc, "org-a", { version: 1 }, { expectedUserId: "user-1", isCurrent: () => true }, () => ({ ok: false }))).rejects.toThrow("could not be saved");
  expect(rows.size).toBe(0);
});
it("restores the previous public document when republishing cannot be saved locally", async () => {
  const { client, rows } = fakeCloud();
  const previous = { id: "r1", rows: [], title: "Original", shareToken: TOKEN, sharePublishedAt: "2026-10-01", shareExpiresAt: "2099-01-01" };
  rows.set(TOKEN, { token: TOKEN, user_id: "user-1", document: previous, updated_at: previous.sharePublishedAt });
  await expect(publishAndCommitRamsShare(client, { ...previous, title: "Changed" }, "org-a", { version: 1 }, { expectedUserId: "user-1", isCurrent: () => true }, () => ({ ok: false }))).rejects.toThrow("could not be saved");
  expect(rows.get(TOKEN).document).toEqual(previous);
});
it.each(["user", "workspace"])("rejects origin %s changes while waiting for authentication before publishing", async (change) => {
  const { client, rows } = fakeCloud();
  let resolveAuth;
  let current = true;
  client.auth.getUser = () => new Promise(resolve => { resolveAuth = resolve; });
  const pending = publishRamsShare(client, { id: "r1", rows: [] }, "org-a", { version: 1 }, { expectedUserId: "user-1", isCurrent: () => current });
  if (change === "workspace") current = false;
  resolveAuth({ data: { user: { id: change === "user" ? "user-2" : "user-1" } } });
  await expect(pending).rejects.toThrow("Account or workspace changed");
  expect(rows.size).toBe(0);
});
it("retains a concurrent newer publication and a scoped recovery reference when rollback cannot remove it", async () => {
  sessionStorage.clear();
  const { client, rows } = fakeCloud();
  const doc = { id: "r1", rows: [], shareToken: TOKEN };
  const origin = { expectedUserId: "user-1", storageScope: "rams_builder_docs_org-a", isCurrent: () => true };
  await expect(publishAndCommitRamsShare(client, doc, "org-a", { version: 1 }, origin, () => {
    rows.set(TOKEN, { ...rows.get(TOKEN), updated_at: "2099-01-01", document: { id: "r1", title: "Concurrent" } });
    return { ok: false };
  })).rejects.toThrow("may remain published");
  expect(rows.get(TOKEN).document.title).toBe("Concurrent");
  const key = `mysafeops_rams_share_recovery_v1:${encodeURIComponent(JSON.stringify(["user-1", origin.storageScope]))}`;
  expect(JSON.parse(sessionStorage.getItem(key))[0]).toMatchObject({ token: TOKEN, orgSlug: "org-a" });
});

it("records revocation metadata before success without copying the public snapshot into the local document", async () => {
  const { client, rows } = fakeCloud();
  const doc = { id: "r1", rows: [], updatedAt: "2026-11-02", shareToken: TOKEN };
  let saved;
  const result = await publishAndCommitRamsShare(client, doc, "org-a", { version: 1, org: { name: "Publisher" } }, { expectedUserId: "user-1", isCurrent: () => true }, document => {
    saved = document;
    return { ok: true, documents: [document] };
  });
  expect(result.documents).toEqual([saved]);
  expect(saved.sharePublishedAt).toBeTruthy();
  expect(saved.publicationSnapshot).toBeUndefined();
  expect(rows.get(TOKEN).document.publicationSnapshot.org.name).toBe("Publisher");
  await revokeRamsShare(client, saved);
  expect(rows.size).toBe(0);
});
