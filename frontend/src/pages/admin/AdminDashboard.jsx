import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  Users,
  CheckCircle,
  CheckCircle2,
  XCircle,
  Clock,
  Activity,
  LogOut,
  RefreshCw,
  Search,
  Filter,
  AlertTriangle,
  Hospital,
  Stethoscope,
  UserCheck,
} from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import LoadingSpinner from '../../components/LoadingSpinner';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();

  const [stats, setStats] = useState(null);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [allConsultations, setAllConsultations] = useState([]);
  const [allPatients, setAllPatients] = useState([]);
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'users' | 'consultations' | 'patients'
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [consultationSearchTerm, setConsultationSearchTerm] = useState('');
  const [patientSearchTerm, setPatientSearchTerm] = useState('');
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, pendingRes, usersRes, consRes, patientsRes] = await Promise.all([
        api.get('/admin/stats').catch(() => ({ data: { data: {} } })),
        api.get('/admin/pending-users').catch(() => ({ data: { data: [] } })),
        api.get('/admin/users').catch(() => ({ data: { data: [] } })),
        api.get('/consultations').catch(() => ({ data: { data: [] } })),
        api.get('/patients').catch(() => ({ data: { data: [] } })),
      ]);

      setStats(statsRes.data?.data || {});
      setPendingUsers(pendingRes.data?.data || []);
      setAllUsers(usersRes.data?.data || []);
      setAllConsultations(Array.isArray(consRes.data) ? consRes.data : (consRes.data?.data || []));
      setAllPatients(Array.isArray(patientsRes.data) ? patientsRes.data : (patientsRes.data?.data || []));
    } catch (err) {
      console.error('Error loading admin dashboard data:', err);
      showToast('Could not refresh admin data. Check network connection.', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleApprove = async (id, userName) => {
    setActionLoadingId(id);
    try {
      const res = await api.patch(`/admin/users/${id}/approve`);
      if (res.data?.success) {
        showToast(`Account approved for ${userName || 'user'}. They may now sign in.`);
        // Optimistically update lists
        setPendingUsers((prev) => prev.filter((u) => u.id !== id));
        setAllUsers((prev) =>
          prev.map((u) => (u.id === id ? { ...u, status: 'active' } : u))
        );
        // Refresh counts
        setStats((prev) => prev ? {
          ...prev,
          pendingApprovals: Math.max(0, (prev.pendingApprovals || 1) - 1),
          activeUsers: (prev.activeUsers || 0) + 1,
        } : null);
      }
    } catch (err) {
      showToast(err.response?.data?.message || err.message || 'Approval failed.', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReject = async (id, userName) => {
    if (!window.confirm(`Are you sure you want to reject registration for ${userName || 'this user'}?`)) {
      return;
    }

    setActionLoadingId(id);
    try {
      const res = await api.patch(`/admin/users/${id}/reject`, { reason: 'Credentials unverified' });
      if (res.data?.success) {
        showToast(`Registration rejected for ${userName || 'user'}.`, 'info');
        setPendingUsers((prev) => prev.filter((u) => u.id !== id));
        setAllUsers((prev) =>
          prev.map((u) => (u.id === id ? { ...u, status: 'rejected' } : u))
        );
        setStats((prev) => prev ? {
          ...prev,
          pendingApprovals: Math.max(0, (prev.pendingApprovals || 1) - 1),
        } : null);
      }
    } catch (err) {
      showToast(err.response?.data?.message || err.message || 'Rejection failed.', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const filteredUsers = allUsers.filter((u) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      u.name?.toLowerCase().includes(term) ||
      u.username?.toLowerCase().includes(term) ||
      u.email?.toLowerCase().includes(term) ||
      u.role?.toLowerCase().includes(term) ||
      u.status?.toLowerCase().includes(term)
    );
  });

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f8fafc',
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Top Navigation Bar */}
      <header
        style={{
          background: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          padding: '1rem 2rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 40,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #1e293b, #0f172a)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ShieldCheck size={24} color="#38bdf8" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              CareWave Administration
            </h1>
            <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
              Security, Role Approvals & Clinical Governance
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1e293b' }}>
              {currentUser?.name || 'Administrator'}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#0284c7', fontWeight: 600 }}>System Admin</div>
          </div>
          <button
            type="button"
            onClick={loadData}
            style={{
              padding: '0.5rem 0.75rem',
              borderRadius: 8,
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#334155',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: '0.85rem',
              fontWeight: 600,
            }}
          >
            <RefreshCw size={15} />
            Refresh
          </button>
          <button
            type="button"
            onClick={handleLogout}
            style={{
              padding: '0.5rem 0.85rem',
              borderRadius: 8,
              border: '1px solid #fecaca',
              background: '#fef2f2',
              color: '#dc2626',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: '0.85rem',
              fontWeight: 600,
            }}
          >
            <LogOut size={15} />
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main style={{ maxWidth: 1200, margin: '2rem auto', padding: '0 1.5rem' }}>
        {/* Toast Notification */}
        {toast && (
          <div
            style={{
              position: 'fixed',
              top: '5rem',
              right: '2rem',
              padding: '0.85rem 1.25rem',
              borderRadius: 12,
              background: toast.type === 'error' ? '#fef2f2' : '#f0fdf4',
              border: toast.type === 'error' ? '1px solid #fca5a5' : '1px solid #86efac',
              color: toast.type === 'error' ? '#991b1b' : '#166534',
              boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              zIndex: 999,
              fontWeight: 600,
              fontSize: '0.9rem',
            }}
          >
            {toast.type === 'error' ? <AlertTriangle size={18} /> : <CheckCircle size={18} />}
            {toast.message}
          </div>
        )}

        {/* Stats Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1rem',
            marginBottom: '2rem',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: 14,
              padding: '1.25rem',
              border: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: '#fef3c7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Clock size={24} color="#d97706" />
            </div>
            <div>
              <div style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}>Pending Approvals</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a' }}>
                {stats?.pendingApprovals ?? pendingUsers.length}
              </div>
            </div>
          </div>

          <div
            style={{
              background: '#ffffff',
              borderRadius: 14,
              padding: '1.25rem',
              border: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: '#dbeafe',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Users size={24} color="#2563eb" />
            </div>
            <div>
              <div style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}>Total Accounts</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a' }}>
                {stats?.totalUsers ?? allUsers.length}
              </div>
            </div>
          </div>

          <div
            style={{
              background: '#ffffff',
              borderRadius: 14,
              padding: '1.25rem',
              border: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: '#e0e7ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Stethoscope size={24} color="#4f46e5" />
            </div>
            <div>
              <div style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}>Doctors / HW</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a' }}>
                {(stats?.doctors || 0) + (stats?.healthWorkers || 0)}
              </div>
            </div>
          </div>

          <div
            style={{
              background: '#ffffff',
              borderRadius: 14,
              padding: '1.25rem',
              border: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: '#dcfce7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Activity size={24} color="#16a34a" />
            </div>
            <div>
              <div style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}>Consultations</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a' }}>
                {stats?.totalConsultations ?? '—'}
              </div>
            </div>
          </div>
        </div>

        {/* Tab Controls */}
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setActiveTab('pending')}
            style={{
              padding: '0.65rem 1.25rem',
              borderRadius: 10,
              border: 'none',
              background: activeTab === 'pending' ? '#0f172a' : '#e2e8f0',
              color: activeTab === 'pending' ? '#ffffff' : '#475569',
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            Pending Verifications
            {pendingUsers.length > 0 && (
              <span
                style={{
                  background: '#ef4444',
                  color: '#ffffff',
                  fontSize: '0.75rem',
                  padding: '0.1rem 0.45rem',
                  borderRadius: 10,
                }}
              >
                {pendingUsers.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('users')}
            style={{
              padding: '0.65rem 1.25rem',
              borderRadius: 10,
              border: 'none',
              background: activeTab === 'users' ? '#0f172a' : '#e2e8f0',
              color: activeTab === 'users' ? '#ffffff' : '#475569',
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: 'pointer',
            }}
          >
            All Accounts Directory ({allUsers.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('consultations')}
            style={{
              padding: '0.65rem 1.25rem',
              borderRadius: 10,
              border: 'none',
              background: activeTab === 'consultations' ? '#0f172a' : '#e2e8f0',
              color: activeTab === 'consultations' ? '#ffffff' : '#475569',
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: 'pointer',
            }}
          >
            Clinical Consultations ({allConsultations.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('patients')}
            style={{
              padding: '0.65rem 1.25rem',
              borderRadius: 10,
              border: 'none',
              background: activeTab === 'patients' ? '#0f172a' : '#e2e8f0',
              color: activeTab === 'patients' ? '#ffffff' : '#475569',
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: 'pointer',
            }}
          >
            Registered Patients ({allPatients.length})
          </button>
        </div>

        {/* Section: Pending Verifications */}
        {activeTab === 'pending' && (
          <div
            style={{
              background: '#ffffff',
              borderRadius: 16,
              border: '1px solid #e2e8f0',
              overflow: 'hidden',
              boxShadow: '0 4px 16px rgba(0,0,0,0.03)',
            }}
          >
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.25rem' }}>
                Privileged Role Verification Requests
              </h2>
              <p style={{ fontSize: '0.84rem', color: '#64748b', margin: 0 }}>
                Review medical licenses and primary clinic assignments before authorizing access to patient telemetry.
              </p>
            </div>

            {loading ? (
              <div style={{ padding: '3rem', textAlign: 'center' }}>
                <LoadingSpinner size="md" text="Loading pending verification requests..." />
              </div>
            ) : pendingUsers.length === 0 ? (
              <div style={{ padding: '3.5rem 1.5rem', textAlign: 'center', color: '#64748b' }}>
                <CheckCircle2 size={44} color="#16a34a" style={{ margin: '0 auto 0.75rem' }} />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', margin: '0 0 0.25rem' }}>
                  All Clear!
                </h3>
                <p style={{ margin: 0, fontSize: '0.88rem' }}>
                  No pending doctor or health worker accounts awaiting approval.
                </p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                      <th style={{ padding: '0.85rem 1.25rem', fontWeight: 700 }}>Applicant</th>
                      <th style={{ padding: '0.85rem 1.25rem', fontWeight: 700 }}>Role</th>
                      <th style={{ padding: '0.85rem 1.25rem', fontWeight: 700 }}>Clinical Details</th>
                      <th style={{ padding: '0.85rem 1.25rem', fontWeight: 700 }}>Contact</th>
                      <th style={{ padding: '0.85rem 1.25rem', fontWeight: 700 }}>Registered</th>
                      <th style={{ padding: '0.85rem 1.25rem', fontWeight: 700, textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingUsers.map((user) => (
                      <tr key={user.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s' }}>
                        <td style={{ padding: '1rem 1.25rem' }}>
                          <div style={{ fontWeight: 700, color: '#0f172a' }}>{user.name}</div>
                          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{user.email || user.username}</div>
                        </td>
                        <td style={{ padding: '1rem 1.25rem' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '0.25rem 0.6rem',
                              borderRadius: 6,
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              background: user.role === 'doctor' ? '#eff6ff' : '#ecfdf5',
                              color: user.role === 'doctor' ? '#1d4ed8' : '#047857',
                            }}
                          >
                            {user.role === 'doctor' ? '👨‍⚕️ Doctor' : '👩‍⚕️ Health Worker'}
                          </span>
                        </td>
                        <td style={{ padding: '1rem 1.25rem' }}>
                          {user.role === 'doctor' ? (
                            <div>
                              <div style={{ fontWeight: 600, color: '#334155' }}>{user.specialization || 'General'}</div>
                              <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                                License: {user.license_number || user.licenseNumber || 'N/A'}
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div style={{ fontWeight: 600, color: '#334155' }}>{user.clinic_id || 'Rural Clinic'}</div>
                              <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                                Village: {user.village || 'Assigned PHC'}
                              </div>
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '1rem 1.25rem', color: '#64748b', fontSize: '0.84rem' }}>
                          {user.contact_number || user.phone || '—'}
                        </td>
                        <td style={{ padding: '1rem 1.25rem', color: '#64748b', fontSize: '0.82rem' }}>
                          {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'Recent'}
                        </td>
                        <td style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                            <button
                              type="button"
                              disabled={actionLoadingId === user.id}
                              onClick={() => handleApprove(user.id, user.name)}
                              style={{
                                padding: '0.45rem 0.85rem',
                                borderRadius: 8,
                                border: 'none',
                                background: '#16a34a',
                                color: '#ffffff',
                                fontWeight: 700,
                                fontSize: '0.82rem',
                                cursor: actionLoadingId === user.id ? 'not-allowed' : 'pointer',
                              }}
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              disabled={actionLoadingId === user.id}
                              onClick={() => handleReject(user.id, user.name)}
                              style={{
                                padding: '0.45rem 0.85rem',
                                borderRadius: 8,
                                border: '1px solid #cbd5e1',
                                background: '#ffffff',
                                color: '#dc2626',
                                fontWeight: 600,
                                fontSize: '0.82rem',
                                cursor: actionLoadingId === user.id ? 'not-allowed' : 'pointer',
                              }}
                            >
                              Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Section: All Accounts Directory */}
        {activeTab === 'users' && (
          <div
            style={{
              background: '#ffffff',
              borderRadius: 16,
              border: '1px solid #e2e8f0',
              overflow: 'hidden',
              boxShadow: '0 4px 16px rgba(0,0,0,0.03)',
            }}
          >
            <div
              style={{
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid #f1f5f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem',
              }}
            >
              <div>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.25rem' }}>
                  User Account Directory
                </h2>
                <p style={{ fontSize: '0.84rem', color: '#64748b', margin: 0 }}>
                  Showing all registered accounts in the PostgreSQL database.
                </p>
              </div>

              <div style={{ position: 'relative', width: 280 }}>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Filter by name, role, email..."
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.85rem 0.6rem 2.2rem',
                    borderRadius: 8,
                    border: '1.5px solid #cbd5e1',
                    fontSize: '0.85rem',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
                <Search
                  size={15}
                  color="#94a3b8"
                  style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)' }}
                />
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                    <th style={{ padding: '0.85rem 1.25rem', fontWeight: 700 }}>User</th>
                    <th style={{ padding: '0.85rem 1.25rem', fontWeight: 700 }}>Role</th>
                    <th style={{ padding: '0.85rem 1.25rem', fontWeight: 700 }}>Status</th>
                    <th style={{ padding: '0.85rem 1.25rem', fontWeight: 700 }}>Details</th>
                    <th style={{ padding: '0.85rem 1.25rem', fontWeight: 700 }}>Registered</th>
                    <th style={{ padding: '0.85rem 1.25rem', fontWeight: 700, textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => (
                    <tr key={u.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.85rem 1.25rem' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{u.name}</div>
                        <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{u.email || u.username}</div>
                      </td>
                      <td style={{ padding: '0.85rem 1.25rem' }}>
                        <span
                          style={{
                            padding: '0.2rem 0.55rem',
                            borderRadius: 6,
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            textTransform: 'capitalize',
                            background:
                              u.role === 'admin'
                                ? '#f3e8ff'
                                : u.role === 'doctor'
                                ? '#eff6ff'
                                : u.role === 'health_worker'
                                ? '#ecfdf5'
                                : '#f1f5f9',
                            color:
                              u.role === 'admin'
                                ? '#7e22ce'
                                : u.role === 'doctor'
                                ? '#1d4ed8'
                                : u.role === 'health_worker'
                                ? '#047857'
                                : '#475569',
                          }}
                        >
                          {u.role?.replace('_', ' ')}
                        </span>
                      </td>
                      <td style={{ padding: '0.85rem 1.25rem' }}>
                        <span
                          style={{
                            padding: '0.2rem 0.55rem',
                            borderRadius: 6,
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            background:
                              u.status === 'active'
                                ? '#dcfce7'
                                : u.status === 'pending'
                                ? '#fef3c7'
                                : '#fee2e2',
                            color:
                              u.status === 'active'
                                ? '#15803d'
                                : u.status === 'pending'
                                ? '#b45309'
                                : '#b91c1c',
                          }}
                        >
                          {u.status || 'active'}
                        </span>
                      </td>
                      <td style={{ padding: '0.85rem 1.25rem', fontSize: '0.82rem', color: '#475569' }}>
                        {u.specialization && <div>Spec: {u.specialization}</div>}
                        {u.license_number && <div>Lic: {u.license_number}</div>}
                        {u.clinic_id && <div>Clinic: {u.clinic_id}</div>}
                        {!u.specialization && !u.license_number && !u.clinic_id && '—'}
                      </td>
                      <td style={{ padding: '0.85rem 1.25rem', fontSize: '0.8rem', color: '#64748b' }}>
                        {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                      </td>
                      <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>
                        {u.role !== 'admin' && (
                          u.status === 'active' ? (
                            <button
                              type="button"
                              disabled={actionLoadingId === u.id}
                              onClick={() => handleReject(u.id, u.name)}
                              style={{
                                padding: '0.35rem 0.65rem',
                                borderRadius: 6,
                                border: '1px solid #fecaca',
                                background: '#fef2f2',
                                color: '#dc2626',
                                fontSize: '0.78rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              Suspend
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={actionLoadingId === u.id}
                              onClick={() => handleApprove(u.id, u.name)}
                              style={{
                                padding: '0.35rem 0.65rem',
                                borderRadius: 6,
                                border: 'none',
                                background: '#16a34a',
                                color: '#ffffff',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              Activate
                            </button>
                          )
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Section: Clinical Consultations */}
        {activeTab === 'consultations' && (
          <div
            style={{
              background: '#ffffff',
              borderRadius: 16,
              border: '1px solid #e2e8f0',
              overflow: 'hidden',
              boxShadow: '0 4px 16px rgba(0,0,0,0.03)',
            }}
          >
            <div
              style={{
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid #f1f5f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem',
              }}
            >
              <div>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.25rem' }}>
                  Cross-Clinic Telemedicine Consultations
                </h2>
                <p style={{ fontSize: '0.84rem', color: '#64748b', margin: 0 }}>
                  Live overview of all active, reviewed, and completed clinical telemetry cases.
                </p>
              </div>

              <div style={{ position: 'relative', width: 280 }}>
                <input
                  type="text"
                  value={consultationSearchTerm}
                  onChange={(e) => setConsultationSearchTerm(e.target.value)}
                  placeholder="Filter by case ID, patient, chief complaint..."
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.85rem 0.6rem 2.2rem',
                    borderRadius: 8,
                    border: '1.5px solid #cbd5e1',
                    fontSize: '0.85rem',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
                <Search
                  size={15}
                  color="#94a3b8"
                  style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)' }}
                />
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                    <th style={{ padding: '0.85rem 1.25rem', fontWeight: 700 }}>Case ID</th>
                    <th style={{ padding: '0.85rem 1.25rem', fontWeight: 700 }}>Patient</th>
                    <th style={{ padding: '0.85rem 1.25rem', fontWeight: 700 }}>Specialization / Doctor</th>
                    <th style={{ padding: '0.85rem 1.25rem', fontWeight: 700 }}>Chief Complaint</th>
                    <th style={{ padding: '0.85rem 1.25rem', fontWeight: 700 }}>Urgency</th>
                    <th style={{ padding: '0.85rem 1.25rem', fontWeight: 700 }}>Status</th>
                    <th style={{ padding: '0.85rem 1.25rem', fontWeight: 700 }}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {allConsultations
                    .filter((c) => {
                      if (!consultationSearchTerm.trim()) return true;
                      const q = consultationSearchTerm.toLowerCase();
                      const complaint = c.mainComplaint || c.clinicalSummary?.mainComplaint || (typeof c.symptoms === 'object' ? c.symptoms?.chiefComplaint : c.symptoms) || '';
                      return (
                        c.id?.toLowerCase().includes(q) ||
                        c.patientName?.toLowerCase().includes(q) ||
                        c.patientId?.toLowerCase().includes(q) ||
                        complaint.toLowerCase().includes(q)
                      );
                    })
                    .map((c) => (
                      <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.85rem 1.25rem', fontWeight: 700, color: '#0284c7' }}>
                          {c.id}
                        </td>
                        <td style={{ padding: '0.85rem 1.25rem' }}>
                          <div style={{ fontWeight: 600, color: '#0f172a' }}>{c.patientName || 'Patient'}</div>
                          <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{c.patientId}</div>
                        </td>
                        <td style={{ padding: '0.85rem 1.25rem', fontSize: '0.82rem', color: '#334155' }}>
                          <div style={{ fontWeight: 600 }}>{c.specialization || 'General Medicine'}</div>
                          <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{c.doctorName || 'Any Specialist'}</div>
                        </td>
                        <td style={{ padding: '0.85rem 1.25rem', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#475569' }}>
                          {c.mainComplaint || c.clinicalSummary?.mainComplaint || (typeof c.symptoms === 'object' ? c.symptoms?.chiefComplaint : c.symptoms) || 'General Consultation'}
                        </td>
                        <td style={{ padding: '0.85rem 1.25rem' }}>
                          <span
                            style={{
                              padding: '0.2rem 0.55rem',
                              borderRadius: 6,
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              background: ['urgent', 'emergency', 'critical'].includes(c.priority || c.urgency) ? '#fee2e2' : '#f0fdf4',
                              color: ['urgent', 'emergency', 'critical'].includes(c.priority || c.urgency) ? '#b91c1c' : '#15803d',
                            }}
                          >
                            {c.priority || c.urgency || 'Normal'}
                          </span>
                        </td>
                        <td style={{ padding: '0.85rem 1.25rem' }}>
                          <span
                            style={{
                              padding: '0.2rem 0.55rem',
                              borderRadius: 6,
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              background: '#eff6ff',
                              color: '#1d4ed8',
                            }}
                          >
                            {c.status}
                          </span>
                        </td>
                        <td style={{ padding: '0.85rem 1.25rem', fontSize: '0.8rem', color: '#64748b' }}>
                          {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '—'}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Section: Registered Patients */}
        {activeTab === 'patients' && (
          <div
            style={{
              background: '#ffffff',
              borderRadius: 16,
              border: '1px solid #e2e8f0',
              overflow: 'hidden',
              boxShadow: '0 4px 16px rgba(0,0,0,0.03)',
            }}
          >
            <div
              style={{
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid #f1f5f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem',
              }}
            >
              <div>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.25rem' }}>
                  Registered Patients Clinical Registry
                </h2>
                <p style={{ fontSize: '0.84rem', color: '#64748b', margin: 0 }}>
                  Demographics, blood groups, and verified contact information registered across rural health posts.
                </p>
              </div>

              <div style={{ position: 'relative', width: 280 }}>
                <input
                  type="text"
                  value={patientSearchTerm}
                  onChange={(e) => setPatientSearchTerm(e.target.value)}
                  placeholder="Filter by ID, name, village, blood group..."
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.85rem 0.6rem 2.2rem',
                    borderRadius: 8,
                    border: '1.5px solid #cbd5e1',
                    fontSize: '0.85rem',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
                <Search
                  size={15}
                  color="#94a3b8"
                  style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)' }}
                />
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                    <th style={{ padding: '0.85rem 1.25rem', fontWeight: 700 }}>Patient ID</th>
                    <th style={{ padding: '0.85rem 1.25rem', fontWeight: 700 }}>Full Name</th>
                    <th style={{ padding: '0.85rem 1.25rem', fontWeight: 700 }}>Age / Sex</th>
                    <th style={{ padding: '0.85rem 1.25rem', fontWeight: 700 }}>Village & Location</th>
                    <th style={{ padding: '0.85rem 1.25rem', fontWeight: 700 }}>Blood Group</th>
                    <th style={{ padding: '0.85rem 1.25rem', fontWeight: 700 }}>Contact Phone</th>
                    <th style={{ padding: '0.85rem 1.25rem', fontWeight: 700 }}>Registered</th>
                  </tr>
                </thead>
                <tbody>
                  {allPatients
                    .filter((p) => {
                      if (!patientSearchTerm.trim()) return true;
                      const q = patientSearchTerm.toLowerCase();
                      return (
                        p.name?.toLowerCase().includes(q) ||
                        p.id?.toLowerCase().includes(q) ||
                        p.referenceId?.toLowerCase().includes(q) ||
                        p.reference_id?.toLowerCase().includes(q) ||
                        p.village?.toLowerCase().includes(q) ||
                        p.bloodGroup?.toLowerCase().includes(q) ||
                        p.blood_group?.toLowerCase().includes(q)
                      );
                    })
                    .map((p) => (
                      <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.85rem 1.25rem', fontWeight: 700, color: '#0284c7' }}>
                          {p.referenceId || p.reference_id || p.id}
                        </td>
                        <td style={{ padding: '0.85rem 1.25rem', fontWeight: 700, color: '#0f172a' }}>
                          {p.name}
                        </td>
                        <td style={{ padding: '0.85rem 1.25rem', color: '#334155' }}>
                          {p.age} yrs / {p.sex}
                        </td>
                        <td style={{ padding: '0.85rem 1.25rem', color: '#475569' }}>
                          {p.village}{p.district ? `, ${p.district}` : ''}
                        </td>
                        <td style={{ padding: '0.85rem 1.25rem' }}>
                          <span
                            style={{
                              padding: '0.2rem 0.55rem',
                              borderRadius: 6,
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              background: '#fef2f2',
                              color: '#b91c1c',
                            }}
                          >
                            {p.bloodGroup || p.blood_group || 'Unknown'}
                          </span>
                        </td>
                        <td style={{ padding: '0.85rem 1.25rem', color: '#64748b', fontSize: '0.82rem' }}>
                          {p.phone || p.contactNumber || p.contact_number || '—'}
                        </td>
                        <td style={{ padding: '0.85rem 1.25rem', fontSize: '0.8rem', color: '#64748b' }}>
                          {p.createdAt || p.created_at ? new Date(p.createdAt || p.created_at).toLocaleDateString() : '—'}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
