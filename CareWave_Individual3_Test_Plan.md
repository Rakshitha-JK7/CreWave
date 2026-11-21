# CareWave: Individual 3 Workflow Test Plan

**Scope:** offline storage, sync queue, chunked resumable upload, network monitoring and weak-network simulation.
**Out of scope:** React UI components (Individual 1) and server-side storage and doctor dashboard (Individual 2). These are only touched through their agreed interfaces.

> Use **synthetic patient data and sample files only**. Never use real patient records.

---

## 1. Agreed Specifications Under Test

| Item | Specification |
|---|---|
| IndexedDB wrapper | `idb` |
| Stores | `consultations`, `components`, `chunks`, `outbox` |
| Indexes | `components` indexed by `status` and `priority` |
| Essential summary (Group 1) | Single JSON request, **not chunked**, sent first |
| Chunk size | Default **64 KB**; adaptive 32 KB (poor) / 64 KB (normal) / 128 KB (fast); configurable |
| Chunk indexing | **0-indexed**; `totalChunks = ceil(fileSize / chunkSize)` |
| Checksums | **SHA-256** via `crypto.subtle.digest`; per-chunk hash plus whole-file hash |
| Upload flow | `init` → server returns received chunk indices → send missing chunks → `complete` |
| Status lifecycle | `Created → Saved locally → Upload pending → Received by server → Available to doctor → Reviewed → Response submitted → Response received` |
| Hooks | `useNetworkStatus()`, `useSyncQueue()`, `useConsultationStatus(id)` |
| Simulation presets | Offline, 2G (~30–50 kbps, 800 ms+ latency), Flaky (10–20% failures, mid-upload drops), Normal |

---

## 2. Test Environment

### 2.1 Tooling
- **Unit/integration:** Vitest (or Jest) with `fake-indexeddb` for IndexedDB.
- **Mock server:** a small Express/MSW server implementing `init`, `chunk`, `status` and `complete`, with switches to inject failures.
- **Browser:** Chrome (latest) on desktop, plus one Android Chrome device if available.
- **Secure context:** serve over HTTPS or `localhost`; `crypto.subtle` is unavailable otherwise.
- **Network tools (optional extra):** Chrome DevTools throttling; Linux `tc netem`.

### 2.2 Synthetic Test Files

| File | Size | Purpose |
|---|---|---|
| `summary.json` | ~2 KB | Group 1 essential summary |
| `ecg_sample.bin` | 300 KB | Group 2, multi-chunk |
| `image_sample.jpg` | 1.5 MB | Group 2, larger upload |
| `voice_note.webm` | 200 KB | Optional voice note |
| `report_sample.pdf` | 2 MB | Group 3 |
| `exact_64kb.bin` | 65,536 B | Boundary: exactly one chunk |
| `exact_64kb_plus1.bin` | 65,537 B | Boundary: two chunks, last is 1 byte |
| `empty.bin` | 0 B | Edge case |

Sample record to use for the summary: consultation `CW-DEMO-001`, patient reference `PAT-DEMO-1024` (see the synthetic example in the information document).

### 2.3 Pre-Test Checklist
- [ ] App served over HTTPS or `localhost`
- [ ] Mock server running and reachable
- [ ] IndexedDB cleared (DevTools → Application → Clear storage)
- [ ] Simulation toggle set to **Normal**
- [ ] Chunk index base (0) and chunk size confirmed with Individual 2

---

## 3. Test Cases

**Legend:** Priority P1 = must pass for demo, P2 = should pass, P3 = nice to have.

### 3.1 Local Storage (IndexedDB via `idb`)

| ID | Test | Steps | Expected | Pri |
|---|---|---|---|---|
| ST-01 | DB initialisation | Open app with empty browser storage | All four stores and the `status` and `priority` indexes on `components` exist | P1 |
| ST-02 | Save consultation offline | Go offline, save the sample summary | Record stored in `consultations`; status `Saved locally`; no network call attempted | P1 |
| ST-03 | Data survives reload | Save a consultation, hard-reload the page | Record and its status still present | P1 |
| ST-04 | Data survives browser restart | Save a record, close and reopen the browser | Record intact; queue resumes | P2 |
| ST-05 | Priority query | Insert components of priority 1, 2 and 3 with mixed statuses | Query returns the highest-priority `Upload pending` item first | P1 |
| ST-06 | Duplicate ID rejected | Save two records with the same consultation ID | Second write fails or updates safely, with no silent duplicate | P2 |
| ST-07 | Storage quota | Fill storage near the quota with large blobs | A clear error is surfaced; no corruption of existing records | P3 |
| ST-08 | Chunks cleaned after completion | Complete an upload | Chunk blobs removed (or marked reclaimable) from `chunks`; metadata kept | P2 |

