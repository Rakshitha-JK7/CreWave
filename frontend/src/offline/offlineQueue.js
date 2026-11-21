/**
 * CareWave Consolidated Offline Queue & Communication Engine Adapter
 * 
 * Unifies the frontend offline queue with the robust low-bandwidth chunking,
 * prioritized 2G sync engine (Group 1 summary > Group 2 ECG > Group 3 attachments).
 */

import {
  saveConsultation as dbSaveConsultation,
  getConsultation as dbGetConsultation,
  getConsultations as dbGetConsultations,
  getPendingOutboxItems,
  removeOutboxItem,
  saveDoctorResponse as dbSaveDoctorResponse,
  getDoctorResponses as dbGetDoctorResponses,
} from '../communication/localDB';
import { syncQueue } from '../communication/syncQueue';
import { responseSync } from '../communication/responseSync';
import { ComponentPriority, TransferState } from '../communication/constants';

/**
 * Saves a consultation locally to client database before any network transmission attempt
 * @param {object} consultation
 * @returns {Promise<object>}
 */
export async function saveConsultationLocally(consultation) {
  try {
    const saved = await dbSaveConsultation(consultation);
    return { success: true, consultation: saved };
  } catch (err) {
    console.warn('saveConsultationLocally IndexedDB warning, falling back to localStorage:', err);
    try {
      const key = `carewave_consultation_${consultation.id}`;
      localStorage.setItem(key, JSON.stringify(consultation));
      return { success: true, consultation, fallback: true };
    } catch (e) {
      return { success: false, error: err.message };
    }
  }
}

/**
 * Adds a consultation to the offline upload queue with assigned priority
 * Group 1: Essential clinical summary & vitals (highest)
 * Group 2: Critical diagnostic telemetry (e.g. ECG)
 * Group 3: Non-urgent files, imaging & documents
 * 
 * @param {string} consultationId
 * @param {object} options - Optional attachments array or metadata
 * @returns {Promise<object>}
 */
