import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search,
  Filter,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock,
  ArrowUpDown,
  Eye,
  FileCheck,
  RotateCcw,
  Activity,
  Layers,
} from 'lucide-react';
import DashboardLayout from '../../layouts/DashboardLayout';
import doctorService from '../../services/doctorService';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import { formatDate, formatDateTime, formatRelative } from '../../utils/formatDate';

export default function IncomingConsultations() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialUrgencyFilter = searchParams.get('filter') || 'all';

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all, pending, under_review, reviewed, response_available
  const [urgencyFilter, setUrgencyFilter] = useState(initialUrgencyFilter); // all, critical, urgent, priority, routine
  const [dateFilter, setDateFilter] = useState('all'); // all, today, week, month

  const [consultations, setConsultations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function loadData() {
      try {
        const data = await doctorService.getDoctorConsultations();
        if (mounted) {
          setConsultations(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error('Failed to load doctor incoming consultations:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadData();
    return () => { mounted = false; };
  }, []);

  // Filter & sort logic: urgent cases sorted first by default
  const filteredConsultations = useMemo(() => {
    return consultations.filter((item) => {
      // Search
      const query = searchQuery.trim().toLowerCase();
      if (query) {
        const name = String(item.patientName || item.patient?.name || '').toLowerCase();
        const id = String(item.id || '').toLowerCase();
        const clinic = String(item.clinicName || '').toLowerCase();
        if (!name.includes(query) && !id.includes(query) && !clinic.includes(query)) return false;
      }

      // Status filter
      if (statusFilter !== 'all') {
        const s = item.status;
        if (statusFilter === 'pending') {
          if (!['delivered', 'available_to_doctor', 'pending_upload', 'partially_uploaded', 'pending'].includes(s)) return false;
        } else if (statusFilter === 'under_review') {
          if (!['under_review', 'in_review'].includes(s)) return false;
        } else if (statusFilter === 'reviewed') {
          if (!['response_available', 'response_submitted', 'completed', 'reviewed_by_doctor', 'response_received_by_clinic'].includes(s)) return false;
        } else if (statusFilter === 'response_available') {
          if (!['response_available', 'response_submitted', 'response_received_by_clinic'].includes(s)) return false;
        }
      }

      // Urgency filter
      if (urgencyFilter !== 'all') {
        const u = String(item.urgency || item.priority || 'normal').toLowerCase();
        if (urgencyFilter === 'critical') {
          if (!['critical', 'emergency'].includes(u)) return false;
        } else if (urgencyFilter === 'urgent') {
          if (!['urgent', 'critical', 'emergency', 'high'].includes(u)) return false;
        } else if (urgencyFilter === 'priority') {
          if (!['priority', 'medium', 'normal'].includes(u)) return false;
        } else if (urgencyFilter === 'routine') {
          if (!['routine', 'low', 'normal'].includes(u)) return false;
        } else if (u !== urgencyFilter.toLowerCase()) {
          return false;
        }
      }

      // Date filter
      if (dateFilter !== 'all') {
        const itemDate = new Date(item.receivedAt || item.createdAt);
        const now = new Date();
        if (dateFilter === 'today') {
          const isSameDay =
            itemDate.getDate() === now.getDate() &&
            itemDate.getMonth() === now.getMonth() &&
            itemDate.getFullYear() === now.getFullYear();
          if (!isSameDay) return false;
        } else if (dateFilter === 'week') {
          const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          if (itemDate < sevenDaysAgo) return false;
        } else if (dateFilter === 'month') {
          const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          if (itemDate < thirtyDaysAgo) return false;
        }
      }

      return true;
    }).sort((a, b) => {
      // Urgent and critical cases first
      const urgencyRank = { emergency: 5, critical: 4, urgent: 3, high: 3, priority: 2, normal: 2, routine: 1, low: 1 };
      const urgA = String(a.urgency || a.priority || 'normal').toLowerCase();
      const urgB = String(b.urgency || b.priority || 'normal').toLowerCase();
      const diff = (urgencyRank[urgB] || 0) - (urgencyRank[urgA] || 0);
      if (diff !== 0) return diff;
      return new Date(b.receivedAt || b.createdAt) - new Date(a.receivedAt || a.createdAt);
    });
  }, [consultations, searchQuery, statusFilter, urgencyFilter, dateFilter]);

  const handleResetFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setUrgencyFilter('all');
    setDateFilter('all');
    setSearchParams({});
  };

  return (
    <DashboardLayout role="doctor">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Page Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#0f172a' }}>
              Incoming Consultations
            </h1>
            <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '0.875rem' }}>
              Clinical triage queue received from rural clinics and health posts
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '0.825rem', color: '#475569', fontWeight: 600, backgroundColor: '#f1f5f9', padding: '6px 12px', borderRadius: 6 }}>
              Total: {filteredConsultations.length} {filteredConsultations.length === 1 ? 'case' : 'cases'}
            </span>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 12,
            padding: '16px 20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            border: '1px solid #e2e8f0',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          {/* Top Row: Search and quick reset */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 260 }}>
              <Search
                size={18}
                color="#94a3b8"
                style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}
              />
              <input
                type="text"
                placeholder="Search by patient name, consultation ID (e.g. CON001), or clinic..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px 9px 38px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  fontSize: '0.875rem',
                  color: '#1e293b',
                  boxSizing: 'border-box',
                  outline: 'none',
                }}
              />
            </div>

            {(searchQuery || statusFilter !== 'all' || urgencyFilter !== 'all' || dateFilter !== 'all') && (
              <button
                onClick={handleResetFilters}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#f8fafc',
                  color: '#475569',
                  fontSize: '0.825rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <RotateCcw size={14} />
                Reset Filters
              </button>
            )}
          </div>

          {/* Bottom Row: Filter Selects */}
          <div
            style={{
              display: 'flex',
              gap: 12,
              flexWrap: 'wrap',
              alignItems: 'center',
              borderTop: '1px solid #f1f5f9',
              paddingTop: 12,
            }}
          >
            {/* Status Select */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: '1px solid #cbd5e1',
                  fontSize: '0.825rem',
                  backgroundColor: '#ffffff',
                  color: '#334155',
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending Review</option>
                <option value="under_review">In Review</option>
                <option value="reviewed">Reviewed</option>
                <option value="response_available">Response Available</option>
              </select>
            </div>

            {/* Urgency Select */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>Urgency:</span>
              <select
                value={urgencyFilter}
                onChange={(e) => setUrgencyFilter(e.target.value)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: '1px solid #cbd5e1',
                  fontSize: '0.825rem',
                  backgroundColor: '#ffffff',
                  color: '#334155',
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                <option value="all">All Urgencies</option>
                <option value="critical">Critical</option>
                <option value="urgent">Urgent</option>
                <option value="priority">Priority</option>
                <option value="routine">Routine</option>
              </select>
            </div>

            {/* Date Range Select */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>Received:</span>
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: '1px solid #cbd5e1',
                  fontSize: '0.825rem',
                  backgroundColor: '#ffffff',
                  color: '#334155',
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                <option value="all">Anytime</option>
                <option value="today">Today</option>
                <option value="week">Past 7 Days</option>
                <option value="month">Past 30 Days</option>
              </select>
            </div>
          </div>
        </div>

        {/* Consultations Table */}
        {filteredConsultations.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="No consultations found"
            description="No consultations matched your active search and filter criteria. Try resetting filters."
            action={{
              label: 'Reset Filters',
              onClick: handleResetFilters,
            }}
          />
        ) : (
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: 12,
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
              border: '1px solid #e2e8f0',
              overflow: 'hidden',
            }}
          >
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 600 }}>
                    <th style={{ padding: '14px 18px' }}>Consultation ID</th>
                    <th style={{ padding: '14px 18px' }}>Patient Name</th>
                    <th style={{ padding: '14px 14px' }}>Age/Sex</th>
                    <th style={{ padding: '14px 16px' }}>Clinic</th>
                    <th style={{ padding: '14px 16px' }}>Received</th>
                    <th style={{ padding: '14px 14px' }}>Urgency</th>
                    <th style={{ padding: '14px 16px' }}>Transfer Status</th>
                    <th style={{ padding: '14px 16px' }}>Review Status</th>
                    <th style={{ padding: '14px 18px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredConsultations.map((item) => {
                    const urg = String(item.urgency || item.priority || 'normal').toLowerCase();
                    const isUrgent = ['critical', 'urgent', 'emergency', 'high'].includes(urg);
                    const isReviewed = ['response_available', 'response_submitted', 'completed', 'reviewed_by_doctor', 'response_received_by_clinic'].includes(item.status);
                    const progress = item.transferProgress || (item.status === 'delivered' ? 100 : item.status === 'partially_uploaded' ? 65 : 100);

                    return (
                      <tr
                        key={item.id}
                        style={{
                          borderBottom: '1px solid #f1f5f9',
                          backgroundColor: isUrgent ? '#fffafb' : 'transparent',
                          transition: 'background-color 0.15s',
                          cursor: 'pointer',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = isUrgent ? '#fef2f2' : '#f8fafc')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = isUrgent ? '#fffafb' : 'transparent')}
                        onClick={() => navigate(`/doctor/consultation/${item.id}`)}
                      >
                        {/* Consultation ID */}
                        <td style={{ padding: '14px 18px' }}>
                          <span
                            style={{
                              fontFamily: 'monospace',
                              fontWeight: 700,
                              color: '#0284c7',
                              backgroundColor: '#e0f2fe',
                              padding: '2px 8px',
                              borderRadius: 4,
                              fontSize: '0.825rem',
                            }}
                          >
                            {item.id}
                          </span>
                        </td>

                        {/* Patient Name */}
                        <td style={{ padding: '14px 18px' }}>
                          <div style={{ fontWeight: 600, color: '#0f172a' }}>{item.patientName || item.patient?.name || 'Patient'}</div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>ID: {item.patientId || item.patient?.id || item.patientReferenceId || '—'}</div>
                        </td>

                        {/* Age / Sex */}
                        <td style={{ padding: '14px 14px', color: '#334155' }}>
                          {item.patientAge || item.patient?.age || '—'}y / {item.patientSex || item.patient?.sex || '—'}
                        </td>

                        {/* Clinic */}
                        <td style={{ padding: '14px 16px', color: '#475569' }}>
                          <div>{item.clinicName || 'Rampur Primary Health Center'}</div>
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>HW: {item.healthWorkerName || 'Community Staff'}</div>
                        </td>

                        {/* Received */}
                        <td style={{ padding: '14px 16px', color: '#475569', whiteSpace: 'nowrap' }}>
                          <div>{formatDate(item.receivedAt || item.createdAt)}</div>
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                            {formatRelative(item.receivedAt || item.createdAt)}
                          </div>
                        </td>

                        {/* Urgency */}
                        <td style={{ padding: '14px 14px' }}>
                          <StatusBadge status={item.urgency || item.priority || 'normal'} type="urgency" />
                        </td>

                        {/* Transfer Status */}
                        <td style={{ padding: '14px 16px' }}>
                          {progress === 100 ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                                fontSize: '0.8rem',
                                fontWeight: 600,
                                color: '#16a34a',
                              }}
                            >
                              <CheckCircle size={14} color="#16a34a" />
                              Complete
                            </span>
                          ) : (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                                fontSize: '0.8rem',
                                fontWeight: 600,
                                color: '#d97706',
                              }}
                            >
                              <Clock size={14} color="#d97706" />
                              Partial ({progress}%)
                            </span>
                          )}
                        </td>

                        {/* Review Status */}
                        <td style={{ padding: '14px 16px' }}>
                          <StatusBadge status={item.status} type="consultation" />
                        </td>

                        {/* Actions */}
                        <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                          <div
                            style={{ display: 'inline-flex', gap: 6 }}
                            onClick={(e) => e.stopPropagation()}
                          >
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

                            <button
                              onClick={() => navigate(`/doctor/consultation/${item.id}`)}
                              title="View Details"
                              style={{
                                padding: '6px 10px',
                                fontSize: '0.8rem',
                                fontWeight: 600,
                                color: '#475569',
                                backgroundColor: '#f1f5f9',
                                border: '1px solid #cbd5e1',
                                borderRadius: 6,
                                cursor: 'pointer',
                              }}
                            >
                              Details
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}
