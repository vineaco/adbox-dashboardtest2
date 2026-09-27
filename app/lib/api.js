'use client';

/** Thin fetch wrapper around the server-side proxy in app/api/[...path]. */
async function call(path, { method = 'GET', body, raw } = {}) {
  const response = await fetch(`/api/${path}`, {
    method,
    ...(raw ? { body: raw } : body ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {}),
    cache: 'no-store'
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || `Request failed (${response.status}).`);
  return payload;
}

export const api = {
  overview: () => call('telemetry/overview'),
  locations: () => call('telemetry/locations'),
  playback: (query = '') => call(`telemetry/playback${query}`),
  errors: (query = '') => call(`telemetry/errors${query}`),
  deliveries: (query = '') => call(`telemetry/deliveries${query}`),

  boxes: (query = '') => call(`boxes${query}`),
  box: (id) => call(`boxes/${id}`),
  updateBox: (id, body) => call(`boxes/${id}`, { method: 'PATCH', body }),
  rotateBoxKey: (id) => call(`boxes/${id}/rotate-key`, { method: 'POST' }),
  schedulePreview: (id, query = '') => call(`boxes/${id}/schedule-preview${query}`),
  deleteBox: (id) => call(`boxes/${id}`, { method: 'DELETE' }),

  provisioningCodes: () => call('provisioning-codes'),
  createProvisioningCode: (body) => call('provisioning-codes', { method: 'POST', body }),
  deleteProvisioningCode: (id) => call(`provisioning-codes/${id}`, { method: 'DELETE' }),

  media: () => call('media'),
  uploadMedia: (formData) => call('media', { method: 'POST', raw: formData }),
  updateMedia: (id, body) => call(`media/${id}`, { method: 'PATCH', body }),
  deleteMedia: (id) => call(`media/${id}`, { method: 'DELETE' }),

  campaigns: (query = '') => call(`campaigns${query}`),
  campaign: (id) => call(`campaigns/${id}`),
  campaignMetrics: (id, query = '') => call(`campaigns/${id}/metrics${query}`),
  createCampaign: (body) => call('campaigns', { method: 'POST', body }),
  updateCampaign: (id, body) => call(`campaigns/${id}`, { method: 'PATCH', body }),
  triggerCampaignSync: (id) => call(`campaigns/${id}/sync`, { method: 'POST' }),
  deleteCampaign: (id) => call(`campaigns/${id}`, { method: 'DELETE' }),

  boundaries: () => call('boundaries'),
  createBoundary: (body) => call('boundaries', { method: 'POST', body }),
  updateBoundary: (id, body) => call(`boundaries/${id}`, { method: 'PATCH', body }),
  deleteBoundary: (id) => call(`boundaries/${id}`, { method: 'DELETE' })
};

export const todayIso = () => new Date().toISOString().slice(0, 10);

export function addDays(serviceDate, days) {
  const base = new Date(`${serviceDate}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

export function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function formatRelative(value) {
  if (!value) return 'never';
  const seconds = Math.round((Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.round(seconds / 3600)}h ago`;
  return `${Math.round(seconds / 86_400)}d ago`;
}

export function formatDuration(ms) {
  const seconds = Math.round((ms || 0) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export function formatBytes(bytes) {
  if (!bytes) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value < 10 && unit > 0 ? 1 : 0)} ${units[unit]}`;
}
