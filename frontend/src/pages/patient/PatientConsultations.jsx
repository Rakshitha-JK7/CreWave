import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, FileText, MessageSquare, Eye, Clock, ArrowRight, X } from 'lucide-react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { useApp } from '../../context/AppContext';
import { mockConsultations } from '../../data/mockData';
import StatusBadge from '../../components/StatusBadge';
import { formatDate, formatDateTime } from '../../utils/formatDate';
import EmptyState from '../../components/EmptyState';

export default function PatientConsultations() {
  const navigate = useNavigate();
  const { currentUser } = useApp();

  const patientId = currentUser?.id || 'PAT001';
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedCase, setSelectedCase] = useState(null);

  const consultations = useMemo(() => {
    let list = mockConsultations;
    try {
      const stored = localStorage.getItem('carewave_consultations');
      if (stored) list = JSON.parse(stored);
    } catch (e) {}

    return list.filter((c) => c.patientId === patientId || c.patientName?.includes('Ravi Kumar'));
  }, [patientId]);

  const filtered = consultations.filter((c) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      c.id?.toLowerCase().includes(q) ||
      c.symptoms?.chiefComplaint?.toLowerCase().includes(q);

    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <DashboardLayout role="patient">
      <div style={{ maxWidth: 1100, margin: '0 auto', paddingBottom: 40 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0f172a' }}>My Consultations</h1>
            <p style={{ color: '#64748b', fontSize: 14 }}>
              Track all telemedicine visits, doctor evaluations, and prescriptions issued for your care.
            </p>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-body" style={{ padding: 16 }}>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 260, position: 'relative' }}>
                <Search size={18} color="#94a3b8" style={{ position: 'absolute', left: 12, top: 12 }} />
                <input
                  type="text"
                  className="form-control"
                  style={{ paddingLeft: 38 }}
                  placeholder="Search by case ID or symptom..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div style={{ width: 200 }}>
                <select className="form-control" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="all">All Statuses</option>
                  <option value="pending_upload">Pending Upload</option>
                  <option value="delivered">Delivered to Doctor</option>
                  <option value="under_review">Under Review</option>
                  <option value="response_available">Response Available</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Consultations List */}
        {filtered.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No consultations found"
            description="Your clinic visits and telemedicine consultations will be listed here."
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {filtered.map((c) => (
              <div key={c.id} className="card">
                <div className="card-body" style={{ padding: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                          {c.symptoms?.chiefComplaint || 'Consultation'}
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#0284c7', background: '#e0f2fe', padding: '2px 8px', borderRadius: 6 }}>
                          Case #{c.id}
                        </span>
                      </div>
                      <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
                        Recorded on: {formatDateTime(c.createdAt)} • Clinic: {c.clinicName || 'Rampur Primary Health Center'}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <StatusBadge status={c.urgency} type="urgency" />
                      <StatusBadge status={c.status} type="consultation" />
                    </div>
                  </div>

                  {/* Vitals snapshot */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, background: '#f8fafc', padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
                    <div>
                      <span style={{ color: '#64748b' }}>Blood Pressure: </span>
                      <strong>
                        {c.vitals?.bloodPressure?.systolic && c.vitals?.bloodPressure?.diastolic
                          ? `${c.vitals.bloodPressure.systolic}/${c.vitals.bloodPressure.diastolic} mmHg`
                          : 'Not measured'}
                      </strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>Heart Rate: </span>
                      <strong>{c.vitals?.heartRate?.value ? `${c.vitals.heartRate.value} bpm` : 'Not measured'}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>SpO2: </span>
                      <strong>{c.vitals?.spo2?.value ? `${c.vitals.spo2.value} %` : 'Not measured'}</strong>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setSelectedCase(c)}
                    >
                      <Eye size={14} /> View Details
                    </button>

                    {['response_available', 'completed'].includes(c.status) && (
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => navigate('/patient/advice')}
                      >
                        <MessageSquare size={14} /> View Doctor's Advice
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Details Modal */}
        {selectedCase && (
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
            <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 580, maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Consultation Record #{selectedCase.id}</h3>
                <button onClick={() => setSelectedCase(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                  <X size={20} />
                </button>
              </div>

              <div style={{ padding: 24 }}>
                <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, marginBottom: 16 }}>
                  <span style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase' }}>Symptoms</span>
                  <div style={{ fontWeight: 600, fontSize: 15, color: '#0f172a', marginTop: 4 }}>
                    {selectedCase.symptoms?.chiefComplaint}
                  </div>
                  <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
                    Duration: {selectedCase.symptoms?.duration} • Severity: {selectedCase.symptoms?.severity}
                  </div>
                </div>

                <div style={{ marginBottom: 20 }}>
                  <span style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase' }}>Current Transmission State</span>
                  <div style={{ marginTop: 6 }}>
                    <StatusBadge status={selectedCase.status} type="consultation" />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button className="btn btn-secondary" onClick={() => setSelectedCase(null)}>
                    Close
                  </button>
                  {['response_available', 'completed'].includes(selectedCase.status) && (
                    <button
                      className="btn btn-primary"
                      onClick={() => {
                        setSelectedCase(null);
                        navigate('/patient/advice');
                      }}
                    >
                      Open Doctor's Advice
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
