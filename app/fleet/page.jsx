'use client';

import Link from 'next/link';
import { useState } from 'react';
import { api, formatDateTime, formatRelative } from '../lib/api';
import { Badge, Empty, ErrorState, Loading, Panel, useResource } from '../components/ui';
import { Pagination, usePagination } from '../components/Pagination';
import { SkeletonFleet } from '../components/Skeleton';
import { PlusIcon, RefreshIcon, SearchIcon } from '../components/Icon';

const STATUSES = ['all', 'active', 'suspended', 'retired'];
const CONNECTIVITY = ['all', 'online', 'offline'];

export default function FleetPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [connectivity, setConnectivity] = useState('all');
  const { loading, data, error, reload } = useResource(() => api.boxes());

  const term = search.trim().toLowerCase();
  const boxes = (data?.boxes || []).filter((box) => {
    if (status !== 'all' && box.status !== status) return false;
    if (connectivity !== 'all' && box.status === 'active' && box.connectivity !== connectivity) return false;
    if (!term) return true;
    return [box.name, box.serialNumber, box.screenLabel, box.notes].some((value) => value?.toLowerCase().includes(term));
  });
  const { page, setPage, totalPages, pageItems, start } = usePagination(boxes, 15);

  if (loading) return <SkeletonFleet />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">Devices</p>
          <h1>Fleet</h1>
          <p>
            Every Raspberry Pi that has claimed a REGISTERED_BOX_NUMBER. The TB20 sending card behind each box is
            treated as a dumb pipe to the LED screen — all scheduling lives here.
          </p>
        </div>
        <div className="head-actions">
          <button className="btn" onClick={reload}>
            <RefreshIcon /> Refresh
          </button>
          <Link className="btn primary" href="/provisioning">
            <PlusIcon /> Register a box
          </Link>
        </div>
      </header>

      <Panel>
        <div className="toolbar">
          <div className="toolbar-group">
            <label className="field" style={{ minWidth: 260 }}>
              Search
              <input
                type="search"
                value={search}
                placeholder="Box number, name or screen label"
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <label className="field">
              Status
              <select value={status} onChange={(event) => setStatus(event.target.value)}>
                {STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {value === 'all' ? 'All statuses' : value}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Connectivity
              <select value={connectivity} onChange={(event) => setConnectivity(event.target.value)}>
                {CONNECTIVITY.map((value) => (
                  <option key={value} value={value}>
                    {value === 'all' ? 'Online + offline' : value}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <span style={{ color: '#929890', fontSize: 11 }}>
            {boxes.length} of {data.boxes.length} boxes
          </span>
        </div>

        {pageItems.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Box</th>
                  <th>Status</th>
                  <th>Last seen</th>
                  <th>Last position</th>
                  <th>Agent</th>
                  <th>Registered</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((box) => (
                  <tr key={box.id} className="clickable">
                    <td>
                      <Link href={`/fleet/${box.id}`}>
                        <strong>{box.name}</strong>
                        <small>
                          {box.serialNumber}
                          {box.screenLabel ? ` · ${box.screenLabel}` : ''}
                        </small>
                      </Link>
                    </td>
                    <td>
                      <Badge state={box.status === 'active' ? box.connectivity : box.status}>
                        {box.status === 'active' ? box.connectivity : box.status}
                      </Badge>
                    </td>
                    <td title={formatDateTime(box.lastSeenAt)}>{formatRelative(box.lastSeenAt)}</td>
                    <td className="mono">
                      {box.lastLat === null || box.lastLat === undefined
                        ? '—'
                        : `${box.lastLat.toFixed(4)}, ${box.lastLng.toFixed(4)}`}
                      {box.lastGpsSource === 'fallback' && (
                        <small>
                          <Badge state="warn">fallback coords</Badge>
                        </small>
                      )}
                    </td>
                    <td>{box.agentVersion || '—'}</td>
                    <td>{formatDateTime(box.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty icon={data.boxes.length ? <SearchIcon /> : '◉'} title={data.boxes.length ? 'No boxes match that search' : 'No boxes registered yet'}>
            Issue a provisioning code, then run <span className="mono">sudo adbox-provision &lt;CODE&gt;</span> on the
            Raspberry Pi.
          </Empty>
        )}

        <Pagination page={page} totalPages={totalPages} onChange={setPage} totalItems={boxes.length} shownCount={pageItems.length} start={start} />
      </Panel>
    </>
  );
}

