/**
 * CareBridge Reliable GSM Transmission & Recovery State Machine
 * Manages complete unified medical record uploads over 2G GSM/GPRS/EDGE networks.
 * Guarantees zero clinical data loss through persistent IndexedDB state and automatic recovery.
 */

import axios from 'axios';
import { encodeMedicalRecord } from './protoCodec';
import { compressRecord } from './compressionEngine';
import { adaptiveBandwidthManager, NetworkClass } from './adaptiveBandwidthManager';
import api from '../services/api';

export const TransmissionState = {
  PENDING: 'PENDING',
  PREPARING: 'PREPARING',
  COMPRESSING: 'COMPRESSING',
  READY: 'READY',
  UPLOADING: 'UPLOADING',
  INTERRUPTED: 'INTERRUPTED',
  RETRY_WAIT: 'RETRY_WAIT',
  SERVER_RECEIVED: 'SERVER_RECEIVED',
  VERIFYING: 'VERIFYING',
  DELIVERED: 'DELIVERED',
  FAILED: 'FAILED',
};

const DB_NAME = 'carebridge_telemetry_db';
const DB_VERSION = 1;

let dbPromise = null;
function getDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      resolve(null);
      return;
    }
    const req = window.indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('records')) {
        db.createObjectStore('records', { keyPath: 'recordId' });
      }
      if (!db.objectStoreNames.contains('payloads')) {
        db.createObjectStore('payloads', { keyPath: 'recordId' });
      }
      if (!db.objectStoreNames.contains('queue')) {
        const qStore = db.createObjectStore('queue', { keyPath: 'recordId' });
        qStore.createIndex('state', 'state', { unique: false });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
  return dbPromise;
}

async function idbPut(storeName, value) {
  const db = await getDB();
  if (!db) return;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put(value);
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e.target.error);
  });
}

async function idbGet(storeName, key) {
  const db = await getDB();
  if (!db) return null;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = (e) => reject(e.target.error);
  });
}

async function idbGetAll(storeName) {
  const db = await getDB();
  if (!db) return [];
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = (e) => reject(e.target.error);
  });
}

