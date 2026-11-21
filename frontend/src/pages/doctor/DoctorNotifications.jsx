import { useState, useEffect } from 'react';
import { Bell, CheckCircle, AlertTriangle, Clock, ArrowRight, Check } from 'lucide-react';
import DashboardLayout from '../../layouts/DashboardLayout';
import doctorService from '../../services/doctorService';
import { formatRelative } from '../../utils/formatDate';
import EmptyState from '../../components/EmptyState';

export default function DoctorNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [filter, setFilter] = useState('all'); // all, unread

  useEffect(() => {
    let mounted = true;
    async function loadNotifications() {
      try {
        const stored = localStorage.getItem('carewave_doctor_notifications');
        if (stored) {
          if (mounted) setNotifications(JSON.parse(stored));
          return;
        }

        // Generate dynamic notifications from real incoming queue
        const consultations = await doctorService.getDoctorConsultations().catch(() => []);
        if (mounted && Array.isArray(consultations) && consultations.length > 0) {
          const generated = consultations.slice(0, 5).map((c, i) => ({
            id: `notif-doc-${c.id || i}`,
            title: `New Case: ${c.patientName || c.patientId || 'Patient'}`,
            message: `Priority: ${c.priority || c.urgency || 'Normal'}. Clinical summary submitted.`,
            type: ['emergency', 'urgent'].includes(c.priority) ? 'urgent' : 'info',
            read: false,
            createdAt: c.createdAt || new Date().toISOString(),
          }));
          setNotifications(generated);
        }
      } catch (err) {
        console.warn('Failed to load doctor notifications:', err);
      }
    }
    loadNotifications();
    return () => { mounted = false; };
  }, []);

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleToggleRead = (id) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: !n.read } : n))
    );
  };

  const filtered = notifications.filter((n) => (filter === 'unread' ? !n.read : true));

  return (
    <DashboardLayout role="doctor">
      <div style={{ maxWidth: 860, margin: '0 auto', paddingBottom: 40 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0f172a' }}>Clinical Alerts & Notifications</h1>
            <p style={{ color: '#64748b', fontSize: 14 }}>
              Incoming urgent case alerts, transmission updates, and clinic delivery confirmations.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              className={`btn ${filter === 'all' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
              onClick={() => setFilter('all')}
            >
              All ({notifications.length})
            </button>
            <button
              className={`btn ${filter === 'unread' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
              onClick={() => setFilter('unread')}
            >
              Unread ({notifications.filter((n) => !n.read).length})
            </button>
            <button className="btn btn-secondary btn-sm" onClick={handleMarkAllRead}>
              <Check size={14} /> Mark All Read
            </button>
          </div>
        </div>

        {/* List */}
        {filtered.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="No notifications"
            description="You are caught up on all clinic alerts and case submissions."
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filtered.map((item) => (
              <div
                key={item.id}
                className="card"
                style={{
                  padding: 16,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 16,
                  backgroundColor: item.read ? '#ffffff' : '#f8fafc',
                  borderLeft:
                    item.type === 'urgent'
                      ? '4px solid #ef4444'
                      : item.type === 'success'
                        ? '4px solid #22c55e'
                        : '4px solid #0284c7',
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    background:
                      item.type === 'urgent'
                        ? '#fee2e2'
                        : item.type === 'success'
                          ? '#dcfce7'
                          : '#e0f2fe',
                    color:
                      item.type === 'urgent'
                        ? '#dc2626'
                        : item.type === 'success'
                          ? '#16a34a'
                          : '#0369a1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {item.type === 'urgent' ? (
                    <AlertTriangle size={20} />
                  ) : item.type === 'success' ? (
                    <CheckCircle size={20} />
                  ) : (
                    <Bell size={20} />
                  )}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
                      {item.title}
                    </h4>
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>
                      {formatRelative(item.timestamp)}
                    </span>
                  </div>
                  <p style={{ margin: '0 0 10px 0', fontSize: 14, color: '#475569' }}>
                    {item.body}
                  </p>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <button
                      onClick={() => handleToggleRead(item.id)}
                      style={{ background: 'none', border: 'none', color: '#0284c7', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0 }}
                    >
                      {item.read ? 'Mark Unread' : 'Mark as Read'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
