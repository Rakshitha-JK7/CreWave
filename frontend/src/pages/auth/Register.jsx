import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Heart,
  User,
  Mail,
  Lock,
  Phone,
  Briefcase,
  Hospital,
  MapPin,
  FileBadge,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  ShieldAlert,
  Clock,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function Register() {
  const navigate = useNavigate();
  const { register } = useAuth();

  // Role Selection: 'health_worker' | 'doctor' | 'patient'
  const [role, setRole] = useState('health_worker');

  // Base Credentials
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Role-Specific Fields
  // Health Worker:
  const [clinicName, setClinicName] = useState('');
  const [village, setVillage] = useState('');
  const [district, setDistrict] = useState('');

  // Doctor:
  const [specialization, setSpecialization] = useState('General Medicine');
  const [licenseNumber, setLicenseNumber] = useState('');

  // Patient:
  const [age, setAge] = useState('');
  const [sex, setSex] = useState('Male');
  const [bloodGroup, setBloodGroup] = useState('B+');

  // Status & Feedback State
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [pendingApprovalSuccess, setPendingApprovalSuccess] = useState(null); // stores user on successful pending registration

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    // Field Validations
    if (!name.trim()) {
      setErrorMessage('Full name is required.');
      return;
    }

    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('A valid email address is required.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please re-enter your password.');
      return;
    }

    // Role-specific validations
    if (role === 'health_worker' && !village.trim()) {
      setErrorMessage('Assigned village/hamlet is required for health worker accounts.');
      return;
    }

    if (role === 'doctor' && !licenseNumber.trim()) {
      setErrorMessage('Medical registration/license number is required for doctor accounts.');
      return;
    }

    if (role === 'patient') {
      if (!age || parseInt(age, 10) <= 0) {
        setErrorMessage('Valid age is required for patient accounts.');
        return;
      }
      if (!village.trim()) {
        setErrorMessage('Village is required for patient accounts.');
        return;
      }
    }

    setLoading(true);

    try {
      const payload = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        username: email.trim().toLowerCase(),
        password,
        role,
        phone: phone.trim() || undefined,
        contactNumber: phone.trim() || undefined,
      };

      if (role === 'health_worker') {
        payload.clinicName = clinicName.trim() || undefined;
        payload.village = village.trim();
        payload.district = district.trim() || undefined;
      } else if (role === 'doctor') {
        payload.specialization = specialization;
        payload.licenseNumber = licenseNumber.trim();
      } else if (role === 'patient') {
        payload.age = parseInt(age, 10);
        payload.sex = sex;
        payload.village = village.trim();
        payload.bloodGroup = bloodGroup;
      }

      const res = await register(payload);

      if (res.status === 'pending') {
        // Privileged account (doctor or health_worker) queued for administrative approval
        setPendingApprovalSuccess(res.user);
      } else {
        // Patient account: activated immediately
        navigate('/patient', { replace: true });
      }
    } catch (err) {
      console.error('Registration failed:', err);
      setErrorMessage(err.message || 'Registration failed. Please check your information and try again.');
    } finally {
      setLoading(false);
    }
  };

  // If user completed registration for a pending approval role, show dedicated success screen
  if (pendingApprovalSuccess) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 50%, #f8fafc 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem 1rem',
          fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 520,
            background: '#ffffff',
            borderRadius: 20,
            boxShadow: '0 10px 40px rgba(15, 23, 42, 0.08)',
            border: '1px solid #e2e8f0',
            padding: '3rem 2.2rem',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: 68,
              height: 68,
              borderRadius: '50%',
              background: '#ecfdf5',
              border: '2px solid #a7f3d0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.5rem',
            }}
          >
            <Clock size={36} color="#059669" />
          </div>

          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.75rem' }}>
            Registration Submitted
          </h2>
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 12,
              padding: '1rem',
              marginBottom: '1.5rem',
              textAlign: 'left',
              fontSize: '0.9rem',
              color: '#334155',
              lineHeight: 1.6,
            }}
          >
            <p style={{ margin: '0 0 0.5rem' }}>
              <strong>Applicant:</strong> {pendingApprovalSuccess.name}
            </p>
            <p style={{ margin: '0 0 0.5rem' }}>
              <strong>Role:</strong> {pendingApprovalSuccess.role === 'doctor' ? 'Medical Doctor' : 'Rural Health Worker'}
            </p>
            <p style={{ margin: '0 0 0.5rem' }}>
              <strong>Email:</strong> {pendingApprovalSuccess.email || pendingApprovalSuccess.username}
            </p>
            <p style={{ margin: 0 }}>
              <strong>Status:</strong>{' '}
              <span style={{ color: '#d97706', fontWeight: 700 }}>Pending Administrative Approval</span>
            </p>
          </div>

          <p style={{ fontSize: '0.92rem', color: '#64748b', lineHeight: 1.5, marginBottom: '2rem' }}>
            To safeguard clinical records and protect patient privacy, privileged accounts require administrative verification.
            An administrator will review your medical credentials and activate your account. You will be able to log in once approved.
          </p>

          <button
            type="button"
            onClick={() => navigate('/login')}
            style={{
              width: '100%',
              padding: '0.85rem',
              borderRadius: 10,
              border: 'none',
              background: '#2563eb',
              color: '#ffffff',
              fontSize: '1rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
            }}
          >
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 50%, #f8fafc 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '3rem 1rem',
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 580,
          background: '#ffffff',
          borderRadius: 20,
          boxShadow: '0 10px 40px rgba(15, 23, 42, 0.08), 0 1px 3px rgba(15, 23, 42, 0.04)',
          border: '1px solid #e2e8f0',
          padding: '2.5rem 2.25rem',
        }}
      >
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: 'linear-gradient(135deg, #2563eb 0%, #0284c7 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 0.9rem',
              boxShadow: '0 6px 16px rgba(37, 99, 235, 0.25)',
            }}
          >
            <Heart size={28} color="#ffffff" fill="#ffffff" />
          </div>
          <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.35rem' }}>
            Create Your Account
          </h1>
          <p style={{ fontSize: '0.88rem', color: '#64748b', margin: 0 }}>
            Join the CareWave rural telemedicine and consultation network
          </p>
        </div>

        {/* Error notification */}
        {errorMessage && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.85rem 1rem',
              borderRadius: 12,
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#991b1b',
              fontSize: '0.88rem',
              marginBottom: '1.5rem',
            }}
          >
            <AlertCircle size={20} style={{ flexShrink: 0 }} />
            <div>{errorMessage}</div>
          </div>
        )}

        {/* Role Selection Tabs */}
        <div style={{ marginBottom: '1.75rem' }}>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '0.6rem' }}>
            Select Account Role
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={() => setRole('health_worker')}
              style={{
                padding: '0.85rem 0.5rem',
                borderRadius: 12,
                border: role === 'health_worker' ? '2px solid #2563eb' : '1.5px solid #e2e8f0',
                background: role === 'health_worker' ? '#eff6ff' : '#f8fafc',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all 0.15s',
              }}
            >
              <div style={{ fontSize: '1.3rem', marginBottom: 4 }}>👩‍⚕️</div>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: role === 'health_worker' ? '#1d4ed8' : '#334155' }}>
                Health Worker
              </div>
            </button>

            <button
              type="button"
              onClick={() => setRole('doctor')}
              style={{
                padding: '0.85rem 0.5rem',
                borderRadius: 12,
                border: role === 'doctor' ? '2px solid #2563eb' : '1.5px solid #e2e8f0',
                background: role === 'doctor' ? '#eff6ff' : '#f8fafc',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all 0.15s',
              }}
            >
              <div style={{ fontSize: '1.3rem', marginBottom: 4 }}>👨‍⚕️</div>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: role === 'doctor' ? '#1d4ed8' : '#334155' }}>
                Doctor
              </div>
            </button>

            <button
              type="button"
              onClick={() => setRole('patient')}
              style={{
                padding: '0.85rem 0.5rem',
                borderRadius: 12,
                border: role === 'patient' ? '2px solid #2563eb' : '1.5px solid #e2e8f0',
                background: role === 'patient' ? '#eff6ff' : '#f8fafc',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all 0.15s',
              }}
            >
              <div style={{ fontSize: '1.3rem', marginBottom: 4 }}>🧑</div>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: role === 'patient' ? '#1d4ed8' : '#334155' }}>
                Patient
              </div>
            </button>
          </div>

          <div style={{ marginTop: '0.6rem', fontSize: '0.78rem', color: '#64748b' }}>
            {role === 'health_worker' && 'Community health worker managing rural consultations (requires admin approval).'}
            {role === 'doctor' && 'Licensed physician evaluating clinical cases and issuing advice (requires admin approval).'}
            {role === 'patient' && 'Patient account with direct access to your personal consultations (instant activation).'}
          </div>
        </div>

        {/* Registration Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
          {/* Full Name */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>
              Full Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Dr. Rajesh Verma, Sunita Devi"
              required
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                borderRadius: 10,
                border: '1.5px solid #cbd5e1',
                fontSize: '0.95rem',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Email & Phone Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>
                Email Address *
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                required
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  borderRadius: 10,
                  border: '1.5px solid #cbd5e1',
                  fontSize: '0.95rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>
                Phone Number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  borderRadius: 10,
                  border: '1.5px solid #cbd5e1',
                  fontSize: '0.95rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          {/* Password & Confirm Password Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>
                Password *
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 6 characters"
                required
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  borderRadius: 10,
                  border: '1.5px solid #cbd5e1',
                  fontSize: '0.95rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>
                Confirm Password *
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                required
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  borderRadius: 10,
                  border: '1.5px solid #cbd5e1',
                  fontSize: '0.95rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          {/* Role-Specific Fields Section */}
          <div style={{ marginTop: '0.5rem', paddingTop: '1rem', borderTop: '1px solid #f1f5f9' }}>
            {role === 'health_worker' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1e293b' }}>
                  Health Worker Assignment Details
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
                      Primary Health Center / Clinic
                    </label>
                    <input
                      type="text"
                      value={clinicName}
                      onChange={(e) => setClinicName(e.target.value)}
                      placeholder="e.g. Rampur Primary Health Centre"
                      style={{
                        width: '100%',
                        padding: '0.7rem 0.9rem',
                        borderRadius: 8,
                        border: '1.5px solid #cbd5e1',
                        fontSize: '0.9rem',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
                      Assigned Village / Hamlet *
                    </label>
                    <input
                      type="text"
                      value={village}
                      onChange={(e) => setVillage(e.target.value)}
                      placeholder="e.g. Rampur Hamlet 2"
                      required
                      style={{
                        width: '100%',
                        padding: '0.7rem 0.9rem',
                        borderRadius: 8,
                        border: '1.5px solid #cbd5e1',
                        fontSize: '0.9rem',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            {role === 'doctor' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1e293b' }}>
                  Medical Professional Credentials
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
                      Medical Specialization *
                    </label>
                    <select
                      value={specialization}
                      onChange={(e) => setSpecialization(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.7rem 0.9rem',
                        borderRadius: 8,
                        border: '1.5px solid #cbd5e1',
                        fontSize: '0.9rem',
                        outline: 'none',
                        boxSizing: 'border-box',
                        background: '#ffffff',
                      }}
                    >
                      <option value="General Medicine">General Medicine</option>
                      <option value="Cardiology">Cardiology</option>
                      <option value="Pulmonology">Pulmonology</option>
                      <option value="Pediatrics">Pediatrics</option>
                      <option value="Dermatology">Dermatology</option>
                      <option value="Orthopedics">Orthopedics</option>
                      <option value="Obstetrics & Gynecology">Obstetrics & Gynecology</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
                      Medical License / Reg. No. *
                    </label>
                    <input
                      type="text"
                      value={licenseNumber}
                      onChange={(e) => setLicenseNumber(e.target.value)}
                      placeholder="e.g. MCI-2018-99482"
                      required
                      style={{
                        width: '100%',
                        padding: '0.7rem 0.9rem',
                        borderRadius: 8,
                        border: '1.5px solid #cbd5e1',
                        fontSize: '0.9rem',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            {role === 'patient' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1e293b' }}>
                  Patient Profile Information
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.65rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
                      Age *
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="125"
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                      placeholder="e.g. 45"
                      required
                      style={{
                        width: '100%',
                        padding: '0.7rem 0.6rem',
                        borderRadius: 8,
                        border: '1.5px solid #cbd5e1',
                        fontSize: '0.9rem',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
                      Sex *
                    </label>
                    <select
                      value={sex}
                      onChange={(e) => setSex(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.7rem 0.6rem',
                        borderRadius: 8,
                        border: '1.5px solid #cbd5e1',
                        fontSize: '0.9rem',
                        outline: 'none',
                        boxSizing: 'border-box',
                        background: '#ffffff',
                      }}
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
                      Blood Group
                    </label>
                    <select
                      value={bloodGroup}
                      onChange={(e) => setBloodGroup(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.7rem 0.6rem',
                        borderRadius: 8,
                        border: '1.5px solid #cbd5e1',
                        fontSize: '0.9rem',
                        outline: 'none',
                        boxSizing: 'border-box',
                        background: '#ffffff',
                      }}
                    >
                      <option value="A+">A+</option>
                      <option value="A-">A-</option>
                      <option value="B+">B+</option>
                      <option value="B-">B-</option>
                      <option value="O+">O+</option>
                      <option value="O-">O-</option>
                      <option value="AB+">AB+</option>
                      <option value="AB-">AB-</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
                      Village *
                    </label>
                    <input
                      type="text"
                      value={village}
                      onChange={(e) => setVillage(e.target.value)}
                      placeholder="Village name"
                      required
                      style={{
                        width: '100%',
                        padding: '0.7rem 0.6rem',
                        borderRadius: 8,
                        border: '1.5px solid #cbd5e1',
                        fontSize: '0.9rem',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: '0.8rem',
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
            }}
          >
            {loading ? 'Creating Account...' : 'Complete Registration'}
            {!loading && <ArrowRight size={18} />}
          </button>
        </form>

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.88rem', color: '#64748b' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: '#2563eb', fontWeight: 700, textDecoration: 'none' }}>
            Sign In here
          </Link>
        </div>
      </div>
    </div>
  );
}

