'use client';

import Link from 'next/link';
import { useState } from 'react';
import { api } from '../lib/api';
import { Badge, Empty, ErrorState, Loading, Panel, useResource, useToast } from '../components/ui';
import { Pagination, usePagination } from '../components/Pagination';
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

  const term = search.trim().toLowerCase();
  const filtered = (data?.campaigns || []).filter((campaign) => {
    if (status !== 'all' && campaign.status !== status) return false;
    if (target !== 'all' && campaign.targetType !== (target === 'all-fleet' ? 'all' : target)) return false;
    if (!term) return true;
    return [campaign.name, campaign.description].some((value) => value?.toLowerCase().includes(term));
  });
  const { page, setPage, totalPages, pageItems, start } = usePagination(filtered, 10);

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

      {loading && <Loading label="Loading campaigns…" />}
      {error && <ErrorState error={error} onRetry={reload} />}

      {data &&
        (data.campaigns.length ? (
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
                {filtered.length} of {data.campaigns.length} campaigns
              </span>
            </div>

            {pageItems.length ? (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Campaign</th>
                      <th>Status</th>
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
            />
          </Panel>
        ) : (
          <Panel>
            <Empty icon="▣" title="No campaigns yet">
              Create a low-priority fleet-wide campaign first so no screen is ever blank, then layer geo-targeted ads on
              top of it.
            </Empty>
          </Panel>
        ))}

      {toastNode}
    </>
  );
}
