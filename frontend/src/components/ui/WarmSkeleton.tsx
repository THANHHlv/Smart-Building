import React from 'react';

interface WarmSkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  className?: string;
  style?: React.CSSProperties;
}

export const WarmSkeleton: React.FC<WarmSkeletonProps> = ({
  width = '100%',
  height = '20px',
  borderRadius = '8px',
  className = '',
  style,
}) => {
  return (
    <div
      className={`shimmer-warm ${className}`}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        borderRadius: typeof borderRadius === 'number' ? `${borderRadius}px` : borderRadius,
        ...style,
      }}
      aria-hidden="true"
    />
  );
};

export const WarmSkeletonCard: React.FC<{ count?: number }> = ({ count = 3 }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%' }}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            background: '#FFFFFF',
            borderRadius: '16px',
            padding: '20px',
            border: '1px solid #EFE9DF',
            boxShadow: '0 2px 8px rgba(45, 40, 37, 0.03)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <WarmSkeleton width="40%" height="20px" borderRadius="6px" />
            <WarmSkeleton width="60px" height="22px" borderRadius="11px" />
          </div>
          <WarmSkeleton width="75%" height="14px" borderRadius="4px" />
          <div style={{ display: 'flex', gap: '12px', marginTop: '6px' }}>
            <WarmSkeleton width="80px" height="12px" borderRadius="4px" />
            <WarmSkeleton width="100px" height="12px" borderRadius="4px" />
          </div>
        </div>
      ))}
    </div>
  );
};

export const WarmSkeletonKpi: React.FC<{ count?: number }> = ({ count = 4 }) => {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px',
        width: '100%',
      }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            background: '#FFFFFF',
            borderRadius: '16px',
            padding: '20px',
            border: '1px solid #EFE9DF',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <WarmSkeleton width="50%" height="16px" borderRadius="4px" />
            <WarmSkeleton width="28px" height="28px" borderRadius="8px" />
          </div>
          <WarmSkeleton width="65%" height="32px" borderRadius="6px" />
          <WarmSkeleton width="40%" height="14px" borderRadius="4px" />
        </div>
      ))}
    </div>
  );
};
