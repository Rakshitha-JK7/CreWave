import api from './api';
import { getConsultation as dbGetConsultation, saveConsultation as dbSaveConsultation } from '../offline/indexedDB';

export const doctorService = {
  /**
   * Get consultations accessible to the doctor directly from the database API
   */
  async getDoctorConsultations(params = {}) {
    try {
      const response = await api.get('/doctor/consultations', { params });
      return Array.isArray(response.data) ? response.data : (response.data?.data || []);
    } catch (err) {
      console.warn('API doctor consultation list error:', err.message);
      return [];
    }
  },

  /**
   * Get single consultation detail for doctor assessment from database API
   */
  async getDoctorConsultation(id) {
    try {
      const response = await api.get(`/doctor/consultations/${id}`);
      return response.data?.data || response.data;
    } catch (err) {
      const local = await dbGetConsultation(id);
      return local || null;
    }
  },

  /**
   * Update clinical review status
   */
  async updateReviewStatus(id, reviewStatus) {
    try {
      const response = await api.patch(`/doctor/consultations/${id}/review`, { reviewStatus });
      return { success: true, data: response.data?.data || response.data };
    } catch (err) {
      const existing = await this.getDoctorConsultation(id);
      if (existing) {
        const updated = {
          ...existing,
          reviewStatus,
          status: reviewStatus === 'in_review' ? 'under_review' : existing.status,
          updatedAt: new Date().toISOString(),
        };
        await dbSaveConsultation(updated);
        return { success: true, data: updated, offline: true };
      }
      return { success: false, error: err.message };
    }
  },
};

export default doctorService;
