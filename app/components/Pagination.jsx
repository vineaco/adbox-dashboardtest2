'use client';

import { useEffect, useState } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from './Icon';

/** Client-side pagination over an already-fetched array. Resets to page 1
 *  whenever the item count changes (e.g. a search/filter narrowed the list). */
export function usePagination(items, pageSize = 10) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const page_ = Math.min(page, totalPages);

  useEffect(() => {
    setPage(1);
  }, [items.length]);

  const start = (page_ - 1) * pageSize;
  const pageItems = items.slice(start, start + pageSize);
  return { page: page_, setPage, totalPages, pageItems, start };
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

export function Pagination({ page, totalPages, onChange, totalItems, shownCount, start }) {
  if (totalPages <= 1) return null;
  const numbers = pageNumbers(page, totalPages);

  return (
    <div className="pagination-bar">
      <span>
        Showing {totalItems ? start + 1 : 0}\u2013{start + shownCount} of {totalItems}
      </span>
      <div className="pagination-controls">
        <button type="button" disabled={page === 1} onClick={() => onChange(page - 1)} aria-label="Previous page">
          <ChevronLeftIcon />
        </button>
        {numbers.map((number, index) => (
          <span key={number} style={{ display: 'contents' }}>
            {index > 0 && numbers[index - 1] !== number - 1 && <span>\u2026</span>}
            <button type="button" className={number === page ? 'active' : ''} onClick={() => onChange(number)}>
              {number}
            </button>
          </span>
        ))}
        <button
          type="button"
          disabled={page === totalPages}
          onClick={() => onChange(page + 1)}
          aria-label="Next page"
        >
          <ChevronRightIcon />
        </button>
      </div>
    </div>
  );
}
