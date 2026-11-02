import { expect, it, vi } from "vitest";
import { fetchPublishedRams, isPublishedRamsShare, publishRamsShare, revokeRamsShare } from "./ramsCloudShare";

const TOKEN = `r_${"a".repeat(32)}`;

function fakeCloud() {
  const rows = new Map();
  const rpc = vi.fn(async (_name, { p_token }) => {
    const row = rows.get(p_token);
    return { data: row ? { document: row.document, expiresAt: row.expires_at } : null, error: null };
  });
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: "user-1" } }, error: null }) },
    rpc,
    from: (table) => {
      expect(table).toBe("rams_public_shares");
      return {
        upsert: async (row) => { rows.set(row.token, row); return { error: null }; },
        delete: () => ({
          eq: (key, token) => ({
            eq: async (ownerKey, ownerId) => {
              expect([key, ownerKey, ownerId]).toEqual(["token", "user_id", "user-1"]);
              rows.delete(token);
              return { error: null };
            },
          }),
        }),
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
