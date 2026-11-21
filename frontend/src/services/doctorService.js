import api from './api';
import { mockConsultations } from '../data/mockData';
import { getConsultation as dbGetConsultation, saveConsultation as dbSaveConsultation } from '../offline/indexedDB';

export const doctorService = {
  /**
   * Get consultations accessible to the doctor
   */
  async getDoctorConsultations(params = {}) {
    try {
      const response = await api.get('/doctor/consultations', { params });
      return Array.isArray(response.data) ? response.data : (response.data?.data || []);
    } catch (err) {
      // Return consultations that have arrived (status not draft)
      const list = mockConsultations.filter((c) => c.status !== 'draft');
      if (params.urgency) {
        return list.filter((c) => c.urgency === params.urgency);
      }
      return list;
    }
  },

  /**
   * Get single consultation detail for doctor assessment
   */
  async getDoctorConsultation(id) {
    try {
      const response = await api.get(`/doctor/consultations/${id}`);
      return response.data?.data || response.data;
    } catch (err) {
      const local = await dbGetConsultation(id);
      if (local) return local;

      return mockConsultations.find((c) => c.id === id) || null;
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
