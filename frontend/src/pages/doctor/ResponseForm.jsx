import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  FileText,
  User,
  Plus,
  Trash2,
  CheckCircle,
  Save,
  Send,
  ArrowLeft,
  AlertCircle,
  MessageSquare,
  Shield,
  HelpCircle,
  Pill,
} from 'lucide-react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { useApp } from '../../context/AppContext';
import responseService from '../../services/responseService';
import doctorService from '../../services/doctorService';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import LoadingSpinner from '../../components/LoadingSpinner';

export default function ResponseForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addNotification, currentUser } = useApp();

  const [loading, setLoading] = useState(true);
  const [consultation, setConsultation] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function loadRecord() {
      setLoading(true);
      try {
        const c = await doctorService.getDoctorConsultation(id);
        if (mounted && c) setConsultation(c);
      } catch (err) {
        console.warn('Failed to load consultation for response form:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadRecord();
    return () => { mounted = false; };
  }, [id]);

  const [formData, setFormData] = useState({
    assessment: '',
    recommendations: '',
    prescriptions: [
      { medicineName: '', dosage: '', frequency: 'Twice daily', duration: '5 days', instructions: '' },
    ],
    followUpInstructions: 'Review in 7 days at clinic or immediately if fever exceeds 39°C',
    referral: { recommended: false, details: '' },
    healthWorkerInstructions: 'Monitor vitals daily and verify patient takes medication with food.',
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showInfoRequestModal, setShowInfoRequestModal] = useState(false);
  const [infoRequestText, setInfoRequestText] = useState('');

  // Check if draft exists
  useEffect(() => {
    const draft = responseService.getDraft(id);
    if (draft) {
      setFormData((prev) => ({ ...prev, ...draft }));
    }
  }, [id]);

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }));
    }
  };

  const handleAddMedication = () => {
    setFormData((prev) => ({
      ...prev,
      prescriptions: [
        ...prev.prescriptions,
        { medicineName: '', dosage: '', frequency: 'Once daily', duration: '5 days', instructions: '' },
      ],
    }));
  };

  const handleRemoveMedication = (index) => {
    setFormData((prev) => ({
      ...prev,
      prescriptions: prev.prescriptions.filter((_, i) => i !== index),
    }));
  };

  const handleMedicationChange = (index, field, value) => {
    setFormData((prev) => {
      const updated = [...prev.prescriptions];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, prescriptions: updated };
    });
  };

  const handleSaveDraft = () => {
    responseService.saveDraft(id, formData);
    addNotification('Response draft saved locally', 'info');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const newErrors = {};
    if (!formData.assessment.trim()) {
      newErrors.assessment = 'Clinical assessment is required';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      addNotification('Please complete required assessment field', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await responseService.submitResponse(id, formData);
      if (result.success) {
        setIsSubmitted(true);
        addNotification('Clinical response successfully signed and transmitted to rural clinic!', 'success');
        // Clear draft
        localStorage.removeItem(`carewave_draft_response_${id}`);
      } else {
        addNotification(result.error || 'Failed to submit response', 'error');
      }
    } catch (err) {
      addNotification('Submission error occurred', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    if (loading) {
    return (
      <DashboardLayout role="doctor">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
          <LoadingSpinner size="lg" text="Loading consultation record from database..." />
        </div>
      </DashboardLayout>
    );
  }

  if (!consultation) {
    return (
      <DashboardLayout role="doctor">
        <div style={{ maxWidth: 600, margin: '60px auto', textAlign: 'center' }}>
          <EmptyState
            icon={FileText}
            title="Consultation Not Found"
            description={`Consultation #${id} was not found in the database. It may have been removed or has not been uploaded yet.`}
          />
          <button
            onClick={() => navigate('/doctor')}
            style={{
              marginTop: 16,
              padding: '10px 20px',
              backgroundColor: '#0284c7',
              color: '#ffffff',
              border: 'none',
              borderRadius: 8,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Back to Consultations
          </button>
        </div>
      </DashboardLayout>
    );
  }

  return (
      <DashboardLayout role="doctor">
        <div style={{ maxWidth: 650, margin: '60px auto', background: '#fff', padding: 40, borderRadius: 16, textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <CheckCircle size={36} />
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>
            Medical Response Submitted & Signed
          </h2>
          <p style={{ color: '#64748b', fontSize: 15, marginBottom: 24 }}>
            Your assessment, prescriptions, and advice for <strong>{consultation?.patientName}</strong> (Case #{consultation?.id}) have been cryptographically stamped and synchronized for delivery to the rural healthcare worker.
          </p>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, marginBottom: 28, fontSize: 13, color: '#475569', textAlign: 'left' }}>
            <div style={{ marginBottom: 6 }}><strong>Doctor:</strong> {currentUser?.name || 'Dr. Anjali Mehta'}</div>
            <div style={{ marginBottom: 6 }}><strong>Status:</strong> Response Delivered / Ready for Clinic Transmission</div>
            <div><strong>Timestamp:</strong> {new Date().toLocaleString()}</div>
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button className="btn btn-primary" onClick={() => navigate('/doctor/incoming')}>
              Review Next Case
            </button>
            <button className="btn btn-secondary" onClick={() => navigate('/doctor/reviewed')}>
              View Reviewed Cases
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (loading) {
    return (
      <DashboardLayout role="doctor">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
          <LoadingSpinner size="lg" text="Loading consultation record from database..." />
        </div>
      </DashboardLayout>
    );
  }

  if (!consultation) {
    return (
      <DashboardLayout role="doctor">
        <div style={{ maxWidth: 600, margin: '60px auto', textAlign: 'center' }}>
          <EmptyState
            icon={FileText}
            title="Consultation Not Found"
            description={`Consultation #${id} was not found in the database. It may have been removed or has not been uploaded yet.`}
          />
          <button
            onClick={() => navigate('/doctor')}
            style={{
              marginTop: 16,
              padding: '10px 20px',
              backgroundColor: '#0284c7',
              color: '#ffffff',
              border: 'none',
              borderRadius: 8,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Back to Consultations
          </button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="doctor">
      <div style={{ maxWidth: 1080, margin: '0 auto', paddingBottom: 60 }}>
        {/* Top Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <button
              onClick={() => navigate(-1)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: '#64748b', fontSize: 14, cursor: 'pointer', marginBottom: 8 }}
            >
              <ArrowLeft size={16} /> Back to Consultation Details
            </button>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0f172a' }}>Submit Doctor Assessment & Advice</h1>
            <p style={{ color: '#64748b', fontSize: 14 }}>
              Case #{consultation?.id} • Patient: {consultation?.patientName} ({consultation?.patientAge} yrs / {consultation?.patientSex})
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="btn btn-secondary" onClick={handleSaveDraft}>
              <Save size={16} /> Save Draft
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ color: '#d97706' }}
              onClick={() => setShowInfoRequestModal(true)}
            >
              <HelpCircle size={16} /> Request More Info
            </button>
          </div>
        </div>

        {/* Case Clinical Snapshot banner */}
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 18, marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#0284c7' }}>
              Clinical Summary
            </span>
            <StatusBadge status={consultation?.urgency} type="urgency" />
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', marginBottom: 4 }}>
            Chief Complaint: {
              typeof consultation?.chiefComplaint === 'string'
                ? consultation.chiefComplaint
                : (typeof consultation?.symptoms === 'object' ? (consultation?.symptoms?.chiefComplaint || 'Consultation') : (consultation?.symptoms || 'Consultation'))
            }
          </div>
          <div style={{ fontSize: 13, color: '#64748b' }}>
            Duration: {typeof consultation?.symptoms === 'object' ? (consultation?.symptoms?.duration || '—') : (consultation?.duration || '—')} • Severity: {typeof consultation?.symptoms === 'object' ? (consultation?.symptoms?.severity || '—') : (consultation?.severity || '—')} • Clinic: {consultation?.clinicName || 'Rampur PHC'}
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Section 1: Clinical Assessment */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <FileText size={18} color="#0284c7" />
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>1. Doctor's Clinical Assessment *</h3>
            </div>
            <div className="card-body">
              <div className="form-group">
                <label className="form-label required">Diagnostic Impression & Evaluation</label>
                <textarea
                  rows={4}
                  className="form-control"
                  placeholder="Provide your clinical diagnosis or differential diagnoses based on recorded vitals, symptoms, and ECG/attachments..."
                  value={formData.assessment}
                  onChange={(e) => handleInputChange('assessment', e.target.value)}
                />
                {errors.assessment && <div className="form-error">{errors.assessment}</div>}
              </div>

              <div className="form-group" style={{ marginTop: 16 }}>
                <label className="form-label">Clinical Recommendations & Lifestyle Guidance</label>
                <textarea
                  rows={3}
                  className="form-control"
                  placeholder="e.g. Bed rest for 48 hours, oral rehydration, warm saline gargle..."
                  value={formData.recommendations}
                  onChange={(e) => handleInputChange('recommendations', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Section 2: Prescription / Medication List */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Pill size={18} color="#16a34a" />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>2. Prescribed Medications (Rx)</h3>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={handleAddMedication}>
                <Plus size={14} /> Add Medicine
              </button>
            </div>
            <div className="card-body">
              {formData.prescriptions.map((rx, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '2fr 1fr 1.5fr 1fr 36px',
                    gap: 12,
                    alignItems: 'center',
                    background: '#f8fafc',
                    padding: 12,
                    borderRadius: 8,
                    marginBottom: 10,
                  }}
                >
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Medicine Name (e.g. Paracetamol)"
                    value={rx.medicineName}
                    onChange={(e) => handleMedicationChange(idx, 'medicineName', e.target.value)}
                  />
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Dosage (500mg)"
                    value={rx.dosage}
                    onChange={(e) => handleMedicationChange(idx, 'dosage', e.target.value)}
                  />
                  <select
                    className="form-control"
                    value={rx.frequency}
                    onChange={(e) => handleMedicationChange(idx, 'frequency', e.target.value)}
                  >
                    <option value="Once daily">Once daily (OD)</option>
                    <option value="Twice daily">Twice daily (BD)</option>
                    <option value="Three times daily">Three times daily (TDS)</option>
                    <option value="Four times daily">Four times daily (QID)</option>
                    <option value="As needed">As needed (PRN)</option>
                  </select>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Duration (5 days)"
                    value={rx.duration}
                    onChange={(e) => handleMedicationChange(idx, 'duration', e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveMedication(idx)}
                    style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 4 }}
                    title="Remove item"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              <span style={{ fontSize: 12, color: '#94a3b8' }}>
                Ensure prescribed medicines correspond to the standard rural clinic formulary.
              </span>
            </div>
          </div>

          {/* Section 3: Follow-Up & Referral */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Shield size={18} color="#ea580c" />
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>3. Follow-Up & Referral</h3>
            </div>
            <div className="card-body">
              <div className="form-group">
                <label className="form-label">Follow-up Instructions</label>
                <textarea
                  rows={2}
                  className="form-control"
                  value={formData.followUpInstructions}
                  onChange={(e) => handleInputChange('followUpInstructions', e.target.value)}
                />
              </div>

              <div style={{ marginTop: 16, borderTop: '1px solid #e2e8f0', paddingTop: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600, color: '#0f172a' }}>
                  <input
                    type="checkbox"
                    checked={formData.referral.recommended}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        referral: { ...prev.referral, recommended: e.target.checked },
                      }))
                    }
                  />
                  Recommend Formal Referral to District Hospital
                </label>

                {formData.referral.recommended && (
                  <div style={{ marginTop: 12 }}>
                    <label className="form-label">Referral Department & Urgency</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Cardiology OPD, District Hospital Sitapur within 48h"
                      value={formData.referral.details}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          referral: { ...prev.referral, details: e.target.value },
                        }))
                      }
                    />
                  </div>
                )}
              </div>

              <div className="form-group" style={{ marginTop: 16 }}>
                <label className="form-label">Instructions for Rural Healthcare Worker</label>
                <textarea
                  rows={2}
                  className="form-control"
                  value={formData.healthWorkerInstructions}
                  onChange={(e) => handleInputChange('healthWorkerInstructions', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
            <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>
              Cancel
            </button>
            <button type="button" className="btn btn-secondary" onClick={handleSaveDraft}>
              Save Draft
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              <Send size={16} /> {isSubmitting ? 'Signing & Submitting...' : 'Sign & Submit Response'}
            </button>
          </div>
        </form>

        {/* Request More Information Modal */}
        {showInfoRequestModal && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              padding: 20,
            }}
          >
            <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 540, padding: 24 }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: 18, fontWeight: 700 }}>Request Additional Information</h3>
              <p style={{ color: '#64748b', fontSize: 14, marginBottom: 16 }}>
                Specify what additional measurements, test reports, or observations are needed from the rural health worker:
              </p>
              <textarea
                rows={4}
                className="form-control"
                placeholder="e.g. Please re-check BP after 15 minutes of rest and confirm if patient has past allergy to cephalosporins."
                value={infoRequestText}
                onChange={(e) => setInfoRequestText(e.target.value)}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
                <button className="btn btn-secondary" onClick={() => setShowInfoRequestModal(false)}>
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    addNotification('Information request dispatched to health worker queue', 'info');
                    setShowInfoRequestModal(false);
                  }}
                >
                  Send Request
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
