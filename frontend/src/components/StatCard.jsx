import { TrendingUp, TrendingDown } from 'lucide-react';

const colorValues = {
  blue:   '#0ea5e9',
  teal:   '#14b8a6',
  green:  '#22c55e',
  orange: '#f59e0b',
  red:    '#ef4444',
};

function hexAlpha(hex, alpha) {
  // Convert hex to rgba for icon bg
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export default function StatCard({ title, value, subtitle, icon: Icon, color = 'blue', trend }) {
  const iconColor = colorValues[color] || colorValues.blue;
  const iconBg = hexAlpha(iconColor, 0.1);

  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        borderRadius: 12,
        boxShadow: '0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)',
        padding: '20px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      {/* Top row: title + icon */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span
          style={{
            fontSize: '0.875rem',
            fontWeight: 600,
            color: '#64748b',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {title}
        </span>

        {Icon && (
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              backgroundColor: iconBg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Icon size={20} color={iconColor} strokeWidth={2} />
          </div>
        )}
      </div>

      {/* Value */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
        <span
          style={{
            fontSize: '2rem',
            fontWeight: 700,
            color: '#1e293b',
            lineHeight: 1,
          }}
        >
          {value}
        </span>

        {trend && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 2,
              fontSize: '0.75rem',
              fontWeight: 600,
              color: trend.direction === 'up' ? '#22c55e' : '#ef4444',
              marginBottom: 2,
            }}
          >
            {trend.direction === 'up' ? (
              <TrendingUp size={14} />
            ) : (
              <TrendingDown size={14} />
            )}
            {trend.value}
          </span>
        )}
      </div>

      {/* Subtitle */}
      {subtitle && (
        <span style={{ fontSize: '0.8125rem', color: '#94a3b8' }}>{subtitle}</span>
      )}
    </div>
  );
}