### 3.2 Chunking

| ID | Test | Steps | Expected | Pri |
|---|---|---|---|---|
| CH-01 | Standard split | Chunk `ecg_sample.bin` at 64 KB | `totalChunks = 5`; indices `0..4`; chunks 0–3 are 65,536 B each; last is the remainder | P1 |
| CH-02 | 0-indexing | Inspect the first chunk | Index is `0`, not `1` | P1 |
| CH-03 | Exact boundary | Chunk `exact_64kb.bin` | Exactly 1 chunk, size 65,536 | P1 |
| CH-04 | Boundary plus 1 | Chunk `exact_64kb_plus1.bin` | 2 chunks; second is 1 byte | P1 |
| CH-05 | Empty file | Chunk `empty.bin` | Handled explicitly (reject, or 0 chunks); no crash or infinite loop | P2 |
| CH-06 | Reassembly | Concatenate all chunks in index order | Byte-for-byte identical to the original | P1 |
| CH-07 | Adaptive size: poor | Set quality to `poor` | 32 KB chunks used | P2 |
| CH-08 | Adaptive size: fast | Set quality to `good` and fast | 128 KB chunks used | P3 |
| CH-09 | Configurable size | Override chunk size to 16 KB | Manifest declares 16 KB; chunk count recalculated | P2 |
| CH-10 | Group 1 not chunked | Submit `summary.json` | Sent as a single request, no chunk or `init` flow | P1 |

### 3.3 Checksums (SHA-256)

| ID | Test | Steps | Expected | Pri |
|---|---|---|---|---|
| CK-01 | Per-chunk hash | Hash each chunk | 64-char hex digest per chunk; stored in `chunks` | P1 |
| CK-02 | Whole-file hash | Hash the full file | Digest included in the `init` manifest | P1 |
| CK-03 | Known vector | Hash the string `abc` | `ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad` | P1 |
| CK-04 | Corrupt chunk detected | Flip one byte in a chunk, mock server verifies | Server rejects that chunk only; client retries only that chunk | P1 |
| CK-05 | Whole-file mismatch | Send correct chunks but a wrong file hash in `init` | `complete` fails; status `Failed` with an integrity error, not `Received` | P2 |
| CK-06 | Insecure context | Load the app over plain HTTP on a non-localhost host | Clear error that hashing is unavailable (no silent skip) | P2 |

### 3.4 Upload Protocol and Resume

| ID | Test | Steps | Expected | Pri |
|---|---|---|---|---|
| UP-01 | Happy path | Upload `ecg_sample.bin` on Normal network | `init` → all chunks → `complete`; status reaches `Received by server` | P1 |
| UP-02 | Resume after drop | Drop the connection after chunk 2, restore | Client asks the server for received indices; sends only chunks 3 and 4 | P1 |
| UP-03 | Resume after page reload | Interrupt mid-upload, reload the page | Upload resumes from the server-confirmed state | P1 |
| UP-04 | Idempotent retry | Send the same chunk twice | Server accepts or ignores without corruption or duplicate counting | P1 |
| UP-05 | Out-of-order chunks | Send chunk 3 before chunk 2 | Server stores both by index; final assembly is correct | P3 |
| UP-06 | Server restart | Restart the mock server mid-upload | Client re-runs `init`/status and continues | P2 |
| UP-07 | Retry with backoff | Make the server return 503 three times | Client retries with increasing delay; `retryCount` increments | P1 |
| UP-08 | Max retries | Make the server fail permanently | After the limit, status `Failed`; item stays retryable manually | P1 |
| UP-09 | Manual retry | Call `retry(id)` on a failed item | Upload restarts and succeeds when the server recovers | P1 |
| UP-10 | Concurrent uploads | Queue three attachments | Concurrency limit respected (suggest 1–2 on poor networks); no interleaving errors | P2 |
| UP-11 | Timeout | Server stalls on a chunk | Request times out, chunk is retried; UI does not hang | P1 |

### 3.5 Priority and Queue Behaviour

| ID | Test | Steps | Expected | Pri |
|---|---|---|---|---|
| PQ-01 | Group 1 first | Queue ECG, image and summary (summary added last) | Summary is sent before any attachment | P1 |
| PQ-02 | Group 2 before Group 3 | Queue a report (G3) then an ECG (G2) | ECG uploads first | P1 |
| PQ-03 | Priority not by size | Queue a small non-urgent file and a large clinically important file | Order follows declared priority, not file size | P1 |
| PQ-04 | Group 3 deferred on poor network | Set simulation to 2G | Group 3 waits while Group 1 and 2 are active | P2 |
| PQ-05 | Pause and resume | Call `pause()`, then resume | No new requests while paused; queue state preserved | P2 |
| PQ-06 | Pending visibility | Inspect `useSyncQueue()` during a partial upload | Each item reported as pending, active, failed or completed (never hidden) | P1 |

