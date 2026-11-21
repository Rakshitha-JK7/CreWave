/**
 * Service for Doctor Response submission and management
 */
import { mockResponses } from '../data/mockData';

export const responseService = {
  /**
   * Submit doctor response for a consultation
   * @param {string} consultationId
   * @param {object} responseData
   */
  async submitResponse(consultationId, responseData) {
    try {
      // Check local storage / mock state
      const newResponse = {
        id: `RES-${Date.now()}`,
        consultationId,
        doctorId: 'DOC001',
        doctorName: 'Dr. Anjali Mehta',
        doctorSpecialty: 'General Medicine',
        submittedAt: new Date().toISOString(),
        assessment: responseData.assessment,
        recommendations: responseData.recommendations,
        prescriptions: responseData.prescription || responseData.prescriptions || [],
        followUpInstructions: responseData.followUpInstructions,
        referral: responseData.referral || { recommended: false, details: '' },
        healthWorkerInstructions: responseData.healthWorkerInstructions,
        status: 'completed',
      };

      // Persist to localStorage
      const existing = JSON.parse(localStorage.getItem('carewave_responses') || '[]');
      existing.push(newResponse);
      localStorage.setItem('carewave_responses', JSON.stringify(existing));

      // Also update consultation review status in local storage
      const consultations = JSON.parse(localStorage.getItem('carewave_consultations') || '[]');
      const updatedConsultations = consultations.map((c) =>
        c.id === consultationId ? { ...c, status: 'response_available' } : c
      );
      localStorage.setItem('carewave_consultations', JSON.stringify(updatedConsultations));

      return {
        success: true,
        data: newResponse,
        message: 'Response submitted successfully. The healthcare worker will be notified.',
      };
    } catch (err) {
      console.error('Error submitting response:', err);
      return {
        success: false,
        error: err.message || 'Submission failed. Response saved as draft.',
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
   * Get response by consultationId
   */
  async getResponseByConsultationId(consultationId) {
    try {
      const stored = JSON.parse(localStorage.getItem('carewave_responses') || '[]');
      const local = stored.find((r) => r.consultationId === consultationId);
      if (local) return local;

      const mock = mockResponses.find((r) => r.consultationId === consultationId);
      return mock || null;
    } catch (e) {
      return null;
    }
  },
};

export default responseService;
