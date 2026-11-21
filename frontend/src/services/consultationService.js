import api from './api';
import { mockConsultations } from '../data/mockData';
import {
  saveConsultation as dbSaveConsultation,
  getConsultation as dbGetConsultation,
  getAllConsultations as dbGetAllConsultations,
  getDraftConsultations as dbGetDraftConsultations,
} from '../offline/indexedDB';
import { enqueueConsultation, getTransferStatus } from '../offline/offlineQueue';

export const consultationService = {
  /**
   * List available approved doctors for consultation routing
   */
  async getDoctors() {
    try {
      const response = await api.get('/consultations/doctors');
      return response.data?.data || response.data || [];
    } catch (err) {
      console.warn('Could not fetch doctor list from server:', err);
      return [
        {
          id: 'DOC-DEMO-01',
          name: 'Dr. Ramesh Sharma (Tele-Specialist)',
          specialization: 'Cardiology & General Medicine',
          licenseNumber: 'MED-REG-44921',
          status: 'active',
        },
      ];
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

    // 1. Always write to client storage first (No data loss principle)
    await dbSaveConsultation(consultation);

    // 2. Queue for chunked/resumable transmission
    await enqueueConsultation(consultation.id, {
      patientName: consultation.patientName,
      urgency: consultation.urgency,
    });

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
   */
  async getConsultations(params = {}) {
    let serverList = [];
    try {
      const response = await api.get('/consultations', { params });
      serverList = Array.isArray(response.data) ? response.data : (response.data?.data || []);
    } catch (err) {
      console.warn('API consultation list error or offline:', err.message);
    }

    // Always fetch local and drafted consultations from client IndexedDB and localStorage
    let localList = [];
    let draftList = [];
    try {
      const [allCons, allDrafts] = await Promise.all([
        dbGetAllConsultations().catch(() => []),
        dbGetDraftConsultations().catch(() => []),
      ]);
      localList = allCons || [];
      draftList = allDrafts || [];
    } catch (e) {
      console.warn('Could not read local consultations from IndexedDB:', e);
    }

    let localDrafts = [];
    try {
      localDrafts = JSON.parse(localStorage.getItem('carewave_drafts') || '[]');
    } catch {
      localDrafts = [];
    }

    // Merge server consultations, local consultations, and drafts
    const combined = [...serverList];
    [...(localList || []), ...(draftList || []), ...localDrafts].forEach((c) => {
      if (!c || !c.id) return;
      const idx = combined.findIndex((item) => item.id === c.id);
      if (idx !== -1) {
        combined[idx] = { ...combined[idx], ...c };
      } else {
        combined.unshift(c);
      }
    });

    // Filter by params if provided
    if (params.status && params.status !== 'all') {
      return combined.filter((c) => c.status === params.status);
    }
    if (params.patientId) {
      return combined.filter((c) => c.patientId === params.patientId || c.patientReferenceId === params.patientId);
    }

    return combined;
  },

  /**
   * Retrieve single consultation detail
   */
  async getConsultation(id) {
    try {
      const response = await api.get(`/consultations/${id}`);
      return response.data?.data || response.data;
    } catch (err) {
      const local = await dbGetConsultation(id);
      if (local) return local;

      const mock = mockConsultations.find((c) => c.id === id);
      return mock || null;
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
