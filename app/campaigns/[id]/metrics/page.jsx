'use client';

import Link from 'next/link';
import { use, useState } from 'react';
import { api, addDays, formatDateTime, formatDuration, todayIso } from '../../../lib/api';
import { Badge, Empty, ErrorState, Loading, Panel, Stat, useResource } from '../../../components/ui';
import { Pagination, usePagination } from '../../../components/Pagination';
import { EditIcon, RefreshIcon, SearchIcon } from '../../../components/Icon';

const STATUSES = ['all', 'played', 'skipped', 'failed'];

export default function CampaignMetricsPage({ params }) {
  const { id } = use(params);
  const [from, setFrom] = useState(addDays(todayIso(), -30));
  const [to, setTo] = useState(todayIso());
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');

  const { loading, data, error, reload } = useResource(
    () => api.campaignMetrics(id, `?from=${from}&to=${to}`),
    [id, from, to]
  );

  const term = search.trim().toLowerCase();
  const filteredEvents = (data?.events || []).filter((event) => {
    if (status !== 'all' && event.status !== status) return false;
    if (!term) return true;
    return [event.boxName, event.boxSerial, event.mediaName].some((value) => value?.toLowerCase().includes(term));
  });
  const { page, setPage, totalPages, pageItems, start } = usePagination(filteredEvents, 20);

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
            <EditIcon /> Edit campaign
          </Link>
          <button className="btn" onClick={reload}>
            <RefreshIcon /> Refresh
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
                ? `Server returned the most recent ${data.events.length} of ${data.totals.plays} plays.`
                : `${data.events.length} play(s).`
            }
          >
            <div className="toolbar">
              <div className="toolbar-group">
                <label className="field" style={{ minWidth: 260 }}>
                  Search
                  <input
                    type="search"
                    value={search}
                    placeholder="Box, serial or ad name"
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
              </div>
              <span style={{ color: '#7f92a6', fontSize: 11 }}>
                {filteredEvents.length} of {data.events.length} shown
              </span>
            </div>

            {pageItems.length ? (
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
                    {pageItems.map((event) => (
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
              <Empty icon={data.events.length ? <SearchIcon /> : '▤'} title={data.events.length ? 'No plays match' : 'No plays in this range'}>
                {data.events.length
                  ? 'Try a different search term or status filter.'
                  : "Widen the date range, or check the box has synced and cached this campaign's media."}
              </Empty>
            )}

            <Pagination
              page={page}
              totalPages={totalPages}
              onChange={setPage}
              totalItems={filteredEvents.length}
              shownCount={pageItems.length}
              start={start}
            />
          </Panel>
        </>
      )}
    </>
  );
}

