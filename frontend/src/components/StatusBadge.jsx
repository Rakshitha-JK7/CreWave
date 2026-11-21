import {
  getConsultationStatusLabel,
  getConsultationStatusColor,
  getAttachmentStatusLabel,
  getAttachmentStatusColor,
  getReviewStatusLabel,
  getReviewStatusColor,
  getUrgencyLabel,
  getUrgencyColor,
} from '../utils/statusHelpers';

const colorMap = {
  'badge-success':   { bg: '#dcfce7', color: '#166534' },
  'badge-warning':   { bg: '#fef3c7', color: '#92400e' },
  'badge-danger':    { bg: '#fee2e2', color: '#991b1b' },
  'badge-info':      { bg: '#dbeafe', color: '#1e40af' },
  'badge-secondary': { bg: '#f1f5f9', color: '#475569' },
  'badge-purple':    { bg: '#f3e8ff', color: '#6b21a8' },
  'badge-primary':   { bg: '#e0f2fe', color: '#0369a1' },
};

function resolveLabel(status, type) {
  switch (type) {
    case 'consultation': return getConsultationStatusLabel(status);
    case 'attachment':   return getAttachmentStatusLabel(status);
    case 'review':       return getReviewStatusLabel(status);
    case 'urgency':      return getUrgencyLabel(status);
    default:             return String(status);
  }
}

function resolveClass(status, type) {
  switch (type) {
    case 'consultation': return getConsultationStatusColor(status);
    case 'attachment':   return getAttachmentStatusColor(status);
    case 'review':       return getReviewStatusColor(status);
    case 'urgency':      return getUrgencyColor(status);
    default:             return 'badge-secondary';
  }
}

export default function StatusBadge({ status, type = 'consultation' }) {
  const safeStatus =
    typeof status === 'object' && status !== null
      ? (status.label || status.name || status.status || status.value || '')
      : (status || '');
  const rawLabel = resolveLabel(safeStatus, type);
  const label =
    typeof rawLabel === 'object' && rawLabel !== null
      ? (rawLabel.label || rawLabel.name || safeStatus || '—')
      : String(rawLabel ?? '—');
  const cls = resolveClass(safeStatus, type);
  const { bg, color } = colorMap[cls] || colorMap['badge-secondary'];

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: 999,
        padding: '2px 10px',
        fontSize: '0.75rem',
        fontWeight: 600,
        backgroundColor: bg,
        color,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}
