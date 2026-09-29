'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { api, formatDateTime, formatRelative } from './lib/api';
import { Badge, Empty, ErrorState, Loading, Panel, Stat, useResource } from './components/ui';
import { SkeletonOverview } from './components/Skeleton';
import { Pagination, usePagination } from './components/Pagination';

const FleetMap = dynamic(() => import('./components/FleetMap'), {
  ssr: false,
  loading: () => <div className="map" />
});

export default function OverviewPage() {
  const { loading, data, error, reload } = useResource(async () => {
    const [overview, locations, boundaries] = await Promise.all([api.overview(), api.locations(), api.boundaries()]);
    return { overview, locations: locations.locations, boundaries: boundaries.boundaries };
  });
  const deliveryPager = usePagination(data?.overview?.recentDeliveries || [], 10);

  if (loading) return <SkeletonOverview />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  const { overview, locations, boundaries } = data;
  const notSynced = overview.boxes.total - overview.boxes.syncedToday;

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">Fleet control</p>
          <h1>Overview</h1>
          <p>
            Every box pulls its own playlist for the day it is about to serve, tagged with the GPS fix it had at the
            moment of the request. Nothing is pushed to a screen from here.
          </p>
        </div>
        <div className="head-actions">
          <button className="btn" onClick={reload}>
            Refresh
          </button>
          <Link className="btn primary" href="/provisioning">
            Register a new box
          </Link>
        </div>
      </header>

      <div className="grid four">
        <Stat
          label="Boxes online"
          value={overview.boxes.online}
          unit={`/ ${overview.boxes.total}`}
          note={overview.boxes.offline ? `${overview.boxes.offline} not seen in 10 min` : 'All reporting'}
          attention={overview.boxes.offline > 0}
        />
        <Stat
          label="Synced for today"
          value={overview.boxes.syncedToday}
          unit={`/ ${overview.boxes.total}`}
          note={notSynced > 0 ? `${notSynced} awaiting a sync window` : 'Whole fleet has today’s playlist'}
          attention={notSynced > 0}
        />
        <Stat label="Active campaigns" value={overview.campaigns.active} note={`${overview.media.total} media items`} />
        <Stat
          label="Errors (24h)"
          value={overview.errors.last24h}
          note={`${overview.playback.eventsToday} plays today`}
          attention={overview.errors.last24h > 0}
        />
      </div>

      <Panel
        eyebrow="Live positions"
        title="Where the fleet is right now"
        description="Markers use each box's most recent GPS fix. Shaded areas are campaign boundaries."
        className="grid"
      >
        {locations.length ? (
          <FleetMap locations={locations} boundaries={boundaries} onSelect={undefined} />
        ) : (
          <Empty icon="◎" title="No positions reported yet">
            Boxes appear here after their first heartbeat with a GPS fix.
          </Empty>
        )}
      </Panel>

      <Panel
        eyebrow="Handovers"
        title="Recent schedule deliveries"
        description="Each row is a box asking for a day's playlist and being told exactly what to play."
        actions={
          <Link className="btn tiny" href="/telemetry">
            All telemetry
          </Link>
        }
      >
        {overview.recentDeliveries.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Box</th>
                  <th>Service date</th>
                  <th className="numeric">Slots</th>
                  <th className="numeric">Items</th>
                  <th>Position</th>
                  <th>Delivered</th>
                </tr>
              </thead>
              <tbody>
                {deliveryPager.pageItems.map((delivery) => (
                  <tr key={delivery.id}>
                    <td>
                      <Link href={`/fleet/${delivery.boxId}`}>
                        <strong>{delivery.box?.name || 'Unknown box'}</strong>
                        <small>{delivery.box?.serialNumber}</small>
                      </Link>
                    </td>
                    <td>{delivery.serviceDate}</td>
                    <td className="numeric">{delivery.slotCount}</td>
                    <td className="numeric">
                      {delivery.itemCount === 0 ? <Badge state="warn">empty</Badge> : delivery.itemCount}
                    </td>
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
          <Empty icon="⌁" title="No schedule handovers yet">
            Register a box on the Provisioning page, then run <span className="mono">sudo adbox-sync-now today</span> on
            the Pi.
          </Empty>
        )}
        <Pagination
          page={deliveryPager.page}
          totalPages={deliveryPager.totalPages}
          onChange={deliveryPager.setPage}
          totalItems={overview.recentDeliveries.length}
          shownCount={deliveryPager.pageItems.length}
          start={deliveryPager.start}
          pageSize={deliveryPager.pageSize}
          onPageSizeChange={deliveryPager.setPageSize}
        />
      </Panel>
    </>
  );
}
