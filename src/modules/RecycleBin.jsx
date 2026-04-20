import { useEffect, useMemo, useState } from "react";
import { useRegisterListPaging } from "../utils/useRegisterListPaging";
import PageHero from "../components/PageHero";
import { ms } from "../utils/moduleStyles";
import {
  RECYCLE_RETENTION_DAYS,
  listRecycleBinEntries,
  restoreRecycleBinEntry,
  deleteRecycleBinEntry,
  purgeExpiredRecycleBinEntries,
} from "../utils/recycleBin";

const RECYCLE_LIST_PAGE = 50;

const ss = { ...ms };

function fmtDateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function remainingDays(expiresAt) {
  const msLeft = new Date(expiresAt).getTime() - Date.now();
  if (msLeft <= 0) return 0;
  return Math.max(1, Math.ceil(msLeft / (24 * 60 * 60 * 1000)));
}

export default function RecycleBin() {
  const [items, setItems] = useState(() => listRecycleBinEntries());
  const listPg = useRegisterListPaging(RECYCLE_LIST_PAGE);

  const refresh = () => setItems(listRecycleBinEntries());

  const refreshAndResetPaging = () => {
    listPg.reset();
    setItems(listRecycleBinEntries());
  };

  useEffect(() => {
    const t = setInterval(refresh, 60000);
    return () => clearInterval(t);
  }, []);

  const moduleStats = useMemo(() => {
    const map = new Map();
    items.forEach((item) => {
      const key = item.moduleLabel || item.moduleId || "Unknown";
      map.set(key, (map.get(key) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [items]);

  const onRestore = (entryId) => {
    const res = restoreRecycleBinEntry(entryId);
    if (!res.ok) {
      alert(res.reason || "Could not restore this item.");
    }
    refresh();
  };

  const onDeleteNow = (entryId) => {
    if (!confirm("Delete permanently now? This cannot be undone.")) return;
    deleteRecycleBinEntry(entryId);
    refresh();
  };

  const onPurgeExpired = () => {
    const removed = purgeExpiredRecycleBinEntries();
    refresh();
    alert(removed > 0 ? `Removed ${removed} expired item(s).` : "No expired items to remove.");
  };

  return (
    <div style={{ fontFamily: "DM Sans,system-ui,sans-serif", padding: "1.25rem 0", fontSize: 14, color: "var(--color-text-primary)" }}>
      <PageHero
        badgeText="BIN"
        title="Recycle bin"
        lead={`Deleted records stay here for ${RECYCLE_RETENTION_DAYS} days, then are auto-removed. You can restore or permanently delete now.`}
        right={
          <>
            <button type="button" style={ss.btn} onClick={refreshAndResetPaging}>
              Refresh
            </button>
            <button type="button" style={ss.btn} onClick={onPurgeExpired}>
              Purge expired
            </button>
          </>
        }
      />

      <div className="app-surface-card" style={{ ...ss.card, marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span style={ss.chip}>Items: {items.length}</span>
          {moduleStats.slice(0, 5).map(([name, count]) => (
            <span key={name} style={ss.chip}>
              {name}: {count}
            </span>
          ))}
        </div>
      </div>

      <div className="app-surface-card" style={ss.card}>
        {items.length === 0 ? (
          <div style={{ color: "var(--color-text-secondary)" }}>Recycle bin is empty.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {listPg.hasMore(items) ? (
              <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                Showing {Math.min(listPg.cap, items.length)} of {items.length} items
              </div>
            ) : null}
            {listPg.visible(items).map((item) => (
              <div
                key={item.id}
                style={{
                  border: "0.5px solid var(--color-border-tertiary,#e5e5e5)",
                  borderRadius: 10,
                  padding: "10px 10px",
                  background: "var(--color-background-primary,#fff)",
                  contentVisibility: "auto",
                  containIntrinsicSize: "0 72px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>{item.itemLabel || "Deleted item"}</div>
                    <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                      {item.moduleLabel || item.moduleId} · {item.itemType || "item"}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 4 }}>
                      Deleted: {fmtDateTime(item.deletedAt)} · Auto remove in {remainingDays(item.expiresAt)} day(s)
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button type="button" style={ss.btn} onClick={() => onRestore(item.id)}>
                      Restore
                    </button>
                    <button type="button" style={{ ...ss.btn, color: "#A32D2D", borderColor: "#F09595" }} onClick={() => onDeleteNow(item.id)}>
                      Delete now
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {listPg.hasMore(items) ? (
              <div style={{ display: "flex", justifyContent: "center", marginTop: 4 }}>
                <button type="button" style={ss.btn} onClick={listPg.showMore}>
                  Show more ({listPg.remaining(items)} remaining)
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
