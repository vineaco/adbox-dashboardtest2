'use client';

import { useEffect, useState } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from './Icon';

/** Client-side pagination over an already-fetched array. Resets to page 1
 *  whenever the item count or page size changes. */
export function usePagination(items, initialPageSize = 10) {
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const page_ = Math.min(page, totalPages);

  useEffect(() => {
    setPage(1);
  }, [items.length, pageSize]);

  const start = (page_ - 1) * pageSize;
  const pageItems = items.slice(start, start + pageSize);
  return { page: page_, setPage, totalPages, pageItems, start, pageSize, setPageSize };
}

function pageNumbers(page, totalPages) {
  const span = 1;
  const numbers = new Set([1, totalPages, page]);
  for (let offset = 1; offset <= span; offset += 1) {
    numbers.add(page - offset);
    numbers.add(page + offset);
  }
  return [...numbers].filter((value) => value >= 1 && value <= totalPages).sort((a, b) => a - b);
}

export function Pagination({ page, totalPages, onChange, totalItems, shownCount, start, pageSize, onPageSizeChange }) {
  if (totalItems === 0) return null;
  const numbers = pageNumbers(page, totalPages);

  return (
    <div className="pagination-bar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <span>
          Showing {totalItems ? start + 1 : 0}–{start + shownCount} of {totalItems}
        </span>
        {onPageSizeChange && (
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#7f92a6' }}>
            Per page:
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              style={{
                padding: '3px 7px',
                border: '1px solid #d7e8ec',
                borderRadius: 4,
                fontSize: 11,
                color: '#1f2c40',
                background: '#fff'
              }}
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </label>
        )}
      </div>

      <div className="pagination-controls">
        <button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Previous page">
          <ChevronLeftIcon />
        </button>
        {numbers.map((number, index) => (
          <span key={number} style={{ display: 'contents' }}>
            {index > 0 && numbers[index - 1] !== number - 1 && <span style={{ padding: '0 4px', color: '#7f92a6' }}>…</span>}
            <button type="button" className={number === page ? 'active' : ''} onClick={() => onChange(number)}>
              {number}
            </button>
          </span>
        ))}
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
          aria-label="Next page"
        >
          <ChevronRightIcon />
        </button>
      </div>
    </div>
  );
}
