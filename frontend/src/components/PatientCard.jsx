import { Phone, MapPin, User, Calendar } from 'lucide-react';

function InfoItem({ icon: Icon, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#64748b', fontSize: '0.8125rem' }}>
      <Icon size={13} strokeWidth={2} />
      <span>{label}</span>
    </div>
  );
}

function ActionButton({ label, onClick, variant = 'primary' }) {
  const styles = {
    primary: { backgroundColor: '#0ea5e9', color: '#ffffff', border: 'none' },
    secondary: { backgroundColor: '#ffffff', color: '#0ea5e9', border: '1.5px solid #0ea5e9' },
    ghost: { backgroundColor: '#f1f5f9', color: '#475569', border: 'none' },
  };

  const base = styles[variant];

  return (
    <button
      onClick={onClick}
      style={{
        ...base,
        padding: '7px 14px',
        borderRadius: 7,
        fontSize: '0.8125rem',
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'opacity 0.15s',
        flex: 1,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
      onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
    >
      {label}
    </button>
  );
}

export default function PatientCard({ patient, onViewProfile, onNewConsultation, onViewHistory }) {
  if (!patient) return null;

  const patientId = `PAT-${String(patient.id || patient._id || '???').padStart(3, '0')}`;

  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        borderRadius: 12,
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '14px 16px 10px',
          borderBottom: '1px solid #f1f5f9',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <h3
            style={{
              margin: 0,
              fontSize: '1rem',
              fontWeight: 700,
              color: '#1e293b',
            }}
          >
            {patient.name || patient.full_name || 'Unknown Patient'}
          </h3>
          <span
            style={{
              backgroundColor: '#dbeafe',
              color: '#1e40af',
              borderRadius: 999,
              padding: '2px 8px',
              fontSize: '0.7rem',
              fontWeight: 700,
              letterSpacing: '0.03em',
            }}
          >
            {patientId}
          </span>
        </div>
      </div>

      {/* Info row */}
      <div style={{ padding: '10px 16px', display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {(patient.age || patient.sex) && (
          <InfoItem
            icon={User}
            label={[patient.age && `${patient.age}y`, patient.sex].filter(Boolean).join(' · ')}
          />
        )}
        {(patient.village || patient.address) && (
          <InfoItem icon={MapPin} label={patient.village || patient.address} />
        )}
        {patient.phone && (
          <InfoItem icon={Phone} label={patient.phone} />
        )}
        {patient.lastConsultation && (
          <InfoItem
            icon={Calendar}
            label={`Last visit: ${new Date(patient.lastConsultation).toLocaleDateString()}`}
          />
        )}
      </div>

      {/* Footer buttons */}
      <div
        style={{
          padding: '10px 16px 14px',
          display: 'flex',
          gap: 8,
        }}
      >
        <ActionButton label="View Profile" onClick={onViewProfile} variant="primary" />
        <ActionButton label="New Consultation" onClick={onNewConsultation} variant="secondary" />
        <ActionButton label="View History" onClick={onViewHistory} variant="ghost" />
      </div>
    </div>
  );
}
