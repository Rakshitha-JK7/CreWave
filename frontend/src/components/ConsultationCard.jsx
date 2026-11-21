import { Calendar, User } from 'lucide-react';
import StatusBadge from './StatusBadge';

function RoleButtons({ role, consultation, onViewDetails, onViewAdvice, onReview }) {
  const btnBase = {
    padding: '7px 14px',
    borderRadius: 7,
    fontSize: '0.8125rem',
    fontWeight: 600,
    cursor: 'pointer',
    border: 'none',
    transition: 'opacity 0.15s',
  };

  const primary = { ...btnBase, backgroundColor: '#0ea5e9', color: '#fff' };
  const secondary = { ...btnBase, backgroundColor: '#f1f5f9', color: '#475569' };

  const hover = (e) => (e.currentTarget.style.opacity = '0.85');
  const leave = (e) => (e.currentTarget.style.opacity = '1');

  const isResponseAvailable =
    consultation.status === 'response_available' || consultation.status === 'completed';
  const isReviewed = consultation.status === 'reviewed' || consultation.status === 'completed';

  if (role === 'patient') {
    return (
      <div style={{ display: 'flex', gap: 8 }}>
        <button style={primary} onClick={onViewDetails} onMouseEnter={hover} onMouseLeave={leave}>
          View Details
        </button>
        {isResponseAvailable && (
          <button style={secondary} onClick={onViewAdvice} onMouseEnter={hover} onMouseLeave={leave}>
            View Advice
          </button>
        )}
      </div>
    );
  }

  if (role === 'healthWorker') {
    return (
      <div style={{ display: 'flex', gap: 8 }}>
        <button style={primary} onClick={onViewDetails} onMouseEnter={hover} onMouseLeave={leave}>
          View Details
        </button>
        {isResponseAvailable && (
          <button style={secondary} onClick={onViewAdvice} onMouseEnter={hover} onMouseLeave={leave}>
            View Response
          </button>
        )}
      </div>
    );
  }

  if (role === 'doctor') {
    return (
      <div style={{ display: 'flex', gap: 8 }}>
        {isReviewed ? (
          <button style={secondary} onClick={onViewDetails} onMouseEnter={hover} onMouseLeave={leave}>
            View Response
          </button>
        ) : (
          <button style={primary} onClick={onReview} onMouseEnter={hover} onMouseLeave={leave}>
            Review
          </button>
        )}
      </div>
    );
  }

  return null;
}

export default function ConsultationCard({
  consultation,
  role = 'healthWorker',
  onViewDetails,
  onViewAdvice,
  onReview,
}) {
  if (!consultation) return null;

  const consultId = `CON-${String(consultation.id || consultation._id || '???').padStart(4, '0')}`;
  const patientName =
    consultation.patientName ||
    consultation.patient_name ||
    (consultation.patient && consultation.patient.name) ||
    'Unknown Patient';
  const patientId =
    consultation.patientId ||
    consultation.patient_id ||
    (consultation.patient && consultation.patient.id);
  const date = consultation.date || consultation.created_at || consultation.createdAt;

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
      {/* Top row */}
      <div
        style={{
          padding: '12px 16px 10px',
          borderBottom: '1px solid #f1f5f9',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <User size={15} color="#64748b" />
          <div>
            <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#1e293b' }}>
              {patientName}
            </span>
            {patientId && (
              <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginLeft: 6 }}>
                PAT-{String(patientId).padStart(3, '0')}
              </span>
            )}
          </div>
        </div>

        <span
          style={{
            backgroundColor: '#f1f5f9',
            color: '#475569',
            borderRadius: 999,
            padding: '2px 8px',
            fontSize: '0.7rem',
            fontWeight: 700,
          }}
        >
          {consultId}
        </span>
      </div>

      {/* Meta row */}
      <div
        style={{
          padding: '10px 16px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          alignItems: 'center',
        }}
      >
        {date && (
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: '0.8125rem',
              color: '#64748b',
            }}
          >
            <Calendar size={13} />
            {new Date(date).toLocaleDateString()}
          </span>
        )}
        <StatusBadge status={consultation.status} type="consultation" />
        {consultation.urgency && (
          <StatusBadge status={consultation.urgency} type="urgency" />
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: '10px 16px 14px' }}>
        <RoleButtons
          role={role}
          consultation={consultation}
          onViewDetails={onViewDetails}
          onViewAdvice={onViewAdvice}
          onReview={onReview}
        />
      </div>
    </div>
  );
}
