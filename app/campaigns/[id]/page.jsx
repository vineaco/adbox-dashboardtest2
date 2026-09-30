'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useState } from 'react';
import {
  api,
  addDays,
  formatBytes,
  formatDateTime,
  formatDuration,
  formatRelative,
  setFlash,
  todayIso
} from '../../lib/api';
import { Badge, ConfirmModal, Empty, ErrorState, Loading, Panel, Stat, useResource, useToast } from '../../components/ui';
import { Pagination, usePagination } from '../../components/Pagination';
import { SkeletonCampaignMetrics } from '../../components/Skeleton';
import { EditIcon, PauseIcon, PlayIcon, RefreshIcon, SearchIcon, TrashIcon } from '../../components/Icon';
import { DAY_NAMES, campaignCycleSeconds, formatAirtime } from '../../lib/airtime';
import { validateMediaFit } from '../../lib/mediaValidation';

const STATUSES = ['all', 'played', 'skipped', 'failed'];

export default function CampaignDetailPage({ params }) {
  const { id } = use(params);
  const router = useRouter();
  const [toastNode, notify] = useToast();
  const [from, setFrom] = useState(addDays(todayIso(), -30));
  const [to, setTo] = useState(todayIso());
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(null); // 'toggle' | 'delete' | null
  const [modalBusy, setModalBusy] = useState(false);

  const campaignRes = useResource(() => api.campaign(id), [id]);
  const metricsRes = useResource(() => api.campaignMetrics(id, `?from=${from}&to=${to}`), [id, from, to]);

  const campaign = campaignRes.data?.campaign;
  const metrics = metricsRes.data;

  const term = search.trim().toLowerCase();
  const filteredEvents = (metrics?.events || []).filter((event) => {
    if (status !== 'all' && event.status !== status) return false;
    if (!term) return true;
    return [event.boxName, event.boxSerial, event.mediaName].some((value) => value?.toLowerCase().includes(term));
  });
  const { page, setPage, totalPages, pageItems, start, pageSize, setPageSize } = usePagination(filteredEvents, 10);

  const triggerSync = async () => {
    setBusy(true);
    try {
      const res = await api.triggerCampaignSync(id);
      notify(res?.message || 'Sync triggered. Boxes will collect changes.');
      campaignRes.reload();
    } catch (syncError) {
      notify(syncError.message, true);
    } finally {
      setBusy(false);
    }
  };

  async function confirmToggleStatus() {
    setModalBusy(true);
    const activating = campaign.status !== 'active';
    try {
      await api.updateCampaign(id, { status: activating ? 'active' : 'paused' });
      notify(activating ? 'Campaign activated.' : 'Campaign paused.');
      setConfirming(null);
      campaignRes.reload();
    } catch (updateError) {
      notify(updateError.message, true);
    } finally {
      setModalBusy(false);
    }
  }

  async function confirmDelete() {
    setModalBusy(true);
    try {
      await api.deleteCampaign(id);
      setFlash(`Campaign "${campaign.name}" deleted.`);
      router.push('/campaigns');
    } catch (deleteError) {
      notify(deleteError.message, true);
      setModalBusy(false);
    }
  }

  if (campaignRes.loading && !campaign) return <SkeletonCampaignMetrics />;
  if (campaignRes.error) return <ErrorState error={campaignRes.error} onRetry={campaignRes.reload} />;

  const syncState =
    campaign.status !== 'active' ? 'inactive' : campaign.sync?.isSynced ? 'synced' : 'not-synced';
  const activating = campaign.status !== 'active';

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">
            <Link href="/campaigns">← Campaigns</Link>
          </p>
          <h1>{campaign.name}</h1>
          <p>{campaign.description || 'Campaign details, attached files and every play it has had.'}</p>
        </div>
        <div className="head-actions">
          <button className="btn" onClick={() => setConfirming('toggle')} disabled={busy}>
            {campaign.status === 'active' ? <PauseIcon /> : <PlayIcon />}
            {campaign.status === 'active' ? 'Pause' : 'Activate'}
          </button>
          <Link className="btn" href={`/campaigns/${id}/edit`}>
            <EditIcon /> Edit
          </Link>
          <button className="btn danger" onClick={() => setConfirming('delete')} disabled={busy}>
            <TrashIcon /> Delete
          </button>
        </div>
      </header>

      {confirming === 'toggle' && (
        <ConfirmModal
          title={activating ? 'Activate campaign?' : 'Pause campaign?'}
          description={
            activating
              ? `"${campaign.name}" will become eligible for box sync and start appearing in rotations again.`
              : `"${campaign.name}" will stop being delivered to boxes at their next sync. It stays saved and can be reactivated any time.`
          }
          confirmLabel={activating ? 'Activate' : 'Pause'}
          busyLabel={activating ? 'Activating…' : 'Pausing…'}
          busy={modalBusy}
          onConfirm={confirmToggleStatus}
          onClose={() => setConfirming(null)}
        />
      )}

      {confirming === 'delete' && (
        <ConfirmModal
          title="Delete campaign?"
          description={`"${campaign.name}" and its playlist, dayparts and targeting will be permanently removed. Proof-of-play history is kept, but this cannot be undone.`}
          confirmLabel="Delete"
          busyLabel="Deleting…"
          danger
          busy={modalBusy}
          onConfirm={confirmDelete}
          onClose={() => setConfirming(null)}
        />
      )}

      {modalBusy && <Loading label={confirming === 'delete' ? 'Deleting campaign…' : 'Updating status…'} compact />}


      <Panel eyebrow="Overview" title="Campaign details">
        <div className="kv">
          <div>
            <small>Status</small>
            <span>
              <Badge state={campaign.status}>{campaign.status}</Badge>
            </span>
          </div>
          <div>
            <small>Sync</small>
            <span>
              <button
                type="button"
                className={`pill-btn ${syncState}`}
                onClick={triggerSync}
                disabled={busy}
                title="Click to trigger an instant sync bump."
              >
                <i />{' '}
                {syncState === 'synced' ? `Synced (${campaign.sync.syncedBoxesCount})` : 'Not synced'}
              </button>
            </span>
          </div>
          <div>
            <small>Last synced</small>
            <strong title={formatDateTime(campaign.sync?.lastSyncedAt)}>
              {campaign.sync?.lastSyncedAt ? formatRelative(campaign.sync.lastSyncedAt) : '—'}
            </strong>
          </div>
          <div>
            <small>Runs</small>
            <strong>
              {campaign.startDate} to {campaign.endDate}
            </strong>
          </div>
          <div>
            <small>Priority</small>
            <strong>{campaign.priority}</strong>
          </div>
          <div>
            <small>Playlist</small>
            <strong>
              {campaign.items.length} ad(s) · {formatAirtime(campaignCycleSeconds(campaign))} / pass
            </strong>
          </div>
          <div>
            <small>Target</small>
            {campaign.targetType === 'all' && <strong>Whole fleet</strong>}
            {campaign.targetType === 'boundary' && (
              <strong>
                {campaign.boundaries.map((boundary) => boundary.name).join(', ') || 'No boundary set'}
              </strong>
            )}
            {campaign.targetType === 'box' && (
              <strong>{campaign.boxes.map((box) => box.name).join(', ') || 'No box set'}</strong>
            )}
          </div>
          <div>
            <small>Dayparts</small>
            <span>
              {campaign.slots.map((slot) => (
                <div key={slot.id} className="daypart-chip">
                  <strong>
                    {slot.startTime}–{slot.endTime}
                  </strong>
                  <small>{slot.daysOfWeek.map((day) => DAY_NAMES[day]).join(' ')}</small>
                </div>
              ))}
            </span>
          </div>
        </div>
      </Panel>

      <Panel eyebrow="Playlist" title="Attached files" description="Played in this order on every pass.">
        {campaign.items.length ? (
          <div className="media-grid">
            {campaign.items.map((item, index) => {
              const media = item.media || {};
              const fit = validateMediaFit(media);
              return (
                <article key={item.id} className="media-card">
                  {media.type === 'video' ? (
                    <video src={media.url} muted preload="metadata" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={media.url} alt={media.name} loading="lazy" />
                  )}
                  <div className="meta">
                    <strong title={media.name}>
                      {index + 1}. {media.name || item.mediaId}
                    </strong>
                    <small>
                      {media.type} · {formatBytes(media.bytes)}
                      {media.width && media.height ? ` · ${media.width}×${media.height}` : ''}
                    </small>
                    <small>{item.durationSeconds || campaign.slotSeconds}s on screen</small>
                    <div className="media-val-badges">
                      {fit.badges.map((b, i) => (
                        <span key={i} className={`media-val-badge ${b.type}`} title={b.description}>
                          {b.type === 'success' ? '✓ ' : b.type === 'warning' ? '⚠️ ' : ''}
                          {b.label}
                        </span>
                      ))}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <Empty icon="▤" title="No files attached">
            Edit the campaign to add media to its playlist.
          </Empty>
        )}
      </Panel>

      <Panel
        eyebrow="Proof of play"
        title="Performance"
        actions={
          <button className="btn" onClick={metricsRes.reload}>
            <RefreshIcon /> Refresh
          </button>
        }
      >
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 18 }}>
          <label className="field">
            From
            <input type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} />
          </label>
          <label className="field">
            To
            <input type="date" value={to} min={from} max={todayIso()} onChange={(event) => setTo(event.target.value)} />
          </label>
        </div>

        {metricsRes.error ? (
          <ErrorState error={metricsRes.error} onRetry={metricsRes.reload} />
        ) : !metrics ? (
          <p style={{ color: '#7f92a6', fontSize: 12 }}>Loading plays…</p>
        ) : (
          <>
            <div className="grid four">
              <Stat label="Total plays" value={metrics.totals.plays} note={`${metrics.range.from} to ${metrics.range.to}`} />
              <Stat label="Total screen time" value={formatDuration(metrics.totals.totalDurationMs)} />
              <Stat label="Boxes that played it" value={metrics.totals.uniqueBoxes} />
              <Stat
                label="Expected impressions"
                value={metrics.impressions.estimate === null ? '—' : metrics.impressions.estimate.toLocaleString()}
                note={metrics.impressions.note || 'Estimated from boundary traffic × share of screen time.'}
                attention={metrics.impressions.estimate === null}
              />
            </div>

            {(metrics.totals.byStatus.failed || metrics.totals.byStatus.skipped) && (
              <p style={{ margin: '10px 0 0' }}>
                {metrics.totals.byStatus.failed ? <Badge state="bad">{metrics.totals.byStatus.failed} failed</Badge> : null}{' '}
                {metrics.totals.byStatus.skipped ? <Badge state="warn">{metrics.totals.byStatus.skipped} skipped</Badge> : null}
              </p>
            )}

            <div className="toolbar" style={{ marginTop: 18 }}>
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
                {metrics.truncated
                  ? `Most recent ${metrics.events.length} of ${metrics.totals.plays} plays`
                  : `${filteredEvents.length} of ${metrics.events.length} shown`}
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
              <Empty
                icon={metrics.events.length ? <SearchIcon /> : '▤'}
                title={metrics.events.length ? 'No plays match' : 'No plays in this range'}
              >
                {metrics.events.length
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
              pageSize={pageSize}
              onPageSizeChange={setPageSize}
            />
          </>
        )}
      </Panel>

      {toastNode}
    </>
  );
}
