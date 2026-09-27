'use client';

import { AdboxLogoMark } from './AdboxLogo';

export function SkeletonLine({ width = '100%', height = 12, className = '', style = {} }) {
  return (
    <div
      className={`skeleton-shimmer ${className}`}
      style={{ width, height, ...style }}
      aria-hidden="true"
    />
  );
}

export function CardOverlayLoader({ label = 'Loading…', markSize = 36 }) {
  return (
    <div className="card-loading-overlay">
      <AdboxLogoMark size={markSize} animated />
      {label && <span>{label}</span>}
    </div>
  );
}

export function SkeletonWatermark({ label = 'Loading…', className = '' }) {
  return (
    <div className={`skeleton-watermark ${className}`}>
      <AdboxLogoMark size={20} animated />
      <span>{label}</span>
    </div>
  );
}

export function SkeletonStats({ count = 4 }) {
  return (
    <div className={`grid ${count === 2 ? 'two' : count === 3 ? 'three' : 'four'}`}>
      {Array.from({ length: count }).map((_, i) => (
        <article key={i} className="skeleton-stat">
          <div className="skeleton-stat-top">
            <SkeletonLine width="45%" height={10} />
            <AdboxLogoMark size={14} animated className="stat-skeleton-mark" />
          </div>
          <SkeletonLine width="65%" height={26} style={{ borderRadius: 6 }} />
          <SkeletonLine width="80%" height={9} style={{ opacity: 0.7 }} />
        </article>
      ))}
    </div>
  );
}

export function SkeletonToolbar() {
  return (
    <div className="toolbar" style={{ marginBottom: 16 }}>
      <div className="toolbar-group">
        <SkeletonLine width={260} height={34} style={{ borderRadius: 5 }} />
        <SkeletonLine width={140} height={34} style={{ borderRadius: 5 }} />
      </div>
      <SkeletonLine width={100} height={14} />
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 6, showOverlay = false, overlayLabel = '' }) {
  return (
    <div className="skeleton-table-container" style={{ position: 'relative' }}>
      <div className="table-wrap">
        <div style={{ padding: '6px 10px 12px', display: 'flex', justifyContent: 'space-between' }}>
          <SkeletonLine width={90} height={10} />
          <SkeletonLine width={70} height={10} />
          <SkeletonLine width={80} height={10} />
          <SkeletonLine width={100} height={10} />
          <SkeletonLine width={60} height={10} />
        </div>
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="skeleton-table-row">
            <div style={{ flex: 2, display: 'grid', gap: 6 }}>
              <SkeletonLine width="75%" height={13} />
              <SkeletonLine width="45%" height={9} style={{ opacity: 0.6 }} />
            </div>
            <div style={{ flex: 1 }}>
              <SkeletonLine width={60} height={20} style={{ borderRadius: 999 }} />
            </div>
            <div style={{ flex: 1.5, display: 'grid', gap: 4 }}>
              <SkeletonLine width="70%" height={11} />
              <SkeletonLine width="40%" height={8} style={{ opacity: 0.6 }} />
            </div>
            <div style={{ flex: 1.5 }}>
              <SkeletonLine width="80%" height={11} />
            </div>
            <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
              <SkeletonLine width={54} height={26} style={{ borderRadius: 5 }} />
              <SkeletonLine width={54} height={26} style={{ borderRadius: 5 }} />
            </div>
          </div>
        ))}
      </div>
      {showOverlay && <CardOverlayLoader label={overlayLabel} />}
    </div>
  );
}

export function SkeletonOverview() {
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
          <SkeletonWatermark label="Refreshing fleet…" />
        </div>
      </header>

      <SkeletonStats count={4} />

      <section className="panel" style={{ marginTop: 18, position: 'relative' }}>
        <div className="panel-head">
          <div>
            <p className="eyebrow">Live positions</p>
            <h2>Where the fleet is right now</h2>
            <p>Markers use each box's most recent GPS fix. Shaded areas are campaign boundaries.</p>
          </div>
        </div>
        <div className="skeleton-map-container" style={{ position: 'relative' }}>
          <div className="skeleton-shimmer" style={{ height: 440, borderRadius: 7 }} />
          <CardOverlayLoader label="Tracking live fleet positions…" markSize={42} />
        </div>
      </section>

      <section className="panel" style={{ marginTop: 18, position: 'relative' }}>
        <div className="panel-head">
          <div>
            <p className="eyebrow">Handovers</p>
            <h2>Recent schedule deliveries</h2>
            <p>Each row is a box asking for a day's playlist and being told exactly what to play.</p>
          </div>
        </div>
        <SkeletonTable rows={5} showOverlay overlayLabel="Loading deliveries…" />
      </section>
    </>
  );
}

