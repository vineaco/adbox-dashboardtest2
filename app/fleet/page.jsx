'use client';

import Link from 'next/link';
import { useState } from 'react';
import { api, formatDateTime, formatRelative } from '../lib/api';
import { Badge, Empty, ErrorState, Loading, Panel, useResource } from '../components/ui';

export default function FleetPage() {
  const [search, setSearch] = useState('');
  const { loading, data, error, reload } = useResource(() => api.boxes());

  if (loading) return <Loading label="Loading boxes…" />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  const term = search.trim().toLowerCase();
  const boxes = data.boxes.filter(
    (box) =>
      !term ||
      [box.name, box.serialNumber, box.screenLabel, box.notes].some((value) => value?.toLowerCase().includes(term))
  );

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
            Refresh
          </button>
          <Link className="btn primary" href="/provisioning">
            Register a box
          </Link>
        </div>
      </header>

      <Panel>
        <div className="toolbar">
          <label className="field" style={{ minWidth: 300 }}>
            Search
            <input
              type="search"
              value={search}
              placeholder="Box number, name or screen label"
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <span style={{ color: '#929890', fontSize: 11 }}>
            {boxes.length} of {data.boxes.length} boxes
          </span>
        </div>

        {boxes.length ? (
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
                {boxes.map((box) => (
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
          <Empty icon="◉" title={data.boxes.length ? 'No boxes match that search' : 'No boxes registered yet'}>
            Issue a provisioning code, then run <span className="mono">sudo adbox-provision &lt;CODE&gt;</span> on the
            Raspberry Pi.
          </Empty>
        )}
      </Panel>
    </>
  );
}
