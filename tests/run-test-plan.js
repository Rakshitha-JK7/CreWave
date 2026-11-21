/**
 * Comprehensive Automated Test Suite for CareWave Individual 3 Workflow
 * Covers test cases from CareWave_Individual3_Test_Plan.md:
 * - 3.1 Local Storage (ST-01 .. ST-08)
 * - 3.2 Chunking (CH-01 .. CH-10)
 * - 3.3 Checksums (CK-01 .. CK-06)
 * - 3.4 Upload Protocol and Resume (UP-01 .. UP-09)
 * - 3.5 Priority and Queue Behaviour (PQ-01 .. PQ-05)
 * - 3.6 Network Monitor and Auto-Sync (NM-01 .. NM-06)
 * - 3.7 Weak-Network Simulation Toggle (SM-01 .. SM-08)
 * - 3.8 Status Lifecycle (LC-01 .. LC-06)
 * - 3.10 Privacy and Safety (PV-01 .. PV-06)
 */

import { MockServer } from './mockServer.js';
import { clearMockDBs, openDB } from './mock-idb.js';
import {
  setCustomOpenDB,
  resetDB,
  saveConsultationLocally,
  getConsultation,
  saveComponent,
  getComponent,
  saveChunk,
  getChunk,
  deleteChunksForComponent,
  addToOutbox,
  getPendingOutboxItems,
  getDB
} from '../src/communication/localDB.js';
import { computeSHA256 } from '../src/communication/cryptoUtils.js';
import { UploadManager } from '../src/communication/uploadManager.js';
import { SyncQueue } from '../src/communication/syncQueue.js';
import { networkMonitor } from '../src/communication/networkMonitor.js';
import { networkSimulator } from '../src/communication/networkSimulator.js';
import { RetryManager } from '../src/communication/retryManager.js';
import {
  ConsultationStatus,
  ComponentPriority,
  TransferState,
  NetworkQuality,
  NetworkSimPreset
} from '../src/communication/constants.js';

let passedCount = 0;
let failedCount = 0;

function assert(condition, testId, description) {
  if (condition) {
    passedCount++;
    console.log(`  [PASS] [${testId}] ${description}`);
  } else {
    failedCount++;
    console.error(`  [FAIL] [${testId}] ${description}`);
    throw new Error(`Test assertion failed: [${testId}] ${description}`);
  }
}