export function SkeletonFleet() {
  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">Devices</p>
          <h1>Fleet</h1>
          <p>
            Every Raspberry Pi that has claimed a REGISTERED_BOX_NUMBER. The TB20 sending card behind each box is
            treated as a dumb pipe to the LED screen — all scheduling lives here.
          </p>
        </div>
        <div className="head-actions">
          <SkeletonWatermark label="Loading fleet…" />
        </div>
      </header>

      <section className="panel" style={{ position: 'relative' }}>
        <SkeletonToolbar />
        <SkeletonTable rows={6} showOverlay overlayLabel="Loading box network…" />
      </section>
    </>
  );
}

export function SkeletonCampaigns() {
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
          <SkeletonWatermark label="Loading campaigns…" />
        </div>
      </header>

      <section className="panel" style={{ position: 'relative' }}>
        <SkeletonToolbar />
        <SkeletonTable rows={5} showOverlay overlayLabel="Loading campaign playlists…" />
      </section>
    </>
  );
}

export function SkeletonMedia() {
  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">Library</p>
          <h1>Media</h1>
          <p>
            Images and videos the boxes download and cache locally. Each file is hashed, so a Pi only ever fetches it
            once and keeps playing it when the network drops.
          </p>
        </div>
        <div className="head-actions">
          <SkeletonWatermark label="Loading media…" />
        </div>
      </header>

      <section className="panel" style={{ position: 'relative' }}>
        <SkeletonToolbar />
        <div className="media-grid">
          {Array.from({ length: 8 }).map((_, i) => (
            <article key={i} className="skeleton-media-card">
              <div className="skeleton-shimmer" style={{ aspectRatio: '16 / 10' }} />
              <div style={{ padding: '10px 11px', display: 'grid', gap: 6 }}>
                <SkeletonLine width="75%" height={12} />
                <SkeletonLine width="45%" height={9} style={{ opacity: 0.6 }} />
              </div>
            </article>
          ))}
        </div>
        <CardOverlayLoader label="Loading media assets…" markSize={36} />
      </section>
    </>
  );
}

export function SkeletonBoundaries() {
  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">Geo targeting</p>
          <h1>Boundaries</h1>
          <p>
            Draw the areas a campaign should run in. When a box syncs, the server tests its GPS fix against every
            boundary and returns only the campaigns whose areas contain it.
          </p>
        </div>
        <div className="head-actions">
          <SkeletonWatermark label="Loading boundaries…" />
        </div>
      </header>

      <div className="grid two">
        <section className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Draw</p>
              <h2>New boundary</h2>
              <p>Click the map to drop polygon points, or switch to a radius around a single point.</p>
            </div>
            <AdboxLogoMark size={20} animated />
          </div>
          <div className="skeleton-map-container" style={{ position: 'relative' }}>
            <div className="skeleton-shimmer" style={{ height: 380, borderRadius: 7 }} />
            <CardOverlayLoader label="Preparing map editor…" markSize={36} />
          </div>
        </section>

        <section className="panel" style={{ position: 'relative' }}>
          <div className="panel-head">
            <div>
              <p className="eyebrow">Saved</p>
              <h2>Saved boundaries</h2>
              <p>Targeted zones with their geographic classifications.</p>
            </div>
          </div>
          <SkeletonTable rows={5} showOverlay overlayLabel="Loading saved boundaries…" />
        </section>
      </div>
    </>
  );
}

export function SkeletonCalendar() {
  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">Planning</p>
          <h1>Calendar</h1>
          <p>
            What is booked to run on each day. Boxes pull these windows when they sync, so a day shows the plan; the
            delivery list inside a day shows which boxes actually collected it.
          </p>
        </div>
        <div className="head-actions">
          <SkeletonWatermark label="Loading calendar…" />
        </div>
      </header>

      <section className="panel" style={{ position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <SkeletonLine width={200} height={24} style={{ borderRadius: 6 }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 5 }}>
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="skeleton-shimmer" style={{ height: 96, borderRadius: 5 }} />
          ))}
        </div>
        <CardOverlayLoader label="Loading calendar dayparts…" markSize={40} />
      </section>
    </>
  );
}

