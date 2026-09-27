'use client';

import { useMemo, useState } from 'react';
import { Modal } from './ui';
import { Pagination, usePagination } from './Pagination';
import { SearchIcon } from './Icon';

const STATUSES = ['all', 'active', 'suspended', 'retired'];
const CONNECTIVITY = ['all', 'online', 'offline'];

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
      title="Select target boxes"
      description="Choose specific screens to assign to this campaign. The schedule will only be delivered to the selected boxes."
      onClose={onClose}
    >
      <div className="picker-modal-inner">
        <div className="toolbar" style={{ marginTop: 12, marginBottom: 14 }}>
          <div className="toolbar-group">
            <label className="field" style={{ minWidth: 200 }}>
              Search
              <input
                type="search"
                placeholder="Name, serial, screen label"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <label className="field">
              Status
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s === 'all' ? 'All statuses' : s}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Connectivity
              <select value={connectivity} onChange={(e) => setConnectivity(e.target.value)}>
                {CONNECTIVITY.map((c) => (
                  <option key={c} value={c}>
                    {c === 'all' ? 'All' : c}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button type="button" className="btn tiny" onClick={toggleAllVisible}>
            {pageItems.every((b) => selected.has(b.id)) ? 'Deselect page' : 'Select page'}
          </button>
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
                    <strong>{b.name}</strong>
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
            <i><SearchIcon /></i>
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

        <div className="form-actions" style={{ marginTop: 18, paddingTop: 14 }}>
          <span style={{ marginRight: 'auto', alignSelf: 'center', fontSize: 12, color: '#008d9f', fontWeight: 600 }}>
            {selected.size} box(es) selected
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