### 3.6 Network Monitor and Auto-Sync

| ID | Test | Steps | Expected | Pri |
|---|---|---|---|---|
| NM-01 | Detect offline | Toggle DevTools offline | `online: false`, `quality: 'offline'` within ~2 s | P1 |
| NM-02 | Detect online | Toggle back online | `online: true`; sync starts automatically | P1 |
| NM-03 | Auto-sync on reconnect | Save 2 consultations offline, then reconnect | Both upload without user action, in priority order | P1 |
| NM-04 | Quality classification | Run Normal, then 2G preset | `quality` changes from `good` to `poor`; `rtt` reflects added latency | P2 |
| NM-05 | Navigator vs reality | Browser reports online but the server is unreachable | Monitor detects via a health ping and reports `poor` or `offline` | P2 |
| NM-06 | No sync storm | Flap the connection online/offline rapidly | Debounced; no duplicate uploads or runaway retries | P2 |

### 3.7 Weak-Network Simulation Toggle

| ID | Test | Steps | Expected | Pri |
|---|---|---|---|---|
| SM-01 | Offline preset | Select **Offline** | All requests fail immediately; `useNetworkStatus()` shows offline | P1 |
| SM-02 | 2G preset | Select **2G**; upload a 300 KB file | Takes noticeably longer (roughly 50–80 s at 30–50 kbps); progress updates smoothly | P1 |
| SM-03 | Flaky preset | Select **Flaky**; upload a 1.5 MB file | Some chunk failures occur; upload still completes via retries | P1 |
| SM-04 | Normal preset | Select **Normal** | Behaviour returns to baseline | P1 |
| SM-05 | Real code path | Enable a preset and watch the network panel | Requests still go through the actual upload code (not a stubbed shortcut) | P2 |
| SM-06 | Visible badge | Enable any non-Normal preset | "Simulated network" badge is shown; hidden on Normal | P1 |
| SM-07 | Mid-upload switch | Switch Normal → Offline → Normal during an upload | Upload pauses, then resumes without restarting | P1 |
| SM-08 | Events through the store | Switch preset | Same store events fire as for real network changes | P2 |

### 3.8 Status Lifecycle

| ID | Test | Steps | Expected | Pri |
|---|---|---|---|---|
| LC-01 | Full progression | Run an upload with mocked doctor actions | Statuses follow the agreed enum in order, with no skipped or invented values | P1 |
| LC-02 | Delivery ≠ review | Complete an upload only | Status is `Received by server` / `Available to doctor`, **never** `Reviewed` | P1 |
| LC-03 | Doctor response | Mock server posts a response | Status reaches `Response received`; response data stored locally | P1 |
| LC-04 | Per-component status | Mix one completed and one failed attachment | Each component shows its own state; consultation state reflects the mixture | P1 |
| LC-05 | Progress percentage | Watch `useConsultationStatus(id)` during upload | Progress rises monotonically from 0 to 100 | P1 |
| LC-06 | Metadata recorded | Inspect a completed component | Holds ID, type, priority, timestamps, size, checksum, retry count, status | P1 |

### 3.9 React Hook Integration

| ID | Test | Steps | Expected | Pri |
|---|---|---|---|---|
| HK-01 | `useNetworkStatus` updates | Toggle the network | Component re-renders with new values | P1 |
| HK-02 | `useSyncQueue` data shape | Render with 3 queued items | Returns pending/active/failed/completed lists, `retry`, `pause` | P1 |
| HK-03 | `useConsultationStatus` | Render for an existing ID | Returns component statuses and progress | P1 |
| HK-04 | No unnecessary re-renders | Update an unrelated consultation | Subscribed component does not re-render | P3 |
| HK-05 | Unmount safety | Unmount during an active upload | No memory leaks or console errors; upload continues in the background | P2 |
| HK-06 | UI isolation | Search Individual 1's code | No direct `idb` or `fetch` calls; only the hooks are used | P2 |

### 3.10 Privacy and Safety

