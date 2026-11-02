import { storageScope } from "../../../shared/storageScope.mjs";

/** One coordinator per workspace. R2 remains the source of truth after interrupted writes. */
export class StorageQuotaLedger {
  constructor(storage, bucket) {
    this.storage = storage;
    this.bucket = bucket;
    this.pending = Promise.resolve();
  }

  serial(operation) {
    const result = this.pending.then(operation);
    this.pending = result.catch(() => {});
    return result;
  }

  async readUsage(scopeId) {
    const state = await this.storage.get("usage");
    if (state && state.scopeId !== scopeId) throw new Error("Storage scope mismatch");
    if (state && !state.dirty) return state.bytes;
    // Includes old paths, which predate country scoping. Paginate; never assume 1,000 objects.
    let bytes = 0;
    let cursor;
    do {
      const page = await this.bucket.list({ limit: 1000, ...(cursor ? { cursor } : {}) });
      for (const object of page.objects) {
        if (storageScope(object.key)?.id === scopeId) bytes += object.size;
      }
      cursor = page.truncated ? page.cursor : null;
      if (page.truncated && !cursor) throw new Error("Incomplete storage inventory");
    } while (cursor);
    await this.storage.put("usage", { scopeId, bytes, dirty: false });
    return bytes;
  }

  usage(scopeId) {
    return this.serial(async () => ({ bytes: await this.readUsage(scopeId) }));
  }

  upload({ key, size, limit, contentType, contentDisposition }, body) {
    return this.serial(async () => {
      const scope = storageScope(key);
      if (!scope || !Number.isSafeInteger(size) || size < 0 || !Number.isSafeInteger(limit) || limit < 0) throw new Error("Invalid upload quota request");
      const used = await this.readUsage(scope.id);
      const existing = await this.bucket.head(key);
      const next = used - (existing?.size || 0) + size;
      // Downgrades retain existing files; replacements may reduce, never grow over quota.
      if (next > limit && next > used) return { ok: false, error: "storage_limit_reached", used, limit };
      await this.storage.put("usage", { scopeId: scope.id, bytes: used, dirty: true });
      const stored = await this.bucket.put(key, body, { httpMetadata: { contentType, contentDisposition } });
      if (!stored || stored.size !== size) throw new Error("Upload size mismatch");
      await this.storage.put("usage", { scopeId: scope.id, bytes: next, dirty: false });
      return { ok: true, used: next, limit };
    });
  }
}
