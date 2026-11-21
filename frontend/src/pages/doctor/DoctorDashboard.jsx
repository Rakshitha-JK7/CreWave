import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Inbox,
  Clock,
  CheckCircle,
  Send,
  AlertTriangle,
  ArrowRight,
  Eye,
  Activity,
  FileCheck,
  Search,
  ChevronRight,
  UserCheck,
  Calendar,
} from 'lucide-react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { useApp } from '../../context/AppContext';
import { mockData } from '../../data/mockData';
import StatCard from '../../components/StatCard';
import StatusBadge from '../../components/StatusBadge';
import { formatDate, formatDateTime, formatRelative } from '../../utils/formatDate';

export default function DoctorDashboard() {
  const navigate = useNavigate();
  const { currentUser } = useApp() || {};

  // Retrieve consultations from localStorage if any, falling back to mockData
  const [consultations] = useState(() => {
    try {
      const stored = localStorage.getItem('carewave_consultations');
      return stored ? JSON.parse(stored) : mockData.consultations;
    } catch {
      return mockData.consultations;
    }
  });

  // Calculate metrics
  const incomingCount = consultations.filter((c) =>
    ['delivered', 'under_review', 'partially_uploaded'].includes(c.status)
  ).length;

  const pendingCount = consultations.filter((c) =>
    ['delivered', 'under_review', 'partially_uploaded', 'pending_upload'].includes(c.status)
  ).length;

  const reviewedCount = consultations.filter((c) =>
    ['response_available', 'completed'].includes(c.status)
  ).length;

  const responsesSentCount = mockData.responses.length;

  const urgentPendingCases = useMemo(() => {
    return consultations.filter(
      (c) =>
        ['urgent', 'critical'].includes(c.urgency) &&
        !['response_available', 'completed'].includes(c.status)
    );
  }, [consultations]);

  const urgentCount = urgentPendingCases.length;

  // Next case to review
  const nextCaseToReview = useMemo(() => {
    // Priority: critical > urgent > others, then by date
    const pending = [...consultations].filter(
      (c) => !['response_available', 'completed'].includes(c.status)
    );
    pending.sort((a, b) => {
      const urgencyRank = { critical: 3, urgent: 2, priority: 1, routine: 0 };
      const diff = (urgencyRank[b.urgency] || 0) - (urgencyRank[a.urgency] || 0);
      if (diff !== 0) return diff;
      return new Date(b.receivedAt || b.createdAt) - new Date(a.receivedAt || a.createdAt);
    });
    return pending[0] || null;
  }, [consultations]);

  // Recent 5 consultations
  const recentConsultations = useMemo(() => {
    return [...consultations]
      .sort((a, b) => new Date(b.receivedAt || b.createdAt) - new Date(a.receivedAt || a.createdAt))
      .slice(0, 5);
  }, [consultations]);

  return (
    <DashboardLayout role="doctor">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        
        {/* Welcome Doctor Banner */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 12,
            padding: '24px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 16,
            borderLeft: '5px solid #0284c7',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0284c7', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Telemedicine Portal
              </span>
              <span style={{ backgroundColor: '#e0f2fe', color: '#0369a1', fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: 999 }}>
                Doctor Station
              </span>
            </div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
              Welcome back, {mockData.doctor?.name || 'Dr. Anjali Mehta'}
            </h1>
            <p style={{ color: '#64748b', fontSize: '0.875rem', margin: '4px 0 0 0' }}>
              {mockData.doctor?.specialization} · {mockData.doctor?.hospital}
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {nextCaseToReview && (
              <button
                onClick={() => navigate(`/doctor/consultation/${nextCaseToReview.id}`)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  backgroundColor: '#0284c7',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 8,
                  padding: '10px 18px',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(2, 132, 199, 0.25)',
                }}
              >
                <Activity size={18} />
                Review Next Case
                <ArrowRight size={16} />
              </button>
            )}
            <button
              onClick={() => navigate('/doctor/incoming')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                backgroundColor: '#f1f5f9',
                color: '#334155',
                border: '1px solid #cbd5e1',
                borderRadius: 8,
                padding: '10px 16px',
                fontWeight: 600,
                fontSize: '0.875rem',
                cursor: 'pointer',
              }}
            >
              <Inbox size={18} />
              View All Incoming
            </button>
          </div>
        </div>

        {/* Urgent Cases Alert Box */}
        {urgentCount > 0 && (
          <div
            style={{
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderLeft: '5px solid #ef4444',
              borderRadius: 10,
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 14,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div
                style={{
                  backgroundColor: '#fee2e2',
                  borderRadius: '50%',
                  padding: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <AlertTriangle size={22} color="#dc2626" />
              </div>
              <div>
                <h4 style={{ margin: 0, color: '#991b1b', fontSize: '0.95rem', fontWeight: 700 }}>
                  ⚠️ {urgentCount} urgent case{urgentCount > 1 ? 's' : ''} require immediate attention
                </h4>
                <p style={{ margin: '2px 0 0 0', color: '#b91c1c', fontSize: '0.825rem' }}>
                  Critical/urgent patient cases arrived from rural health posts awaiting clinical triage.
                </p>
              </div>
            </div>

            <button
              onClick={() => navigate('/doctor/incoming?filter=urgent')}
              style={{
                backgroundColor: '#dc2626',
                color: '#ffffff',
                border: 'none',
                borderRadius: 6,
                padding: '8px 16px',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              View Urgent Queue
              <ArrowRight size={15} />
            </button>
          </div>
        )}

        {/* Stats Grid: 5 cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 16,
          }}
        >
          <StatCard
            title="Incoming Consultations"
            value={incomingCount}
            subtitle="Received from clinics"
            icon={Inbox}
            color="blue"
          />
          <StatCard
            title="Pending Reviews"
            value={pendingCount}
            subtitle="Awaiting doctor action"
            icon={Clock}
            color="orange"
          />
          <StatCard
            title="Reviewed Cases"
            value={reviewedCount}
            subtitle="Evaluated & completed"
            icon={CheckCircle}
            color="teal"
          />
          <StatCard
            title="Responses Sent"
            value={responsesSentCount}
            subtitle="Dispatched to clinics"
            icon={Send}
            color="green"
          />
          <StatCard
            title="Urgent Cases"
            value={urgentCount}
            subtitle="High triage priority"
            icon={AlertTriangle}
            color="red"
          />
        </div>

        {/* Quick Links Row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 14,
          }}
        >
          <div
            onClick={() => nextCaseToReview && navigate(`/doctor/consultation/${nextCaseToReview.id}`)}
            style={{
              backgroundColor: '#ffffff',
              borderRadius: 10,
              padding: '16px 20px',
              border: '1px solid #e2e8f0',
              cursor: nextCaseToReview ? 'pointer' : 'default',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              transition: 'transform 0.15s, box-shadow 0.15s',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ backgroundColor: '#e0f2fe', padding: 10, borderRadius: 8 }}>
                <Activity size={20} color="#0284c7" />
              </div>
              <div>
                <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.9rem' }}>Review Next Case</div>
                <div style={{ color: '#64748b', fontSize: '0.775rem' }}>
                  {nextCaseToReview ? `${nextCaseToReview.patientName} (${nextCaseToReview.id})` : 'Queue empty'}
                </div>
              </div>
            </div>
            <ChevronRight size={18} color="#94a3b8" />
          </div>

          <div
            onClick={() => navigate('/doctor/incoming')}
            style={{
              backgroundColor: '#ffffff',
              borderRadius: 10,
              padding: '16px 20px',
              border: '1px solid #e2e8f0',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ backgroundColor: '#fef3c7', padding: 10, borderRadius: 8 }}>
                <Inbox size={20} color="#d97706" />
              </div>
              <div>
                <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.9rem' }}>View All Incoming</div>
                <div style={{ color: '#64748b', fontSize: '0.775rem' }}>{incomingCount} consultations in queue</div>
              </div>
            </div>
            <ChevronRight size={18} color="#94a3b8" />
          </div>

          <div
            onClick={() => navigate('/doctor/reviewed')}
            style={{
              backgroundColor: '#ffffff',
              borderRadius: 10,
              padding: '16px 20px',
              border: '1px solid #e2e8f0',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ backgroundColor: '#ccfbf1', padding: 10, borderRadius: 8 }}>
                <CheckCircle size={20} color="#0f766e" />
              </div>
              <div>
                <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.9rem' }}>Reviewed Cases</div>
                <div style={{ color: '#64748b', fontSize: '0.775rem' }}>History & signed responses</div>
              </div>
            </div>
            <ChevronRight size={18} color="#94a3b8" />
          </div>
        </div>

        {/* Recent Consultations Table */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 12,
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            border: '1px solid #e2e8f0',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '18px 24px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
                Recent Consultations
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                Latest 5 patient cases sent from connected rural centers
              </p>
            </div>
            <button
              onClick={() => navigate('/doctor/incoming')}
              style={{
                backgroundColor: 'transparent',
                border: '1px solid #cbd5e1',
                borderRadius: 6,
                padding: '6px 14px',
                fontSize: '0.825rem',
                fontWeight: 600,
                color: '#0284c7',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              See Full Registry
              <ArrowRight size={14} />
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 600 }}>
                  <th style={{ padding: '14px 20px' }}>Patient</th>
                  <th style={{ padding: '14px 16px' }}>Age/Sex</th>
                  <th style={{ padding: '14px 16px' }}>Urgency</th>
                  <th style={{ padding: '14px 16px' }}>Received</th>
                  <th style={{ padding: '14px 16px' }}>Data Completeness</th>
                  <th style={{ padding: '14px 16px' }}>Status</th>
                  <th style={{ padding: '14px 20px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {recentConsultations.map((item) => {
                  const progress = item.transferProgress || (item.status === 'delivered' ? 100 : item.status === 'partially_uploaded' ? 65 : 100);
                  const isReviewed = ['response_available', 'completed'].includes(item.status);

                  return (
                    <tr
                      key={item.id}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        transition: 'background-color 0.15s',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      onClick={() => navigate(`/doctor/consultation/${item.id}`)}
                    >
                      {/* Patient */}
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>{item.patientName}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          {item.id} · {item.clinicName}
                        </div>
                      </td>

                      {/* Age / Sex */}
                      <td style={{ padding: '14px 16px', color: '#334155' }}>
                        {item.patientAge}y / {item.patientSex}
                      </td>

                      {/* Urgency */}
                      <td style={{ padding: '14px 16px' }}>
                        <StatusBadge status={item.urgency} type="urgency" />
                      </td>

                      {/* Received */}
                      <td style={{ padding: '14px 16px', color: '#475569', whiteSpace: 'nowrap' }}>
                        <div>{formatDate(item.receivedAt || item.createdAt)}</div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                          {formatRelative(item.receivedAt || item.createdAt)}
                        </div>
                      </td>

                      {/* Completeness */}
                      <td style={{ padding: '14px 16px', minWidth: 140 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: progress === 100 ? '#16a34a' : '#d97706' }}>
                            {progress === 100 ? '100% Complete' : `Partial (${progress}%)`}
                          </span>
                        </div>
                        <div style={{ width: '100%', height: 6, backgroundColor: '#e2e8f0', borderRadius: 999, overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${progress}%`,
                              height: '100%',
                              backgroundColor: progress === 100 ? '#22c55e' : '#f59e0b',
                              borderRadius: 999,
                            }}
                          />
                        </div>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '14px 16px' }}>
                        <StatusBadge status={item.status} type="consultation" />
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 6 }} onClick={(e) => e.stopPropagation()}>
                          {isReviewed ? (
                            <button
                              onClick={() => navigate(`/doctor/consultation/${item.id}`)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '6px 12px',
                                fontSize: '0.8rem',
                                fontWeight: 600,
                                color: '#047857',
                                backgroundColor: '#ecfdf5',
                                border: '1px solid #a7f3d0',
                                borderRadius: 6,
                                cursor: 'pointer',
                              }}
                            >
                              <FileCheck size={14} />
                              View Response
                            </button>
                          ) : (
                            <button
                              onClick={() => navigate(`/doctor/consultation/${item.id}`)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '6px 12px',
                                fontSize: '0.8rem',
                                fontWeight: 600,
                                color: '#ffffff',
                                backgroundColor: '#0284c7',
                                border: 'none',
                                borderRadius: 6,
                                cursor: 'pointer',
                              }}
                            >
                              <Eye size={14} />
                              Review
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}
