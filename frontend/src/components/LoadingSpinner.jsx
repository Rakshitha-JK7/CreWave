import { useEffect, useState } from 'react';

const sizeMap = {
  sm: { size: 24, border: 3 },
  md: { size: 40, border: 4 },
  lg: { size: 56, border: 5 },
};

export default function LoadingSpinner({ size = 'md', text }) {
  const { size: dim, border } = sizeMap[size] || sizeMap.md;
  const [angle, setAngle] = useState(0);

  useEffect(() => {
    let frame;
    let last = performance.now();
    const spin = (now) => {
      const delta = now - last;
      last = now;
      setAngle((a) => (a + delta * 0.36) % 360);
      frame = requestAnimationFrame(spin);
    };
    frame = requestAnimationFrame(spin);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
      }}
    >
      <div
        style={{
          width: dim,
          height: dim,
          borderRadius: '50%',
          border: `${border}px solid #e2e8f0`,
          borderTopColor: '#0ea5e9',
          transform: `rotate(${angle}deg)`,
          boxSizing: 'border-box',
        }}
      />
      {text && (
        <span
          style={{
            fontSize: '0.875rem',
            color: '#94a3b8',
            fontWeight: 500,
          }}
        >
          {text}
        </span>
      )}
    </div>
  );
}