export function SkeletonTelemetry() {
  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">Reporting</p>
          <h1>Telemetry</h1>
          <p>
            Proof of play, schedule handovers and faults reported by the fleet. Boxes buffer everything locally when
            offline and replay it once a connection returns, so gaps fill themselves in.
          </p>
        </div>
        <div className="head-actions">
          <SkeletonWatermark label="Loading telemetry…" />
        </div>
      </header>

      <SkeletonStats count={4} />

      <div className="tabs" style={{ marginTop: 18 }}>
        <button className="on">Playback</button>
        <button disabled>Schedule deliveries</button>
        <button disabled>Errors</button>
      </div>

      <section className="panel" style={{ position: 'relative' }}>
        <SkeletonTable rows={7} />
        <CardOverlayLoader label="Loading telemetry events…" markSize={36} />
      </section>
    </>
  );
}

export function SkeletonFleetDetail() {
  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">← Fleet</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <SkeletonLine width={180} height={32} style={{ borderRadius: 6 }} />
            <AdboxLogoMark size={20} animated />
          </div>
          <SkeletonLine width={120} height={12} style={{ marginTop: 6 }} />
        </div>
        <div className="head-actions">
          <SkeletonWatermark label="Connecting to box…" />
        </div>
      </header>

      <SkeletonStats count={4} />

      <div className="grid two" style={{ marginTop: 18 }}>
        <section className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Position</p>
              <h2>Last known location</h2>
            </div>
          </div>
          <div className="skeleton-map-container" style={{ position: 'relative' }}>
            <div className="skeleton-shimmer" style={{ height: 240, borderRadius: 7 }} />
            <CardOverlayLoader label="Locating box on map…" markSize={32} />
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Details</p>
              <h2>Hardware & Diagnostics</h2>
            </div>
          </div>
          <div style={{ display: 'grid', gap: 12, padding: '8px 0' }}>
            <SkeletonLine width="90%" height={14} />
            <SkeletonLine width="70%" height={14} />
            <SkeletonLine width="80%" height={14} />
            <SkeletonLine width="60%" height={14} />
          </div>
        </section>
      </div>
    </>
  );
}

export function SkeletonCampaignMetrics() {
  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">← Campaigns</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <SkeletonLine width={220} height={32} style={{ borderRadius: 6 }} />
            <AdboxLogoMark size={20} animated />
          </div>
          <p>Every play this campaign has had, with the box, timing and GPS fix at that moment.</p>
        </div>
        <div className="head-actions">
          <SkeletonWatermark label="Analyzing metrics…" />
        </div>
      </header>

      <section className="panel filters" style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end' }}>
          <SkeletonLine width={140} height={36} style={{ borderRadius: 5 }} />
          <SkeletonLine width={140} height={36} style={{ borderRadius: 5 }} />
        </div>
      </section>

      <SkeletonStats count={4} />

      <section className="panel" style={{ marginTop: 18, position: 'relative' }}>
        <div className="panel-head">
          <div>
            <p className="eyebrow">Proof of play</p>
            <h2>Every play in range</h2>
          </div>
        </div>
        <SkeletonTable rows={8} />
        <CardOverlayLoader label="Aggregating proof of play…" markSize={36} />
      </section>
    </>
  );
}

export function SkeletonCampaignWizard() {
  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">← Campaigns</p>
          <h1>Campaign publisher</h1>
          <p>Build the playlist, pick the audience, then check how often each ad will actually play.</p>
        </div>
        <div className="head-actions">
          <SkeletonWatermark label="Loading publisher…" />
        </div>
      </header>

      <section className="wizard" style={{ position: 'relative' }}>
        <div className="wizard-progress">
          {['Campaign', 'Ads & audience', 'Schedule', 'Review'].map((label, i) => (
            <button key={i} className={i === 0 ? 'active' : ''} disabled>
              <i>{i + 1}</i>
              <span>{label}</span>
            </button>
          ))}
        </div>
        <div className="wizard-body">
          <div style={{ display: 'grid', gap: 16, maxWidth: 620 }}>
            <SkeletonLine width="30%" height={10} />
            <SkeletonLine width="60%" height={24} style={{ borderRadius: 5 }} />
            <SkeletonLine width="100%" height={12} />
            <SkeletonLine width="100%" height={40} style={{ borderRadius: 5, marginTop: 12 }} />
            <SkeletonLine width="100%" height={80} style={{ borderRadius: 5 }} />
          </div>
        </div>
        <CardOverlayLoader label="Loading audience & playlist…" markSize={36} />
      </section>
    </>
  );
}
