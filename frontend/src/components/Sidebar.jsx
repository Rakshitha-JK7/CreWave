import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Heart,
  LayoutDashboard,
  User,
  FileText,
  Clipboard,
  MessageSquare,
  Bell,
  UserPlus,
  Users,
  FilePlus,
  ClipboardList,
  Clock,
  Wifi,
  Inbox,
  CheckCircle,
  LogOut,
  ShieldCheck,
} from 'lucide-react';

const healthWorkerNav = [
  { icon: LayoutDashboard, label: 'Dashboard',            path: '/health-worker' },
  { icon: UserPlus,        label: 'Register Patient',     path: '/health-worker/register-patient' },
  { icon: Users,           label: 'Patient Records',      path: '/health-worker/patients' },
  { icon: FilePlus,        label: 'New Consultation',     path: '/health-worker/new-consultation' },
  { icon: ClipboardList,   label: 'Consultation History', path: '/health-worker/consultations' },
  { icon: Clock,           label: 'Pending Uploads',      path: '/health-worker/pending-uploads' },
  { icon: MessageSquare,   label: 'Doctor Responses',     path: '/health-worker/responses' },
  { icon: Wifi,            label: 'Network Monitor',      path: '/health-worker/network' },
];

const patientNav = [
  { icon: LayoutDashboard, label: 'Dashboard',        path: '/patient' },
  { icon: User,            label: 'My Profile',       path: '/patient/profile' },
  { icon: FileText,        label: 'My Consultations', path: '/patient/consultations' },
  { icon: Clipboard,       label: 'Medical Records',  path: '/patient/records' },
  { icon: MessageSquare,   label: "Doctor's Advice",  path: '/patient/advice' },
  { icon: Bell,            label: 'Notifications',    path: '/patient/notifications' },
];

const doctorNav = [
  { icon: LayoutDashboard, label: 'Dashboard',              path: '/doctor' },
  { icon: Inbox,           label: 'Incoming Consultations', path: '/doctor/incoming' },
  { icon: CheckCircle,     label: 'Reviewed Cases',         path: '/doctor/reviewed' },
  { icon: Users,           label: 'Patient Records',        path: '/doctor/patients' },
  { icon: Bell,            label: 'Notifications',          path: '/doctor/notifications' },
];

const adminNav = [
  { icon: ShieldCheck,     label: 'Admin Overview',         path: '/admin' },
];

const navByRole = {
  patient: patientNav,
  health_worker: healthWorkerNav,
  healthWorker: healthWorkerNav,
  doctor: doctorNav,
  admin: adminNav,
};

const SIDEBAR_WIDTH = 260;

function NavItem({ icon: Icon, label, path }) {
  return (
    <NavLink
      to={path}
      end={path.split('/').length <= 2}
      className={({ isActive }) => (isActive ? 'sidebar-link sidebar-link--active' : 'sidebar-link')}
      style={({ isActive }) => ({
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 20px',
        borderRadius: 8,
        margin: '1px 10px',
        textDecoration: 'none',
        fontSize: '0.875rem',
        fontWeight: 500,
        color: isActive ? '#ffffff' : '#94a3b8',
        backgroundColor: isActive ? 'rgba(14,165,233,0.25)' : 'transparent',
        transition: 'background-color 0.15s, color 0.15s',
      })}
      onMouseEnter={(e) => {
        if (!e.currentTarget.classList.contains('sidebar-link--active')) {
          e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)';
          e.currentTarget.style.color = '#e2e8f0';
        }
      }}
      onMouseLeave={(e) => {
        if (!e.currentTarget.classList.contains('sidebar-link--active')) {
          e.currentTarget.style.backgroundColor = 'transparent';
          e.currentTarget.style.color = '#94a3b8';
        }
      }}
    >
      <Icon size={18} strokeWidth={1.75} />
      <span>{label}</span>
    </NavLink>
  );
}

export default function Sidebar({ role, isOpen, onClose }) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const navigationItems = navByRole[role] || navByRole.health_worker;

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth <= 768 : false
  );

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <>
      {/* Mobile overlay */}
      {isMobile && isOpen && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 199,
          }}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={`sidebar ${isOpen ? 'open' : ''}`}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          height: '100vh',
          width: SIDEBAR_WIDTH,
          backgroundColor: '#1e293b',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 200,
          transform: isMobile ? (isOpen ? 'translateX(0)' : `translateX(-${SIDEBAR_WIDTH}px)`) : 'none',
          transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1)',
          overflowY: 'auto',
          overflowX: 'hidden',
          boxShadow: isMobile && isOpen ? '4px 0 20px rgba(0,0,0,0.3)' : '1px 0 0 rgba(255,255,255,0.05)',
        }}
      >
        {/* Logo */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '20px 20px 16px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 9,
              backgroundColor: '#0ea5e9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Heart size={20} color="#ffffff" fill="#ffffff" />
          </div>
          <span
            style={{
              fontSize: '1.125rem',
              fontWeight: 800,
              color: '#ffffff',
              letterSpacing: '-0.01em',
            }}
          >
            CareWave
          </span>
        </div>

        {/* Nav items */}
        <nav style={{ flex: 1, paddingTop: 10, paddingBottom: 10 }}>
          {navigationItems.map((item) => (
            <NavItem key={item.path} icon={item.icon} label={item.label} path={item.path} />
          ))}
        </nav>

        {/* Footer */}
        <div
          style={{
            borderTop: '1px solid rgba(255,255,255,0.08)',
            padding: '12px 10px',
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={handleLogout}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              width: '100%',
              padding: '9px 12px',
              borderRadius: 8,
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'background-color 0.15s, color 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.1)';
              e.currentTarget.style.color = '#f87171';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = '#94a3b8';
            }}
          >
            <LogOut size={17} strokeWidth={1.75} />
            Logout
          </button>

          <p
            style={{
              margin: '8px 12px 0',
              fontSize: '0.65rem',
              color: '#475569',
            }}
          >
            CareWave v1.0.0 · dev
          </p>
        </div>
      </aside>
    </>
  );
}
