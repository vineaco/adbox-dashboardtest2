'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { api, formatDateTime } from '../lib/api';
import { Badge, Empty, ErrorState, Loading, Panel, useResource, useToast } from '../components/ui';

const BoundaryEditor = dynamic(() => import('../components/BoundaryEditor'), {
  ssr: false,
  loading: () => <div className="map" />
});

export default function BoundariesPage() {
  const [toastNode, notify] = useToast();
  const [selected, setSelected] = useState(null);
  const { loading, data, error, reload } = useResource(() => api.boundaries());

  async function create(draft) {
    try {
      await api.createBoundary(draft);
      notify('Boundary saved.');
      reload();
    } catch (createError) {
      notify(createError.message, true);
    }
  }

  async function remove(boundary) {
    if (!window.confirm(`Delete boundary “${boundary.name}”?`)) return;
    try {
      await api.deleteBoundary(boundary.id);
      notify('Boundary deleted.');
      if (selected?.id === boundary.id) setSelected(null);
      reload();
    } catch (deleteError) {
      notify(deleteError.message, true);
    }
  }

  async function saveTraffic(boundary, value) {
    try {
      await api.updateBoundary(boundary.id, { avgDailyTraffic: value === '' ? null : Number(value) });
      notify('Average daily traffic updated.');
      reload();
    } catch (updateError) {
      notify(updateError.message, true);
    }
  }

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">Geo targeting</p>
          <h1>Boundaries</h1>
          <p>
            Draw the areas a campaign should run in. When a box syncs, the server tests its GPS fix against every
            boundary and returns only the campaigns whose areas contain it.
          </p>
        </div>
        <button className="btn" onClick={reload}>
          Refresh
        </button>
      </header>

      {loading && <Loading label="Loading boundaries…" />}
      {error && <ErrorState error={error} onRetry={reload} />}

      {data && (
        <div className="grid two">
          <Panel
            eyebrow="Draw"
            title="New boundary"
            description="Click the map to drop polygon points, or switch to a radius around a single point."
          >
            <BoundaryEditor existing={data.boundaries} onSave={create} />
          </Panel>

          <Panel eyebrow="Saved" title={`${data.boundaries.length} boundary(s)`} description="Set an average daily traffic figure so campaign metrics can estimate impressions for this area.">
            {data.boundaries.length ? (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Type</th>
                      <th>Detail</th>
                      <th>Avg daily traffic</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {data.boundaries.map((boundary) => (
                      <tr key={boundary.id}>
                        <td>
                          <strong>{boundary.name}</strong>
                          <small>
                            {boundary.classifications.map((entry) => entry.label).join(' · ') ||
                              formatDateTime(boundary.createdAt)}
                          </small>
                        </td>
                        <td>
                          <Badge state="ok">{boundary.type}</Badge>
                        </td>
                        <td className="mono">
                          {boundary.type === 'circle'
                            ? `${Math.round(boundary.radius)} m radius`
                            : `${boundary.points.length} points`}
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            placeholder="not set"
                            defaultValue={boundary.avgDailyTraffic ?? ''}
                            style={{ width: 110 }}
                            onBlur={(event) => {
                              const value = event.target.value;
                              if (Number(value) === (boundary.avgDailyTraffic ?? '')) return;
                              saveTraffic(boundary, value);
                            }}
                          />
                        </td>
                        <td>
                          <button className="btn tiny danger" onClick={() => remove(boundary)}>
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty icon="◇" title="No boundaries yet">
                Until you draw one, only fleet-wide and per-box campaigns will reach your screens.
              </Empty>
            )}
          </Panel>
        </div>
      )}

      {toastNode}
    </>
  );
}
