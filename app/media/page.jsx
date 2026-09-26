'use client';

import { useRef, useState } from 'react';
import { api, formatBytes, formatDateTime } from '../lib/api';
import { Badge, Empty, ErrorState, Loading, Panel, useResource, useToast } from '../components/ui';

export default function MediaPage() {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [toastNode, notify] = useToast();
  const { loading, data, error, reload } = useResource(() => api.media());

  async function upload(files) {
    if (!files?.length) return;
    setUploading(true);
    let added = 0;
    for (const file of files) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('name', file.name);
        const result = await api.uploadMedia(formData);
        added += result.deduplicated ? 0 : 1;
        if (result.deduplicated) notify(`${file.name} is already in the library.`);
      } catch (uploadError) {
        notify(`${file.name}: ${uploadError.message}`, true);
      }
    }
    setUploading(false);
    if (inputRef.current) inputRef.current.value = '';
    if (added) notify(`${added} file(s) uploaded.`);
    reload();
  }

  async function remove(item) {
    if (!window.confirm(`Delete “${item.name}”? This cannot be undone.`)) return;
    try {
      await api.deleteMedia(item.id);
      notify('Media deleted.');
      reload();
    } catch (deleteError) {
      notify(deleteError.message, true);
    }
  }

  async function setDuration(item, seconds) {
    const value = Number(seconds);
    if (!Number.isFinite(value) || value === item.durationSeconds) return;
    try {
      await api.updateMedia(item.id, { durationSeconds: value });
      notify('Default duration updated.');
      reload();
    } catch (updateError) {
      notify(updateError.message, true);
    }
  }

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
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
            style={{ display: 'none' }}
            onChange={(event) => upload([...event.target.files])}
          />
          <button className="btn primary" disabled={uploading} onClick={() => inputRef.current?.click()}>
            {uploading ? 'Uploading…' : 'Upload media'}
          </button>
          <button className="btn" onClick={reload}>
            Refresh
          </button>
        </div>
      </header>

      <Panel>
        {loading && <Loading label="Loading media…" />}
        {error && <ErrorState error={error} onRetry={reload} />}
        {data &&
          (data.media.length ? (
            <div className="media-grid">
              {data.media.map((item) => (
                <article key={item.id} className="media-card">
                  {item.type === 'video' ? (
                    <video src={item.url} muted preload="metadata" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.url} alt={item.name} loading="lazy" />
                  )}
                  <div className="meta">
                    <strong title={item.name}>{item.name}</strong>
                    <small>
                      {formatBytes(item.bytes)} · {item.width && item.height ? `${item.width}×${item.height}` : item.mimeType}
                    </small>
                    <small>{formatDateTime(item.createdAt)}</small>
                  </div>
                  <div className="row">
                    <Badge state="ok">{item.type}</Badge>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#929890', fontSize: 10 }}>
                      <input
                        type="number"
                        min="1"
                        max="3600"
                        defaultValue={item.durationSeconds}
                        onBlur={(event) => setDuration(item, event.target.value)}
                        style={{ width: 54, padding: '4px 6px', border: '1px solid #d8dcd2', borderRadius: 4, fontSize: 11 }}
                      />
                      s
                    </label>
                    <button className="btn tiny danger" onClick={() => remove(item)}>
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <Empty icon="▤" title="The library is empty">
              Upload an image or video, then build a campaign that targets a boundary or the whole fleet.
            </Empty>
          ))}
      </Panel>

      {toastNode}
    </>
  );
}
