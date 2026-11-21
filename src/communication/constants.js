/**
 * CareWave Status Lifecycle Constants
 * Based on CareWave Team Development Plan & Information Collection spec.
 */

export const ConsultationStatus = Object.freeze({
  CREATED: 'Created',
  SAVED_LOCALLY: 'Saved locally',
  UPLOAD_PENDING: 'Upload pending',
  RECEIVED_BY_SERVER: 'Received by server',
  AVAILABLE_TO_DOCTOR: 'Available to doctor',
  REVIEWED: 'Reviewed',
  RESPONSE_SUBMITTED: 'Response submitted',
  RESPONSE_RECEIVED: 'Response received',
});

export const ComponentPriority = Object.freeze({
  GROUP_1_ESSENTIAL: 1, // Essential clinical summary (sent first, unchunked)
  GROUP_2_CLINICAL: 2,  // ECG, important clinical recordings / images
  GROUP_3_DOCUMENTS: 3, // Lab reports, previous prescriptions, documents
});

export const ComponentType = Object.freeze({
  SUMMARY: 'summary',
  ECG: 'ecg',
  CLINICAL_IMAGE: 'clinical_image',
  LAB_REPORT: 'lab_report',
  VOICE_NOTE: 'voice_note',
  DOCUMENT: 'document',
});

export const TransferState = Object.freeze({
  PENDING: 'pending',
  UPLOADING: 'uploading',
  COMPLETED: 'completed',
  FAILED: 'failed',
  PAUSED: 'paused',
});

export const NetworkQuality = Object.freeze({
  OFFLINE: 'offline',
  POOR: 'poor',    // 2G, high latency or low throughput
  GOOD: 'good',    // normal broadband/4G
});

export const NetworkSimPreset = Object.freeze({
  NORMAL: 'normal',
  POOR_2G: '2g',
  FLAKY: 'flaky',
  OFFLINE: 'offline',
});
