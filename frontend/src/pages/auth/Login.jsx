import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Heart, Lock, Mail, User, Eye, EyeOff, AlertCircle, ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [errorCode, setErrorCode] = useState('');

  const from = location.state?.from?.pathname || null;

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!identifier.trim() || !password) {
      setErrorMessage('Please enter both your email/username and password.');
      setErrorCode('VALIDATION_ERROR');
      return;
    }

    setLoading(true);
    setErrorMessage('');
    setErrorCode('');

    try {
      const isEmail = identifier.includes('@');
      const res = await login({
        email: isEmail ? identifier.trim() : undefined,
        username: !isEmail ? identifier.trim() : undefined,
        password,
      });

      const userRole = res.user?.role;

      // Only redirect to `from` if `from` belongs to the user's authoritative role!
      const isAllowedFrom = from && (
        (userRole === 'admin' && from.startsWith('/admin')) ||
        (userRole === 'doctor' && from.startsWith('/doctor')) ||
        (userRole === 'health_worker' && from.startsWith('/health-worker')) ||
        (userRole === 'patient' && from.startsWith('/patient'))
      );

      if (isAllowedFrom) {
        navigate(from, { replace: true });
        return;
      }

      if (userRole === 'admin') {
        navigate('/admin', { replace: true });
      } else if (userRole === 'doctor') {
        navigate('/doctor', { replace: true });
      } else if (userRole === 'health_worker') {
        navigate('/health-worker', { replace: true });
      } else {
        navigate('/patient', { replace: true });
      }
    } catch (err) {
      console.error('Login error:', err);
      setErrorCode(err.code || 'AUTH_ERROR');
      if (err.code === 'ACCOUNT_PENDING_APPROVAL') {
        setErrorMessage(
          'Your account registration has been submitted and is currently pending administrator verification. Please wait for an administrator to approve your account before logging in.'
        );
      } else if (err.code === 'ACCOUNT_REJECTED') {
        setErrorMessage(
          'Your account registration was reviewed and not approved. Please reach out to your clinic administrator for assistance.'
        );
      } else {
        setErrorMessage(err.message || 'Invalid username/email or password. Please check your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = (roleName, userVal, passVal) => {
    setIdentifier(userVal);
    setPassword(passVal);
    setErrorMessage('');
    setErrorCode('');
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 50%, #f8fafc 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1rem',
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 460,
          background: '#ffffff',
          borderRadius: 20,
          boxShadow: '0 10px 40px rgba(15, 23, 42, 0.08), 0 1px 3px rgba(15, 23, 42, 0.04)',
          border: '1px solid #e2e8f0',
          padding: '2.5rem 2rem',
        }}
      >
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: 'linear-gradient(135deg, #2563eb 0%, #0284c7 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem',
              boxShadow: '0 6px 16px rgba(37, 99, 235, 0.25)',
            }}
          >
            <Heart size={30} color="#ffffff" fill="#ffffff" />
          </div>
          <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.4rem' }}>
            CareWave Login
          </h1>
          <p style={{ fontSize: '0.9rem', color: '#64748b', margin: 0 }}>
            Rural Telemedicine & Asynchronous Clinical Portal
          </p>
        </div>

        {/* Error notification banner */}
        {errorMessage && (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.75rem',
              padding: '0.9rem 1rem',
              borderRadius: 12,
              background: errorCode === 'ACCOUNT_PENDING_APPROVAL' ? '#fffbeb' : '#fef2f2',
              border: errorCode === 'ACCOUNT_PENDING_APPROVAL' ? '1px solid #fcd34d' : '1px solid #fecaca',
              color: errorCode === 'ACCOUNT_PENDING_APPROVAL' ? '#92400e' : '#991b1b',
              fontSize: '0.88rem',
              marginBottom: '1.5rem',
              lineHeight: 1.45,
            }}
          >
            <AlertCircle size={20} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <strong style={{ display: 'block', marginBottom: 2 }}>
                {errorCode === 'ACCOUNT_PENDING_APPROVAL' ? 'Approval Pending' : 'Authentication Error'}
              </strong>
              {errorMessage}
            </div>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>
              Username or Email
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="doctor1, worker1, or user@example.com"
                required
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem 0.75rem 2.6rem',
                  borderRadius: 10,
                  border: '1.5px solid #cbd5e1',
                  fontSize: '0.95rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#2563eb';
                  e.target.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.15)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#cbd5e1';
                  e.target.style.boxShadow = 'none';
                }}
              />
              <User
                size={18}
                color="#94a3b8"
                style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                required
                style={{
                  width: '100%',
                  padding: '0.75rem 2.75rem 0.75rem 2.6rem',
                  borderRadius: 10,
                  border: '1.5px solid #cbd5e1',
                  fontSize: '0.95rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#2563eb';
                  e.target.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.15)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#cbd5e1';
                  e.target.style.boxShadow = 'none';
                }}
              />
              <Lock
                size={18}
                color="#94a3b8"
                style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 4,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {showPassword ? <EyeOff size={18} color="#64748b" /> : <Eye size={18} color="#64748b" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: '0.5rem',
              width: '100%',
              padding: '0.85rem',
              borderRadius: 10,
              border: 'none',
              background: loading ? '#94a3b8' : 'linear-gradient(135deg, #2563eb, #1d4ed8)',
              color: '#ffffff',
              fontSize: '1rem',
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
              transition: 'background 0.2s',
            }}
          >
            {loading ? 'Authenticating...' : 'Sign In'}
            {!loading && <ArrowRight size={18} />}
          </button>
        </form>

        {/* Demo Credentials Quick-Selection */}
        <div style={{ marginTop: '1.75rem', paddingTop: '1.25rem', borderTop: '1px solid #f1f5f9' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.6rem' }}>
            Quick Demo Accounts
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={() => handleQuickFill('Health Worker', 'worker1', 'password123')}
              style={{
                padding: '0.5rem 0.6rem',
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                background: '#f8fafc',
                fontSize: '0.8rem',
                color: '#334155',
                cursor: 'pointer',
                textAlign: 'left',
                fontWeight: 600,
              }}
            >
              👩‍⚕️ Health Worker
            </button>
            <button
              type="button"
              onClick={() => handleQuickFill('Doctor', 'doctor1', 'password123')}
              style={{
                padding: '0.5rem 0.6rem',
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                background: '#f8fafc',
                fontSize: '0.8rem',
                color: '#334155',
                cursor: 'pointer',
                textAlign: 'left',
                fontWeight: 600,
              }}
            >
              👨‍⚕️ Doctor
            </button>
            <button
              type="button"
              onClick={() => handleQuickFill('Patient', 'patient1', 'password123')}
              style={{
                padding: '0.5rem 0.6rem',
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                background: '#f8fafc',
                fontSize: '0.8rem',
                color: '#334155',
                cursor: 'pointer',
                textAlign: 'left',
                fontWeight: 600,
              }}
            >
              🧑 Patient
            </button>
            <button
              type="button"
              onClick={() => handleQuickFill('Administrator', 'admin', 'admin123')}
              style={{
                padding: '0.5rem 0.6rem',
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                background: '#f8fafc',
                fontSize: '0.8rem',
                color: '#334155',
                cursor: 'pointer',
                textAlign: 'left',
                fontWeight: 600,
              }}
            >
              🛡️ Admin
            </button>
          </div>
        </div>

        {/* Footer Registration Link */}
        <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.88rem', color: '#64748b' }}>
          Don't have an account?{' '}
          <Link
            to="/register"
            style={{ color: '#2563eb', fontWeight: 700, textDecoration: 'none' }}
          >
            Register here
          </Link>
        </div>
      </div>
    </div>
  );
}

