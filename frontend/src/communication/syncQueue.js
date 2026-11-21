import {
  addToOutbox,
  getPendingOutboxItems,
  updateOutboxItem,
  saveConsultationLocally,
  saveComponent,
  updateConsultationStatus,
  updateComponentStatus,
} from './localDB.js';
import {
  ConsultationStatus,
  ComponentPriority,
  TransferState,
} from './constants.js';
import { UploadManager } from './uploadManager.js';
import { networkMonitor } from './networkMonitor.js';
import { defaultRetryManager } from './retryManager.js';
import { networkSimulator } from './networkSimulator.js';
import { EventEmitter } from './eventEmitter.js';

export class SyncQueue extends EventEmitter {
  constructor({ apiBaseUrl = '/api' } = {}) {
    super();
    this.apiBaseUrl = apiBaseUrl;
    this.isProcessing = false;
    this.isPaused = false;
    this.activeTransferAbortController = null;

    this.uploadManager = new UploadManager({
      apiBaseUrl,
      onProgress: (progressInfo) => {
        this.emit('progress', progressInfo);
        this.emit('change');
      },
    });

    // Listen to network transitions to automatically resume processing
    networkMonitor.on('change', ({ online }) => {
      if (online && !this.isPaused) {
        this.processQueue();
      }
    });
  }

  pause() {
    this.isPaused = true;
    if (this.activeTransferAbortController) {
      this.activeTransferAbortController.abort();
      this.activeTransferAbortController = null;
    }
    this.emit('change');
  }

  resume() {
    this.isPaused = false;
    this.processQueue();
    this.emit('change');
  }

