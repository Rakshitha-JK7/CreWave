# CareWave - Individual 3 Communication Layer Documentation

This module implements the **offline-first, prioritized, network-adaptive, and resumable communication mechanism** for CareWave, tailored for rural clinics operating over weak/intermittent 2G networks.

---

## 1. Module Overview (`src/communication/`)

| File | Purpose |
|---|---|
| [`constants.js`](file:///d:/Bits2Wave/src/communication/constants.js) | Full status lifecycles, priority groups (1: Essential, 2: Clinical, 3: Documents), component types, and network presets |
| [`cryptoUtils.js`](file:///d:/Bits2Wave/src/communication/cryptoUtils.js) | SHA-256 chunk and full-file hashing via standard browser `crypto.subtle.digest` |
| [`localDB.js`](file:///d:/Bits2Wave/src/communication/localDB.js) | `idb`-powered IndexedDB schemas (`consultations`, `components`, `chunks`, `outbox`) |
| [`networkSimulator.js`](file:///d:/Bits2Wave/src/communication/networkSimulator.js) | Built-in network simulator wrapping `fetch` (Normal, 2G with 800ms + 40kbps throttling, Flaky 20% drops, Offline) |
| [`networkMonitor.js`](file:///d:/Bits2Wave/src/communication/networkMonitor.js) | Active reachability probing, latency measurement, adaptive chunk sizing (32KB/64KB/128KB), status classification |
| [`retryManager.js`](file:///d:/Bits2Wave/src/communication/retryManager.js) | Exponential backoff with full jitter to avoid request hammering on reconnects |
| [`uploadManager.js`](file:///d:/Bits2Wave/src/communication/uploadManager.js) | 0-indexed chunking, manifest `init`, missing-chunk resume, chunk hash verification, and `complete` verification |
| [`syncQueue.js`](file:///d:/Bits2Wave/src/communication/syncQueue.js) | Priority-based client-side sync queue. Sends essential summary (Group 1) unchunked first, followed by attachments |
| [`responseSync.js`](file:///d:/Bits2Wave/src/communication/responseSync.js) | Polling engine for retrieving doctor responses and sending acknowledgments back to the server |
| [`hooks.js`](file:///d:/Bits2Wave/src/communication/hooks.js) | React integration hooks (`useNetworkStatus`, `useSyncQueue`, `useConsultationStatus`) using `useSyncExternalStore` |
| [`NetworkSimulatorBadge.jsx`](file:///d:/Bits2Wave/src/communication/NetworkSimulatorBadge.jsx) | Plug-and-play UI badge and selector for live demo presentations to judges |

---

## 2. API Contract Expected by Individual 2 (Backend)

1. **Essential Clinical Summary (`POST /api/consultations`)**
   - Header: `Idempotency-Key: <stable-key>`
   - Body: JSON consultation record (`consultationId`, `patientId`, `clinicalSummary`, `vitals`, `priority`, etc.)
2. **Chunk Upload Init (`POST /api/uploads/init`)**
   - Body: `{ consultationId, componentId, type, size, chunkSize, totalChunks, fileHash }`
   - Response: `{ uploadId, receivedChunks: [0, 1, 3] }`
3. **Upload Chunk (`PUT /api/uploads/:uploadId/chunks/:index`)**
   - 0-indexed chunk index
   - Headers: `X-Chunk-Hash`, `X-Chunk-Index`
   - Body: `FormData` with chunk blob
4. **Complete Upload (`POST /api/uploads/:uploadId/complete`)**
   - Body: `{ consultationId, componentId, fileHash, totalChunks }`
   - Server validates SHA-256 and marks component complete
5. **Sync Responses (`GET /api/sync/responses`)** & **Acknowledge (`PATCH /api/responses/:id/acknowledge`)**

---

## 3. UI Integration Guide for Individual 1 (Frontend)

Individual 1 only needs to import hooks from `src/communication/`:

```jsx
import { useNetworkStatus, useSyncQueue, useConsultationStatus, NetworkSimulatorBadge } from './communication';

// In Navigation / Header:
<NetworkSimulatorBadge />

// In Healthcare Worker Consultation View:
const { enqueueConsultation, pending, active, failed, retry } = useSyncQueue();

// Save and sync:
await enqueueConsultation(consultationData, [
  { file: ecgBlob, type: 'ecg', priority: 2, name: 'ecg_lead2.dat' }
]);

// Track component upload status:
const { consultation, components, overallProgress } = useConsultationStatus(consultationId);
```
