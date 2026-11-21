import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Activity, CheckCircle, MessageSquare, Clock, ArrowRight, User, AlertCircle, Heart } from 'lucide-react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { useAuth } from '../../context/AuthContext';
import consultationService from '../../services/consultationService';
import StatCard from '../../components/StatCard';
import StatusBadge from '../../components/StatusBadge';
import { formatDate, formatDateTime } from '../../utils/formatDate';

export default function PatientDashboard() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const patientId = currentUser?.patientId || currentUser?.referenceId || currentUser?.id || 'PAT001';
  const patientName = currentUser?.name || 'Patient';

  const [consultations, setConsultations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function loadPatientConsultations() {
      try {
        const data = await consultationService.getConsultations();
        if (mounted && Array.isArray(data)) {
          const myCons = data.filter(
            (c) => c.patientId === patientId || c.patientName?.toLowerCase().includes(patientName.toLowerCase())
          );
          setConsultations(myCons);
        }
      } catch (err) {
        console.warn('Failed to load patient consultations:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadPatientConsultations();
    return () => { mounted = false; };
  }, [patientId, patientName]);

  const ongoingCount = consultations.filter((c) =>
    ['pending_upload', 'uploading', 'partially_uploaded', 'delivered', 'under_review', 'pending'].includes(c.status)
  ).length;

  const completedCount = consultations.filter((c) =>
    ['response_available', 'completed'].includes(c.status)
  ).length;

  const latestConsultation = consultations[0] || null;

  return (
    <DashboardLayout role="patient">
      <div style={{ maxWidth: 1100, margin: '0 auto', paddingBottom: 40 }}>
        {/* Welcome Banner */}
        <div
          style={{
            background: 'linear-gradient(135deg, #0284c7 0%, #0d9488 100%)',
            color: '#fff',
            borderRadius: 16,
            padding: '24px 28px',
            marginBottom: 24,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 16,
            boxShadow: '0 4px 14px rgba(2, 132, 199, 0.25)',
          }}
        >
          <div>
            <div style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.9 }}>
              Patient Portal • CareWave Telemedicine
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 800, margin: '4px 0 6px 0' }}>
              Welcome back, {patientName}
            </h1>
            <p style={{ margin: 0, opacity: 0.9, fontSize: 14 }}>
              Patient ID: <strong>{patientId}</strong> • Village: Rampur • Blood Group: B+
            </p>
          </div>

          <button
            className="btn btn-secondary"
            onClick={() => navigate('/patient/profile')}
            style={{ backgroundColor: '#fff', color: '#0f172a', fontWeight: 600, border: 'none' }}
          >
            <User size={16} /> View Profile
          </button>
        </div>

        {/* Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 28 }}>
          <StatCard
            title="Total Consultations"
            value={consultations.length}
            icon={FileText}
            color="blue"
            subtitle="Lifetime clinic visits"
          />
          <StatCard
            title="In Progress"
            value={ongoingCount}
            icon={Activity}
            color="orange"
            subtitle="Under doctor review"
          />
          <StatCard
            title="Completed"
            value={completedCount}
            icon={CheckCircle}
            color="green"
            subtitle="With final doctor advice"
          />
          <StatCard
            title="Prescriptions Ready"
            value={completedCount}
            icon={MessageSquare}
            color="teal"
            subtitle="Available for download"
          />
        </div>

        {/* Latest Consultation Tracker (Transmission & Review Lifecycle) */}
        {latestConsultation && (
          <div className="card" style={{ marginBottom: 28 }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Activity size={18} color="#0284c7" />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Latest Consultation Progress</h3>
              </div>
              <span style={{ fontSize: 13, color: '#64748b' }}>
                Case #{latestConsultation.id} • {formatDate(latestConsultation.createdAt)}
              </span>
            </div>
            <div className="card-body">
              <div style={{ marginBottom: 16 }}>
                <h4 style={{ margin: '0 0 4px 0', fontSize: 15, fontWeight: 600, color: '#0f172a' }}>
                  {latestConsultation.symptoms?.chiefComplaint || 'Consultation at Rural Clinic'}
                </h4>
                <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                  <StatusBadge status={latestConsultation.status} type="consultation" />
                  <StatusBadge status={latestConsultation.urgency} type="urgency" />
                </div>
              </div>

              {/* Progress Stepper */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: 12,
                  marginTop: 20,
                  textAlign: 'center',
                }}
              >
                <div style={{ padding: 12, borderRadius: 8, background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                  <div style={{ color: '#16a34a', fontWeight: 700, fontSize: 13 }}>1. Saved at Clinic</div>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Vitals Recorded</div>
                </div>
                <div
                  style={{
                    padding: 12,
                    borderRadius: 8,
                    background: ['delivered', 'under_review', 'response_available', 'completed'].includes(latestConsultation.status)
                      ? '#f0fdf4'
                      : '#fef3c7',
                    border: `1px solid ${['delivered', 'under_review', 'response_available', 'completed'].includes(latestConsultation.status)
                      ? '#bbf7d0'
                      : '#fde68a'
                      }`,
                  }}
                >
                  <div
                    style={{
                      color: ['delivered', 'under_review', 'response_available', 'completed'].includes(latestConsultation.status)
                        ? '#16a34a'
                        : '#b45309',
                      fontWeight: 700,
                      fontSize: 13,
                    }}
                  >
                    2. 2G Transmission
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Delivered to Hospital</div>
                </div>
                <div
                  style={{
                    padding: 12,
                    borderRadius: 8,
                    background: ['under_review', 'response_available', 'completed'].includes(latestConsultation.status)
                      ? '#f0fdf4'
                      : '#f1f5f9',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <div
                    style={{
                      color: ['under_review', 'response_available', 'completed'].includes(latestConsultation.status)
                        ? '#16a34a'
                        : '#64748b',
                      fontWeight: 700,
                      fontSize: 13,
                    }}
                  >
                    3. Doctor Review
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Specialist Review</div>
                </div>
                <div
                  style={{
                    padding: 12,
                    borderRadius: 8,
                    background: ['response_available', 'completed'].includes(latestConsultation.status)
                      ? '#f0fdf4'
                      : '#f1f5f9',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <div
                    style={{
                      color: ['response_available', 'completed'].includes(latestConsultation.status)
                        ? '#16a34a'
                        : '#64748b',
                      fontWeight: 700,
                      fontSize: 13,
                    }}
                  >
                    4. Advice Ready
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Prescription Issued</div>
                </div>
              </div>

              {['response_available', 'completed'].includes(latestConsultation.status) && (
                <div style={{ marginTop: 20, textAlign: 'right' }}>
                  <button
                    className="btn btn-primary"
                    onClick={() => navigate('/patient/advice')}
                  >
                    <MessageSquare size={16} /> View Doctor's Advice & Prescription
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Recent Consultations List */}
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>My Consultation History</h3>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => navigate('/patient/consultations')}
              style={{ display: 'flex', alignItems: 'center', gap: 4 }}
            >
              View All <ArrowRight size={14} />
            </button>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Consultation ID</th>
                    <th>Date</th>
                    <th>Clinic / Healthcare Worker</th>
                    <th>Chief Complaint</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {myConsultations.map((c) => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 600, color: '#0284c7' }}>{c.id}</td>
                      <td style={{ fontSize: 13, color: '#64748b' }}>{formatDate(c.createdAt)}</td>
                      <td>{c.clinicName || 'Rampur Primary Health Center'}</td>
                      <td>{c.symptoms?.chiefComplaint || 'Consultation'}</td>
                      <td>
                        <StatusBadge status={c.status} type="consultation" />
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          {['response_available', 'completed'].includes(c.status) ? (
                            <button
                              className="btn btn-success btn-sm"
                              onClick={() => navigate('/patient/advice')}
                            >
                              View Advice
                            </button>
                          ) : (
                            <span style={{ fontSize: 12, color: '#94a3b8' }}>Awaiting review</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
