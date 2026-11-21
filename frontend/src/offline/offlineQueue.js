/**
 * CareWave Offline Queue & Communication Module Adapter
 * 
 * INTEGRATION CONTRACT:
 * This module is the clean boundary between the UI and the low-bandwidth communication
 * engine (chunked uploads, prioritized sync over 2G, resumable transfers).
 * 
 * Functions defined here can be directly bound or extended by the communication developer's module.
 */

import {
  saveConsultation,
  getConsultation,
  savePendingUpload,
  getPendingUploads as dbGetPendingUploads,
  removePendingUpload,
  saveDoctorResponse,
  getDoctorResponses,
} from './indexedDB';

/**
 * Saves a consultation locally to IndexedDB before any network transmission attempt
 * @param {object} consultation
 * @returns {Promise<object>}
 */
export async function saveConsultationLocally(consultation) {
  try {
    const saved = await saveConsultation(consultation);
    return { success: true, consultation: saved };
  } catch (err) {
    console.error('saveConsultationLocally failed:', err);
    // Fallback to localStorage if IndexedDB is blocked
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
 * Priority: 1 (Critical clinical info, text/vitals), 2 (ECG reports), 3 (Images/large files)
 * @param {string} consultationId
 * @param {object} options - Optional metadata like urgency or components
 * @returns {Promise<object>}
 */
export async function enqueueConsultation(consultationId, options = {}) {
  try {
    const consultation = await getConsultation(consultationId);

    const queueItem = {
      id: `QUEUE-${consultationId}`,
      consultationId,
      patientName: consultation?.patientName || options.patientName || 'Unknown Patient',
      urgency: consultation?.urgency || options.urgency || 'normal',
      status: 'pending_upload', // 'pending_upload' | 'uploading' | 'partially_uploaded' | 'delivered' | 'failed'
      progress: 0,
      queuedAt: new Date().toISOString(),
      lastAttempt: null,
      components: [
        { name: 'Patient Info', type: 'text', status: 'pending', priority: 1 },
        { name: 'Symptoms & Vitals', type: 'text', status: 'pending', priority: 1 },
        ...(consultation?.attachments?.map((att, i) => ({
          name: att.name || `Attachment ${i + 1}`,
          type: att.type || 'file',
          size: att.size || 0,
          status: 'pending',
          priority: att.name?.toLowerCase().includes('ecg') ? 2 : 3,
          chunksTotal: Math.ceil((att.size || 50000) / 16384),
          chunksUploaded: 0,
        })) || []),
      ],
      pendingComponents: ['Patient Info', 'Symptoms & Vitals'],
      failedComponents: [],
      error: null,
    };

    const saved = await savePendingUpload(queueItem);
    
    // Broadcast event for UI reactive updates
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('carewave:queue-updated', { detail: saved }));
    }

    return { success: true, queueItem: saved };
  } catch (err) {
    console.error('enqueueConsultation error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Returns all active pending uploads from local queue
 * @returns {Promise<Array>}
 */
export async function getPendingUploads() {
  try {
    const uploads = await dbGetPendingUploads();
    return uploads || [];
  } catch (err) {
    console.warn('Failed to get pending uploads from IndexedDB, checking local state', err);
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
    const match = uploads.find((u) => u.consultationId === consultationId);
    if (match) return match;

    const consult = await getConsultation(consultationId);
    return {
      consultationId,
      status: consult?.status || 'unknown',
      progress: consult?.status === 'delivered' ? 100 : 0,
    };
  } catch (err) {
    return { consultationId, status: 'error', error: err.message };
  }
}

/**
 * Signals communication module to resume an interrupted upload
 * @param {string} consultationId
 * @returns {Promise<object>}
 */
export async function resumeUpload(consultationId) {
  try {
    const uploads = await getPendingUploads();
    const item = uploads.find((u) => u.consultationId === consultationId);

    if (item) {
      item.status = 'uploading';
      item.progress = Math.min(item.progress + 25, 100);
      item.lastAttempt = new Date().toISOString();
      if (item.progress >= 100) {
        item.status = 'delivered';
      }
      await savePendingUpload(item);

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('carewave:transfer-progress', { detail: item }));
      }
      return { success: true, item };
    }

    return { success: false, message: 'Transfer not found in queue' };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Retries a failed upload component or consultation
 * @param {string} consultationId
 * @returns {Promise<object>}
 */
export async function retryUpload(consultationId) {
  return resumeUpload(consultationId);
}

/**
 * Safely cancels a pending transfer
 * @param {string} consultationId
 * @returns {Promise<object>}
 */
export async function cancelUpload(consultationId) {
  try {
    const uploads = await getPendingUploads();
    const item = uploads.find((u) => u.consultationId === consultationId);
    if (item) {
      await removePendingUpload(item.id);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('carewave:queue-updated'));
      }
      return { success: true };
    }
    return { success: false, message: 'Item not in queue' };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Synchronizes available doctor responses from server / storage
 * @returns {Promise<Array>}
 */
export async function syncDoctorResponses() {
  try {
    const responses = await getDoctorResponses();
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
