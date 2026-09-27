'use client';

import { useMemo, useState } from 'react';
import { Modal } from './ui';
import { Pagination, usePagination } from './Pagination';
import { BoxIcon, SearchIcon, TrashIcon } from './Icon';

const STATUSES = [
  { value: 'all', label: 'All Statuses' },
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'retired', label: 'Retired' }
];

const CONNECTIVITY = [
  { value: 'all', label: 'All Connectivity' },
  { value: 'online', label: 'Online' },
  { value: 'offline', label: 'Offline' }
];

export default function BoxPickerModal({ boxes, selectedIds = [], onConfirm, onClose }) {
  const [selected, setSelected] = useState(() => new Set(selectedIds));
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [connectivity, setConnectivity] = useState('all');

  const term = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    return boxes.filter((b) => {
      if (status !== 'all' && b.status !== status) return false;
      if (connectivity !== 'all' && b.status === 'active' && b.connectivity !== connectivity) return false;
      if (!term) return true;
      return [b.name, b.serialNumber, b.screenLabel, b.notes].some((v) => v?.toLowerCase().includes(term));
    });
  }, [boxes, status, connectivity, term]);

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
      wide
      title="Select target boxes"
      description="Choose specific screens to assign to this campaign. The schedule will only be delivered to the selected boxes."
      onClose={onClose}
    >
      <div className="picker-modal-inner">
        <div className="cascade-toolbar" style={{ marginTop: 8 }}>
          <label className="cascade-field">
            Search
            <input
              type="search"
              placeholder="Name, serial, screen label"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <label className="cascade-field">
            Status
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="cascade-field">
            Connectivity
            <select value={connectivity} onChange={(e) => setConnectivity(e.target.value)}>
              {CONNECTIVITY.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <div style={{ display: 'flex', gap: 6, alignSelf: 'flex-end' }}>
            <button type="button" className="btn tiny" onClick={toggleAllVisible}>
              {pageItems.length && pageItems.every((b) => selected.has(b.id)) ? 'Deselect page' : 'Select page'}
            </button>
            {selected.size > 0 && (
              <button
                type="button"
                className="btn tiny danger"
                onClick={() => setSelected(new Set())}
                title="Clear all"
              >
                <TrashIcon />
              </button>
            )}
          </div>
        </div>

        {pageItems.length ? (
          <div className="picker-list">
            {pageItems.map((b) => {
              const isChecked = selected.has(b.id);
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
                    <strong style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <BoxIcon />
                      {b.name}
                    </strong>
                    <small>
                      {b.serialNumber}
                      {b.screenLabel ? ` · ${b.screenLabel}` : ''}
                    </small>
                  </div>
                  <span className={`picker-badge ${b.status === 'active' ? b.connectivity || 'active' : b.status}`}>
                    {b.status === 'active' ? b.connectivity || 'active' : b.status}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty" style={{ minHeight: 140 }}>
            <i>
              <SearchIcon />
            </i>
            <strong>No boxes match</strong>
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

        <div className="form-actions" style={{ marginTop: 14, paddingTop: 14 }}>
          <div style={{ marginRight: 'auto', alignSelf: 'center', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, color: '#008d9f', fontWeight: 700 }}>
              {selected.size} box(es) selected
            </span>
            <span style={{ fontSize: 11, color: '#7f92a6' }}>
              across {boxes.length} total registered
            </span>
          </div>
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
