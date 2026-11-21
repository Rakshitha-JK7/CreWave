import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Check, CheckCircle2, User, Printer, Calendar, Pill, AlertTriangle, X, Eye } from 'lucide-react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { mockResponses } from '../../data/mockData';
import { formatDateTime } from '../../utils/formatDate';
import { useApp } from '../../context/AppContext';
import EmptyState from '../../components/EmptyState';

export default function DoctorResponses() {
  const navigate = useNavigate();
  const { addNotification } = useApp();

  const [responses, setResponses] = useState([]);
  const [filter, setFilter] = useState('all'); // 'all' | 'unread' | 'communicated'
  const [selectedResponse, setSelectedResponse] = useState(null);
  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);

  useEffect(() => {
    // Load responses from localStorage or mock data
    const local = JSON.parse(localStorage.getItem('carewave_responses') || '[]');
    const combined = [...local];
    mockResponses.forEach((mr) => {
      if (!combined.some((item) => item.id === mr.id || item.consultationId === mr.consultationId)) {
        combined.push(mr);
      }
    });

    // Check communication status from localStorage
    const commStatus = JSON.parse(localStorage.getItem('carewave_communicated_responses') || '{}');
    const enriched = combined.map((r) => ({
      ...r,
      communicatedToPatient: commStatus[r.id] || false,
    }));

    setResponses(enriched);
  }, []);

  const handleMarkCommunicated = (responseId) => {
    const commStatus = JSON.parse(localStorage.getItem('carewave_communicated_responses') || '{}');
    commStatus[responseId] = true;
    localStorage.setItem('carewave_communicated_responses', JSON.stringify(commStatus));

    setResponses((prev) =>
      prev.map((r) => (r.id === responseId ? { ...r, communicatedToPatient: true } : r))
    );

    addNotification('Marked as communicated to patient. Original doctor advice preserved.', 'success');
  };

  const filtered = responses.filter((r) => {
    if (filter === 'communicated') return r.communicatedToPatient;
    if (filter === 'unread') return !r.communicatedToPatient;
    return true;
  });

  return (
    <DashboardLayout role="healthWorker">
      <div style={{ maxWidth: 1100, margin: '0 auto', paddingBottom: 40 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0f172a' }}>Remote Doctor Responses</h1>
            <p style={{ color: '#64748b', fontSize: 14 }}>
              Specialist advice received for clinic patients. Deliver instructions and prescribe medications locally.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className={`btn ${filter === 'all' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
              onClick={() => setFilter('all')}
            >
              All ({responses.length})
            </button>
            <button
              className={`btn ${filter === 'unread' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
              onClick={() => setFilter('unread')}
            >
              Pending Delivery ({responses.filter((r) => !r.communicatedToPatient).length})
            </button>
            <button
              className={`btn ${filter === 'communicated' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
              onClick={() => setFilter('communicated')}
            >
              Delivered ({responses.filter((r) => r.communicatedToPatient).length})
            </button>
          </div>
        </div>

        {/* Responses Grid */}
        {filtered.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="No doctor responses match your filter"
            description="Responses submitted by remote doctors will automatically sync here when internet connectivity is established."
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {filtered.map((resp) => {
              const prescriptionsList = resp.prescriptions || resp.prescription || [];

              return (
                <div key={resp.id} className="card" style={{ borderLeft: resp.communicatedToPatient ? '4px solid #16a34a' : '4px solid #0284c7' }}>
                  <div className="card-body" style={{ padding: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#0f172a' }}>
                            {resp.patientName || `Patient for Case #${resp.consultationId}`}
                          </h3>
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#0284c7', background: '#e0f2fe', padding: '2px 8px', borderRadius: 6 }}>
                            Case #{resp.consultationId}
                          </span>
                        </div>
                        <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
                          Doctor: <strong>{resp.doctorName}</strong> ({resp.doctorSpecialty || 'Specialist'}) • Received: {formatDateTime(resp.submittedAt || resp.createdAt)}
                        </div>
                      </div>

                      <div>
                        {resp.communicatedToPatient ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#dcfce7', color: '#166534', padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600 }}>
                            <CheckCircle2 size={14} /> Communicated to Patient
                          </span>
                        ) : (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#fef3c7', color: '#92400e', padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600 }}>
                            Action Required: Deliver Advice
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Assessment Preview */}
                    <div style={{ background: '#f8fafc', padding: 14, borderRadius: 10, marginBottom: 16, fontSize: 14 }}>
                      <div style={{ fontWeight: 600, color: '#475569', fontSize: 12, textTransform: 'uppercase', marginBottom: 4 }}>
                        Clinical Assessment
                      </div>
                      <p style={{ margin: 0, color: '#0f172a' }}>{resp.assessment}</p>
                    </div>

                    {/* Prescription summary tags */}
                    {prescriptionsList.length > 0 && (
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#64748b', marginBottom: 6 }}>
                          <Pill size={14} color="#0284c7" />
                          <span>Prescribed Medications ({prescriptionsList.length}):</span>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {prescriptionsList.map((med, idx) => (
                            <span key={idx} className="tag" style={{ background: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe' }}>
                              {med.medicineName} • {med.dosage} ({med.frequency})
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap', borderTop: '1px solid #f1f5f9', paddingTop: 14 }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          setSelectedResponse(resp);
                          setShowPrescriptionModal(true);
                        }}
                      >
                        <Printer size={14} /> Print Prescription
                      </button>

                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setSelectedResponse(resp)}
                      >
                        <Eye size={14} /> View Full Assessment
                      </button>

                      {!resp.communicatedToPatient && (
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => handleMarkCommunicated(resp.id)}
                        >
                          <Check size={14} /> Mark as Communicated
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Full Details Modal */}
        {selectedResponse && !showPrescriptionModal && (
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
            <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 650, maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Doctor Assessment & Advice</h3>
                  <span style={{ fontSize: 13, color: '#64748b' }}>Consultation #{selectedResponse.consultationId}</span>
                </div>
                <button onClick={() => setSelectedResponse(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                  <X size={20} />
                </button>
              </div>

              <div style={{ padding: 24 }}>
                <div style={{ marginBottom: 18 }}>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: 13, color: '#64748b', textTransform: 'uppercase' }}>Clinical Assessment</h4>
                  <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, fontSize: 14, color: '#0f172a' }}>
                    {selectedResponse.assessment}
                  </div>
                </div>

                <div style={{ marginBottom: 18 }}>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: 13, color: '#64748b', textTransform: 'uppercase' }}>Recommendations & Clinical Interventions</h4>
                  <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, fontSize: 14, color: '#0f172a' }}>
                    {selectedResponse.recommendations || 'Standard rural clinic supportive care.'}
                  </div>
                </div>

                {/* Prescriptions */}
                {(selectedResponse.prescriptions || selectedResponse.prescription)?.length > 0 && (
                  <div style={{ marginBottom: 18 }}>
                    <h4 style={{ margin: '0 0 6px 0', fontSize: 13, color: '#64748b', textTransform: 'uppercase' }}>Medications</h4>
                    <table className="data-table" style={{ background: '#fff' }}>
                      <thead>
                        <tr>
                          <th>Medicine</th>
                          <th>Dosage</th>
                          <th>Frequency</th>
                          <th>Duration</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(selectedResponse.prescriptions || selectedResponse.prescription).map((med, idx) => (
                          <tr key={idx}>
                            <td style={{ fontWeight: 600 }}>{med.medicineName}</td>
                            <td>{med.dosage}</td>
                            <td>{med.frequency}</td>
                            <td>{med.duration}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Follow up & Referral */}
                <div style={{ marginBottom: 18 }}>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: 13, color: '#64748b', textTransform: 'uppercase' }}>Follow-up Instructions</h4>
                  <p style={{ margin: 0, fontSize: 14, color: '#0f172a' }}>
                    {selectedResponse.followUpInstructions || 'Review in 7 days or sooner if symptoms worsen.'}
                  </p>
                </div>

                {selectedResponse.referral?.recommended && (
                  <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: 12, marginBottom: 20 }}>
                    <div style={{ fontWeight: 700, color: '#b91c1c', fontSize: 13 }}>⚠️ Referral Recommended</div>
                    <div style={{ color: '#7f1d1d', fontSize: 13, marginTop: 4 }}>{selectedResponse.referral.details}</div>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button className="btn btn-secondary" onClick={() => setSelectedResponse(null)}>
                    Close
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={() => setShowPrescriptionModal(true)}
                  >
                    <Printer size={16} /> Open Prescription Slip
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Printable Prescription Modal */}
        {selectedResponse && showPrescriptionModal && (
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
            <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 680, padding: 32, boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
              {/* Slip Header */}
              <div style={{ borderBottom: '2px solid #0284c7', paddingBottom: 16, marginBottom: 20, display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <h2 style={{ margin: 0, color: '#0284c7', fontSize: 22, fontWeight: 800 }}>CareWave Telemedicine</h2>
                  <div style={{ fontSize: 12, color: '#64748b' }}>Rural Health Center Prescription Slip</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, color: '#0f172a' }}>{selectedResponse.doctorName}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>{selectedResponse.doctorSpecialty || 'General Medicine'}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>Reg: UP-MED-2015-4821</div>
                </div>
              </div>

              {/* Patient info row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', background: '#f8fafc', padding: 12, borderRadius: 8, marginBottom: 20, fontSize: 13 }}>
                <div>Patient: <strong>{selectedResponse.patientName || 'Patient'}</strong></div>
                <div>Case ID: <strong>{selectedResponse.consultationId}</strong></div>
                <div>Date: <strong>{new Date().toLocaleDateString()}</strong></div>
              </div>

              {/* Rx list */}
              <div style={{ marginBottom: 24 }}>
                <h4 style={{ fontSize: 18, fontWeight: 800, color: '#0284c7', margin: '0 0 12px 0' }}>Rx</h4>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                      <th style={{ padding: '8px 0' }}>Medicine</th>
                      <th style={{ padding: '8px 0' }}>Dose</th>
                      <th style={{ padding: '8px 0' }}>Frequency</th>
                      <th style={{ padding: '8px 0' }}>Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedResponse.prescriptions || selectedResponse.prescription || []).map((med, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 0', fontWeight: 600 }}>{med.medicineName}</td>
                        <td style={{ padding: '10px 0' }}>{med.dosage}</td>
                        <td style={{ padding: '10px 0' }}>{med.frequency}</td>
                        <td style={{ padding: '10px 0' }}>{med.duration}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Advice */}
              <div style={{ fontSize: 13, color: '#475569', marginBottom: 24, borderTop: '1px solid #e2e8f0', paddingTop: 12 }}>
                <strong>Advice / Instructions:</strong> {selectedResponse.recommendations || selectedResponse.assessment}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowPrescriptionModal(false)}
                >
                  Back
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => window.print()}
                >
                  <Printer size={16} /> Print Prescription
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
