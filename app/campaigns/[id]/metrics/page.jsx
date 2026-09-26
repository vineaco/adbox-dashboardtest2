'use client';

import Link from 'next/link';
import { use, useState } from 'react';
import { api, addDays, formatDateTime, formatDuration, todayIso } from '../../../lib/api';
import { Badge, Empty, ErrorState, Loading, Panel, Stat, useResource } from '../../../components/ui';

export default function CampaignMetricsPage({ params }) {
  const { id } = use(params);
  const [from, setFrom] = useState(addDays(todayIso(), -30));
  const [to, setTo] = useState(todayIso());

  const { loading, data, error, reload } = useResource(
    () => api.campaignMetrics(id, `?from=${from}&to=${to}`),
    [id, from, to]
  );

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">
            <Link href="/campaigns">← Campaigns</Link>
          </p>
          <h1>{data?.campaign?.name || 'Campaign performance'}</h1>
          <p>Every play this campaign has had, with the box, timing and GPS fix at that moment.</p>
        </div>
        <div className="head-actions">
          <Link className="btn" href={`/campaigns/${id}`}>
            Edit campaign
          </Link>
          <button className="btn" onClick={reload}>
            Refresh
          </button>
        </div>
      </header>

      <Panel className="filters">
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <label className="field">
            From
            <input type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} />
          </label>
          <label className="field">
            To
            <input type="date" value={to} min={from} max={todayIso()} onChange={(event) => setTo(event.target.value)} />
          </label>
        </div>
      </Panel>

      {loading && <Loading label="Loading campaign metrics…" />}
      {error && <ErrorState error={error} onRetry={reload} />}

      {data && (
        <>
          <div className="grid four">
            <Stat label="Total plays" value={data.totals.plays} note={`${data.range.from} to ${data.range.to}`} />
            <Stat label="Total screen time" value={formatDuration(data.totals.totalDurationMs)} />
            <Stat label="Boxes that played it" value={data.totals.uniqueBoxes} />
            <Stat
              label="Expected impressions"
              value={data.impressions.estimate === null ? '—' : data.impressions.estimate.toLocaleString()}
              note={data.impressions.note || 'Estimated from boundary traffic × share of screen time.'}
              attention={data.impressions.estimate === null}
            />
          </div>

          {(data.totals.byStatus.failed || data.totals.byStatus.skipped) && (
            <p style={{ margin: '10px 0 0' }}>
              {data.totals.byStatus.failed ? <Badge state="bad">{data.totals.byStatus.failed} failed</Badge> : null}{' '}
              {data.totals.byStatus.skipped ? <Badge state="warn">{data.totals.byStatus.skipped} skipped</Badge> : null}
            </p>
          )}

          <Panel
            eyebrow="Proof of play"
            title="Every play in range"
            description={
              data.truncated
                ? `Showing the most recent ${data.events.length} of ${data.totals.plays} plays.`
                : `${data.events.length} play(s).`
            }
          >
            {data.events.length ? (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Box</th>
                      <th>Ad</th>
                      <th>Started</th>
                      <th>Ended</th>
                      <th className="numeric">Duration</th>
                      <th>GPS at play time</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.events.map((event) => (
                      <tr key={event.id}>
                        <td>
                          <strong>{event.boxName || event.boxId}</strong>
                          {event.boxSerial && <small className="mono">{event.boxSerial}</small>}
                        </td>
                        <td>{event.mediaName || event.mediaId || '—'}</td>
                        <td>{formatDateTime(event.startedAt)}</td>
                        <td>{event.endedAt ? formatDateTime(event.endedAt) : '—'}</td>
                        <td className="numeric">{formatDuration(event.durationMs)}</td>
                        <td className="mono">
                          {Number.isFinite(event.lat) && Number.isFinite(event.lng)
                            ? `${event.lat.toFixed(5)}, ${event.lng.toFixed(5)}`
                            : '—'}
                        </td>
                        <td>
                          <Badge state={event.status === 'played' ? 'ok' : event.status === 'failed' ? 'bad' : 'warn'}>
                            {event.status}
                          </Badge>
                          {event.detail && <small>{event.detail}</small>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty icon="▤" title="No plays in this range">
                Widen the date range, or check the box has synced and cached this campaign's media.
              </Empty>
            )}
          </Panel>
        </>
      )}
    </>
  );
}
