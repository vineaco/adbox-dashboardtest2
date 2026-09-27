'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api, formatDateTime, formatRelative, todayIso } from '../lib/api';
import { Badge, Empty, ErrorState, Loading, Panel, Stat, useResource } from '../components/ui';
import { SkeletonCalendar, SkeletonTable } from '../components/Skeleton';
import {
  DAY_NAMES,
  campaignCycleSeconds,
  daypartsOn,
  formatAirtime,
  percentOfDay,
  toMinutes
} from '../lib/airtime';

const HOUR_MARKS = Array.from({ length: 13 }, (_, index) => index * 2);
const isoOf = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export default function CalendarPage() {
  const [cursor, setCursor] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [statusFilter, setStatusFilter] = useState('active');

  const { loading, data, error, reload } = useResource(async () => {
    const [campaigns, boxes] = await Promise.all([api.campaigns(), api.boxes()]);
    return { campaigns: campaigns.campaigns, boxes: boxes.boxes };
  });

  const deliveries = useResource(
    async () => (selectedDate ? api.deliveries(`?serviceDate=${selectedDate}&take=200`) : { deliveries: [] }),
    [selectedDate]
  );

  useEffect(() => {
    const onKey = (event) => event.key === 'Escape' && setSelectedDate(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const statuses = statusFilter === 'all' ? ['active', 'paused', 'draft'] : [statusFilter];

  const monthDays = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const count = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    return {
      offset: first.getDay(),
      days: Array.from({ length: count }, (_, index) => new Date(cursor.getFullYear(), cursor.getMonth(), index + 1))
    };
  }, [cursor]);

  if (loading) return <SkeletonCalendar />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  const dayparts = (serviceDate) => daypartsOn(data.campaigns, serviceDate, { statuses });
  const selectedParts = selectedDate ? dayparts(selectedDate) : [];

  // One lane per campaign; a campaign with two dayparts shows two bars.
  const lanes = [...new Map(selectedParts.map((part) => [part.campaignId, part])).values()].map((part) => ({
    id: part.campaignId,
    name: part.name,
    priority: part.priority,
    parts: selectedParts.filter((entry) => entry.campaignId === part.campaignId)
  }));

  const monthTotal = monthDays.days.reduce((total, date) => total + dayparts(isoOf(date)).length, 0);

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">Planning</p>
          <h1>Calendar</h1>
          <p>
            What is booked to run on each day. Boxes pull these windows when they sync, so a day shows the plan; the
            delivery list inside a day shows which boxes actually collected it.
          </p>
        </div>
        <div className="head-actions">
          <label className="field">
            Show
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="active">Active only</option>
              <option value="all">Active, paused and drafts</option>
              <option value="draft">Drafts only</option>
            </select>
          </label>
          <Link className="btn primary" href="/campaigns/new">
            New campaign
          </Link>
        </div>
      </header>

      <div className="grid three">
        <Stat label="Campaign windows this month" value={monthTotal} note={cursor.toLocaleString('en', { month: 'long', year: 'numeric' })} />
        <Stat label="Running today" value={dayparts(todayIso()).length} note="dayparts active on today's date" />
        <Stat
          label="Total ads booked today"
          value={dayparts(todayIso()).reduce((total, part) => total + part.adCount, 0)}
          note="across every active campaign"
        />
      </div>

      <Panel>
        <div className="calendar-toolbar">
          <button className="btn tiny" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>
            ‹
          </button>
          <strong>{cursor.toLocaleString('en', { month: 'long', year: 'numeric' })}</strong>
          <button className="btn tiny" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>
            ›
          </button>
          <button className="btn tiny" onClick={() => setCursor(new Date())}>
            Today
          </button>
        </div>

        <div className="calendar-grid">
          {DAY_NAMES.map((day) => (
            <span className="calendar-weekday" key={day}>
              {day}
            </span>
          ))}
          {Array.from({ length: monthDays.offset }).map((_, index) => (
            <span className="calendar-empty" key={`pad-${index}`} />
          ))}
          {monthDays.days.map((date) => {
            const serviceDate = isoOf(date);
            const parts = dayparts(serviceDate);
            const ads = parts.reduce((total, part) => total + part.adCount, 0);
            return (
              <button
                className={`calendar-day ${parts.length ? 'has-schedule' : ''} ${serviceDate === todayIso() ? 'is-today' : ''}`}
                key={serviceDate}
                onClick={() => {
                  setSelectedDate(serviceDate);
                  setSelectedEvent(null);
                }}
              >
                <strong>{date.getDate()}</strong>
                {parts.slice(0, 3).map((part) => (
                  <small key={part.key} title={`${part.name} · ${part.startTime}–${part.endTime}`}>
                    {part.startTime} {part.name}
                  </small>
                ))}
                {parts.length > 3 && <em>+{parts.length - 3} more</em>}
                {parts.length > 0 && <em>{ads} ad{ads === 1 ? '' : 's'}</em>}
              </button>
            );
          })}
        </div>
      </Panel>

      {selectedDate && (
        <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setSelectedDate(null)}>
          <section className="calendar-modal" role="dialog" aria-modal="true">
            <div className="calendar-modal-header">
              <div>
                <p className="eyebrow">Day detail</p>
                <h2>{new Date(`${selectedDate}T12:00:00`).toLocaleDateString('en', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</h2>
                <span>
                  {selectedParts.length} window{selectedParts.length === 1 ? '' : 's'} across {lanes.length} campaign
                  {lanes.length === 1 ? '' : 's'}
                </span>
              </div>
              <button className="modal-close" onClick={() => setSelectedDate(null)} aria-label="Close">
                ×
              </button>
            </div>

            <div className="calendar-modal-body">
              <div className="timeline-wrap">
                {lanes.length ? (
                  <div className="timeline">
                    <div className="timeline-header">
                      <span className="timeline-lane-label">Campaign</span>
                      <div className="timeline-hours">
                        {HOUR_MARKS.map((hour) => (
                          <span style={{ left: `${(hour / 24) * 100}%` }} key={hour}>
                            {hour}:00
                          </span>
                        ))}
                      </div>
                    </div>
                    {lanes.map((lane) => (
                      <div className="timeline-lane" key={lane.id}>
                        <span className="timeline-lane-label" title={lane.name}>
                          {lane.name}
                        </span>
                        <div className="timeline-track">
                          {HOUR_MARKS.map((hour) => (
                            <i style={{ left: `${(hour / 24) * 100}%` }} key={hour} />
                          ))}
                          {lane.parts.map((part) => (
                            <button
                              type="button"
                              className={`timeline-event ${selectedEvent?.key === part.key ? 'selected' : ''}`}
                              style={{
                                left: `${percentOfDay(part.startTime)}%`,
                                width: `${Math.max(percentOfDay(part.endTime) - percentOfDay(part.startTime), 3)}%`
                              }}
                              key={part.key}
                              onClick={() => setSelectedEvent(part)}
                            >
                              <strong>{part.name}</strong>
                              <small>
                                {part.startTime}–{part.endTime}
                              </small>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Empty icon="◫" title="Nothing booked on this day">
                    No campaign daypart covers this date with the current filter.
                  </Empty>
                )}

                <Panel
                  eyebrow="Actual"
                  title="Schedules collected by boxes"
                  description="Proof of what the fleet pulled for this date."
                  className="calendar-deliveries"
                  style={{ position: 'relative' }}
                >
                  {deliveries.loading && <SkeletonTable rows={4} showOverlay overlayLabel="Loading deliveries…" />}
                  {deliveries.data?.deliveries?.length ? (
                    <div className="table-wrap">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Box</th>
                            <th className="numeric">Windows</th>
                            <th className="numeric">Ads</th>
                            <th>Collected</th>
                          </tr>
                        </thead>
                        <tbody>
                          {deliveries.data.deliveries.map((delivery) => (
                            <tr key={delivery.id}>
                              <td>
                                <Link href={`/fleet/${delivery.boxId}`}>
                                  <strong>{delivery.box?.name}</strong>
                                  <small>{delivery.box?.serialNumber}</small>
                                </Link>
                              </td>
                              <td className="numeric">{delivery.slotCount}</td>
                              <td className="numeric">{delivery.itemCount}</td>
                              <td title={formatDateTime(delivery.deliveredAt)}>{formatRelative(delivery.deliveredAt)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    !deliveries.loading && (
                      <Empty icon="⌁" title="No box has collected this date yet">
                        Boxes fetch tomorrow from 23:00 and catch up on today until 07:00.
                      </Empty>
                    )
                  )}
                </Panel>
              </div>

              {selectedEvent && (
                <aside className="calendar-event-detail">
                  <p className="eyebrow">Window detail</p>
                  <h3>{selectedEvent.name}</h3>
                  <div className="kv" style={{ gridTemplateColumns: '1fr' }}>
                    <div>
                      <small>Window</small>
                      <strong>
                        {selectedEvent.startTime}–{selectedEvent.endTime} (
                        {formatAirtime((toMinutes(selectedEvent.endTime) - toMinutes(selectedEvent.startTime)) * 60)})
                      </strong>
                    </div>
                    <div>
                      <small>Status / priority</small>
                      <strong>
                        <Badge state={selectedEvent.status}>{selectedEvent.status}</Badge> · {selectedEvent.priority}
                      </strong>
                    </div>
                    <div>
                      <small>Target</small>
                      <strong>
                        {selectedEvent.targetType === 'all' && 'Whole fleet'}
                        {selectedEvent.targetType === 'boundary' && (selectedEvent.boundaries.map((b) => b.name).join(', ') || 'No boundary')}
                        {selectedEvent.targetType === 'box' && (selectedEvent.boxes.map((b) => b.name).join(', ') || 'No box')}
                      </strong>
                    </div>
                    <div>
                      <small>Playlist</small>
                      <strong>
                        {selectedEvent.adCount} ad{selectedEvent.adCount === 1 ? '' : 's'} ·{' '}
                        {formatAirtime(selectedEvent.cycleSeconds)} per pass
                      </strong>
                    </div>
                    <div>
                      <small>Ads</small>
                      <strong>{selectedEvent.items.map((item) => item.media?.name).filter(Boolean).join(', ') || '—'}</strong>
                    </div>
                  </div>
                  <Link className="btn tiny" href={`/campaigns/${selectedEvent.campaignId}`} style={{ marginTop: 14 }}>
                    Open campaign
                  </Link>
                </aside>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