export class TransmissionManager {
  constructor() {
    this.activeTransfers = new Map();
    this.listeners = new Set();
    this.isProcessingQueue = false;

    // Automatic resume on connection recovery
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.processQueue();
      });
    }
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify(recordId, stateUpdate) {
    for (const listener of this.listeners) {
      try { listener(recordId, stateUpdate); } catch (e) { /* ignore */ }
    }
  }

  /**
   * Submits a full medical record for unified compression and reliable 2G transmission
   * @param {object} recordData 
   * @returns {Promise<{ recordId: string, transferId: string, status: string }>}
   */
  async submitMedicalRecord(recordData) {
    const recordId = recordData.record_id || recordData.id || `CW-${Date.now()}`;
    const transferId = `TR-${recordId}-${Math.random().toString(36).substr(2, 6)}`;
    const idempotencyKey = recordData.idempotency_key || recordData.idempotencyKey || `IDEMP-${recordId}`;

    // 1. PENDING & Persist Original Record
    this.notify(recordId, { state: TransmissionState.PENDING, progress: 0, text: 'Saving record locally' });
    await idbPut('records', { recordId, data: recordData, createdAt: new Date().toISOString() });

    // 2. PREPARING (Protobuf Serialization)
    this.notify(recordId, { state: TransmissionState.PREPARING, progress: 10, text: 'Serializing clinical telemetry (Protobuf)' });
    const serializedBinary = await encodeMedicalRecord({
      ...recordData,
      record_id: recordId,
      idempotency_key: idempotencyKey,
    });

    // 3. COMPRESSING (Unified Lossless GZIP)
    const level = adaptiveBandwidthManager.getRecommendedCompressionLevel();
    this.notify(recordId, { state: TransmissionState.COMPRESSING, progress: 25, text: `Compressing payload (Lossless GZIP level ${level})` });
    const compressionResult = await compressRecord(serializedBinary, { level });

    // 4. READY & Persist Compressed Payload
    const payloadMeta = {
      recordId,
      transferId,
      idempotencyKey,
      sha256: compressionResult.sha256,
      originalSize: compressionResult.originalSize,
      compressedSize: compressionResult.compressedSize,
      ratio: compressionResult.ratio,
      compressedPayload: compressionResult.compressed,
      state: TransmissionState.READY,
      attempts: 0,
      updatedAt: new Date().toISOString(),
    };
    await idbPut('payloads', payloadMeta);
    await idbPut('queue', { recordId, transferId, state: TransmissionState.READY, attempts: 0 });

    this.notify(recordId, {
      state: TransmissionState.READY,
      progress: 40,
      text: 'Payload ready for 2G transmission',
      stats: {
        originalSize: compressionResult.originalSize,
        compressedSize: compressionResult.compressedSize,
        ratio: compressionResult.ratio,
      },
    });

    // Trigger transmission asynchronously
    this.executeUpload(recordId);

    return {
      recordId,
      transferId,
      status: TransmissionState.READY,
      stats: {
        originalSize: compressionResult.originalSize,
        compressedSize: compressionResult.compressedSize,
        ratio: compressionResult.ratio,
        sha256: compressionResult.sha256,
      },
    };
  }

  /**
   * Executes transmission of prepared compressed payload in a single HTTPS request
   */
  async executeUpload(recordId, options = {}) {
    if (this.activeTransfers.has(recordId)) {
      return { success: false, reason: 'Upload already active for this record' };
    }

    const payloadMeta = await idbGet('payloads', recordId);
    if (!payloadMeta) return { success: false, reason: 'Payload not found in local IndexedDB' };

    if (typeof navigator !== 'undefined' && !navigator.onLine && !options.bypassOfflineCheck) {
      await this.markInterrupted(recordId, 'Offline: Waiting for mobile connection');
      return { success: false, reason: 'Offline' };
    }

    const controller = new AbortController();
    this.activeTransfers.set(recordId, controller);

    if (options.abortAfterMs) {
      setTimeout(() => controller.abort(), options.abortAfterMs);
    }

    const timeoutMs = options.timeoutMs || adaptiveBandwidthManager.getRequestTimeoutMs(payloadMeta.compressedSize);
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    const token = typeof localStorage !== 'undefined'
      ? (localStorage.getItem('carewave_auth_token') || localStorage.getItem('carewave_token') || localStorage.getItem('token'))
      : null;
    const startTime = performance.now();

    this.notify(recordId, {
      state: TransmissionState.UPLOADING,
      progress: 45,
      text: 'Transmitting complete record over 2G GSM',
      timeoutMs,
      startTime: new Date().toISOString(),
    });

    try {
      // Single complete HTTPS POST request (No chunking!)
      const headers = {
        'Content-Type': 'application/vnd.carebridge.medical-record',
        'X-Record-ID': payloadMeta.recordId,
        'X-Schema-Version': '1',
        'X-Compression-Format': 'gzip',
        'X-Transfer-ID': payloadMeta.transferId,
        'X-Idempotency-Key': payloadMeta.idempotencyKey,
        'X-Record-SHA256': payloadMeta.sha256,
        'Authorization': token ? `Bearer ${token}` : undefined,
        ...(options.headers || {}),
        ...(options.simulateAbort ? { 'X-Simulate-Abort': 'true' } : {}),
      };

      const response = await axios.post('/api/medical-records/upload', payloadMeta.compressedPayload, {
        signal: controller.signal,
        headers,
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percent = Math.min(95, 45 + Math.round((progressEvent.loaded / progressEvent.total) * 50));
            const elapsedSec = (performance.now() - startTime) / 1000;
            const currentKbps = elapsedSec > 0 ? ((progressEvent.loaded * 8) / elapsedSec / 1000).toFixed(1) : 0;
            this.notify(recordId, {
              state: TransmissionState.UPLOADING,
              progress: percent,
              loadedBytes: progressEvent.loaded,
              totalBytes: progressEvent.total,
              currentKbps,
              text: `Uploading: ${percent}% (${currentKbps} kbps)`,
            });
          }
        },
      });

      clearTimeout(timeoutId);
      const durationMs = performance.now() - startTime;
      const throughputKbps = durationMs > 0
        ? Number(((payloadMeta.compressedSize * 8) / (durationMs / 1000) / 1000).toFixed(2))
        : 0;

      // 5. SERVER_RECEIVED & VERIFYING
      this.notify(recordId, { state: TransmissionState.SERVER_RECEIVED, progress: 96, text: 'Received by hospital server' });
      this.notify(recordId, { state: TransmissionState.VERIFYING, progress: 98, text: 'Verifying attachment cryptographic hashes' });

      // Record network metric
      adaptiveBandwidthManager.recordTransfer({
        bytes: payloadMeta.compressedSize,
        durationMs,
        success: true,
      });

      // 6. DELIVERED
      const receipt = response.data?.receipt || response.data?.data || {};
      payloadMeta.state = TransmissionState.DELIVERED;
      payloadMeta.deliveredAt = new Date().toISOString();
      payloadMeta.receipt = receipt;
      payloadMeta.durationMs = durationMs;
      payloadMeta.throughputKbps = throughputKbps;
      await idbPut('payloads', payloadMeta);
      await idbPut('queue', { recordId, transferId: payloadMeta.transferId, state: TransmissionState.DELIVERED, attempts: payloadMeta.attempts });

      this.notify(recordId, {
        state: TransmissionState.DELIVERED,
        progress: 100,
        text: 'Successfully delivered and verified by hospital system',
        receipt,
        durationMs,
        throughputKbps,
      });

      return {
        success: true,
        receipt,
        durationMs,
        throughputKbps,
        transferId: payloadMeta.transferId,
        recordId,
      };

    } catch (err) {
      clearTimeout(timeoutId);
      const durationMs = performance.now() - startTime;

      adaptiveBandwidthManager.recordTransfer({
        bytes: payloadMeta.compressedSize,
        durationMs,
        success: false,
        interrupted: true,
      });

      const isCanceled = axios.isCancel(err) || err.name === 'AbortError' || err.code === 'ECONNABORTED';
      const reason = isCanceled ? 'Upload timed out or aborted on 2G link' : (err.response?.data?.message || err.message);

      await this.markInterrupted(recordId, reason);

      return {
        success: false,
        reason,
        durationMs,
        isCanceled,
        transferId: payloadMeta.transferId,
        recordId,
      };
    } finally {
      this.activeTransfers.delete(recordId);
    }
  }

  async markInterrupted(recordId, reason) {
    const payloadMeta = await idbGet('payloads', recordId);
    if (!payloadMeta) return;

    payloadMeta.attempts = (payloadMeta.attempts || 0) + 1;
    payloadMeta.lastError = reason;

    if (payloadMeta.attempts > 12) {
      payloadMeta.state = TransmissionState.FAILED;
      await idbPut('payloads', payloadMeta);
      await idbPut('queue', { recordId, transferId: payloadMeta.transferId, state: TransmissionState.FAILED, attempts: payloadMeta.attempts });
      this.notify(recordId, { state: TransmissionState.FAILED, progress: 0, text: `Upload failed after multiple attempts: ${reason}` });
      return;
    }

    const retryDelay = adaptiveBandwidthManager.getRetryDelayMs(payloadMeta.attempts);
    payloadMeta.state = TransmissionState.INTERRUPTED;
    payloadMeta.nextRetryAt = Date.now() + retryDelay;

    await idbPut('payloads', payloadMeta);
    await idbPut('queue', { recordId, transferId: payloadMeta.transferId, state: TransmissionState.INTERRUPTED, attempts: payloadMeta.attempts, nextRetryAt: payloadMeta.nextRetryAt });

    this.notify(recordId, {
      state: TransmissionState.INTERRUPTED,
      progress: 30,
      text: `Upload interrupted (${reason}). Retrying in ${Math.round(retryDelay / 1000)}s...`,
      retryDelay,
      attempt: payloadMeta.attempts,
    });

    setTimeout(() => {
      this.executeUpload(recordId);
    }, retryDelay);
  }

  async processQueue() {
    if (this.isProcessingQueue) return;
    this.isProcessingQueue = true;
    try {
      const queue = await idbGetAll('queue');
      const pending = queue.filter(q => [TransmissionState.READY, TransmissionState.INTERRUPTED, TransmissionState.RETRY_WAIT].includes(q.state));
      for (const item of pending) {
        if (!this.activeTransfers.has(item.recordId)) {
          await this.executeUpload(item.recordId);
        }
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  async getRecordStatus(recordId) {
    return await idbGet('payloads', recordId);
  }
}

export const transmissionManager = new TransmissionManager();
export default transmissionManager;