export async function enqueueConsultation(consultationId, options = {}) {
  try {
    let consultation = await dbGetConsultation(consultationId);

    if (!consultation) {
      // Check localStorage fallback
      const cached = localStorage.getItem(`carewave_consultation_${consultationId}`);
      if (cached) {
        consultation = JSON.parse(cached);
      }
    }

    if (!consultation) {
      consultation = {
        id: consultationId,
        consultationId,
        patientId: options.patientId || options.patientName || 'PAT-LOCAL',
        priority: options.urgency || 'routine',
        clinicalSummary: options.clinicalSummary || { complaint: options.chiefComplaint || 'Consultation record' },
        vitals: options.vitals || {},
        createdAt: new Date().toISOString(),
      };
    }

    // Attachments passed as File objects or descriptors
    const rawAttachments = options.attachments || consultation.attachments || [];
    const attachmentFiles = rawAttachments
      .map((att) => {
        if (att.file instanceof Blob || att.file instanceof File) {
          return {
            file: att.file,
            name: att.name || att.file.name,
            type: att.name?.toLowerCase().includes('ecg') ? 'ecg' : 'document',
            priority: att.name?.toLowerCase().includes('ecg')
              ? ComponentPriority.GROUP_2_CLINICAL
              : ComponentPriority.GROUP_3_DOCUMENTS,
          };
        } else if (att instanceof Blob || att instanceof File) {
          return {
            file: att,
            name: att.name,
            type: att.name?.toLowerCase().includes('ecg') ? 'ecg' : 'document',
            priority: att.name?.toLowerCase().includes('ecg')
              ? ComponentPriority.GROUP_2_CLINICAL
              : ComponentPriority.GROUP_3_DOCUMENTS,
          };
        }
        return null;
      })
      .filter(Boolean);

    // Enqueue in consolidated sync queue
    const { consultation: enqueuedConsult, processPromise } = await syncQueue.enqueueConsultation(
      consultation,
      attachmentFiles
    );

    // Broadcast reactive event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('carewave:queue-updated', {
          detail: { consultationId, enqueuedConsult },
        })
      );
    }

    return { success: true, consultation: enqueuedConsult };
  } catch (err) {
    console.error('enqueueConsultation error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Returns all active pending uploads from local persistent outbox
 * @returns {Promise<Array>}
 */
export async function getPendingUploads() {
  try {
    const outboxItems = await getPendingOutboxItems();
    if (!outboxItems || outboxItems.length === 0) {
      return [];
    }

    return outboxItems.map((item) => {
      const isFile = item.type !== 'summary' && item.type !== 'response_acknowledgment';
      const total = item.totalChunks || 1;
      const uploaded = item.uploadedChunks || 0;
      const progress = item.status === TransferState.COMPLETED
        ? 100
        : item.status === TransferState.UPLOADING
        ? Math.min(Math.round((uploaded / total) * 100), 99)
        : 0;

      return {
        id: item.id,
        consultationId: item.consultationId,
        componentId: item.componentId,
        type: item.type,
        priority: item.priority,
        status: item.status,
        progress,
        totalChunks: total,
        uploadedChunks: uploaded,
        error: item.lastError || null,
        queuedAt: item.createdAt,
        lastAttempt: item.updatedAt || item.createdAt,
        patientName: item.payload?.patientId || item.consultationId,
        pendingComponents: [item.type === 'summary' ? 'Essential Clinical Summary' : `Attachment (${item.type})`],
        failedComponents: item.lastError ? [item.lastError] : [],
      };
    });
  } catch (err) {
    console.warn('Failed to retrieve pending uploads from outbox:', err);
    return [];
  }
}

/**
 * Gets transfer status of a specific consultation
 * @param {string} consultationId
 * @returns {Promise<object>}
 */
export async function getTransferStatus(consultationId) {
  try {
    const uploads = await getPendingUploads();
    const matches = uploads.filter((u) => u.consultationId === consultationId);

    if (matches.length > 0) {
      const avgProgress = Math.round(
        matches.reduce((acc, cur) => acc + cur.progress, 0) / matches.length
      );
      const isUploading = matches.some((m) => m.status === TransferState.UPLOADING);
      const isFailed = matches.some((m) => m.status === TransferState.FAILED);

      return {
        consultationId,
        status: isUploading ? 'uploading' : isFailed ? 'failed' : 'pending_upload',
        progress: avgProgress,
        items: matches,
      };
    }

    const consult = await dbGetConsultation(consultationId);
    return {
      consultationId,
      status: consult?.status || 'delivered',
      progress: consult?.status === 'delivered' ? 100 : 0,
    };
  } catch (err) {
    return { consultationId, status: 'error', error: err.message };
  }
}

/**
 * Signals communication module to resume an interrupted transfer
 * @param {string} consultationId
 * @returns {Promise<object>}
 */
export async function resumeUpload(consultationId) {
  try {
    syncQueue.resume();
    const promise = syncQueue.processQueue();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('carewave:transfer-progress', { detail: { consultationId, status: 'uploading' } })
      );
    }
    return { success: true, promise };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Retries a failed upload component or consultation
 * @param {string} itemId
 * @returns {Promise<object>}
 */
export async function retryUpload(itemId) {
  try {
    await syncQueue.retryItem(itemId);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Safely cancels a pending transfer
 * @param {string} itemId
 * @returns {Promise<object>}
 */
export async function cancelUpload(itemId) {
  try {
    await removeOutboxItem(itemId);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('carewave:queue-updated'));
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Synchronizes available doctor responses from server / storage
 * @returns {Promise<object>}
 */
export async function syncDoctorResponses() {
  try {
    await responseSync.poll();
    const responses = await dbGetDoctorResponses();
    return { success: true, responses: responses || [] };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export default {
  saveConsultationLocally,
  enqueueConsultation,
  getPendingUploads,
  getTransferStatus,
  resumeUpload,
  retryUpload,
  cancelUpload,
  syncDoctorResponses,
};
