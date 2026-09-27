'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useState } from 'react';
import { api, addDays, formatDateTime, formatDuration, formatRelative, todayIso } from '../../lib/api';
import { Badge, Empty, ErrorState, Loading, Modal, Panel, Stat, useResource, useToast } from '../../components/ui';
import { SkeletonFleetDetail, SkeletonTable } from '../../components/Skeleton';

const FleetMap = dynamic(() => import('../../components/FleetMap'), { ssr: false, loading: () => <div className="map small" /> });

const TABS = [
  ['schedule', 'Schedule'],
  ['playback', 'Playback'],
  ['errors', 'Errors'],
  ['settings', 'Settings']
];

export default function BoxDetailPage({ params }) {
  const router = useRouter();
  const { id } = use(params);
  const [tab, setTab] = useState('schedule');
  const [previewDate, setPreviewDate] = useState(todayIso());
  const [rotatedKey, setRotatedKey] = useState(null);
  const [toastNode, notify] = useToast();

  const { loading, data, error, reload } = useResource(() => api.box(id), [id]);
  const preview = useResource(() => api.schedulePreview(id, `?serviceDate=${previewDate}`), [id, previewDate]);

  if (loading) return <SkeletonFleetDetail />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  const { box, deliveries, latestSchedule, playbackEvents, errors, heartbeats } = data;
  const latestHeartbeat = heartbeats[0];
  const playedToday = playbackEvents.filter((event) => event.serviceDate === todayIso());
  const screenTime = playedToday.reduce((total, event) => total + event.durationMs, 0);

  async function saveField(field, value) {
    try {
      await api.updateBox(id, { [field]: value });
      notify(`${field} updated.`);
      reload();
    } catch (updateError) {
      notify(updateError.message, true);
    }
  }

  async function rotateKey() {
    try {
      const result = await api.rotateBoxKey(id);
      setRotatedKey(result.apiKey);
    } catch (rotateError) {
      notify(rotateError.message, true);
    }
  }

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">
            <Link href="/fleet">← Fleet</Link>
          </p>
          <h1>{box.name}</h1>
          <p className="mono">{box.serialNumber}</p>
        </div>
        <div className="head-actions">
          <Badge state={box.status === 'active' ? box.connectivity : box.status}>
            {box.status === 'active' ? box.connectivity : box.status}
          </Badge>
          <button className="btn" onClick={reload}>
            Refresh
          </button>
        </div>
      </header>

      <div className="grid four">
        <Stat label="Last seen" value={formatRelative(box.lastSeenAt)} note={formatDateTime(box.lastSeenAt)} />
        <Stat
          label="Plays today"
          value={playedToday.length}
          note={`${formatDuration(screenTime)} of screen time`}
        />
        <Stat
          label="Schedule deliveries"
          value={deliveries.length}
          note={deliveries[0] ? `latest for ${deliveries[0].serviceDate}` : 'none yet'}
        />
        <Stat
          label="CPU temperature"
          value={latestHeartbeat?.cpuTempC ? latestHeartbeat.cpuTempC.toFixed(1) : '—'}
          unit="°C"
          note={latestHeartbeat?.diskFreeMb ? `${latestHeartbeat.diskFreeMb} MB free` : 'no heartbeat yet'}
          attention={latestHeartbeat?.cpuTempC > 75}
        />
      </div>

      <div className="grid two">
        <Panel eyebrow="Position" title="Last known location">
          {box.lastLat === null || box.lastLat === undefined ? (
            <Empty icon="◎" title="No GPS fix reported">
              Check the NEO module wiring and run <span className="mono">sudo adbox-doctor</span> on the Pi.
            </Empty>
          ) : (
            <>
              <FleetMap locations={[box]} boundaries={[]} height={240} />
              <div className="kv" style={{ marginTop: 16 }}>
                <div>
                  <small>Coordinates</small>
                  <strong className="mono">
                    {box.lastLat.toFixed(5)}, {box.lastLng.toFixed(5)}
                  </strong>
                </div>
                <div>
                  <small>Fix source</small>
                  <strong>
                    <Badge state={box.lastGpsSource === 'gps' ? 'ok' : 'warn'}>{box.lastGpsSource || 'unknown'}</Badge>
                  </strong>
                </div>
                <div>
                  <small>Fixed at</small>
                  <strong>{formatDateTime(box.lastGpsFixAt)}</strong>
                </div>
                <div>
                  <small>Matched boundaries</small>
                  <strong>{box.boundaryIds.length || 'none'}</strong>
                </div>
              </div>
            </>
          )}
        </Panel>

        <Panel eyebrow="Device" title="Hardware and agent">
          <div className="kv">
            <div>
              <small>Model</small>
              <strong>{box.model || '—'}</strong>
            </div>
            <div>
              <small>Agent version</small>
              <strong>{box.agentVersion || '—'}</strong>
            </div>
            <div>
              <small>Hardware id</small>
              <strong className="mono">{box.hardwareId || '—'}</strong>
            </div>
            <div>
              <small>MAC address</small>
              <strong className="mono">{box.macAddress || '—'}</strong>
            </div>
            <div>
              <small>Timezone</small>
              <strong>{box.timezone}</strong>
            </div>
            <div>
              <small>Registered</small>
              <strong>{formatDateTime(box.createdAt)}</strong>
            </div>
          </div>
          {latestHeartbeat && (
            <div className="notice" style={{ marginTop: 16 }}>
              Last heartbeat {formatRelative(latestHeartbeat.at)} — player {latestHeartbeat.playerState || 'unknown'}
              {latestHeartbeat.currentMedia ? `, showing “${latestHeartbeat.currentMedia}”` : ''}.
            </div>
          )}
        </Panel>
      </div>

      <div className="tabs">
        {TABS.map(([key, label]) => (
          <button key={key} className={tab === key ? 'on' : ''} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'schedule' && (
        <>
          <Panel
            eyebrow="Preview"
            title="What this box would receive"
            description="Resolved against its last known position — the same logic the device endpoint runs."
            style={{ position: 'relative' }}
            actions={
              <label className="field">
                Service date
                <input type="date" value={previewDate} onChange={(event) => setPreviewDate(event.target.value)} />
              </label>
            }
          >
            {preview.loading && <SkeletonTable rows={3} showOverlay overlayLabel="Resolving box playlist…" />}
            {preview.error && <ErrorState error={preview.error} onRetry={preview.reload} />}
            {preview.data && <SlotList schedule={preview.data} />}
          </Panel>

          <Panel
            eyebrow="History"
            title="Delivered schedules"
            description="Proof of exactly what this screen was told to play, and from where."
          >
            {deliveries.length ? (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Service date</th>
                      <th className="numeric">Slots</th>
                      <th className="numeric">Items</th>
                      <th>Position</th>
                      <th>Delivered</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deliveries.map((delivery) => (
                      <tr key={delivery.id}>
                        <td>
                          <strong>{delivery.serviceDate}</strong>
                        </td>
                        <td className="numeric">{delivery.slotCount}</td>
                        <td className="numeric">{delivery.itemCount}</td>
                        <td className="mono">
                          {delivery.lat === null ? '—' : `${delivery.lat.toFixed(4)}, ${delivery.lng.toFixed(4)}`}
                        </td>
                        <td title={formatDateTime(delivery.deliveredAt)}>{formatRelative(delivery.deliveredAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty icon="⌁" title="No schedule delivered yet">
                The box syncs at 23:00 for tomorrow, and between 00:00 and 07:00 for today. Force one now with{' '}
                <span className="mono">sudo adbox-sync-now today</span>.
              </Empty>
            )}
            {latestSchedule && (
              <details style={{ marginTop: 16 }}>
                <summary style={{ cursor: 'pointer', color: '#648f32', fontSize: 11 }}>
                  Raw payload of the most recent delivery
                </summary>
                <pre className="code">{JSON.stringify(latestSchedule, null, 2)}</pre>
              </details>
            )}
          </Panel>
        </>
      )}

      {tab === 'playback' && (
        <Panel eyebrow="Proof of play" title="Recent playback" description="Uploaded in batches by the agent.">
          {playbackEvents.length ? (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Started</th>
                    <th>Ad</th>
                    <th className="numeric">Duration</th>
                    <th>Position</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {playbackEvents.map((event) => (
                    <tr key={event.id}>
                      <td title={formatDateTime(event.startedAt)}>{formatRelative(event.startedAt)}</td>
                      <td>
                        <strong>{event.mediaName || event.mediaId || '—'}</strong>
                        <small>{event.serviceDate}</small>
                      </td>
                      <td className="numeric">{formatDuration(event.durationMs)}</td>
                      <td className="mono">
                        {event.lat === null ? '—' : `${event.lat.toFixed(4)}, ${event.lng.toFixed(4)}`}
                      </td>
                      <td>
                        <Badge state={event.status}>{event.status}</Badge>
                        {event.detail && <small>{event.detail}</small>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty icon="▣" title="No playback recorded">
              The agent buffers events locally and uploads them every two minutes.
            </Empty>
          )}
        </Panel>
      )}

      {tab === 'errors' && (
        <Panel eyebrow="Diagnostics" title="Reported errors" description="Raised by the agent, GPS reader or mpv.">
          {errors.length ? (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Level</th>
                    <th>Source</th>
                    <th>Message</th>
                  </tr>
                </thead>
                <tbody>
                  {errors.map((entry) => (
                    <tr key={entry.id}>
                      <td title={formatDateTime(entry.at)}>{formatRelative(entry.at)}</td>
                      <td>
                        <Badge state={entry.level === 'warn' ? 'warn' : 'bad'}>{entry.level}</Badge>
                      </td>
                      <td>{entry.source}</td>
                      <td>
                        {entry.message}
                        {entry.context && entry.context !== '{}' && <small className="mono">{entry.context}</small>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty icon="✓" title="No errors reported">
              This box has not raised anything since its records were last pruned.
            </Empty>
          )}
        </Panel>
      )}

      {tab === 'settings' && (
        <Panel eyebrow="Configuration" title="Box settings">
          <div className="form-grid">
            <label className="field">
              Display name
              <input defaultValue={box.name} onBlur={(event) => event.target.value !== box.name && saveField('name', event.target.value)} />
            </label>
            <label className="field">
              Screen label
              <input
                defaultValue={box.screenLabel || ''}
                onBlur={(event) => event.target.value !== (box.screenLabel || '') && saveField('screenLabel', event.target.value)}
              />
            </label>
            <label className="field">
              Timezone
              <input
                defaultValue={box.timezone}
                onBlur={(event) => event.target.value !== box.timezone && saveField('timezone', event.target.value)}
              />
            </label>
            <label className="field">
              Status
              <select defaultValue={box.status} onChange={(event) => saveField('status', event.target.value)}>
                <option value="active">active — syncs and plays</option>
                <option value="suspended">suspended — requests rejected</option>
                <option value="retired">retired — permanently removed</option>
              </select>
            </label>
          </div>

          <label className="field" style={{ marginTop: 14 }}>
            Notes
            <textarea
              defaultValue={box.notes || ''}
              onBlur={(event) => event.target.value !== (box.notes || '') && saveField('notes', event.target.value)}
            />
          </label>

          <div className="notice" style={{ marginTop: 18 }}>
            Rotating the API key immediately invalidates the credential stored in{' '}
            <span className="mono">/etc/adbox/box.env</span> on the device. You must write the new key to that file and
            restart <span className="mono">adbox-agent</span>, or the box will stop syncing.
          </div>
          <div className="form-actions" style={{ justifyContent: 'space-between' }}>
            <button
              className="btn danger"
              onClick={async () => {
                if (!window.confirm(`Delete box "${box.name}" (${box.serialNumber}) completely? All associated delivery and telemetry logs will be removed.`)) return;
                try {
                  await api.deleteBox(id);
                  router.push('/fleet');
                } catch (err) {
                  notify(err.message, true);
                }
              }}
            >
              Delete box
            </button>
            <button className="btn" onClick={rotateKey}>
              Rotate API key
            </button>
          </div>
        </Panel>
      )}

      {rotatedKey && (
        <Modal
          title="New API key issued"
          description="This is shown once. Copy it into /etc/adbox/box.env on the Pi, then restart the agent."
          onClose={() => setRotatedKey(null)}
        >
          <div className="copy-box">
            <code style={{ fontSize: 11 }}>{rotatedKey}</code>
            <button
              className="btn tiny"
              onClick={() => {
                navigator.clipboard?.writeText(rotatedKey);
                notify('Key copied to clipboard.');
              }}
            >
              Copy
            </button>
          </div>
          <pre className="code">{`sudo sed -i "s|^ADBOX_API_KEY=.*|ADBOX_API_KEY=${rotatedKey}|" /etc/adbox/box.env
sudo systemctl restart adbox-agent`}</pre>
          <div className="form-actions">
            <button className="btn primary" onClick={() => setRotatedKey(null)}>
              Done
            </button>
          </div>
        </Modal>
      )}

      {toastNode}
    </>
  );
}

function SlotList({ schedule }) {
  if (!schedule.slots.length) {
    return (
      <Empty icon="▢" title="Nothing would be delivered">
        No active campaign targets this position on {schedule.serviceDate}. Create a fleet-wide fallback campaign so the
        screen is never blank.
      </Empty>
    );
  }

  return (
    <>
      <div className="kv" style={{ marginBottom: 18 }}>
        <div>
          <small>Service date</small>
          <strong>{schedule.serviceDate}</strong>
        </div>
        <div>
          <small>Total items</small>
          <strong>{schedule.itemCount}</strong>
        </div>
        <div>
          <small>Matched boundaries</small>
          <strong>{schedule.location.boundaries.map((boundary) => boundary.name).join(', ') || 'none'}</strong>
        </div>
        <div>
          <small>Payload hash</small>
          <strong className="mono">{schedule.payloadHash}</strong>
        </div>
      </div>

      {schedule.slots.map((slot) => (
        <div key={slot.campaignId} style={{ marginBottom: 14 }}>
          <div className="toolbar" style={{ marginBottom: 8 }}>
            <strong style={{ fontSize: 13 }}>{slot.name}</strong>
            <span style={{ color: '#929890', fontSize: 11 }}>
              {slot.startTime}–{slot.endTime} · priority {slot.priority} · {slot.targetType}
            </span>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Ad</th>
                  <th>Type</th>
                  <th className="numeric">Duration</th>
                </tr>
              </thead>
              <tbody>
                {slot.items.map((item) => (
                  <tr key={item.itemId}>
                    <td>
                      <strong>{item.name}</strong>
                      <small className="mono">{item.url}</small>
                    </td>
                    <td>
                      <Badge state="ok">{item.type}</Badge>
                    </td>
                    <td className="numeric">{item.durationSeconds}s</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </>
  );
}
