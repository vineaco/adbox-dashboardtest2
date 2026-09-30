import { redirect } from 'next/navigation';

export default async function CampaignMetricsRedirect({ params }) {
  const { id } = await params;
  redirect(`/campaigns/${id}`);
}
