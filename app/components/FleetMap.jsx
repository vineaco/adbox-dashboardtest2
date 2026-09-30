'use client';

import { useEffect, useMemo, useRef } from 'react';

/** Inline SVG mirroring AdboxLogoMark, tinted per box status, for use as a Leaflet divIcon. */
function boxMarkerHtml(online) {
  const stroke = online ? '#00bdd6' : '#d17b58';
  const bars = online ? ['#106f7b', '#008d9f', '#00bdd6', '#90f2ff'] : ['#7a4530', '#a2513a', '#c96b4a', '#f2b191'];
  return `
    <svg viewBox="0 0 100 100" width="22" height="22" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="2" width="96" height="96" rx="24" fill="#0f171d" stroke="${stroke}" stroke-width="8" />
      <rect x="22" y="27" width="10" height="46" rx="5" fill="${bars[0]}" />
      <rect x="37" y="27" width="10" height="46" rx="5" fill="${bars[1]}" />
      <rect x="52" y="27" width="10" height="46" rx="5" fill="${bars[2]}" />
      <rect x="67" y="27" width="10" height="46" rx="5" fill="${bars[3]}" />
    </svg>
  `;
}

/**
 * Leaflet is loaded lazily and imperatively: react-leaflet's context does not
 * survive Next's streaming boundaries well, and this map is read-mostly.
 */
export default function FleetMap({ locations = [], boundaries = [], height, onSelect, legend = true }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);

  const points = useMemo(
    () => locations.filter((entry) => Number.isFinite(entry.lastLat) && Number.isFinite(entry.lastLng)),
    [locations]
  );

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !containerRef.current) return;

      if (!mapRef.current) {
        mapRef.current = L.map(containerRef.current, { scrollWheelZoom: false }).setView([6.5244, 3.3792], 10);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 19
        }).addTo(mapRef.current);
        layerRef.current = L.layerGroup().addTo(mapRef.current);
      }

      layerRef.current.clearLayers();

      for (const boundary of boundaries) {
        if (boundary.type === 'circle' && boundary.points?.[0]) {
          L.circle(boundary.points[0], {
            radius: boundary.radius || 0,
            color: '#008d9f',
            weight: 2,
            fillOpacity: 0.08
          })
            .bindTooltip(boundary.name)
            .addTo(layerRef.current);
        } else if (boundary.points?.length >= 3) {
          L.polygon(boundary.points, { color: '#008d9f', weight: 2, fillOpacity: 0.08 })
            .bindTooltip(boundary.name)
            .addTo(layerRef.current);
        }
      }

      for (const entry of points) {
        const online = entry.lastSeenAt && Date.now() - new Date(entry.lastSeenAt).getTime() < 600_000;
        const icon = L.divIcon({
          html: boxMarkerHtml(online),
          className: 'box-marker-icon',
          iconSize: [22, 22],
          iconAnchor: [11, 11],
          tooltipAnchor: [0, -11]
        });
        const marker = L.marker([entry.lastLat, entry.lastLng], { icon })
          .bindTooltip(`<strong>${entry.name}</strong><br/>${entry.serialNumber}`, { direction: 'top' })
          .addTo(layerRef.current);
        if (onSelect) marker.on('click', () => onSelect(entry));
      }

      const bounds = [
        ...points.map((entry) => [entry.lastLat, entry.lastLng]),
        ...boundaries.flatMap((boundary) => boundary.points || [])
      ];
      if (bounds.length) mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
      setTimeout(() => mapRef.current?.invalidateSize(), 120);
    })();

    return () => {
      cancelled = true;
    };
  }, [points, boundaries, onSelect]);

  useEffect(
    () => () => {
      mapRef.current?.remove();
      mapRef.current = null;
    },
    []
  );

  return (
    <div className="map-wrap">
      <div ref={containerRef} className="map" style={height ? { height } : undefined} />
      {legend && (
        <div className="map-legend">
          <div className="map-legend-item">
            <span dangerouslySetInnerHTML={{ __html: boxMarkerHtml(true) }} />
            Online
          </div>
          <div className="map-legend-item">
            <span dangerouslySetInnerHTML={{ __html: boxMarkerHtml(false) }} />
            Offline
          </div>
        </div>
      )}
    </div>
  );
}

