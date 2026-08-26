# Paperless Construction Workflow — New Features

## Overview

Three new features enable true offline-first, paperless construction site operations:

1. **Batch Photo Queue** — Queue multiple photos, tag collectively, upload when online
2. **Offline-First Sync** — Queue any record edits offline, auto-sync when connectivity returns
3. **Offline Status UI** — Visual indicator of network state, pending sync items, manual sync trigger

---

## Feature 1: Batch Photo Queue

### Files
- `src/components/geoPhotos/GeoPhotoBatchQueue.jsx` — UI component + storage hook
- Uses: `localStorage` (browser quota ~5-50MB depending on device)

### What It Does
- Captures multiple photos from device camera/gallery
- Stores photos in base64 in localStorage (survives app close/PWA background)
- Shows preview grid (thumbnails)
- Allows bulk tagging: area, phase, direction, permit reference
- Uploads all at once when user triggers (or auto-syncs when online)

### Usage
```jsx
import GeoPhotoBatchQueue, { useBatchPhotoQueue } from "../components/geoPhotos/GeoPhotoBatchQueue";

function SitePhotosModule() {
  const { queue, addPhoto, removePhoto, updatePhotoDetails } = useBatchPhotoQueue();

  // After camera capture:
  addPhoto(imageDataUrl, "facade_north.jpg", {
    lat: 52.1234,
    lng: 13.4567,
    bearing: 45,
    phase: "framing"
  });

  return (
    <GeoPhotoBatchQueue
      queue={queue}
      onRemove={removePhoto}
      onUpdateDetails={updatePhotoDetails}
      onBatchUpload={handleUploadAll}
    />
  );
}
```

### Browser Support
✅ Works offline in PWA + web
✅ Survives app backgrounding (sessionStorage → localStorage migration)
✅ On Android/iOS, photos persist through camera app round-trip

---

## Feature 2: Offline-First Sync

### Files
- `src/utils/offlineSync.js` — core sync engine
- `src/utils/offlineSync.test.js` — test suite
- Uses: `localStorage` for queue + retry state

### What It Does
- Accepts any record edit/upload in a sync queue
- Detects online/offline via `navigator.onLine` + `online`/`offline` events
- If online: attempts immediate sync
- If offline: queues for later
- When connectivity returns: auto-syncs (debounced)
- Retries failed items up to 3× with exponential backoff
- Moves permanently-failed items to "dead letter" queue for manual review

### API

```js
import { queueForSync, processSyncQueue, useOfflineSync } from "../utils/offlineSync";

// Queue a single item
await queueForSync(
  {
    type: "record",  // 'photo' | 'record' | 'signature'
    payload: { workerName: "Alice", hours: 8 }
  },
  async (item) => {
    // Your sync handler — called if online, else queued
    const res = await api.post("/timesheets", item.payload);
    return res.data;
  }
);

// Manually process queue
const { processed, failed } = await processSyncQueue(
  async (item) => {
    // Handler called for each queued item
    return api.post("/sync", item);
  },
  (progress) => console.log(`${progress.processed}/${progress.total} synced`)
);

// Hook: auto-detects online/offline + triggers sync
const { isOnline, syncing, queueSize, failedSize } = useOfflineSync(syncHandler);
```

### Storage Keys
- `mysafeops_sync_queue` — items awaiting upload (JSON array)
- `mysafeops_sync_failed` — permanently failed items (for manual review/retry)

### Retry Policy
- Max retries: 3
- Delay between attempts: 5 seconds (configurable)
- After 3 failures: moved to dead-letter queue

---

## Feature 3: Offline Status Indicator

### Files
- `src/components/OfflineSyncStatus.jsx` — header/footer UI component

### What It Shows
- Network icon: 🌐 (green online) / 📡 (red offline)
- "Online" / "Offline" label
- Pending items count (if any)
- Failed items count + alert icon (if any)
- "Sync Now" button (visible if online + items pending)

### Usage
```jsx
import OfflineSyncStatus from "../components/OfflineSyncStatus";

export function AppHeader() {
  const handleSync = async (item) => {
    // Handler passed to processSyncQueue
    return api.post("/sync", item);
  };

  return (
    <header>
      <OfflineSyncStatus onSync={handleSync} />
      {/* other header content */}
    </header>
  );
}
```

### Placement
- Top-right corner of app header (or bottom-left for mobile)
- Only visible if:
  - Offline, OR
  - Online + pending sync items, OR
  - Failed items exist

---

## Integration Examples

### Scenario 1: Field Team Capturing Evidence Photos
1. Site crew on location; WiFi unavailable
2. Use geo-photos to capture 20+ photos of work-in-progress
3. **Batch Queue** adds each to localStorage
4. **Offline Status** shows "Offline · 20 pending" (no Sync button)
5. Crew returns to site office (WiFi available)
6. **Offline Status** shows "Online · 20 pending" + "Sync Now" button
7. Crew clicks "Sync Now" → all 20 upload at once
8. App creates workspace records (geo-photos + linked permit)

### Scenario 2: Logging Daily Checklist Offline
1. Crew starts checklist on site (no connectivity)
2. Each form submission → **Offline Sync** queues it
3. **Offline Status** counts pending items
4. After work day, crew connects at office
5. **Offline Status** auto-syncs (or manual "Sync Now")
6. Failed items (e.g., invalid reference) go to dead-letter for review
7. Admin resolves failed items next day

### Scenario 3: Multi-Site Synchronization
1. Supervisor works across 3 sites with poor WiFi
2. Edits timesheets/incidents at each site (queued offline)
3. Each site queued separately in localStorage
4. On return to office: single "Sync Now" uploads all batches
5. App handles retry + deduplication server-side

---

## Architecture Notes

### Why localStorage (not IndexedDB)?
- **Simpler**: No async setup, works immediately
- **Sufficient**: 5-50MB covers 100+ photos (compressed)
- **Portable**: Data survives PWA uninstall (on Android)
- **Fallback**: If quota exceeded, gracefully queues on next sync

### Data Flow
```
Offline capture → localStorage (batch queue)
      ↓
Network status changes to "online"
      ↓
Auto-trigger processSyncQueue()
      ↓
For each item, call onSync handler
      ↓
Success → remove from queue
Failure → increment retries, re-queue or move to dead-letter
      ↓
Update UI (OfflineSyncStatus)
```

### Limitations & Future Work
- **Max queue size**: ~50MB (device dependent)
- **No P2P sync**: Single-device queuing only (no crew-to-crew mesh)
- **Server-side dedup**: Assumes backend handles duplicate detection
- **No conflict resolution**: Last-write-wins; future: merge strategies
- **No compression**: Could add JPEG→WEBP compression for photos

---

## Testing

Run tests:
```bash
npm test src/utils/offlineSync.test.js
npm test src/components/geoPhotos/GeoPhotoBatchQueue.jsx  # integration tests
```

Manual testing:
1. **Offline simulation**: DevTools → Network → Offline
2. **Queue inspection**: DevTools → Application → localStorage
3. **Sync trigger**: Click "Sync Now" button in OfflineSyncStatus

---

## Next Steps

### High Priority
1. Integrate **Batch Queue** into geo-photos module UI
2. Integrate **Offline Sync** into timesheet/incident forms
3. Add **Offline Status** to app header

### Medium Priority
1. Form field auto-extraction (OCR for permits)
2. Email-to-workspace bridge
3. Server-side dedup logic

### Low Priority
1. JPEG→WEBP compression (save bandwidth)
2. IndexedDB migration (for very large queues)
3. P2P crew sync via local network