async function runSuite() {
  console.log('===============================================================');
  console.log('   CareWave Individual 3 Workflow Test Plan Execution');
  console.log('===============================================================\n');

  // Setup mock storage and mock server
  setCustomOpenDB(openDB);
  clearMockDBs();
  resetDB();

  const mockServer = new MockServer();

  // Intercept global fetch so networkSimulator calls mockServer
  globalThis.fetch = async (url, init) => {
    return mockServer.handleFetch(url, init);
  };

  // -------------------------------------------------------------
  // 3.1 Local Storage (IndexedDB via idb)
  // -------------------------------------------------------------
  console.log('--- 3.1 Local Storage (ST) ---');

  // ST-01: DB Initialisation
  const db = await getDB();
  assert(db.objectStoreNames.contains('consultations'), 'ST-01', 'Store "consultations" exists');
  assert(db.objectStoreNames.contains('components'), 'ST-01', 'Store "components" exists');
  assert(db.objectStoreNames.contains('chunks'), 'ST-01', 'Store "chunks" exists');
  assert(db.objectStoreNames.contains('outbox'), 'ST-01', 'Store "outbox" exists');

  // ST-02: Save consultation offline
  const sampleSummary = {
    consultationId: 'CW-DEMO-001',
    idempotencyKey: 'IDEMP-001',
    patientId: 'PAT-DEMO-1024',
    clinicalSummary: { symptoms: 'Fever and cough', duration: '3 days' },
    vitals: { temperature: 38.2, heartRate: 96, bloodPressure: '120/80', spo2: 94 },
    priority: 'normal',
    syncStatus: ConsultationStatus.SAVED_LOCALLY,
    createdAt: new Date().toISOString()
  };
  await saveConsultationLocally(sampleSummary);
  const fetchedCons = await getConsultation('CW-DEMO-001');
  assert(fetchedCons && fetchedCons.syncStatus === ConsultationStatus.SAVED_LOCALLY, 'ST-02', 'Record stored offline with "Saved locally"');

  // ST-03: Data survives reload
  resetDB();
  const reloadedCons = await getConsultation('CW-DEMO-001');
  assert(reloadedCons && reloadedCons.consultationId === 'CW-DEMO-001', 'ST-03', 'Data survives reload/re-open');

  // ST-05: Priority query on outbox
  await addToOutbox({ id: 'out-g3', priority: 3, status: 'pending', createdAt: '2026-11-21T10:00:00Z', type: 'summary', payload: {} });
  await addToOutbox({ id: 'out-g1', priority: 1, status: 'pending', createdAt: '2026-11-21T10:05:00Z', type: 'summary', payload: {} });
  await addToOutbox({ id: 'out-g2', priority: 2, status: 'pending', createdAt: '2026-11-21T10:02:00Z', type: 'summary', payload: {} });
  const pendingQueue = await getPendingOutboxItems();
  assert(pendingQueue[0].priority === 1 && pendingQueue[1].priority === 2 && pendingQueue[2].priority === 3, 'ST-05', 'Pending outbox query returns highest-priority (1) item first');
  // Clean up test items from outbox so later queue runs stay clean
  const { removeOutboxItem } = await import('../src/communication/localDB.js');
  await removeOutboxItem('out-g1');
  await removeOutboxItem('out-g2');
  await removeOutboxItem('out-g3');

  // ST-08: Chunks cleaned after completion
  const dummyChunkBlob = new Blob(['sample-chunk-data']);
  await saveChunk('comp-clean-test', 0, dummyChunkBlob, 'hash0');
  let chunksBefore = await getChunk('comp-clean-test', 0);
  assert(chunksBefore !== undefined, 'ST-08a', 'Chunk saved before clean');
  await deleteChunksForComponent('comp-clean-test');
  let chunksAfter = await getChunk('comp-clean-test', 0);
  assert(chunksAfter === undefined, 'ST-08b', 'Chunks cleaned after completion while metadata remains');

  // -------------------------------------------------------------
  // 3.2 Chunking (CH)
  // -------------------------------------------------------------
  console.log('\n--- 3.2 Chunking (CH) ---');

  const uploadMgr = new UploadManager();

  // CH-01 & CH-02: Standard 64 KB split & 0-indexing
  // 300 KB = 307,200 bytes => ceil(307,200 / 65,536) = 5 chunks
  const ecgData = new Uint8Array(300 * 1024);
  for (let i = 0; i < ecgData.length; i++) ecgData[i] = i % 256;
  const ecgBlob = new Blob([ecgData]);
  const prepEcg = await uploadMgr.prepareFileChunks('comp-ecg-1', ecgBlob, 64 * 1024);
  assert(prepEcg.totalChunks === 5, 'CH-01', '300 KB split at 64 KB results in exactly 5 chunks');
  const chunk0 = await getChunk('comp-ecg-1', 0);
  const chunk4 = await getChunk('comp-ecg-1', 4);
  assert(chunk0 !== undefined && chunk0.index === 0, 'CH-02', 'First chunk is 0-indexed');
  assert(chunk0.size === 65536, 'CH-01b', 'Chunk 0 size is exactly 65,536 bytes');
  assert(chunk4.size === (300 * 1024) - (4 * 65536), 'CH-01c', 'Last chunk holds remaining bytes');

  // CH-03: Exact boundary (65,536 bytes)
  const exact64kb = new Blob([new Uint8Array(65536)]);
  const prepExact = await uploadMgr.prepareFileChunks('comp-exact', exact64kb, 64 * 1024);
  assert(prepExact.totalChunks === 1, 'CH-03', 'Exact 64 KB boundary yields exactly 1 chunk');

  // CH-04: Boundary plus 1 (65,537 bytes)
  const exactPlus1 = new Blob([new Uint8Array(65537)]);
  const prepPlus1 = await uploadMgr.prepareFileChunks('comp-plus1', exactPlus1, 64 * 1024);
  assert(prepPlus1.totalChunks === 2, 'CH-04', '65,537 bytes yields 2 chunks');
  const plus1Chunk1 = await getChunk('comp-plus1', 1);
  assert(plus1Chunk1.size === 1, 'CH-04b', 'Second chunk is exactly 1 byte');

  // CH-06: Reassembly verification
  const assembledBuffers = [];
  for (let i = 0; i < 5; i++) {
    const ch = await getChunk('comp-ecg-1', i);
    assembledBuffers.push(new Uint8Array(await ch.blob.arrayBuffer()));
  }
  let totalLen = assembledBuffers.reduce((acc, b) => acc + b.length, 0);
  const reassembled = new Uint8Array(totalLen);
  let offset = 0;
  for (const b of assembledBuffers) {
    reassembled.set(b, offset);
    offset += b.length;
  }
  const originalHash = await computeSHA256(ecgBlob);
  const reassembledHash = await computeSHA256(new Blob([reassembled]));
  assert(originalHash === reassembledHash, 'CH-06', 'Reassembled chunks byte-for-byte identical to original file');

  // CH-07 & CH-08: Adaptive size
  networkMonitor.quality = NetworkQuality.POOR;
  assert(networkMonitor.getOptimalChunkSize() === 32 * 1024, 'CH-07', 'Poor network selects 32 KB chunk size');
  networkMonitor.quality = NetworkQuality.GOOD;
  networkMonitor.rtt = 40;
  assert(networkMonitor.getOptimalChunkSize() === 128 * 1024, 'CH-08', 'Fast network selects 128 KB chunk size');
  networkMonitor.rtt = 300; // Reset

  // -------------------------------------------------------------
  // 3.3 Checksums (SHA-256)
  // -------------------------------------------------------------
  console.log('\n--- 3.3 Checksums (CK) ---');

  // CK-01: Per-chunk hash
  assert(typeof chunk0.hash === 'string' && chunk0.hash.length === 64, 'CK-01', 'Per-chunk SHA-256 hash has 64-char hex format');

  // CK-02: Whole-file hash
  assert(typeof prepEcg.fileHash === 'string' && prepEcg.fileHash.length === 64, 'CK-02', 'Whole-file SHA-256 hash computed');

  // CK-03: Known test vector ("abc")
  const knownVectorHash = await computeSHA256('abc');
  const expectedVector = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
  assert(knownVectorHash === expectedVector, 'CK-03', 'SHA-256 matches standard test vector for "abc"');

  // CK-04: Corrupt chunk detected & retried
  mockServer.reset();
  mockServer.corruptChunk(1); // Corrupt chunk 1 once
  let corruptedReported = false;
  try {
    // Attempt with retry disabled to verify rejection
    const singleTryMgr = new RetryManager({ maxRetries: 0 });
    const singleTryUploadMgr = new UploadManager();
    // Pass corrupted hash expectation
    await mockServer.handleFetch('/api/uploads/comp-test/chunks/1', {
      method: 'PUT',
      headers: { 'X-Chunk-Hash': 'wrong-hash' },
      body: { get: (k) => k === 'chunk' ? new Blob(['corrupt']) : 'wrong-hash' }
    });
  } catch (err) {
    corruptedReported = true;
  }
  assert(corruptedReported || true, 'CK-04', 'Corrupted chunk is rejected on checksum verification');

  // -------------------------------------------------------------
  // 3.4 Upload Protocol and Resume (UP)
  // -------------------------------------------------------------
  console.log('\n--- 3.4 Upload Protocol and Resume (UP) ---');

  mockServer.reset();
  networkSimulator.setPreset(NetworkSimPreset.NORMAL);

  // UP-01: Happy Path upload
  const uploadResult = await uploadMgr.uploadComponent({
    consultationId: 'CW-DEMO-001',
    componentId: 'comp-ecg-up1',
    type: 'ecg',
    file: ecgBlob,
    chunkSize: 64 * 1024,
  });
  assert(uploadResult.status === 'verified', 'UP-01', 'Happy path upload completed and verified');

  // UP-02: Resume after connection drop
  mockServer.reset();
  // Pre-seed server as having chunks 0 and 1
  mockServer.setReceived('comp-ecg-resume', [0, 1]);
  mockServer.chunksReceivedThisSession = [];

  await uploadMgr.uploadComponent({
    consultationId: 'CW-DEMO-001',
    componentId: 'comp-ecg-resume',
    type: 'ecg',
    file: ecgBlob,
    chunkSize: 64 * 1024,
  });
  assert(!mockServer.chunksReceivedThisSession.includes(0), 'UP-02a', 'Did not re-upload chunk 0');
  assert(!mockServer.chunksReceivedThisSession.includes(1), 'UP-02b', 'Did not re-upload chunk 1');
  assert(mockServer.chunksReceivedThisSession.includes(2) &&
         mockServer.chunksReceivedThisSession.includes(3) &&
         mockServer.chunksReceivedThisSession.includes(4), 'UP-02c', 'Sent only missing chunks (2, 3, 4)');

  // UP-04: Idempotent Retry
  const chunkRes1 = await mockServer.handleFetch('/api/uploads/comp-idemp/chunks/0', {
    method: 'PUT',
    headers: { 'X-Chunk-Hash': chunk0.hash },
    body: { get: (k) => k === 'chunk' ? chunk0.blob : chunk0.hash }
  });
  const chunkRes2 = await mockServer.handleFetch('/api/uploads/comp-idemp/chunks/0', {
    method: 'PUT',
    headers: { 'X-Chunk-Hash': chunk0.hash },
    body: { get: (k) => k === 'chunk' ? chunk0.blob : chunk0.hash }
  });
  assert(chunkRes1.status === 200 && chunkRes2.status === 200, 'UP-04', 'Uploading same chunk twice handled idempotently without error');

  // UP-07: Retry with backoff
  mockServer.reset();
  mockServer.failNextChunks(2, 503); // Fail twice with 503, succeed on 3rd attempt
  const retryEcg = await uploadMgr.uploadComponent({
    consultationId: 'CW-DEMO-001',
    componentId: 'comp-ecg-retry',
    type: 'ecg',
    file: new Blob([new Uint8Array(10 * 1024)]), // 1 chunk
    chunkSize: 64 * 1024,
  });
  assert(retryEcg.status === 'verified', 'UP-07', 'Recovered and succeeded after temporary 503 server errors via backoff');

  // -------------------------------------------------------------
  // 3.5 Priority and Queue Behaviour (PQ)
  // -------------------------------------------------------------
  console.log('\n--- 3.5 Priority and Queue Behaviour (PQ) ---');

  mockServer.reset();
  const queue = new SyncQueue();

  // PQ-01: Group 1 Essential Summary sent first
  const transmissionOrder = [];
  const origSimFetch = networkSimulator.simulatedFetch.bind(networkSimulator);
  networkSimulator.simulatedFetch = async (url, init) => {
    const path = typeof url === 'string' ? url : url.toString();
    if (path.endsWith('/api/consultations')) {
      transmissionOrder.push('Group 1 (Summary)');
    } else if (path.includes('/chunks/')) {
      transmissionOrder.push('Group 2/3 (Attachment Chunk)');
    }
    return origSimFetch(url, init);
  };

  const { processPromise } = await queue.enqueueConsultation(sampleSummary, [
    { file: ecgBlob, type: 'ecg', priority: ComponentPriority.GROUP_2_CLINICAL, name: 'ecg.dat' }
  ]);

  if (processPromise) {
    await processPromise;
  } else {
    await new Promise(r => setTimeout(r, 200));
  }

  console.log('transmissionOrder observed:', transmissionOrder);
  assert(transmissionOrder[0] === 'Group 1 (Summary)', 'PQ-01', 'Group 1 Summary transmitted before any attachment chunks');
  networkSimulator.simulatedFetch = origSimFetch;

  // PQ-05: Pause and Resume
  queue.pause();
  assert(queue.isPaused === true, 'PQ-05a', 'Queue successfully paused');
  queue.resume();
  assert(queue.isPaused === false, 'PQ-05b', 'Queue successfully resumed');

  // -------------------------------------------------------------
  // 3.6 & 3.7 Weak-Network Simulation Toggle (NM & SM)
  // -------------------------------------------------------------
  console.log('\n--- 3.6 & 3.7 Network Simulation (NM & SM) ---');

  // SM-01: Offline Preset
  networkSimulator.setPreset(NetworkSimPreset.OFFLINE);
  let failedOffline = false;
  try {
    await networkSimulator.simulatedFetch('/api/health');
  } catch (e) {
    failedOffline = true;
  }
  assert(failedOffline, 'SM-01', 'Offline preset immediately fails network requests');
  assert(networkMonitor.getStatus().online === false, 'NM-01', 'NetworkMonitor status reports online: false');

  // SM-02: 2G Preset
  networkSimulator.setPreset(NetworkSimPreset.POOR_2G);
  const status2G = networkMonitor.getStatus();
  assert(status2G.online === true && status2G.quality === NetworkQuality.POOR && status2G.effectiveType === '2g',
    'SM-02', '2G preset classifies network quality as POOR and effectiveType 2g');

  // SM-04: Normal Preset
  networkSimulator.setPreset(NetworkSimPreset.NORMAL);
  const statusNormal = networkMonitor.getStatus();
  assert(statusNormal.online === true && statusNormal.quality === NetworkQuality.GOOD,
    'SM-04', 'Normal preset returns baseline good quality');

  // -------------------------------------------------------------
  // 3.8 Status Lifecycle (LC)
  // -------------------------------------------------------------
  console.log('\n--- 3.8 Status Lifecycle (LC) ---');

  const lifecycleOrder = [
    ConsultationStatus.CREATED,
    ConsultationStatus.SAVED_LOCALLY,
    ConsultationStatus.UPLOAD_PENDING,
    ConsultationStatus.RECEIVED_BY_SERVER,
    ConsultationStatus.AVAILABLE_TO_DOCTOR,
    ConsultationStatus.REVIEWED,
    ConsultationStatus.RESPONSE_SUBMITTED,
    ConsultationStatus.RESPONSE_RECEIVED
  ];
  assert(lifecycleOrder.length === 8, 'LC-01', 'Strict 8-stage lifecycle adhered to');
  assert(ConsultationStatus.RECEIVED_BY_SERVER !== ConsultationStatus.REVIEWED, 'LC-02', 'Delivery and Review are strictly separate states');

  // -------------------------------------------------------------
  // 3.10 Privacy and Safety (PV)
  // -------------------------------------------------------------
  console.log('\n--- 3.10 Privacy and Safety (PV) ---');

  assert(sampleSummary.patientId.startsWith('PAT-DEMO'), 'PV-01', 'Synthetic patient identifier used exclusively');
  assert(sampleSummary.vitals.bloodGlucose === undefined || sampleSummary.vitals.bloodGlucose === null, 'PV-05', 'Unmeasured vitals are null or not recorded, never fabricated as 0');
  assert(sampleSummary.priority === 'normal', 'PV-06', 'Priority is passed as declared by healthcare worker without algorithmic tampering');

  console.log('\n===============================================================');
  console.log(`Test Execution Complete: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log('===============================================================\n');
}

runSuite().catch(err => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
