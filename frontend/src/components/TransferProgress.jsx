import { Check, X, Clock, RefreshCw, Play, AlertCircle, Upload, Loader } from 'lucide-react';

const statusLabels = {
  saving:     'Saving...',
  queued:     'Queued',
  uploading:  'Uploading',
  paused:     'Paused',
  failed:     'Failed',
  delivered:  'Delivered',
};

const statusColors = {
  saving:    { bg: '#dbeafe', color: '#1e40af' },
  queued:    { bg: '#f1f5f9', color: '#475569' },
  uploading: { bg: '#e0f2fe', color: '#0369a1' },
  paused:    { bg: '#fef3c7', color: '#92400e' },
  failed:    { bg: '#fee2e2', color: '#991b1b' },
  delivered: { bg: '#dcfce7', color: '#166534' },
};

function ComponentIcon({ status }) {
  const size = 14;
  switch (status) {
    case 'done':      return <Check size={size} color="#22c55e" />;
    case 'failed':    return <X size={size} color="#ef4444" />;
    case 'uploading': return <Loader size={size} color="#0ea5e9" />;
    case 'pending':
    default:          return <Clock size={size} color="#94a3b8" />;
  }
}

function ActionButton({ label, onClick, icon: Icon, variant = 'primary' }) {
  const styles = {
    primary:   { backgroundColor: '#0ea5e9', color: '#fff', border: 'none' },
    secondary: { backgroundColor: '#f1f5f9', color: '#475569', border: 'none' },
    danger:    { backgroundColor: '#fee2e2', color: '#991b1b', border: 'none' },
  };
  const s = styles[variant] || styles.primary;
  return (
    <button
      onClick={onClick}
      style={{
        ...s,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '6px 12px',
        borderRadius: 7,
        fontSize: '0.8rem',
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'opacity 0.15s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
      onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
    >
      {Icon && <Icon size={13} />}
      {label}
    </button>
  );
}

export default function TransferProgress({
  upload,
  onSyncNow,
  onResume,
  onRetry,
  onCancel,
  onViewDetails,
}) {
  if (!upload) return null;

  const {
    consultationId,
    patientName,
    status = 'queued',
    progress = 0,
    pendingComponents = [],
    failedComponents = [],
    lastSync,
    createdAt,
  } = upload;

  const statusLabel = statusLabels[status] || status;
  const statusStyle = statusColors[status] || statusColors.queued;
  const consultId = `CON-${String(consultationId || '???').padStart(4, '0')}`;

  const allComponents = [
    ...pendingComponents.map((c) => ({ name: c, status: 'pending' })),
    ...failedComponents.map((c) => ({ name: c, status: 'failed' })),
  ];

  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        borderRadius: 12,
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid #f1f5f9',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <span style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.9375rem' }}>
            {patientName || 'Unknown Patient'}
          </span>
          <span style={{ marginLeft: 8, fontSize: '0.75rem', color: '#94a3b8' }}>{consultId}</span>
        </div>

        <span
          style={{
            ...statusStyle,
            borderRadius: 999,
            padding: '2px 10px',
            fontSize: '0.75rem',
            fontWeight: 700,
          }}
        >
          {statusLabel}
        </span>
      </div>

      {/* Progress bar */}
      <div style={{ padding: '12px 16px 0' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '0.75rem',
            color: '#64748b',
            marginBottom: 4,
          }}
        >
          <span>Upload progress</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div
          style={{
            height: 6,
            backgroundColor: '#e2e8f0',
            borderRadius: 999,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${Math.min(100, Math.max(0, progress))}%`,
              backgroundColor: status === 'failed' ? '#ef4444' : '#0ea5e9',
              borderRadius: 999,
              transition: 'width 0.4s ease',
            }}
          />
        </div>
      </div>

      {/* Component list */}
      {allComponents.length > 0 && (
        <div style={{ padding: '10px 16px' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>
            Components
          </span>
          <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {allComponents.map((comp, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: '0.8125rem',
                  color: '#475569',
                }}
              >
                <ComponentIcon status={comp.status} />
                {comp.name}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Meta */}
      <div
        style={{
          padding: '4px 16px 10px',
          display: 'flex',
          gap: 16,
          fontSize: '0.7rem',
          color: '#94a3b8',
        }}
      >
        {lastSync && <span>Last sync: {new Date(lastSync).toLocaleString()}</span>}
        {createdAt && <span>Created: {new Date(createdAt).toLocaleDateString()}</span>}
      </div>

      {/* Action buttons */}
      <div
        style={{
          padding: '10px 16px 14px',
          borderTop: '1px solid #f1f5f9',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        {status === 'queued' && (
          <ActionButton label="Sync Now" onClick={onSyncNow} icon={Upload} />
        )}
        {status === 'paused' && (
          <ActionButton label="Resume" onClick={onResume} icon={Play} />
        )}
        {status === 'failed' && (
          <ActionButton label="Retry" onClick={onRetry} icon={RefreshCw} />
        )}
        {(status === 'queued' || status === 'paused' || status === 'failed') && (
          <ActionButton label="Cancel" onClick={onCancel} variant="danger" icon={X} />
        )}
        <ActionButton label="View Details" onClick={onViewDetails} variant="secondary" icon={AlertCircle} />
      </div>
    </div>
  );
}
