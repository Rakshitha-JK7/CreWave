import api from './api';
import {
  savePatient as dbSavePatient,
  getAllPatients as dbGetPatients,
  getPatient as dbGetPatient,
  deletePatient as dbDeletePatient,
  clearPatients as dbClearPatients,
} from '../offline/indexedDB';

export const patientService = {
  /**
   * Register a new patient
   */
  async createPatient(patientData) {
    try {
      const response = await api.post('/patients', patientData);
      const patient = response.data?.data || response.data;
      // Cache in IndexedDB for offline view
      await dbSavePatient(patient);
      return { success: true, data: patient };
    } catch (err) {
      console.warn('API unavailable, saving patient locally:', err.userMessage || err.message);
      const newPatient = {
        ...patientData,
        id: patientData.id || `PAT-${Date.now().toString().slice(-4)}`,
        createdAt: new Date().toISOString(),
        isLocalOnly: true,
      };

      await dbSavePatient(newPatient);
      return {
        success: true,
        data: newPatient,
        offline: true,
        message: 'Saved locally on this device. Will sync to main hospital server when connection is available.',
      };
    }
  },

  /**
   * Retrieve all patients directly from the database API
   */
  async getPatients(params = {}) {
    try {
      const response = await api.get('/patients', { params });
      const serverList = Array.isArray(response.data) ? response.data : (response.data?.data || []);

      // Keep local cache synchronized with database: delete stale cached records if removed from database
      try {
        const local = await dbGetPatients();
        const serverIds = new Set(serverList.map((p) => p.id));
        if (serverList.length === 0) {
          // Database was cleared or is empty: clear all cached patients!
          await dbClearPatients();
        } else {
          for (const lp of (local || [])) {
            if (!serverIds.has(lp.id)) {
              await dbDeletePatient(lp.id);
            }
          }
        }
      } catch (e) {
        // ignore
      }

      return serverList;
    } catch (err) {
      console.warn('API patient list error:', err.message);
      // Offline fallback: only return locally cached patients when browser is truly offline
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        const localPatients = await dbGetPatients().catch(() => []);
        return localPatients || [];
      }
      return [];
    }
  },

  /**
   * Retrieve single patient by ID from database API
   */
  async getPatient(id) {
    try {
      const response = await api.get(`/patients/${id}`);
      return response.data?.data || response.data;
    } catch (err) {
      const local = await dbGetPatient(id);
      return local || null;
    }
  },

  /**
   * Update permitted patient fields
   */
  async updatePatient(id, updates) {
    try {
      const response = await api.patch(`/patients/${id}`, updates);
      const data = response.data?.data || response.data;
      await dbSavePatient(data);
      return { success: true, data };
    } catch (err) {
      const patient = await this.getPatient(id);
      if (patient) {
        const updated = { ...patient, ...updates, updatedAt: new Date().toISOString() };
        await dbSavePatient(updated);
        return { success: true, data: updated, offline: true };
      }
      return { success: false, error: err.message };
    }
  },
};

export default patientService;
