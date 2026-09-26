'use client';

import { useEffect, useMemo, useRef } from 'react';

/**
 * Leaflet is loaded lazily and imperatively: react-leaflet's context does not
 * survive Next's streaming boundaries well, and this map is read-mostly.
 */
export default function FleetMap({ locations = [], boundaries = [], height, onSelect }) {
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
        const marker = L.circleMarker([entry.lastLat, entry.lastLng], {
          radius: 8,
          color: online ? '#00636f' : '#b06045',
          fillColor: online ? '#6fcbd8' : '#e8a289',
          fillOpacity: 0.95,
          weight: 2
        })
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

  return <div ref={containerRef} className="map" style={height ? { height } : undefined} />;
}
