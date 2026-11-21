import { useNavigate } from 'react-router-dom';
import { Heart, User, Activity, ClipboardList, ArrowRight } from 'lucide-react';

export default function Home() {
  const navigate = useNavigate();

  const cardStyle = {
    background: '#fff',
    borderRadius: 16,
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
    padding: '2rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    minHeight: 300,
    transition: 'transform 0.2s, box-shadow 0.2s',
    cursor: 'pointer',
    border: '1.5px solid #e2e8f0',
    position: 'relative',
  };

  const handleCardHover = (e, enter) => {
    if (enter) {
      e.currentTarget.style.transform = 'translateY(-4px)';
      e.currentTarget.style.boxShadow = '0 12px 32px rgba(0,0,0,0.13)';
    } else {
      e.currentTarget.style.transform = 'translateY(0)';
      e.currentTarget.style.boxShadow = '0 4px 24px rgba(0,0,0,0.08)';
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
    fontSize: '0.97rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    marginTop: 'auto',
    transition: 'opacity 0.15s',
  });

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #f0f9ff 0%, #f8fafc 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '3rem 1rem 2rem',
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #2563eb, #0ea5e9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.25rem',
            boxShadow: '0 4px 20px rgba(37,99,235,0.3)',
          }}
        >
          <Heart size={36} color="#fff" fill="#fff" />
        </div>
        <h1
          style={{
            fontSize: 'clamp(2.2rem, 5vw, 3.2rem)',
            fontWeight: 800,
            background: 'linear-gradient(135deg, #1e40af, #0ea5e9)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            margin: '0 0 0.5rem',
            letterSpacing: '-0.5px',
          }}
        >
          CareWave
        </h1>
        <p
          style={{
            fontSize: '1.2rem',
            fontWeight: 600,
            color: '#334155',
            margin: '0 0 0.5rem',
          }}
        >
          Connecting Rural Healthcare. Reliably.
        </p>
        <p
          style={{
            fontSize: '1rem',
            color: '#64748b',
            maxWidth: 480,
            margin: '0 auto',
            lineHeight: 1.6,
          }}
        >
          Reliable medical consultations, even when connectivity is limited.
        </p>
      </div>

      {/* Role cards grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1.5rem',
          width: '100%',
          maxWidth: 1000,
          marginBottom: '2.5rem',
        }}
      >
        {/* Patient Card */}
        <div
          style={cardStyle}
          onMouseEnter={(e) => handleCardHover(e, true)}
          onMouseLeave={(e) => handleCardHover(e, false)}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: '#dbeafe',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1rem',
            }}
          >
            <User size={28} color="#2563eb" />
          </div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#1e293b', margin: '0 0 0.5rem' }}>
            Patient
          </h2>
          <p style={{ fontSize: '0.95rem', color: '#64748b', lineHeight: 1.6, flexGrow: 1, margin: '0 0 1.5rem' }}>
            View your consultations, medical records, and doctor's advice from anywhere.
          </p>
          <button
            style={btnStyle('#2563eb')}
            onClick={() => navigate('/patient')}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.88'; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
          >
            Open Patient Dashboard <ArrowRight size={16} />
          </button>
        </div>

        {/* Healthcare Worker Card */}
        <div
          style={cardStyle}
          onMouseEnter={(e) => handleCardHover(e, true)}
          onMouseLeave={(e) => handleCardHover(e, false)}
        >
          {/* Badge */}
          <span
            style={{
              position: 'absolute',
              top: 16,
              right: 16,
              background: '#fff7ed',
              color: '#c2410c',
              border: '1px solid #fed7aa',
              borderRadius: 999,
              padding: '2px 10px',
              fontSize: '0.7rem',
              fontWeight: 800,
              letterSpacing: '0.08em',
            }}
          >
            PRIMARY ROLE
          </span>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: '#ccfbf1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1rem',
            }}
          >
            <Activity size={28} color="#0d9488" />
          </div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#1e293b', margin: '0 0 0.5rem' }}>
            Healthcare Worker
          </h2>
          <p style={{ fontSize: '0.95rem', color: '#64748b', lineHeight: 1.6, flexGrow: 1, margin: '0 0 1.5rem' }}>
            Register patients, create consultations, and manage medical data even with poor connectivity.
          </p>
          <button
            style={btnStyle('#0d9488')}
            onClick={() => navigate('/health-worker')}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.88'; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
          >
            Open Healthcare Worker Dashboard <ArrowRight size={16} />
          </button>
        </div>

        {/* Doctor Card */}
        <div
          style={cardStyle}
          onMouseEnter={(e) => handleCardHover(e, true)}
          onMouseLeave={(e) => handleCardHover(e, false)}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: '#dcfce7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1rem',
            }}
          >
            <ClipboardList size={28} color="#16a34a" />
          </div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#1e293b', margin: '0 0 0.5rem' }}>
            Doctor
          </h2>
          <p style={{ fontSize: '0.95rem', color: '#64748b', lineHeight: 1.6, flexGrow: 1, margin: '0 0 1.5rem' }}>
            Review incoming consultations, assess patient data, and submit medical responses.
          </p>
          <button
            style={btnStyle('#16a34a')}
            onClick={() => navigate('/doctor')}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.88'; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
          >
            Open Doctor Dashboard <ArrowRight size={16} />
          </button>
        </div>
      </div>

      {/* Footer note */}
      <div
        style={{
          background: '#fefce8',
          border: '1px solid #fde047',
          borderRadius: 10,
          padding: '0.75rem 1.25rem',
          maxWidth: 680,
          textAlign: 'center',
          fontSize: '0.85rem',
          color: '#78350f',
          lineHeight: 1.5,
        }}
      >
        ⚠️ <strong>Development Mode:</strong> Authentication will be implemented in Phase 7. These are temporary role
        selectors.
      </div>
    </div>
  );
}
