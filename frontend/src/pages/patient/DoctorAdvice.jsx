import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Printer, Pill, Calendar, AlertTriangle, User, ArrowLeft, Shield } from 'lucide-react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { useAuth } from '../../context/AuthContext';
import { syncDoctorResponses } from '../../offline/offlineQueue';
import { formatDate, formatDateTime } from '../../utils/formatDate';
import EmptyState from '../../components/EmptyState';

export default function DoctorAdvice() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const patientId = currentUser?.patientId || currentUser?.referenceId || currentUser?.id || 'PAT001';

  const [responses, setResponses] = useState([]);
  const [selectedResponse, setSelectedResponse] = useState(null);
  const [showPrintModal, setShowPrintModal] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function loadAdvice() {
      try {
        const res = await syncDoctorResponses().catch(() => ({ responses: [] }));
        const serverResponses = (res && Array.isArray(res.responses)) ? res.responses : [];
        if (mounted) {
          setResponses(serverResponses);
          if (serverResponses.length > 0 && !selectedResponse) {
            setSelectedResponse(serverResponses[0]);
          }
        }
      } catch (err) {
        console.warn('Failed to load doctor advice:', err);
      }
    }
    loadAdvice();
    return () => { mounted = false; };
  }, [patientId]);

  const activeResponse = selectedResponse || responses[0];

  return (
    <DashboardLayout role="patient">
      <div style={{ maxWidth: 1000, margin: '0 auto', paddingBottom: 40 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0f172a' }}>Doctor's Advice & Prescriptions</h1>
            <p style={{ color: '#64748b', fontSize: 14 }}>
              Official medical evaluations, dosage regimens, and follow-up guidance issued by remote specialists.
            </p>
          </div>

          {activeResponse && (
            <button
              className="btn btn-primary"
              onClick={() => setShowPrintModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <Printer size={16} /> Print Prescription Slip
            </button>
          )}
        </div>

        {responses.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="No doctor advice available yet"
            description="Once the remote doctor completes review of your case, their diagnostic advice and prescriptions will appear here."
            action={{
              label: 'View My Consultations',
              onClick: () => navigate('/patient/consultations'),
            }}
          />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: responses.length > 1 ? '260px 1fr' : '1fr', gap: 20 }}>
            {/* Case Selector if multiple */}
            {responses.length > 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                  Select Consultation
                </span>
                {responses.map((r) => (
                  <div
                    key={r.id}
                    onClick={() => setSelectedResponse(r)}
                    style={{
                      padding: 14,
                      borderRadius: 10,
                      background: activeResponse?.id === r.id ? '#e0f2fe' : '#fff',
                      border: `1px solid ${activeResponse?.id === r.id ? '#0284c7' : '#e2e8f0'}`,
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 14, color: '#0f172a' }}>
                      Case #{r.consultationId}
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                      {formatDate(r.submittedAt || r.createdAt)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Active Advice Display */}
            {activeResponse && (
              <div>
                {/* Doctor credentials banner */}
                <div className="card" style={{ marginBottom: 20 }}>
                  <div className="card-body" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a' }}>
                        {activeResponse.doctorName}
                      </h3>
                      <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
                        {activeResponse.doctorSpecialty || 'General Physician'} • City Medical Center
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: 12, color: '#64748b' }}>
                      <div>Issued: <strong>{formatDateTime(activeResponse.submittedAt || activeResponse.createdAt)}</strong></div>
                      <div>Verified Telemedicine Advice</div>
                    </div>
                  </div>
                </div>

                {/* Clinical Assessment */}
                <div className="card" style={{ marginBottom: 20 }}>
                  <div className="card-header">
                    <h4 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Doctor's Clinical Assessment</h4>
                  </div>
                  <div className="card-body">
                    <p style={{ margin: 0, fontSize: 15, color: '#0f172a', lineHeight: 1.6 }}>
                      {activeResponse.assessment}
                    </p>
                  </div>
                </div>

                {/* Treatment Recommendations */}
                <div className="card" style={{ marginBottom: 20 }}>
                  <div className="card-header">
                    <h4 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Treatment Recommendations & Care</h4>
                  </div>
                  <div className="card-body">
                    <p style={{ margin: 0, fontSize: 14, color: '#475569', lineHeight: 1.6 }}>
                      {activeResponse.recommendations || 'Continue prescribed medications and rest.'}
                    </p>
                  </div>
                </div>

                {/* Prescriptions Table */}
                {(activeResponse.prescriptions || activeResponse.prescription)?.length > 0 && (
                  <div className="card" style={{ marginBottom: 20, overflow: 'hidden' }}>
                    <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Pill size={18} color="#0284c7" />
                      <h4 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Prescribed Medications (Rx)</h4>
                    </div>
                    <div className="card-body" style={{ padding: 0 }}>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Medication</th>
                            <th>Dosage</th>
                            <th>Frequency</th>
                            <th>Duration</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(activeResponse.prescriptions || activeResponse.prescription).map((med, idx) => (
                            <tr key={idx}>
                              <td style={{ fontWeight: 600, color: '#0f172a' }}>{med.medicineName}</td>
                              <td>{med.dosage}</td>
                              <td>{med.frequency}</td>
                              <td>{med.duration}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Follow-up & Referral */}
                <div className="card" style={{ marginBottom: 20 }}>
                  <div className="card-header">
                    <h4 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Follow-up & Referral Instructions</h4>
                  </div>
                  <div className="card-body">
                    <div style={{ marginBottom: activeResponse.referral?.recommended ? 16 : 0 }}>
                      <span style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                        Follow-Up Guidance
                      </span>
                      <p style={{ margin: 0, fontSize: 14, color: '#0f172a' }}>
                        {activeResponse.followUpInstructions || 'Review in 7 days with your rural clinic healthcare worker.'}
                      </p>
                    </div>

                    {activeResponse.referral?.recommended && (
                      <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: 14 }}>
                        <div style={{ fontWeight: 700, color: '#b91c1c', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <AlertTriangle size={16} /> Hospital Referral Recommended
                        </div>
                        <div style={{ color: '#7f1d1d', fontSize: 13, marginTop: 4 }}>
                          {activeResponse.referral.details}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Printable Modal */}
        {showPrintModal && activeResponse && (
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
            <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 650, padding: 32, boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
              <div style={{ borderBottom: '2px solid #0284c7', paddingBottom: 16, marginBottom: 20, display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <h2 style={{ margin: 0, color: '#0284c7', fontSize: 22, fontWeight: 800 }}>CareWave Telemedicine</h2>
                  <div style={{ fontSize: 12, color: '#64748b' }}>Rural Telehealth Medical Prescription</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, color: '#0f172a' }}>{activeResponse.doctorName}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>{activeResponse.doctorSpecialty || 'General Medicine'}</div>
                </div>
              </div>

              <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, marginBottom: 20, fontSize: 13, display: 'flex', justifyContent: 'space-between' }}>
                <div>Patient: <strong>{currentUser?.name || 'Ravi Kumar'}</strong></div>
                <div>Case ID: <strong>{activeResponse.consultationId}</strong></div>
                <div>Date: <strong>{formatDate(activeResponse.submittedAt || activeResponse.createdAt)}</strong></div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <h4 style={{ fontSize: 16, fontWeight: 800, color: '#0284c7', margin: '0 0 10px 0' }}>Rx - Medications</h4>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                      <th style={{ padding: '6px 0' }}>Medicine</th>
                      <th style={{ padding: '6px 0' }}>Dosage</th>
                      <th style={{ padding: '6px 0' }}>Frequency</th>
                      <th style={{ padding: '6px 0' }}>Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(activeResponse.prescriptions || activeResponse.prescription || []).map((med, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 0', fontWeight: 600 }}>{med.medicineName}</td>
                        <td style={{ padding: '8px 0' }}>{med.dosage}</td>
                        <td style={{ padding: '8px 0' }}>{med.frequency}</td>
                        <td style={{ padding: '8px 0' }}>{med.duration}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ fontSize: 13, color: '#475569', marginBottom: 24, borderTop: '1px solid #e2e8f0', paddingTop: 12 }}>
                <strong>Doctor's Advice:</strong> {activeResponse.recommendations || activeResponse.assessment}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                <button className="btn btn-secondary" onClick={() => setShowPrintModal(false)}>
                  Close
                </button>
                <button className="btn btn-primary" onClick={() => window.print()}>
                  <Printer size={16} /> Print
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
