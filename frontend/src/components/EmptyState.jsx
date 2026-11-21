export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '48px 24px',
        gap: 16,
      }}
    >
      {Icon && (
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            backgroundColor: '#f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon size={48} color="#94a3b8" strokeWidth={1.5} />
        </div>
      )}

      <h3
        style={{
          margin: 0,
          fontSize: '1.125rem',
          fontWeight: 600,
          color: '#1e293b',
        }}
      >
        {title}
      </h3>

      {description && (
        <p
          style={{
            margin: 0,
            fontSize: '0.875rem',
            color: '#94a3b8',
            maxWidth: 360,
            lineHeight: 1.6,
          }}
        >
          {description}
        </p>
      )}

      {action && (
        <button
          onClick={action.onClick}
          style={{
            marginTop: 8,
            padding: '10px 24px',
            backgroundColor: '#0ea5e9',
            color: '#ffffff',
            border: 'none',
            borderRadius: 8,
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'background-color 0.2s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#0284c7')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#0ea5e9')}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
