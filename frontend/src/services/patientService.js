import api from './api';
import { mockPatients } from '../data/mockData';
import { savePatient as dbSavePatient, getAllPatients as dbGetPatients, getPatient as dbGetPatient } from '../offline/indexedDB';

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
      // Offline fallback: save to IndexedDB & localStorage
      const newPatient = {
        ...patientData,
        id: patientData.id || `PAT-${Date.now().toString().slice(-4)}`,
        createdAt: new Date().toISOString(),
        isLocalOnly: true,
      };

      await dbSavePatient(newPatient);

      const localList = JSON.parse(localStorage.getItem('carewave_patients') || '[]');
      localList.push(newPatient);
      localStorage.setItem('carewave_patients', JSON.stringify(localList));

      return {
        success: true,
        data: newPatient,
        offline: true,
        message: 'Saved locally on this device. Will sync to main hospital server when connection is available.',
      };
    }
  },

  /**
   * Retrieve all patients
   */
  async getPatients(params = {}) {
    try {
      const response = await api.get('/patients', { params });
      return Array.isArray(response.data) ? response.data : (response.data?.data || []);
    } catch (err) {
      // Offline fallback: Merge mock patients with any locally created ones
      const localPatients = await dbGetPatients();
      const stored = JSON.parse(localStorage.getItem('carewave_patients') || '[]');

      const combined = [...mockPatients];

      // Add local unique items
      [...(localPatients || []), ...stored].forEach((p) => {
        if (!combined.some((item) => item.id === p.id)) {
          combined.unshift(p);
        }
      });

      return combined;
    }
  },

  /**
   * Retrieve single patient by ID
   */
  async getPatient(id) {
    try {
      const response = await api.get(`/patients/${id}`);
      return response.data?.data || response.data;
    } catch (err) {
      const local = await dbGetPatient(id);
      if (local) return local;

      const mock = mockPatients.find((p) => p.id === id);
      if (mock) return mock;

      const stored = JSON.parse(localStorage.getItem('carewave_patients') || '[]');
      return stored.find((p) => p.id === id) || null;
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
      // Local fallback
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
