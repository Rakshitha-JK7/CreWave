import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useApp } from '../context/AppContext';

const statusConfig = {
  online:    { color: '#22c55e', label: 'Online' },
  slow:      { color: '#eab308', label: 'Slow Connection' },
  unstable:  { color: '#f59e0b', label: 'Unstable' },
  offline:   { color: '#ef4444', label: 'Offline' },
};

export default function NetworkStatus() {
  const { status } = useNetworkStatus();
  const { state } = useApp();

  const cfg = statusConfig[status] || statusConfig.online;
  const pendingCount = state?.pendingUploads?.length || state?.pendingCount || 0;

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: 999,
        padding: '4px 12px',
        fontSize: '0.75rem',
        fontWeight: 600,
        color: '#475569',
        userSelect: 'none',
      }}
    >
      {/* Dot */}
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: cfg.color,
          display: 'inline-block',
          flexShrink: 0,
          boxShadow: `0 0 0 2px ${cfg.color}33`,
        }}
      />
      <span style={{ color: cfg.color }}>{cfg.label}</span>

      {status === 'offline' && pendingCount > 0 && (
        <span
          style={{
            marginLeft: 4,
            backgroundColor: '#fef3c7',
            color: '#92400e',
            borderRadius: 999,
            padding: '1px 7px',
            fontSize: '0.7rem',
          }}
        >
          {pendingCount} pending sync
        </span>
      )}
    </div>
  );
}
