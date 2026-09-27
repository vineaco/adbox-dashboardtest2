'use client';

import Link from 'next/link';
import { useState } from 'react';
import { api, formatDateTime, formatDuration, formatRelative, todayIso } from '../lib/api';
import { Badge, Empty, ErrorState, Loading, Panel, Stat, useResource } from '../components/ui';
import { SkeletonTelemetry } from '../components/Skeleton';

const TABS = [
  ['playback', 'Playback'],
  ['deliveries', 'Schedule deliveries'],
  ['errors', 'Errors']
];

export default function TelemetryPage() {
  const [tab, setTab] = useState('playback');
  const [serviceDate, setServiceDate] = useState(todayIso());

  const { loading, data, error, reload } = useResource(
    async () => {
      const [playback, deliveries, errors] = await Promise.all([
        api.playback(`?serviceDate=${serviceDate}&take=300`),
        api.deliveries(`?serviceDate=${serviceDate}&take=200`),
        api.errors('?take=200')
      ]);
      return { playback, deliveries: deliveries.deliveries, errors: errors.errors };
    },
    [serviceDate]
  );

  if (loading) return <SkeletonTelemetry />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">Reporting</p>
          <h1>Telemetry</h1>
          <p>
            Proof of play, schedule handovers and faults reported by the fleet. Boxes buffer everything locally when
            offline and replay it once a connection returns, so gaps fill themselves in.
          </p>
        </div>
        <div className="head-actions">
          <label className="field">
            Service date
            <input type="date" value={serviceDate} onChange={(event) => setServiceDate(event.target.value)} />
          </label>
          <button className="btn" onClick={reload}>
            Refresh
          </button>
        </div>
      </header>

      <div className="grid four">
            <Stat label="Plays recorded" value={data.playback.events.length} note={`on ${serviceDate}`} />
            <Stat label="Screen time" value={formatDuration(data.playback.totals.durationMs)} note="sum of played durations" />
            <Stat
              label="Failed plays"
              value={data.playback.totals.failed || 0}
              note={data.playback.totals.failed ? 'check the errors tab' : 'none'}
              attention={Boolean(data.playback.totals.failed)}
            />
            <Stat label="Boxes served" value={new Set(data.deliveries.map((entry) => entry.boxId)).size} note="received a playlist" />
          </div>

          <div className="tabs">
            {TABS.map(([key, label]) => (
              <button key={key} className={tab === key ? 'on' : ''} onClick={() => setTab(key)}>
                {label}
              </button>
            ))}
          </div>

          {tab === 'playback' && (
            <Panel eyebrow="Proof of play" title={`Playback on ${serviceDate}`}>
              {data.playback.events.length ? (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Started</th>
                        <th>Box</th>
                        <th>Ad</th>
                        <th className="numeric">Duration</th>
                        <th>Position</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.playback.events.map((event) => (
                        <tr key={event.id}>
                          <td title={formatDateTime(event.startedAt)}>{formatRelative(event.startedAt)}</td>
                          <td>
                            <Link href={`/fleet/${event.boxId}`}>
                              <strong>{event.box?.name}</strong>
                              <small>{event.box?.serialNumber}</small>
                            </Link>
                          </td>
                          <td>{event.mediaName || event.mediaId || '—'}</td>
                          <td className="numeric">{formatDuration(event.durationMs)}</td>
                          <td className="mono">
                            {event.lat === null ? '—' : `${event.lat.toFixed(4)}, ${event.lng.toFixed(4)}`}
                          </td>
                          <td>
                            <Badge state={event.status}>{event.status}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty icon="▣" title={`No playback recorded for ${serviceDate}`}>
                  Events upload every two minutes. Check the box's local console if a screen is definitely running.
                </Empty>
              )}
            </Panel>
          )}

          {tab === 'deliveries' && (
            <Panel eyebrow="Handovers" title={`Schedules delivered for ${serviceDate}`}>
              {data.deliveries.length ? (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Box</th>
                        <th className="numeric">Slots</th>
                        <th className="numeric">Items</th>
                        <th>Position</th>
                        <th>Fix source</th>
                        <th>Delivered</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.deliveries.map((delivery) => (
                        <tr key={delivery.id}>
                          <td>
                            <Link href={`/fleet/${delivery.boxId}`}>
                              <strong>{delivery.box?.name}</strong>
                              <small>{delivery.box?.serialNumber}</small>
                            </Link>
                          </td>
                          <td className="numeric">{delivery.slotCount}</td>
                          <td className="numeric">
                            {delivery.itemCount === 0 ? <Badge state="warn">empty</Badge> : delivery.itemCount}
                          </td>
                          <td className="mono">
                            {delivery.lat === null ? '—' : `${delivery.lat.toFixed(4)}, ${delivery.lng.toFixed(4)}`}
                          </td>
                          <td>
                            <Badge state={delivery.gpsSource === 'gps' ? 'ok' : 'warn'}>
                              {delivery.gpsSource || 'unknown'}
                            </Badge>
                          </td>
                          <td title={formatDateTime(delivery.deliveredAt)}>{formatRelative(delivery.deliveredAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty icon="⌁" title={`Nothing delivered for ${serviceDate} yet`}>
                  Boxes fetch tomorrow's playlist from 23:00, and catch up on today's between midnight and 07:00.
                </Empty>
              )}
            </Panel>
          )}

          {tab === 'errors' && (
            <Panel eyebrow="Faults" title="Recent errors across the fleet">
              {data.errors.length ? (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>When</th>
                        <th>Box</th>
                        <th>Level</th>
                        <th>Source</th>
                        <th>Message</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.errors.map((entry) => (
                        <tr key={entry.id}>
                          <td title={formatDateTime(entry.at)}>{formatRelative(entry.at)}</td>
                          <td>
                            <Link href={`/fleet/${entry.boxId}`}>
                              <strong>{entry.box?.name}</strong>
                              <small>{entry.box?.serialNumber}</small>
                            </Link>
                          </td>
                          <td>
                            <Badge state={entry.level === 'warn' ? 'warn' : 'bad'}>{entry.level}</Badge>
                          </td>
                          <td>{entry.source}</td>
                          <td>{entry.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty icon="✓" title="No errors reported">
                  The whole fleet is healthy.
                </Empty>
              )}
            </Panel>
          )}
    </>
  );
}
