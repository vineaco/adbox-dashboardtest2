'use client';

import Link from 'next/link';
import { api } from '../../lib/api';
import { ErrorState, Loading, useResource } from '../../components/ui';
import CampaignWizard, { emptyDraft } from '../../components/CampaignWizard';

export default function NewCampaignPage() {
  const { loading, data, error, reload } = useResource(async () => {
    const [media, boundaries, boxes, campaigns] = await Promise.all([
      api.media(),
      api.boundaries(),
      api.boxes(),
      api.campaigns()
    ]);
    return {
      media: media.media,
      boundaries: boundaries.boundaries,
      boxes: boxes.boxes,
      campaigns: campaigns.campaigns
    };
  });

  if (loading) return <Loading label="Loading publisher…" />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">
            <Link href="/campaigns">← Campaigns</Link>
          </p>
          <h1>New campaign</h1>
          <p>Build the playlist, pick the audience, then check how often each ad will actually play.</p>
        </div>
      </header>

      <CampaignWizard
        initial={emptyDraft()}
        media={data.media}
        boundaries={data.boundaries}
        boxes={data.boxes}
        campaigns={data.campaigns}
      />
    </>
  );
}
