import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  FileText,
  Clock,
  MessageSquare,
  UserPlus,
  FilePlus,
  Wifi,
  ChevronRight,
} from 'lucide-react';
import DashboardLayout from '../../layouts/DashboardLayout';
import StatCard from '../../components/StatCard';
import StatusBadge from '../../components/StatusBadge';
import { useApp } from '../../context/AppContext';
import { formatDate, formatDateTime } from '../../utils/formatDate';
import patientService from '../../services/patientService';
import consultationService from '../../services/consultationService';
import useNetworkStatus from '../../hooks/useNetworkStatus';

export default function HealthWorkerDashboard() {
  const navigate = useNavigate();
  const { addNotification } = useApp();
  const { isOnline, effectiveType } = useNetworkStatus();

  const [patients, setPatients] = useState([]);
  const [consultations, setConsultations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function loadData() {
      try {
        const [pts, cons] = await Promise.all([
          patientService.getPatients().catch(() => []),
          consultationService.getConsultations().catch(() => []),
        ]);
        if (mounted) {
          setPatients(Array.isArray(pts) ? pts : []);
          setConsultations(Array.isArray(cons) ? cons : []);
        }
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadData();
    return () => { mounted = false; };
  }, []);

  const totalPatients = patients.length;
  const totalConsultations = consultations.length;
  const pendingUploads = consultations.filter((c) =>
    ['pending_upload', 'uploading', 'partially_uploaded'].includes(c.transferStatus || c.status)
  ).length;
  const responsesReceived = consultations.filter((c) =>
    ['response_available', 'completed'].includes(c.status)
  ).length;

  const recentConsultations = [...consultations]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5);

  const getPatientName = (patientId) => {
    const p = patients.find((pt) => pt.id === patientId || pt.referenceId === patientId);
    return p ? (p.name || p.referenceId) : (patientId || 'Unknown Patient');
  };

  const statCards = [
    {
      label: 'Total Patients',
      value: totalPatients,
      icon: Users,
      color: '#2563eb',
      bgColor: '#dbeafe',
    },
    {
      label: 'Total Consultations',
      value: totalConsultations,
      icon: FileText,
      color: '#0d9488',
      bgColor: '#ccfbf1',
    },
    {
      label: 'Pending Uploads',
      value: pendingUploads,
      icon: Clock,
      color: '#d97706',
      bgColor: '#fef3c7',
    },
    {
      label: 'Responses Received',
      value: responsesReceived,
      icon: MessageSquare,
      color: '#16a34a',
      bgColor: '#dcfce7',
    },
  ];

  const quickActions = [
    {
      icon: UserPlus,
      label: 'Register New Patient',
      desc: 'Add a new patient to the system',
      path: '/health-worker/register-patient',
      color: '#2563eb',
      bg: '#dbeafe',
    },
    {
      icon: FilePlus,
      label: 'New Consultation',
      desc: 'Start a consultation for a patient',
      path: '/health-worker/new-consultation',
      color: '#0d9488',
      bg: '#ccfbf1',
    },
    {
      icon: Clock,
      label: 'View Pending Uploads',
      desc: 'Manage offline queue and sync status',
      path: '/health-worker/pending-uploads',
      color: '#d97706',
      bg: '#fef3c7',
    },
    {
      icon: Wifi,
      label: 'Network Monitor',
      desc: 'Check connection quality and sync history',
      path: '/health-worker/network',
      color: '#7c3aed',
      bg: '#f3e8ff',
    },
  ];

  return (
    <DashboardLayout role="healthWorker">
      <div style={{ padding: '0 0 2rem' }}>
        {/* Welcome banner */}
        <div
          style={{
            background: 'linear-gradient(135deg, #1e40af 0%, #0369a1 100%)',
            borderRadius: 16,
            padding: '1.5rem 2rem',
            color: '#fff',
            marginBottom: '1.75rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '0 0 0.3rem' }}>
              Health Worker Dashboard
            </h1>
            <p style={{ fontSize: '0.9rem', opacity: 0.85, margin: 0 }}>
              Manage patients, consultations, and sync status from one place.
            </p>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: 'rgba(255,255,255,0.15)',
              padding: '0.5rem 1rem',
              borderRadius: 999,
              fontSize: '0.85rem',
              fontWeight: 600,
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: isOnline ? '#4ade80' : '#f87171',
                display: 'inline-block',
              }}
            />
            {isOnline ? `Online (${effectiveType || '—'})` : 'Offline'}
          </div>
        </div>

        {/* Stats */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            marginBottom: '2rem',
          }}
        >
          {statCards.map((s) => (
            <StatCard
              key={s.label}
              label={s.label}
              value={s.value}
              icon={s.icon}
              color={s.color}
              bgColor={s.bgColor}
            />
          ))}
        </div>

        {/* Quick Actions */}
        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', margin: '0 0 1rem' }}>
            Quick Actions
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '1rem',
            }}
          >
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.label}
                  onClick={() => navigate(action.path)}
                  style={{
                    background: '#fff',
                    border: '1.5px solid #e2e8f0',
                    borderRadius: 14,
                    padding: '1.25rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    textAlign: 'left',
                    transition: 'all 0.2s',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = action.color;
                    e.currentTarget.style.boxShadow = `0 4px 16px rgba(0,0,0,0.1)`;
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#e2e8f0';
                    e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.05)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      background: action.bg,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Icon size={22} color={action.color} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1e293b' }}>
                      {action.label}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 2 }}>
                      {action.desc}
                    </div>
                  </div>
                  <ChevronRight size={16} color="#94a3b8" />
                </button>
              );
            })}
          </div>
        </div>

        {/* Recent Activity */}
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1rem',
            }}
          >
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>
              Recent Consultations
            </h2>
            <button
              onClick={() => navigate('/health-worker/consultations')}
              style={{
                background: 'none',
                border: 'none',
                color: '#2563eb',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '0.9rem',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              View All <ChevronRight size={15} />
            </button>
          </div>

          <div
            style={{
              background: '#fff',
              borderRadius: 14,
              border: '1.5px solid #e2e8f0',
              overflow: 'hidden',
              boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
            }}
          >
            {recentConsultations.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                No consultations yet. Create your first one!
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    {['Patient', 'Consultation ID', 'Date', 'Status', 'Urgency', 'Actions'].map(
                      (h) => (
                        <th
                          key={h}
                          style={{
                            padding: '0.75rem 1rem',
                            textAlign: 'left',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            color: '#64748b',
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                          }}
                        >
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {recentConsultations.map((c, i) => (
                    <tr
                      key={c.id}
                      style={{
                        borderBottom: i < recentConsultations.length - 1 ? '1px solid #f1f5f9' : 'none',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#f8fafc'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <td style={{ padding: '0.85rem 1rem', fontWeight: 600, color: '#1e293b', fontSize: '0.9rem' }}>
                        {getPatientName(c.patientId)}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: '#64748b', fontSize: '0.85rem', fontFamily: 'monospace' }}>
                        {c.id}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: '#64748b', fontSize: '0.85rem' }}>
                        {c.createdAt ? formatDate(c.createdAt) : '—'}
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <StatusBadge status={c.status} type="consultation" />
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <StatusBadge status={c.urgency} type="urgency" />
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <button
                          onClick={() => navigate('/health-worker/consultations')}
                          style={{
                            padding: '0.35rem 0.85rem',
                            borderRadius: 8,
                            border: '1.5px solid #e2e8f0',
                            background: '#fff',
                            color: '#2563eb',
                            fontWeight: 600,
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                          }}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
