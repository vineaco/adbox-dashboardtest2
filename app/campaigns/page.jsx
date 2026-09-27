'use client';

import Link from 'next/link';
import { useState } from 'react';
import { api } from '../lib/api';
import { Badge, Empty, ErrorState, Loading, Panel, Stat, useResource, useToast } from '../components/ui';
import { Pagination, usePagination } from '../components/Pagination';
import { SkeletonCampaigns } from '../components/Skeleton';
import { ChartIcon, EditIcon, PauseIcon, PlayIcon, PlusIcon, RefreshIcon, SearchIcon, TrashIcon } from '../components/Icon';
import { DAY_NAMES, campaignCycleSeconds, formatAirtime } from '../lib/airtime';

const STATUSES = ['all', 'draft', 'active', 'paused', 'archived'];

export default function CampaignsPage() {
  const [toastNode, notify] = useToast();
  const { loading, data, error, reload } = useResource(() => api.campaigns());
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [target, setTarget] = useState('all');

  async function remove(campaign) {
    if (!window.confirm(`Delete campaign “${campaign.name}”?`)) return;
    try {
      await api.deleteCampaign(campaign.id);
      notify('Campaign deleted.');
      reload();
    } catch (deleteError) {
      notify(deleteError.message, true);
    }
  }

  async function toggleStatus(campaign) {
    try {
      await api.updateCampaign(campaign.id, { status: campaign.status === 'active' ? 'paused' : 'active' });
      notify(campaign.status === 'active' ? 'Campaign paused.' : 'Campaign activated.');
      reload();
    } catch (updateError) {
      notify(updateError.message, true);
    }
  }

  async function triggerSync(campaign) {
    try {
      const res = await api.triggerCampaignSync(campaign.id);
      notify(res.message || `Sync triggered for "${campaign.name}". Boxes will collect changes.`);
      reload();
    } catch (syncError) {
      notify(syncError.message, true);
    }
  }

  const allCampaigns = data?.campaigns || [];
  const activeCount = allCampaigns.filter((c) => c.status === 'active').length;
  const pausedCount = allCampaigns.filter((c) => c.status === 'paused').length;
  const syncedCount = allCampaigns.filter((c) => c.sync?.isSynced).length;
  const boundaryCampaignsCount = allCampaigns.filter((c) => c.targetType === 'boundary').length;
  const targetedBoundariesCount = new Set(
    allCampaigns.flatMap((c) => (c.boundaries || []).map((b) => b.id))
  ).size;
  const totalMediaItems = allCampaigns.reduce((sum, c) => sum + (c.items?.length || 0), 0);
  const activeAirtimeSeconds = allCampaigns
    .filter((c) => c.status === 'active')
    .reduce((sum, c) => sum + campaignCycleSeconds(c), 0);

  const term = search.trim().toLowerCase();
  const filtered = allCampaigns.filter((campaign) => {
    if (status !== 'all' && campaign.status !== status) return false;
    if (target !== 'all' && campaign.targetType !== (target === 'all-fleet' ? 'all' : target)) return false;
    if (!term) return true;
    return [campaign.name, campaign.description].some((value) => value?.toLowerCase().includes(term));
  });
  const { page, setPage, totalPages, pageItems, start, pageSize, setPageSize } = usePagination(filtered, 10);

  if (loading) return <SkeletonCampaigns />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">Planning</p>
          <h1>Campaigns</h1>
          <p>
            A campaign is a playlist, a set of running times and a target. Boxes resolve them against their own GPS fix
            when they sync, so a moving screen picks up the right local ads automatically.
          </p>
        </div>
        <div className="head-actions">
          <Link className="btn" href="/calendar">
            Calendar
          </Link>
          <button className="btn" onClick={reload}>
            <RefreshIcon /> Refresh
          </button>
          <Link className="btn primary" href="/campaigns/new">
            <PlusIcon /> New campaign
          </Link>
        </div>
      </header>

      {data && (
        <>
          <div className="grid four" style={{ marginBottom: 18 }}>
            <Stat
              label="Total campaigns"
              value={allCampaigns.length}
              note={`${activeCount} active · ${pausedCount} paused`}
            />
            <Stat
              label="Active on screens"
              value={activeCount}
              unit={`/ ${allCampaigns.length}`}
              note={activeCount > 0 ? 'Eligible for box sync' : 'All campaigns paused or draft'}
              attention={allCampaigns.length > 0 && activeCount === 0}
            />
            <Stat
              label="Synced to boxes"
              value={syncedCount}
              unit={`/ ${activeCount}`}
              note={syncedCount > 0 ? `${syncedCount} active synced today` : 'Pending box sync'}
              attention={activeCount > 0 && syncedCount === 0}
            />
            <Stat
              label="Scheduled ads"
              value={totalMediaItems}
              note={
                activeAirtimeSeconds > 0
                  ? `${formatAirtime(activeAirtimeSeconds)} active airtime / pass`
                  : `${totalMediaItems} ads in playlists`
              }
            />
          </div>

          {allCampaigns.length ? (
            <Panel>
              <div className="toolbar">
                <div className="toolbar-group">
                  <label className="field" style={{ minWidth: 260 }}>
                    Search
                    <input
                      type="search"
                      value={search}
                      placeholder="Campaign name or description"
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
                    Target
                    <select value={target} onChange={(event) => setTarget(event.target.value)}>
                      <option value="all">All targets</option>
                      <option value="boundary">Boundary</option>
                      <option value="box">Specific box(es)</option>
                      <option value="all-fleet">Whole fleet</option>
                    </select>
                  </label>
                </div>
                <span style={{ color: '#7f92a6', fontSize: 11 }}>
                  {filtered.length} of {allCampaigns.length} campaigns
                </span>
              </div>

              {pageItems.length ? (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Campaign</th>
                        <th>Status</th>
                        <th>Sync</th>
                        <th>Runs</th>
                        <th>Dayparts</th>
                        <th>Target</th>
                        <th className="numeric">Playlist</th>
                        <th className="numeric">Priority</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {pageItems.map((campaign) => (
                        <tr key={campaign.id}>
                          <td>
                            <Link href={`/campaigns/${campaign.id}`}>
                              <strong>{campaign.name}</strong>
                              {campaign.description && <small>{campaign.description}</small>}
                            </Link>
                          </td>
                          <td>
                            <Badge state={campaign.status}>{campaign.status}</Badge>
                          </td>
                          <td>
                            <button
                              type="button"
                              className={`pill-btn ${
                                campaign.status !== 'active'
                                  ? 'inactive'
                                  : campaign.sync?.isSynced
                                  ? 'synced'
                                  : 'not-synced'
                              }`}
                              onClick={() => triggerSync(campaign)}
                              title={
                                campaign.status !== 'active'
                                  ? `Campaign is ${campaign.status}. Click to force sync bump.`
                                  : campaign.sync?.isSynced
                                  ? `Synced to ${campaign.sync.syncedBoxesCount} screen(s) today. Click to trigger instant sync bump.`
                                  : 'Not synced to any screen yet today. Click to trigger instant sync bump.'
                              }
                            >
                              <i />{' '}
                              {campaign.status !== 'active'
                                ? 'Not synced'
                                : campaign.sync?.isSynced
                                ? `Synced (${campaign.sync.syncedBoxesCount})`
                                : 'Not synced'}
                            </button>
                          </td>
                          <td>
                            {campaign.startDate}
                            <small>to {campaign.endDate}</small>
                          </td>
                          <td>
                            {campaign.slots.map((slot) => (
                              <div key={slot.id} className="daypart-chip">
                                <strong>
                                  {slot.startTime}–{slot.endTime}
                                </strong>
                                <small>{slot.daysOfWeek.map((day) => DAY_NAMES[day]).join(' ')}</small>
                              </div>
                            ))}
                          </td>
                          <td>
                            {campaign.targetType === 'all' && <Badge state="ok">whole fleet</Badge>}
                            {campaign.targetType === 'boundary' && (
                              <>
                                <strong>{campaign.boundaries.length} boundary</strong>
                                <small>{campaign.boundaries.map((boundary) => boundary.name).join(', ') || 'none set'}</small>
                              </>
                            )}
                            {campaign.targetType === 'box' && (
                              <>
                                <strong>{campaign.boxes.length} box(es)</strong>
                                <small>{campaign.boxes.map((box) => box.name).join(', ') || 'none set'}</small>
                              </>
                            )}
                          </td>
                          <td className="numeric">
                            {campaign.items.length}
                            <small>{formatAirtime(campaignCycleSeconds(campaign))} / pass</small>
                          </td>
                          <td className="numeric">{campaign.priority}</td>
                          <td>
                            <div className="row-actions">
                              <Link className="btn tiny" href={`/campaigns/${campaign.id}/metrics`} title="Metrics">
                                <ChartIcon /> Metrics
                              </Link>
                              <button
                                className="btn tiny"
                                onClick={() => toggleStatus(campaign)}
                                title={campaign.status === 'active' ? 'Pause' : 'Activate'}
                              >
                                {campaign.status === 'active' ? <PauseIcon /> : <PlayIcon />}
                                {campaign.status === 'active' ? 'Pause' : 'Activate'}
                              </button>
                              <Link className="btn tiny" href={`/campaigns/${campaign.id}`} title="Edit">
                                <EditIcon /> Edit
                              </Link>
                              <button className="btn tiny danger" onClick={() => remove(campaign)} title="Delete">
                                <TrashIcon /> Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty icon={<SearchIcon />} title="No campaigns match">
                  Try a different search term or clear the status/target filters.
                </Empty>
              )}

              <Pagination
                page={page}
                totalPages={totalPages}
                onChange={setPage}
                totalItems={filtered.length}
                shownCount={pageItems.length}
                start={start}
                pageSize={pageSize}
                onPageSizeChange={setPageSize}
              />
            </Panel>
          ) : (
            <Panel>
              <Empty icon="▣" title="No campaigns yet">
                Create a low-priority fleet-wide campaign first so no screen is ever blank, then layer geo-targeted ads on
                top of it.
              </Empty>
            </Panel>
          )}
        </>
      )}

      {toastNode}
    </>
  );
}
