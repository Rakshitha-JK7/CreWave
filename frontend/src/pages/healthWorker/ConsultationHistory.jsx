import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, FileText, Filter, Eye, MessageSquare, Clock, ArrowRight, X } from 'lucide-react';
import DashboardLayout from '../../layouts/DashboardLayout';
import consultationService from '../../services/consultationService';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import LoadingSpinner from '../../components/LoadingSpinner';
import { formatDateTime } from '../../utils/formatDate';

export default function ConsultationHistory() {
  const navigate = useNavigate();
  const [consultations, setConsultations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [urgencyFilter, setUrgencyFilter] = useState('all');
  const [selectedConsultation, setSelectedConsultation] = useState(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const data = await consultationService.getConsultations();
        setConsultations(data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const filtered = consultations.filter((c) => {
    const q = searchQuery.toLowerCase();
    const complaint = c.mainComplaint || c.clinicalSummary?.mainComplaint || (typeof c.symptoms === 'object' ? c.symptoms?.chiefComplaint : c.symptoms) || '';
    const matchesSearch =
      c.id?.toLowerCase().includes(q) ||
      c.patientName?.toLowerCase().includes(q) ||
      c.patientId?.toLowerCase().includes(q) ||
      complaint.toLowerCase().includes(q);

    const matchesStatus = statusFilter === 'all' || c.status === statusFilter || (statusFilter === 'draft' && c.isDraft);
    const matchesUrgency = urgencyFilter === 'all' || c.urgency === urgencyFilter || c.priority === urgencyFilter;

    return matchesSearch && matchesStatus && matchesUrgency;
  });

  return (
    <DashboardLayout role="healthWorker">
      <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: 40 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0f172a' }}>Consultation History</h1>
            <p style={{ color: '#64748b', fontSize: 14 }}>Track all telemedicine cases, transmission lifecycle, and doctor review status</p>
          </div>
          <button
            className="btn btn-primary"
            onClick={() => navigate('/health-worker/new-consultation')}
          >
            Create New Consultation
          </button>
        </div>

        {/* Filter controls */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-body" style={{ padding: 16 }}>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 260, position: 'relative' }}>
                <Search size={18} color="#94a3b8" style={{ position: 'absolute', left: 12, top: 12 }} />
                <input
                  type="text"
                  className="form-control"
                  style={{ paddingLeft: 38 }}
                  placeholder="Search by ID, patient name, chief complaint..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div style={{ width: 180 }}>
                <select className="form-control" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="all">All Statuses</option>
                  <option value="draft">Draft</option>
                  <option value="pending_upload">Pending Upload</option>
                  <option value="uploading">Uploading</option>
                  <option value="partially_uploaded">Partial Upload</option>
                  <option value="delivered">Delivered</option>
                  <option value="under_review">Under Review</option>
                  <option value="response_available">Response Available</option>
                  <option value="completed">Completed</option>
                  <option value="failed">Failed</option>
                </select>
              </div>

              <div style={{ width: 150 }}>
                <select className="form-control" value={urgencyFilter} onChange={(e) => setUrgencyFilter(e.target.value)}>
                  <option value="all">All Urgency</option>
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* List Table */}
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center' }}>
            <LoadingSpinner size="lg" text="Loading consultation records..." />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No consultations found"
            description={searchQuery ? 'No cases match your filters' : 'Start a consultation to send patient vitals and symptoms to a doctor'}
            action={
              searchQuery
                ? { label: 'Clear Filters', onClick: () => { setSearchQuery(''); setStatusFilter('all'); setUrgencyFilter('all'); } }
                : { label: 'New Consultation', onClick: () => navigate('/health-worker/new-consultation') }
            }
          />
        ) : (
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Case ID</th>
                    <th>Patient</th>
                    <th>Chief Complaint</th>
                    <th>Recorded Date</th>
                    <th>Urgency</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 600, color: '#0284c7' }}>{c.id}</td>
                      <td>
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>{c.patientName}</div>
                        <div style={{ fontSize: 12, color: '#64748b' }}>{c.patientId}</div>
                      </td>
                      <td style={{ maxWidth: 220, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {c.mainComplaint || c.clinicalSummary?.mainComplaint || (typeof c.symptoms === 'object' ? c.symptoms?.chiefComplaint : c.symptoms) || 'General Consultation'}
                        {c.specialization && (
                          <div style={{ fontSize: 11, color: '#0284c7', fontWeight: 600 }}>Spec: {c.specialization}</div>
                        )}
                      </td>
                      <td style={{ fontSize: 13, color: '#64748b' }}>
                        {formatDateTime(c.createdAt)}
                      </td>
                      <td>
                        <StatusBadge status={c.urgency || c.priority} type="urgency" />
                      </td>
                      <td>
                        {c.isDraft ? (
                          <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: 6, fontSize: 12, fontWeight: 700, background: '#fef3c7', color: '#b45309' }}>
                            Draft (Saved Locally)
                          </span>
                        ) : (
                          <StatusBadge status={c.status} type="consultation" />
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          {c.isDraft ? (
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => navigate('/health-worker/new-consultation', { state: { draftId: c.id } })}
                              title="Resume Draft"
                            >
                              Resume
                            </button>
                          ) : (
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => setSelectedConsultation(c)}
                              title="View Case Summary"
                            >
                              <Eye size={14} /> View
                            </button>
                          )}
                          {(c.status === 'response_available' || c.status === 'completed') && (
                            <button
                              className="btn btn-success btn-sm"
                              onClick={() => navigate('/health-worker/responses')}
                              title="Doctor Response Ready"
                            >
                              <MessageSquare size={14} /> Advice
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Details Modal */}
        {selectedConsultation && (
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
            <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 640, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
              <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', sticky: 'top', background: '#fff' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Consultation #{selectedConsultation.id}</h3>
                  <span style={{ fontSize: 13, color: '#64748b' }}>Patient: {selectedConsultation.patientName} ({selectedConsultation.patientId})</span>
                </div>
                <button
                  onClick={() => setSelectedConsultation(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
                >
                  <X size={20} />
                </button>
              </div>

              <div style={{ padding: 24 }}>
                <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
                  <StatusBadge status={selectedConsultation.status} type="consultation" />
                  <StatusBadge status={selectedConsultation.urgency} type="urgency" />
                </div>

                <div style={{ background: '#f8fafc', padding: 16, borderRadius: 12, marginBottom: 16 }}>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: 14, color: '#64748b' }}>Chief Complaint</h4>
                  <p style={{ margin: 0, fontWeight: 600, color: '#0f172a' }}>{selectedConsultation.symptoms?.chiefComplaint}</p>
                  <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#475569' }}>
                    Duration: {selectedConsultation.symptoms?.duration} • Severity: {selectedConsultation.symptoms?.severity}
                  </p>
                </div>

                {/* Vitals Summary */}
                <div style={{ marginBottom: 16 }}>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: 14, color: '#64748b' }}>Recorded Vitals</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
                    <div style={{ background: '#f1f5f9', padding: 10, borderRadius: 8, fontSize: 12 }}>
                      <span style={{ color: '#64748b' }}>BP</span>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>
                        {selectedConsultation.vitals?.bloodPressure?.systolic && selectedConsultation.vitals?.bloodPressure?.diastolic
                          ? `${selectedConsultation.vitals.bloodPressure.systolic}/${selectedConsultation.vitals.bloodPressure.diastolic} mmHg`
                          : 'Not measured'}
                      </div>
                    </div>
                    <div style={{ background: '#f1f5f9', padding: 10, borderRadius: 8, fontSize: 12 }}>
                      <span style={{ color: '#64748b' }}>Heart Rate</span>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>
                        {selectedConsultation.vitals?.heartRate?.value ? `${selectedConsultation.vitals.heartRate.value} bpm` : 'Not measured'}
                      </div>
                    </div>
                    <div style={{ background: '#f1f5f9', padding: 10, borderRadius: 8, fontSize: 12 }}>
                      <span style={{ color: '#64748b' }}>Temperature</span>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>
                        {selectedConsultation.vitals?.temperature?.value ? `${selectedConsultation.vitals.temperature.value} °C` : 'Not measured'}
                      </div>
                    </div>
                    <div style={{ background: '#f1f5f9', padding: 10, borderRadius: 8, fontSize: 12 }}>
                      <span style={{ color: '#64748b' }}>SpO2</span>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>
                        {selectedConsultation.vitals?.spo2?.value ? `${selectedConsultation.vitals.spo2.value} %` : 'Not measured'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Attachments */}
                {selectedConsultation.attachments?.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: 14, color: '#64748b' }}>Attached Documents</h4>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {selectedConsultation.attachments.map((att, idx) => (
                        <li key={idx} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', fontSize: 13, display: 'flex', justifyContent: 'space-between' }}>
                          <span>{att.name || `Document #${idx + 1}`}</span>
                          <span style={{ color: '#64748b' }}>{att.size ? `${Math.round(att.size / 1024)} KB` : 'Attached'}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
                  <button className="btn btn-secondary" onClick={() => setSelectedConsultation(null)}>
                    Close
                  </button>
                  {selectedConsultation.status === 'pending_upload' && (
                    <button className="btn btn-primary" onClick={() => { setSelectedConsultation(null); navigate('/health-worker/pending-uploads'); }}>
                      View in Upload Queue
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
