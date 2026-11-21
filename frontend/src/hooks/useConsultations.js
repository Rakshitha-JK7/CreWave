import { useState, useEffect, useCallback } from 'react';
import consultationService from '../services/consultationService';

export function useConsultations(initialFilters = {}) {
  const [consultations, setConsultations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchConsultations = useCallback(async (filters = initialFilters) => {
    setLoading(true);
    setError(null);
    try {
      const data = await consultationService.getConsultations(filters);
      setConsultations(data || []);
    } catch (err) {
      setError(err.userMessage || 'Failed to load consultations');
    } finally {
      setLoading(false);
    }
  }, [initialFilters]);

  const createConsultation = useCallback(async (formData) => {
    try {
      const result = await consultationService.createConsultation(formData);
      if (result.success && result.data) {
        setConsultations((prev) => [result.data, ...prev]);
      }
      return result;
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, []);

  const updateConsultation = useCallback(async (id, updates) => {
    try {
      const result = await consultationService.updateConsultation(id, updates);
      if (result.success && result.data) {
        setConsultations((prev) =>
          prev.map((c) => (c.id === id ? { ...c, ...result.data } : c))
        );
      }
      return result;
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, []);

  const getConsultationById = useCallback(async (id) => {
    return consultationService.getConsultation(id);
  }, []);

  useEffect(() => {
    fetchConsultations();
  }, [fetchConsultations]);

  return {
    consultations,
    loading,
    error,
    fetchConsultations,
    createConsultation,
    updateConsultation,
    getConsultationById,
  };
}

export default useConsultations;
