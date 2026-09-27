'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';

const LINKS = [
  ['/', '▦', 'Overview'],
  ['/fleet', '◉', 'Fleet'],
  ['/provisioning', '⌁', 'Provisioning'],
  ['/campaigns', '▣', 'Campaigns'],
  ['/calendar', '◫', 'Calendar'],
  ['/media', '▤', 'Media'],
  ['/boundaries', '◇', 'Boundaries'],
  ['/telemetry', '◴', 'Telemetry']
];

export default function Sidebar() {
  const pathname = usePathname();
  const [fleet, setFleet] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      api
        .overview()
        .then((data) => !cancelled && setFleet(data))
        .catch(() => !cancelled && setFleet(null));
    load();
    const timer = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const offline = fleet ? fleet.boxes.offline : 0;

  return (
    <aside className="sidebar">
      <Link href="/" className="brand" title="adbox home">
        <img src="/adbox-logo-dark.png" alt="adbox" className="sidebar-logo" />
        <span className="brand-tag">fleet control</span>
      </Link>

      <div className={`fleet-chip ${offline > 0 ? 'degraded' : ''}`}>
        <i />
        {fleet ? `${fleet.boxes.online}/${fleet.boxes.total} boxes online` : 'Connecting…'}
      </div>

      <nav>
        {LINKS.map(([href, icon, label]) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link key={href} href={href} className={active ? 'active' : ''}>
              <span>{icon}</span>
              {label}
              {href === '/fleet' && fleet && <b>{fleet.boxes.total}</b>}
              {href === '/campaigns' && fleet && <b>{fleet.campaigns.active}</b>}
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-foot">
        Boxes pull their own schedules.
        <br />
        Evening window 23:00, morning catch-up until 07:00.
      </div>
    </aside>
  );
}
