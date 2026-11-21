import api from './api';
import transmissionManager from '../telemetry/transmissionManager';
import {
  saveConsultation as dbSaveConsultation,
  getConsultation as dbGetConsultation,
  getAllConsultations as dbGetAllConsultations,
  deleteConsultation as dbDeleteConsultation,
  clearConsultations as dbClearConsultations,
  getDraftConsultations as dbGetDraftConsultations,
} from '../offline/indexedDB';
import { enqueueConsultation, getTransferStatus } from '../offline/offlineQueue';

export const consultationService = {
  /**
   * List available approved doctors for consultation routing
   * Strictly fetched from database active users
   */
  async getDoctors() {
    try {
      const response = await api.get('/consultations/doctors');
      return response.data?.data || response.data || [];
    } catch (err) {
      console.warn('Could not fetch doctor list from server:', err);
      return [];
    }
  },

  /**
   * Submit or locally save a consultation
   */
  async createConsultation(consultationData) {
    const consultation = {
      ...consultationData,
      id: consultationData.id || `CW-${Date.now().toString().slice(-6)}`,
      createdAt: consultationData.createdAt || new Date().toISOString(),
      status: 'pending_upload',
    };
    if (!consultation.idempotencyKey) {
      consultation.idempotencyKey = `IDEMP-${consultation.id}`;
    }

    // 1. Write to client storage for offline protection
    await dbSaveConsultation(consultation);

    // 2. Dispatch to CareBridge Unified 2G Protobuf & Lossless Transmission Engine
    try {
      await transmissionManager.submitMedicalRecord(consultation);
    } catch (e) {
      console.warn('CareBridge transmission manager notice:', e.message);
    }

    // 3. Attempt API delivery if online
    try {
      const response = await api.post('/consultations', consultation);
      const serverData = response.data?.data || response.data;
      // If server confirmed receipt:
      const updated = {
        ...consultation,
        status: 'delivered',
        serverId: serverData?.id || serverData?.consultationId || response.data?.id,
      };
      await dbSaveConsultation(updated);
      return { success: true, data: updated, deliveredNow: true };
    } catch (err) {
      console.info('Consultation queued locally for sync:', err.userMessage || err.message);
      return {
        success: true,
        data: consultation,
        deliveredNow: false,
        message: 'Consultation saved securely on this device and queued for transmission over available bandwidth.',
      };
    }
  },

  /**
   * List all consultations accessible to user role
   * Strictly sourced from the PostgreSQL / SQLite database when online
   */
  async getConsultations(params = {}) {
    try {
      const response = await api.get('/consultations', { params });
      const serverList = Array.isArray(response.data) ? response.data : (response.data?.data || []);

      // Authoritative database sync: clean up stale cached records so clearing DB clears frontend
      try {
        const local = await dbGetAllConsultations();
        const serverIds = new Set(serverList.map((c) => c.id));
        if (serverList.length === 0) {
          // Database was cleared or is empty: clear all non-draft local consultations!
          await dbClearConsultations();
        } else {
          for (const item of (local || [])) {
            if (!item.isDraft && item.status !== 'draft' && !serverIds.has(item.id)) {
              await dbDeleteConsultation(item.id);
            }
          }
        }
      } catch (e) {
        // ignore local pruning errors
      }

      // If user specifically filtered for drafts, retrieve active drafts from local draft stores
      if (params.status === 'draft') {
        const [idbDrafts, localDrafts] = await Promise.all([
          dbGetDraftConsultations().catch(() => []),
          Promise.resolve(JSON.parse(localStorage.getItem('carewave_drafts') || '[]')),
        ]);
        const combinedDrafts = [...idbDrafts];
        localDrafts.forEach((d) => {
          if (d && d.id && !combinedDrafts.some((item) => item.id === d.id)) {
            combinedDrafts.push(d);
          }
        });
        return combinedDrafts;
      }

      // Filter by params if provided
      if (params.status && params.status !== 'all') {
        return serverList.filter((c) => c.status === params.status);
      }
      if (params.patientId) {
        return serverList.filter((c) => c.patientId === params.patientId || c.patientReferenceId === params.patientId);
      }

      return serverList;
    } catch (err) {
      console.warn('API consultation list error or offline:', err.message);
      // Offline fallback: only return locally cached consultations when server is truly unreachable
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        const local = await dbGetAllConsultations().catch(() => []);
        return local || [];
      }
      return [];
    }
  },

  /**
   * Retrieve single consultation detail
   * Directly from database API; fallback to local IDB only for offline inspection
   */
  async getConsultation(id) {
    try {
      const response = await api.get(`/consultations/${id}`);
      return response.data?.data || response.data;
    } catch (err) {
      const local = await dbGetConsultation(id);
      return local || null;
    }
  },

  /**
   * Update consultation fields
   */
  async updateConsultation(id, updates) {
    try {
      const response = await api.patch(`/consultations/${id}`, updates);
      const data = response.data?.data || response.data;
      await dbSaveConsultation(data);
      return { success: true, data };
    } catch (err) {
      const existing = await this.getConsultation(id);
      if (existing) {
        const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
        await dbSaveConsultation(updated);
        return { success: true, data: updated, offline: true };
      }
      return { success: false, error: err.message };
    }
  },

  /**
   * Get sync and transfer status
   */
  async getConsultationSyncStatus(id) {
    try {
      const response = await api.get(`/consultations/${id}/sync-status`);
      return response.data?.data || response.data;
    } catch (err) {
      return getTransferStatus(id);
    }
  },
};

export default consultationService;
