'use client';

import Link from 'next/link';
import { use } from 'react';
import { api } from '../../lib/api';
import { ErrorState, Loading, useResource } from '../../components/ui';
import CampaignWizard from '../../components/CampaignWizard';

export default function EditCampaignPage({ params }) {
  const { id } = use(params);

  const { loading, data, error, reload } = useResource(async () => {
    const [campaign, media, boundaries, boxes, campaigns] = await Promise.all([
      api.campaign(id),
      api.media(),
      api.boundaries(),
      api.boxes(),
      api.campaigns()
    ]);
    return {
      campaign: campaign.campaign,
      media: media.media,
      boundaries: boundaries.boundaries,
      boxes: boxes.boxes,
      campaigns: campaigns.campaigns
    };
  }, [id]);

  if (loading) return <Loading label="Loading campaign…" />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  const { campaign } = data;
  const initial = {
    name: campaign.name,
    description: campaign.description || '',
    status: campaign.status,
    priority: campaign.priority,
    slotSeconds: campaign.slotSeconds,
    startDate: campaign.startDate,
    endDate: campaign.endDate,
    targetType: campaign.targetType,
    boundaryIds: campaign.boundaries.map((boundary) => boundary.id),
    boxIds: campaign.boxes.map((box) => box.id),
    items: campaign.items.map((item) => ({ mediaId: item.mediaId, durationSeconds: item.durationSeconds })),
    slots: campaign.slots.map((slot) => ({
      startTime: slot.startTime,
      endTime: slot.endTime,
      daysOfWeek: slot.daysOfWeek
    }))
  };

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">
            <Link href="/campaigns">← Campaigns</Link>
          </p>
          <h1>{campaign.name}</h1>
          <p>Editing an existing campaign. Boxes pick up changes at their next sync.</p>
        </div>
      </header>

      <CampaignWizard
        initial={initial}
        campaignId={campaign.id}
        media={data.media}
        boundaries={data.boundaries}
        boxes={data.boxes}
        campaigns={data.campaigns}
      />
    </>
  );
}
