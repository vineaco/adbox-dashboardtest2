'use client';

import Link from 'next/link';
import { api } from '../lib/api';
import { Badge, Empty, ErrorState, Loading, Panel, useResource, useToast } from '../components/ui';
import { DAY_NAMES, campaignCycleSeconds, formatAirtime } from '../lib/airtime';

export default function CampaignsPage() {
  const [toastNode, notify] = useToast();
  const { loading, data, error, reload } = useResource(() => api.campaigns());

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
            Refresh
          </button>
          <Link className="btn primary" href="/campaigns/new">
            New campaign
          </Link>
        </div>
      </header>

      {loading && <Loading label="Loading campaigns…" />}
      {error && <ErrorState error={error} onRetry={reload} />}

      {data &&
        (data.campaigns.length ? (
          <Panel>
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
                  {data.campaigns.map((campaign) => (
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
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <Link className="btn tiny" href={`/campaigns/${campaign.id}/metrics`}>
                            Metrics
                          </Link>
                          <button className="btn tiny" onClick={() => toggleStatus(campaign)}>
                            {campaign.status === 'active' ? 'Pause' : 'Activate'}
                          </button>
                          <Link className="btn tiny" href={`/campaigns/${campaign.id}`}>
                            Edit
                          </Link>
                          <button className="btn tiny danger" onClick={() => remove(campaign)}>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
