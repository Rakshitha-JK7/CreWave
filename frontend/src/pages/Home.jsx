import { useNavigate, Link } from 'react-router-dom';
import { Heart, User, Activity, ClipboardList, ShieldCheck, ArrowRight, LogIn, UserPlus, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Home() {
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();

  const cardStyle = {
    background: '#fff',
    borderRadius: 16,
    boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
    padding: '2rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    minHeight: 280,
    transition: 'transform 0.2s, box-shadow 0.2s',
    cursor: 'pointer',
    border: '1.5px solid #e2e8f0',
    position: 'relative',
  };

  const handleCardHover = (e, enter) => {
    if (enter) {
      e.currentTarget.style.transform = 'translateY(-4px)';
      e.currentTarget.style.boxShadow = '0 12px 32px rgba(0,0,0,0.12)';
    } else {
      e.currentTarget.style.transform = 'translateY(0)';
      e.currentTarget.style.boxShadow = '0 4px 24px rgba(0,0,0,0.06)';
    }
  };

  const btnStyle = (color) => ({
    width: '100%',
    padding: '0.75rem 1rem',
    borderRadius: 10,
    border: 'none',
    background: color,
    color: '#fff',
    fontWeight: 700,
    fontSize: '0.92rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    marginTop: 'auto',
    transition: 'opacity 0.15s',
  });

  const getDashboardPath = (role) => {
    if (role === 'admin') return '/admin';
    if (role === 'doctor') return '/doctor';
    if (role === 'health_worker') return '/health-worker';
    return '/patient';
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #f0f9ff 0%, #f8fafc 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '2rem 1.5rem 3rem',
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      {/* Top Navbar */}
      <header
        style={{
          width: '100%',
          maxWidth: 1100,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '2.5rem',
          paddingBottom: '1rem',
          borderBottom: '1px solid #e2e8f0',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #0284c7, #2563eb)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)',
            }}
          >
            <Heart size={24} color="#fff" fill="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
              CareWave
            </h1>
            <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Rural Telemedicine Network</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {currentUser ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => navigate(getDashboardPath(currentUser.role))}
                style={{
                  padding: '0.55rem 1rem',
                  borderRadius: 8,
                  border: 'none',
                  background: '#0284c7',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                Go to Dashboard <ArrowRight size={15} />
              </button>
              <button
                type="button"
                onClick={logout}
                style={{
                  padding: '0.55rem 0.85rem',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#475569',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                <LogOut size={15} /> Sign Out
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Link
                to="/login"
                style={{
                  padding: '0.55rem 1rem',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#1e293b',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                <LogIn size={15} /> Sign In
              </Link>
              <Link
                to="/register"
                style={{
                  padding: '0.55rem 1rem',
                  borderRadius: 8,
                  border: 'none',
                  background: '#0284c7',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                <UserPlus size={15} /> Register
              </Link>
            </div>
          )}
        </div>
      </header>

      {/* Hero Title */}
      <div style={{ textAlign: 'center', marginBottom: '2.5rem', maxWidth: 640 }}>
        <h2
          style={{
            fontSize: 'clamp(2rem, 4vw, 2.75rem)',
            fontWeight: 800,
            color: '#0f172a',
            margin: '0 0 0.75rem',
            letterSpacing: '-0.02em',
          }}
        >
          Connecting Rural Healthcare. <span style={{ color: '#0284c7' }}>Reliably.</span>
        </h2>
        <p style={{ fontSize: '1.05rem', color: '#475569', margin: 0, lineHeight: 1.6 }}>
          Store-and-forward telemedicine with offline synchronization, 2G diagnostic transmission, and verified medical review.
        </p>
      </div>

      {/* Role Portals Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '1.25rem',
          width: '100%',
          maxWidth: 1100,
          marginBottom: '2.5rem',
        }}
      >
        {/* Healthcare Worker Card */}
        <div
          style={cardStyle}
          onClick={() => navigate('/health-worker')}
          onMouseEnter={(e) => handleCardHover(e, true)}
          onMouseLeave={(e) => handleCardHover(e, false)}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: '#ccfbf1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1rem',
            }}
          >
            <Activity size={26} color="#0d9488" />
          </div>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0f172a', margin: '0 0 0.5rem' }}>
            Health Worker
          </h3>
          <p style={{ fontSize: '0.88rem', color: '#64748b', lineHeight: 1.5, flexGrow: 1, margin: '0 0 1.25rem' }}>
            Register village patients, draft consultations offline, upload vitals & ECGs, and receive doctor responses.
          </p>
          <button style={btnStyle('#0d9488')}>
            Health Worker Portal <ArrowRight size={16} />
          </button>
        </div>

        {/* Doctor Card */}
        <div
          style={cardStyle}
          onClick={() => navigate('/doctor')}
          onMouseEnter={(e) => handleCardHover(e, true)}
          onMouseLeave={(e) => handleCardHover(e, false)}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: '#eff6ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1rem',
            }}
          >
            <ClipboardList size={26} color="#2563eb" />
          </div>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0f172a', margin: '0 0 0.5rem' }}>
            Specialist Doctor
          </h3>
          <p style={{ fontSize: '0.88rem', color: '#64748b', lineHeight: 1.5, flexGrow: 1, margin: '0 0 1.25rem' }}>
            Review incoming prioritized clinical queues, inspect diagnostic files, and submit prescriptions & referrals.
          </p>
          <button style={btnStyle('#2563eb')}>
            Doctor Portal <ArrowRight size={16} />
          </button>
        </div>

        {/* Patient Card */}
        <div
          style={cardStyle}
          onClick={() => navigate('/patient')}
          onMouseEnter={(e) => handleCardHover(e, true)}
          onMouseLeave={(e) => handleCardHover(e, false)}
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
              marginBottom: '1rem',
            }}
          >
            <User size={26} color="#16a34a" />
          </div>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0f172a', margin: '0 0 0.5rem' }}>
            Patient Portal
          </h3>
          <p style={{ fontSize: '0.88rem', color: '#64748b', lineHeight: 1.5, flexGrow: 1, margin: '0 0 1.25rem' }}>
            Access consultation history, verified doctor advice, prescriptions, and personal health telemetry.
          </p>
          <button style={btnStyle('#16a34a')}>
            Patient Portal <ArrowRight size={16} />
          </button>
        </div>

        {/* System Administrator Card */}
        <div
          style={cardStyle}
          onClick={() => navigate('/admin')}
          onMouseEnter={(e) => handleCardHover(e, true)}
          onMouseLeave={(e) => handleCardHover(e, false)}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: '#f3e8ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1rem',
            }}
          >
            <ShieldCheck size={26} color="#7c3aed" />
          </div>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0f172a', margin: '0 0 0.5rem' }}>
            Administration
          </h3>
          <p style={{ fontSize: '0.88rem', color: '#64748b', lineHeight: 1.5, flexGrow: 1, margin: '0 0 1.25rem' }}>
            Approve privileged clinical applicants, manage users across clinics, and monitor system health.
          </p>
          <button style={btnStyle('#7c3aed')}>
            Admin Portal <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
