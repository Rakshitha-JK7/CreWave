import { Menu } from 'lucide-react';
import NetworkStatus from './NetworkStatus';
import { useAuth } from '../context/AuthContext';

const roleLabels = {
  patient:       'Patient',
  health_worker: 'Health Worker',
  healthWorker:  'Health Worker',
  doctor:        'Doctor',
  admin:         'Admin',
};

const roleColors = {
  patient:       { bg: '#dcfce7', color: '#166534' },
  health_worker: { bg: '#dbeafe', color: '#1e40af' },
  healthWorker:  { bg: '#dbeafe', color: '#1e40af' },
  doctor:        { bg: '#f3e8ff', color: '#6b21a8' },
  admin:         { bg: '#fee2e2', color: '#991b1b' },
};

export default function Navbar({ title, isMobile, onMenuToggle }) {
  const { currentUser } = useAuth();
  const currentRole = currentUser?.role;
  const roleCfg = (currentRole && roleColors[currentRole]) || { bg: '#f1f5f9', color: '#475569' };

  return (
    <header
      style={{
        height: 64,
        backgroundColor: '#ffffff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 24px',
        gap: 16,
        position: 'sticky',
        top: 0,
        zIndex: 100,
        flexShrink: 0,
      }}
    >
      {/* Hamburger – visible only on mobile */}
      {isMobile && (
        <button
          className="hamburger-btn"
          onClick={onMenuToggle}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 6,
            borderRadius: 8,
            color: '#475569',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          aria-label="Toggle sidebar"
        >
          <Menu size={22} />
        </button>
      )}

      {/* Title */}
      <h1
        style={{
          margin: 0,
          fontSize: '1.0625rem',
          fontWeight: 700,
          color: '#1e293b',
          flex: 1,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {title}
      </h1>

      {/* Right side */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <NetworkStatus />

        {currentUser && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1e293b' }}>
              {currentUser.name || currentUser.username || 'User'}
            </span>
            {currentRole && (
              <span
                style={{
                  ...roleCfg,
                  borderRadius: 999,
                  padding: '2px 10px',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                }}
              >
                {roleLabels[currentRole] || currentRole}
              </span>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
