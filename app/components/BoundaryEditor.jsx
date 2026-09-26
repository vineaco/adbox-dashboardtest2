'use client';

import { useEffect, useRef, useState } from 'react';

/** Imperative Leaflet drawing surface for polygon and radius boundaries. */
export default function BoundaryEditor({ existing = [], onSave }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const drawLayerRef = useRef(null);
  const existingLayerRef = useRef(null);
  const leafletRef = useRef(null);

  const [name, setName] = useState('');
  const [type, setType] = useState('polygon');
  const [radius, setRadius] = useState(2000);
  const [points, setPoints] = useState([]);
  const [busy, setBusy] = useState(false);
  const [place, setPlace] = useState('');
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState(null);

  // Keep the click handler reading fresh state without re-registering the map.
  const modeRef = useRef({ type, points });
  modeRef.current = { type, points };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !containerRef.current || mapRef.current) return;
      leafletRef.current = L;

      mapRef.current = L.map(containerRef.current).setView([6.5244, 3.3792], 11);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19
      }).addTo(mapRef.current);

      existingLayerRef.current = L.layerGroup().addTo(mapRef.current);
      drawLayerRef.current = L.layerGroup().addTo(mapRef.current);

      mapRef.current.on('click', (event) => {
        const point = [Number(event.latlng.lat.toFixed(6)), Number(event.latlng.lng.toFixed(6))];
        setPoints(modeRef.current.type === 'circle' ? [point] : [...modeRef.current.points, point]);
      });

      setTimeout(() => mapRef.current?.invalidateSize(), 120);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(
    () => () => {
      mapRef.current?.remove();
      mapRef.current = null;
    },
    []
  );

  // Existing boundaries, drawn faintly for context.
  useEffect(() => {
    const L = leafletRef.current;
    if (!L || !existingLayerRef.current) return;
    existingLayerRef.current.clearLayers();
    for (const boundary of existing) {
      const style = { color: '#9aa298', weight: 1.5, fillOpacity: 0.05, dashArray: '4 4' };
      if (boundary.type === 'circle' && boundary.points?.[0]) {
        L.circle(boundary.points[0], { ...style, radius: boundary.radius || 0 }).bindTooltip(boundary.name).addTo(existingLayerRef.current);
      } else if (boundary.points?.length >= 3) {
        L.polygon(boundary.points, style).bindTooltip(boundary.name).addTo(existingLayerRef.current);
      }
    }
  }, [existing]);

  // The shape currently being drawn.
  useEffect(() => {
    const L = leafletRef.current;
    if (!L || !drawLayerRef.current) return;
    drawLayerRef.current.clearLayers();
    const style = { color: '#008d9f', weight: 2, fillOpacity: 0.14 };

    if (type === 'circle' && points[0]) {
      L.circle(points[0], { ...style, radius: Number(radius) || 0 }).addTo(drawLayerRef.current);
    } else if (points.length >= 3) {
      L.polygon(points, style).addTo(drawLayerRef.current);
    } else if (points.length === 2) {
      L.polyline(points, style).addTo(drawLayerRef.current);
    }

    points.forEach((point, index) =>
      L.circleMarker(point, { radius: 5, color: '#00636f', fillColor: '#9fe3ee', fillOpacity: 1, weight: 2 })
        .bindTooltip(`Point ${index + 1}`)
        .addTo(drawLayerRef.current)
    );
  }, [points, type, radius]);

  async function searchPlace(event) {
    event.preventDefault();
    if (!place.trim()) return;
    setSearching(true);
    setMessage(null);
    try {
      const query = new URLSearchParams({ q: place, format: 'jsonv2', limit: '1' });
      const response = await fetch(`https://nominatim.openstreetmap.org/search?${query}`);
      const [match] = await response.json();
      if (!match) setMessage({ bad: true, text: `No match for “${place}”.` });
      else mapRef.current?.setView([Number(match.lat), Number(match.lon)], 12);
    } catch (error) {
      setMessage({ bad: true, text: `Place lookup failed: ${error.message}` });
    } finally {
      setSearching(false);
    }
  }

  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      await onSave({ name: name.trim(), type, points, radius: type === 'circle' ? Number(radius) : undefined });
      setName('');
      setPoints([]);
    } finally {
      setBusy(false);
    }
  }

  const ready = name.trim() && (type === 'circle' ? points.length === 1 && Number(radius) > 0 : points.length >= 3);

  return (
    <>
      <form onSubmit={searchPlace} style={{ display: 'flex', gap: 9, marginBottom: 12 }}>
        <input
          value={place}
          onChange={(event) => setPlace(event.target.value)}
          placeholder="Jump to a place — e.g. Ikeja, Lagos"
          style={{ flex: 1, minWidth: 0, padding: '10px 11px', border: '1px solid #d8dcd2', borderRadius: 5, fontSize: 12 }}
        />
        <button className="btn" disabled={searching}>
          {searching ? 'Searching…' : 'Go'}
        </button>
      </form>

      <div className="tabs">
        <button className={type === 'polygon' ? 'on' : ''} onClick={() => { setType('polygon'); setPoints([]); }}>
          Polygon
        </button>
        <button className={type === 'circle' ? 'on' : ''} onClick={() => { setType('circle'); setPoints(points.slice(0, 1)); }}>
          Radius
        </button>
      </div>

      <div ref={containerRef} className="map" />

      <div className="form-grid" style={{ marginTop: 14 }}>
        <label className="field" style={{ gridColumn: type === 'circle' ? 'auto' : '1 / -1' }}>
          Boundary name
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ikeja business district" />
        </label>
        {type === 'circle' && (
          <label className="field">
            Radius (metres)
            <input type="number" min="50" max="200000" value={radius} onChange={(event) => setRadius(event.target.value)} />
          </label>
        )}
      </div>

      {message && <div className={`notice ${message.bad ? 'bad' : 'good'}`} style={{ marginTop: 12 }}>{message.text}</div>}

      <div className="form-actions">
        <span style={{ marginRight: 'auto', color: '#929890', fontSize: 11 }}>
          {type === 'circle'
            ? points.length
              ? 'Centre placed. Adjust the radius, then save.'
              : 'Click the map to place the centre.'
            : `${points.length} point(s) — at least 3 required.`}
        </span>
        <button className="btn" onClick={() => setPoints([])} disabled={!points.length}>
          Clear
        </button>
        <button className="btn primary" onClick={save} disabled={!ready || busy}>
          {busy ? 'Saving…' : 'Save boundary'}
        </button>
      </div>
    </>
  );
}
