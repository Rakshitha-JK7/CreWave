/**
 * Service for Doctor Response submission and management
 * Directly sourced from the CareWave database API
 */
import api from './api';

export const responseService = {
  /**
   * Submit doctor response for a consultation
   * @param {string} consultationId
   * @param {object} responseData
   */
  async submitResponse(consultationId, responseData) {
    try {
      const payload = {
        assessment: responseData.assessment,
        recommendations: responseData.recommendations,
        prescription: responseData.prescription || responseData.prescriptions || [],
        followUpInstructions: responseData.followUpInstructions,
        referral: responseData.referral,
        healthWorkerInstructions: responseData.healthWorkerInstructions,
      };

      const res = await api.post(`/consultations/${consultationId}/responses`, payload);
      const apiResponse = res.data?.data || res.data;

      return {
        success: true,
        data: apiResponse,
        message: 'Response submitted successfully. The healthcare worker will be notified.',
      };
    } catch (err) {
      console.error('Error submitting response:', err);
      return {
        success: false,
        error: err.response?.data?.message || err.message || 'Submission failed.',
      };
    }
  },

  /**
   * Save draft response
   */
  saveDraft(consultationId, draftData) {
    try {
      const key = `carewave_draft_response_${consultationId}`;
      localStorage.setItem(key, JSON.stringify({
        consultationId,
        ...draftData,
        updatedAt: new Date().toISOString(),
      }));
      return true;
    } catch (e) {
      console.error('Error saving draft:', e);
      return false;
    }
  },

  /**
   * Get draft response
   */
  getDraft(consultationId) {
    try {
      const key = `carewave_draft_response_${consultationId}`;
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  },

  /**
   * Get response by consultationId directly from database API
   */
  async getResponseByConsultationId(consultationId) {
    try {
      const res = await api.get(`/consultations/${consultationId}/responses`);
      const data = res.data?.data || res.data;
      if (Array.isArray(data) && data.length > 0) {
        return data[data.length - 1];
      } else if (data && !Array.isArray(data)) {
        return data;
      }
      return null;
    } catch (e) {
      return null;
    }
  },
};

export default responseService;
