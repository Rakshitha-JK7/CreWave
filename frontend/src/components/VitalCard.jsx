import { AlertTriangle } from 'lucide-react';

function formatVitalValue(val) {
  if (val === null || val === undefined) return '';
  if (typeof val === 'object') {
    if (val.systolic !== undefined && val.diastolic !== undefined) {
      return `${val.systolic}/${val.diastolic}`;
    }
    if (val.value !== undefined) {
      return String(val.value);
    }
    const vals = Object.values(val).filter((v) => v !== null && v !== undefined && typeof v !== 'object');
    return vals.length > 0 ? vals.join('/') : '—';
  }
  return String(val);
}

function isOutOfRange(value, normalRange) {
  if (!normalRange) return false;
  const formatted = formatVitalValue(value);
  const num = parseFloat(formatted);
  if (isNaN(num)) return false;
  return num < normalRange.min || num > normalRange.max;
}

export default function VitalCard({ label, value, unit, timestamp, isAvailable, icon: Icon, normalRange }) {
  const displayValue = formatVitalValue(value);
  const outOfRange = isAvailable && isOutOfRange(value, normalRange);

  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        borderRadius: 12,
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        borderLeft: outOfRange ? '4px solid #f59e0b' : '4px solid transparent',
      }}
    >
      {/* Header: icon + label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {Icon && (
          <Icon
            size={18}
            color={isAvailable ? '#0ea5e9' : '#cbd5e1'}
            strokeWidth={2}
          />
        )}
        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#64748b' }}>{label}</span>
        {outOfRange && (
          <AlertTriangle size={14} color="#f59e0b" style={{ marginLeft: 'auto' }} />
        )}
      </div>

      {/* Value */}
      {isAvailable && displayValue ? (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span style={{ fontSize: '1.5rem', fontWeight: 700, color: outOfRange ? '#f59e0b' : '#1e293b' }}>
            {displayValue}
          </span>
          {unit && (
            <span style={{ fontSize: '0.8125rem', color: '#94a3b8', fontWeight: 500 }}>{unit}</span>
          )}
        </div>
      ) : (
        <span style={{ fontSize: '0.875rem', color: '#cbd5e1', fontStyle: 'italic' }}>Not Measured</span>
      )}

      {/* Normal range hint */}
      {isAvailable && normalRange && (
        <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
          Normal: {normalRange.min}–{normalRange.max} {unit}
        </span>
      )}

      {/* Timestamp */}
      {timestamp && (
        <span style={{ fontSize: '0.7rem', color: '#cbd5e1', marginTop: 'auto' }}>
          {new Date(timestamp).toLocaleString()}
        </span>
      )}
    </div>
  );
}
