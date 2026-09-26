import React from 'react';

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  className?: string;
  style?: React.CSSProperties;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = '16px',
  borderRadius = 'var(--radius-sm, 6px)',
  className = '',
  style = {},
}) => {
  return (
    <div
      className={`sa-skeleton ${className}`}
      style={{
        width,
        height,
        borderRadius,
        ...style,
      }}
    />
  );
};

export const TableSkeleton: React.FC<{ rows?: number; columns?: number }> = ({ rows = 5, columns = 6 }) => {
  return (
    <>
      {Array.from({ length: rows }).map((_, rIdx) => (
        <tr key={rIdx} className="sa-skeleton-row">
          {Array.from({ length: columns }).map((_, cIdx) => (
            <td key={cIdx} style={{ padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {cIdx === 0 && <Skeleton width="32px" height="32px" borderRadius="6px" />}
                <Skeleton
                  width={cIdx === 0 ? '120px' : cIdx === columns - 1 ? '70px' : `${50 + (cIdx * 15) % 40}%`}
                  height="14px"
                />
              </div>
            </td>
          ))}
        </tr>
      ))}
    </>
  );
};

export const DashboardSkeleton: React.FC = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Banner Skeleton */}
      <div
        style={{
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius-md)',
          padding: '24px 28px',
          border: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '60%' }}>
          <Skeleton width="140px" height="20px" borderRadius="12px" />
          <Skeleton width="320px" height="28px" />
          <Skeleton width="480px" height="14px" />
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <Skeleton width="130px" height="38px" borderRadius="8px" />
          <Skeleton width="140px" height="38px" borderRadius="8px" />
        </div>
      </div>

      {/* Metric Cards Skeleton Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
        }}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Skeleton width="90px" height="12px" />
              <Skeleton width="28px" height="28px" borderRadius="6px" />
            </div>
            <Skeleton width="70px" height="32px" />
            <Skeleton width="120px" height="12px" />
          </div>
        ))}
      </div>

      {/* Big Telemetry Chart Skeleton */}
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <Skeleton width="220px" height="18px" />
            <Skeleton width="340px" height="12px" />
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Skeleton width="80px" height="30px" borderRadius="6px" />
            <Skeleton width="80px" height="30px" borderRadius="6px" />
            <Skeleton width="80px" height="30px" borderRadius="6px" />
          </div>
        </div>

        {/* Shimmer Bar Graph Bars Placeholder */}
        <div
          style={{
            height: '180px',
            display: 'flex',
            alignItems: 'flex-end',
            gap: '14px',
            paddingTop: '20px',
          }}
        >
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <Skeleton
                width="100%"
                height={`${30 + ((i * 37) % 70)}%`}
                borderRadius="4px 4px 0 0"
              />
              <Skeleton width="24px" height="10px" />
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Split Tables Skeleton */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Skeleton width="150px" height="16px" />
              <Skeleton width="60px" height="14px" />
            </div>
            {Array.from({ length: 4 }).map((_, r) => (
              <div
                key={r}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 0',
                  borderBottom: '1px solid var(--border-color)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Skeleton width="34px" height="34px" borderRadius="8px" />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <Skeleton width="120px" height="14px" />
                    <Skeleton width="80px" height="11px" />
                  </div>
                </div>
                <Skeleton width="70px" height="24px" borderRadius="12px" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};
