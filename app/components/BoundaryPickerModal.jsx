'use client';

import { useMemo, useState } from 'react';
import { Modal } from './ui';
import { Pagination, usePagination } from './Pagination';
import { SearchIcon } from './Icon';

export default function BoundaryPickerModal({ boundaries, selectedIds = [], onConfirm, onClose }) {
  const [selected, setSelected] = useState(() => new Set(selectedIds));
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');

  // Discover all distinct classifications across boundaries: { country: [...], state: [...], city: [...] }
  const categories = useMemo(() => {
    const cats = new Set();
    for (const b of boundaries) {
      if (Array.isArray(b.classifications)) {
        for (const c of b.classifications) {
          if (c.type) cats.add(c.type);
        }
      }
    }
    return ['all', ...Array.from(cats).sort()];
  }, [boundaries]);

  const term = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    return boundaries.filter((b) => {
      if (category !== 'all') {
        const hasCat = Array.isArray(b.classifications) && b.classifications.some((c) => c.type === category);
        if (!hasCat) return false;
      }
      if (!term) return true;
      const classLabels = Array.isArray(b.classifications)
        ? b.classifications.map((c) => c.label).join(' ')
        : '';
      return `${b.name} ${classLabels} ${b.type}`.toLowerCase().includes(term);
    });
  }, [boundaries, category, term]);

  const { page, setPage, totalPages, pageItems, start } = usePagination(filtered, 8);

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllVisible = () => {
    const allSelected = pageItems.every((b) => selected.has(b.id));
    setSelected((prev) => {
      const next = new Set(prev);
      for (const b of pageItems) {
        if (allSelected) next.delete(b.id);
        else next.add(b.id);
      }
      return next;
    });
  };

  const save = () => {
    onConfirm(Array.from(selected));
    onClose();
  };

  return (
    <Modal
      title="Select geographic boundaries"
      description="Choose zones to target with this campaign. Moving screens will automatically pick up this campaign when inside any selected boundary."
      onClose={onClose}
    >
      <div className="picker-modal-inner">
        <div className="toolbar" style={{ marginTop: 12, marginBottom: 14 }}>
          <div className="toolbar-group">
            <label className="field" style={{ minWidth: 220 }}>
              Search
              <input
                type="search"
                placeholder="Zone, city, or area name"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            {categories.length > 1 && (
              <label className="field">
                Classification
                <select value={category} onChange={(e) => setCategory(e.target.value)}>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat === 'all' ? 'All categories' : cat.replace(/-/g, ' ')}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <button type="button" className="btn tiny" onClick={toggleAllVisible}>
            {pageItems.every((b) => selected.has(b.id)) ? 'Deselect page' : 'Select page'}
          </button>
        </div>

        {pageItems.length ? (
          <div className="picker-list">
            {pageItems.map((b) => {
              const isChecked = selected.has(b.id);
              const classText = Array.isArray(b.classifications) && b.classifications.length
                ? b.classifications.map((c) => c.label).join(' · ')
                : `${b.type === 'circle' ? `${Math.round(b.radius)}m radius` : `${b.points.length} points`}`;
              return (
                <div
                  key={b.id}
                  className={`picker-item ${isChecked ? 'selected' : ''}`}
                  onClick={() => toggle(b.id)}
                  role="checkbox"
                  aria-checked={isChecked}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault();
                      toggle(b.id);
                    }
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {}}
                    tabIndex={-1}
                    aria-label={`Select ${b.name}`}
                  />
                  <div className="picker-item-info">
                    <strong>{b.name}</strong>
                    <small>{classText}</small>
                  </div>
                  <span className="picker-badge">{b.type}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty" style={{ minHeight: 140 }}>
            <i><SearchIcon /></i>
            <strong>No boundaries match</strong>
            <p>Try clearing filters or search terms.</p>
          </div>
        )}

        <Pagination
          page={page}
          totalPages={totalPages}
          onChange={setPage}
          totalItems={filtered.length}
          shownCount={pageItems.length}
          start={start}
        />

        <div className="form-actions" style={{ marginTop: 18, paddingTop: 14 }}>
          <span style={{ marginRight: 'auto', alignSelf: 'center', fontSize: 12, color: '#008d9f', fontWeight: 600 }}>
            {selected.size} boundary(s) selected
          </span>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn primary" onClick={save}>
            Apply selection
          </button>
        </div>
      </div>
    </Modal>
  );
}
