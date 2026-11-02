import { DurableObject } from "cloudflare:workers";
import { StorageQuotaLedger } from "./storageQuota.mjs";
export { default } from "./index.mjs";

export class StorageQuota extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ledger = new StorageQuotaLedger(ctx.storage, env.BUCKET);
  }
  usage(scopeId) { return this.ledger.usage(scopeId); }
  upload(options, body) { return this.ledger.upload(options, body); }
}