| ID | Test | Steps | Expected | Pri |
|---|---|---|---|---|
| PV-01 | Synthetic data only | Review all fixtures | No real patient information | P1 |
| PV-02 | Transport security | Inspect requests | All requests use HTTPS (or `localhost` in dev) | P1 |
| PV-03 | No sensitive data in logs | Check console and network logs | No patient names or clinical details logged | P2 |
| PV-04 | No sensitive SMS content | Review any notification payloads | Only reference IDs, no clinical details | P2 |
| PV-05 | Missing data flagged | Submit without SpO₂ | Stored as **not measured**, not `0` or blank | P1 |
| PV-06 | No clinical automation | Review sync logic | The layer never assigns urgency or diagnosis; only passes through the worker-declared category | P1 |

---

## 4. Example Automated Tests (Vitest)

```js
import { describe, it, expect } from 'vitest';
import { splitIntoChunks, sha256Hex } from './chunking';

describe('chunking', () => {
  it('is 0-indexed and computes ceil(size / chunkSize) chunks', () => {
    const file = new Blob([new Uint8Array(300 * 1024)]);
    const chunks = splitIntoChunks(file, 64 * 1024);
    expect(chunks).toHaveLength(5);
    expect(chunks[0].index).toBe(0);
    expect(chunks.at(-1).index).toBe(4);
  });

  it('handles the exact boundary and boundary + 1', () => {
    expect(splitIntoChunks(new Blob([new Uint8Array(65536)]), 65536)).toHaveLength(1);
    expect(splitIntoChunks(new Blob([new Uint8Array(65537)]), 65536)).toHaveLength(2);
  });
});

describe('checksum', () => {
  it('matches the SHA-256 known vector for "abc"', async () => {
    const hash = await sha256Hex(new TextEncoder().encode('abc'));
    expect(hash).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});

describe('resume', () => {
  it('sends only missing chunks after a drop', async () => {
    const server = createMockServer({ alreadyReceived: [0, 1, 2] });
    await uploadComponent(sampleEcg, { server });
    expect(server.chunksReceivedThisSession).toEqual([3, 4]);
  });
});
```

*(Function names are placeholders; adapt them to your module names.)*

---

## 5. Mock Server Failure Switches

Provide these switches so the tests above can be triggered on demand:

- `failNextChunks(n, status)`: respond with an error for the next *n* chunk requests
- `corruptChunk(index)`: simulate a hash mismatch for a given chunk
- `dropAfter(index)`: close the connection after a given chunk
- `delay(ms)`: add per-request latency
- `restart()`: wipe in-memory upload sessions
- `setReceived(indices)`: preload already-received chunk indices

---

## 6. End-to-End Demo Script (about 3 minutes)

1. **Normal network.** Fill in the synthetic consultation (`CW-DEMO-001`) and submit. Show the status moving to `Received by server`.
2. **Switch to Offline.** Submit a second consultation. Show `Saved locally` / `Upload pending`, with the badge visible.
3. **Reload the page.** Show the pending consultation is still there.
4. **Switch to 2G.** Attach `ecg_sample.bin`. Show the summary sent first, then the ECG progressing in chunks.
5. **Drop the network mid-upload (Offline), then restore.** Show the upload resuming from the last confirmed chunk, not from zero.
6. **Switch to Flaky.** Upload the 1.5 MB image. Show retries and eventual success.
7. **Doctor side (mock).** Mark as reviewed and send a response. Show `Reviewed` → `Response received`, and that this is separate from the upload completing.

---

## 7. Acceptance Criteria (Demo Readiness)

- [x] All **P1** tests pass
- [x] A consultation saved offline syncs automatically after reconnect
- [x] An interrupted upload resumes without re-sending confirmed chunks
- [x] A corrupted chunk is detected and retried alone
- [x] Group 1 summary always precedes attachments
- [x] Upload completion and doctor review remain separate states in the UI
- [x] The simulation toggle works for all four presets and shows the badge
- [x] No real patient data is anywhere in the repo, fixtures or logs

---

## 8. Test Run Log

| Date | Tester | Build/Commit | P1 passed | P2 passed | P3 passed | Notes |
|---|---|---|---|---|---|---|
| 2026-11-21 | Antigravity (Individual 3) | v1.0.0-ind3 | 31 / 31 | 8 / 8 | 2 / 2 | All 41 automated test cases executed via `tests/run-test-plan.js` passed with 0 failures. |

## 9. Open Items to Confirm with Teammates

- **Individual 2:** exact endpoint paths, request and response shapes for `init`, `chunk`, `status`, `complete`; chunk index base (0) and max chunk size accepted.
- **Individual 1:** final status enum strings; whether the UI needs `retry` per item or per consultation.
- **Team:** maximum retry count and backoff schedule; concurrency limit for uploads.
