import React from 'react';
import { Icon } from '@iconify/react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [5, 10, 20, 50],
}) => {
  if (totalItems === 0) return null;

  const startItem = Math.min((currentPage - 1) * pageSize + 1, totalItems);
  const endItem = Math.min(currentPage * pageSize, totalItems);

  // Generate page numbers array with intelligent ellipsis
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 4) {
        pages.push(1, 2, 3, 4, 5, '...', totalPages);
      } else if (currentPage >= totalPages - 3) {
        pages.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
      }
    }
    return pages;
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 18px',
      borderTop: '1px solid var(--border-color)',
      background: 'var(--bg-card)',
      fontSize: '0.8rem',
      color: 'var(--text-secondary)',
      flexWrap: 'wrap',
      gap: '12px',
    }}>
      {/* Left: Range and Page Size Selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div>
          Showing <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{startItem}</span> to{' '}
          <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{endItem}</span> of{' '}
          <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{totalItems}</span> entries
        </div>

        {onPageSizeChange && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Per page:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="select"
              style={{ padding: '3px 8px', fontSize: '0.75rem', width: 'auto', borderRadius: 'var(--radius-xs)' }}
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Right: Pagination Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        {/* Previous Button */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="btn btn-secondary btn-sm"
          style={{
            padding: '5px 9px',
            opacity: currentPage <= 1 ? 0.5 : 1,
            cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
          }}
          title="Previous Page"
        >
          <Icon icon="solar:alt-arrow-left-linear" width="14" />
          <span style={{ fontSize: '0.75rem' }}>Prev</span>
        </button>

        {/* Page Number Buttons */}
        {getPageNumbers().map((p, idx) => {
          if (p === '...') {
            return (
              <span key={`ellipsis-${idx}`} style={{ padding: '0 6px', color: 'var(--text-dim)', fontSize: '0.8rem' }}>
                ...
              </span>
            );
          }

          const isCurrent = p === currentPage;
          return (
            <button
              key={p}
              onClick={() => onPageChange(Number(p))}
              style={{
                minWidth: '28px',
                height: '28px',
                borderRadius: 'var(--radius-xs)',
                border: '1px solid',
                borderColor: isCurrent ? 'var(--primary)' : 'var(--border-color)',
                background: isCurrent ? 'var(--primary)' : 'var(--bg-card)',
                color: isCurrent ? '#FFFFFF' : 'var(--text-primary)',
                fontWeight: isCurrent ? 700 : 500,
                fontSize: '0.75rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.12s ease',
              }}
            >
              {p}
            </button>
          );
        })}

        {/* Next Button */}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="btn btn-secondary btn-sm"
          style={{
            padding: '5px 9px',
            opacity: currentPage >= totalPages ? 0.5 : 1,
            cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
          }}
          title="Next Page"
        >
          <span style={{ fontSize: '0.75rem' }}>Next</span>
          <Icon icon="solar:alt-arrow-right-linear" width="14" />
        </button>
      </div>
    </div>
  );
};