  /**
   * Enqueues an entire consultation for transmission.
   * Saves everything locally first (Group 1 summary + attachments).
   */
  async enqueueConsultation(consultationPayload, attachmentFiles = []) {
    const consultationId = consultationPayload.consultationId || `CW-${Date.now()}`;
    const idempotencyKey = consultationPayload.idempotencyKey || `IDEMP-${consultationId}`;

    const enrichedConsultation = {
      ...consultationPayload,
      consultationId,
      idempotencyKey,
      syncStatus: ConsultationStatus.SAVED_LOCALLY,
      createdAt: consultationPayload.createdAt || new Date().toISOString(),
    };

    // 1. Save Consultation locally
    await saveConsultationLocally(enrichedConsultation);

    // 2. Queue Group 1: Essential Clinical Summary (unchunked, Priority 1)
    const summaryQueueItem = {
      id: `outbox-summary-${consultationId}`,
      consultationId,
      componentId: `comp-summary-${consultationId}`,
      type: 'summary',
      priority: ComponentPriority.GROUP_1_ESSENTIAL,
      payload: {
        consultationId,
        idempotencyKey,
        patientId: enrichedConsultation.patientId,
        clinicalSummary: enrichedConsultation.clinicalSummary,
        vitals: enrichedConsultation.vitals,
        priority: enrichedConsultation.priority,
        createdAt: enrichedConsultation.createdAt,
      },
      status: TransferState.PENDING,
      retryCount: 0,
      createdAt: new Date().toISOString(),
    };
    await addToOutbox(summaryQueueItem);

    // 3. Queue Attachments (Group 2 or Group 3)
    for (const att of attachmentFiles) {
      const componentId = att.componentId || `comp-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
      const priority = att.priority || (att.type === 'ecg' ? ComponentPriority.GROUP_2_CLINICAL : ComponentPriority.GROUP_3_DOCUMENTS);

      // Save component metadata locally
      await saveComponent({
        componentId,
        consultationId,
        type: att.type || 'document',
        name: att.name || 'file',
        size: att.file.size,
        priority,
        status: TransferState.PENDING,
        uploadedChunks: 0,
        createdAt: new Date().toISOString(),
      });

      // Prepare chunks in localDB
      const chunkSize = networkMonitor.getOptimalChunkSize();
      const prep = await this.uploadManager.prepareFileChunks(componentId, att.file, chunkSize);

      // Add to outbox queue
      const fileQueueItem = {
        id: `outbox-${componentId}`,
        consultationId,
        componentId,
        type: att.type || 'document',
        priority,
        file: att.file,
        totalChunks: prep.totalChunks,
        chunkSize: prep.chunkSize,
        status: TransferState.PENDING,
        retryCount: 0,
        createdAt: new Date().toISOString(),
      };
      await addToOutbox(fileQueueItem);
    }

    await updateConsultationStatus(consultationId, ConsultationStatus.UPLOAD_PENDING);
    this.emit('change');

    // Trigger queue processing (returns promise)
    const processPromise = this.processQueue();

    return { consultation: enrichedConsultation, processPromise };
  }

  /**
   * Main Queue Processor:
   * Selects highest-priority pending item and executes transmission.
   */
  async processQueue() {
    if (this.isProcessing || this.isPaused) return;

    const netStatus = networkMonitor.getStatus();
    if (!netStatus.online) {
      return;
    }

    this.isProcessing = true;

    try {
      const pendingItems = await getPendingOutboxItems();
      if (pendingItems.length === 0) {
        this.isProcessing = false;
        return;
      }

      for (const item of pendingItems) {
        if (this.isPaused) break;

        // Check network reachability before each transmission
        if (!networkMonitor.getStatus().online) break;

        await this.transmitItem(item);
      }
    } catch (err) {
      console.error('Queue processing error:', err);
    } finally {
      this.isProcessing = false;
      this.emit('change');
    }
  }

  /**
   * Transmit single queue item
   */
  async transmitItem(item) {
    this.activeTransferAbortController = new AbortController();
    const signal = this.activeTransferAbortController.signal;

    await updateOutboxItem(item.id, { status: TransferState.UPLOADING });
    this.emit('change');

    try {
      if (item.type === 'summary') {
        // Group 1: Send essential summary
        await defaultRetryManager.executeWithRetry(async () => {
          const res = await networkSimulator.simulatedFetch(`${this.apiBaseUrl}/consultations`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Idempotency-Key': item.payload.idempotencyKey,
            },
            body: JSON.stringify(item.payload),
            signal,
          });

          if (!res.ok) {
            throw new Error(`Summary transmission failed: HTTP ${res.status}`);
          }
          return res.json();
        });

        // Mark consultation as received by server
        await updateConsultationStatus(item.consultationId, ConsultationStatus.RECEIVED_BY_SERVER);
      } else if (item.type === 'response_acknowledgment') {
        // Response acknowledgment
        const respId = item.responseId || item.payload?.responseId;
        await defaultRetryManager.executeWithRetry(async () => {
          const res = await networkSimulator.simulatedFetch(`${this.apiBaseUrl}/responses/${respId}/acknowledge`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ acknowledgedAt: item.payload?.acknowledgedAt || new Date().toISOString() }),
            signal,
          });

          if (!res.ok) {
            throw new Error(`Acknowledgment transmission failed: HTTP ${res.status}`);
          }
          return res.json();
        });
      } else {
        // Group 2/3: Chunked attachment upload
        const optimalChunkSize = networkMonitor.getOptimalChunkSize();
        await this.uploadManager.uploadComponent({
          consultationId: item.consultationId,
          componentId: item.componentId,
          type: item.type,
          file: item.file,
          chunkSize: item.chunkSize || optimalChunkSize,
          signal,
        });
      }

      await updateOutboxItem(item.id, {
        status: TransferState.COMPLETED,
        completedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error(`Item ${item.id} transmission failed:`, err);
      const newRetry = (item.retryCount || 0) + 1;
      await updateOutboxItem(item.id, {
        status: TransferState.FAILED,
        retryCount: newRetry,
        lastError: err.message,
      });

      if (item.componentId) {
        await updateComponentStatus(item.componentId, {
          status: TransferState.FAILED,
          lastError: err.message,
        });
      }
    } finally {
      this.activeTransferAbortController = null;
      this.emit('change');
    }
  }

  async retryItem(id) {
    await updateOutboxItem(id, { status: TransferState.PENDING });
    this.emit('change');
    this.processQueue();
  }
}

export const syncQueue = new SyncQueue();
