import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { X, CheckCircle, AlertTriangle, AlertCircle, Info } from 'lucide-react';

const titleMap = {
  '/patient': 'Patient Dashboard',
  '/patient/profile': 'My Profile',
  '/patient/consultations': 'My Consultations',
  '/patient/records': 'Medical Records',
  '/patient/advice': "Doctor's Advice",
  '/patient/notifications': 'Notifications',
  '/patient/help': 'Help & Support',

  '/health-worker': 'Health Worker Dashboard',
  '/health-worker/register-patient': 'Register New Patient',
  '/health-worker/patients': 'Patient Records',
  '/health-worker/new-consultation': 'New Consultation',
  '/health-worker/consultations': 'Consultation History',
  '/health-worker/pending-uploads': 'Pending Uploads',
  '/health-worker/responses': 'Doctor Responses',
  '/health-worker/network': 'Network Monitor',

  '/doctor': 'Doctor Dashboard',
  '/doctor/incoming': 'Incoming Consultations',
  '/doctor/pending': 'Pending Reviews',
  '/doctor/reviewed': 'Reviewed Cases',
  '/doctor/patients': 'Patient Records',
  '/doctor/responses': 'Responses Sent',
  '/doctor/notifications': 'Doctor Notifications',
};

function ToastContainer({ notifications, onDismiss }) {
  if (!notifications || notifications.length === 0) return null;

  const typeConfig = {
    success: { bg: '#10b981', icon: CheckCircle },
    error: { bg: '#ef4444', icon: AlertCircle },
    warning: { bg: '#f59e0b', icon: AlertTriangle },
    info: { bg: '#0ea5e9', icon: Info },
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        maxWidth: 380,
      }}
    >
      {notifications.map((item) => {
        const config = typeConfig[item.type] || typeConfig.info;
        const IconComponent = config.icon;
        return (
          <div
            key={item.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              backgroundColor: '#ffffff',
              borderLeft: `4px solid ${config.bg}`,
              borderRadius: 8,
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              color: '#1e293b',
              fontSize: '0.875rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <IconComponent size={18} color={config.bg} />
              <span>{item.message || item.text || item.title}</span>
            </div>
            <button
              onClick={() => onDismiss && onDismiss(item.id)}
              style={{
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: 4,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export default function DashboardLayout({ role, children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth <= 768 : false
  );
  const location = useLocation();
  const { state, dismissNotification } = useApp() || {};
  const { currentUser } = useAuth() || {};
  const effectiveRole = role || currentUser?.role || 'health_worker';

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (!mobile) {
        setSidebarOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Find page title from path or path prefix
  let pageTitle = titleMap[location.pathname];
  if (!pageTitle) {
    if (location.pathname.startsWith('/doctor/consultation/')) {
      pageTitle = 'Consultation Details';
    } else if (location.pathname.startsWith('/doctor/response/')) {
      pageTitle = 'Clinical Response';
    } else {
      const segs = location.pathname.split('/').filter(Boolean);
      pageTitle = segs.length > 0 ? segs[segs.length - 1].replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'Dashboard';
    }
  }

  return (
    <div className="dashboard-layout" style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f8fafc' }}>
      <Sidebar role={effectiveRole} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div
        className="main-content"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          marginLeft: isMobile ? 0 : 260,
          width: isMobile ? '100%' : 'calc(100% - 260px)',
          transition: 'margin-left 0.2s',
        }}
      >
        <Navbar
          title={pageTitle}
          isMobile={isMobile}
          onMenuToggle={() => setSidebarOpen((prev) => !prev)}
        />
        
        <main
          className="page-container"
          style={{
            flex: 1,
            padding: '24px',
            maxWidth: 1400,
            width: '100%',
            margin: '0 auto',
            boxSizing: 'border-box',
          }}
        >
          {children}
        </main>
      </div>

      <ToastContainer
        notifications={state?.notifications || []}
        onDismiss={(id) => dismissNotification && dismissNotification(id)}
      />
    </div>
  );
}
