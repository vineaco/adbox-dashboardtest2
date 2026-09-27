'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { api, addDays, formatBytes, todayIso } from '../lib/api';
import { Badge, Empty, Panel, useToast } from './ui';
import BoundaryPickerModal from './BoundaryPickerModal';
import BoxPickerModal from './BoxPickerModal';
import { EditIcon } from './Icon';
import {
  DAY_NAMES,
  estimateCampaign,
  findConflicts,
  formatAirtime,
  formatClock,
  percentOfDay,
  rotationPreview,
  toMinutes,
  weekdayOf
} from '../lib/airtime';

const STEPS = ['Campaign', 'Ads & audience', 'Schedule', 'Review'];

const SLOT_PRESETS = [
  { value: 10, label: '10 seconds' },
  { value: 15, label: '15 seconds' },
  { value: 30, label: '30 seconds' },
  { value: 60, label: '1 minute' },
  { value: 300, label: '5 minutes' },
  { value: 900, label: '15 minutes' }
];

const WINDOW_PRESETS = [
  { value: 'all-day', label: 'All day', start: '00:00', end: '23:59' },
  { value: 'morning', label: 'Morning drive 06:00–10:00', start: '06:00', end: '10:00' },
  { value: 'midday', label: 'Midday 11:00–15:00', start: '11:00', end: '15:00' },
  { value: 'evening', label: 'Evening drive 16:00–20:00', start: '16:00', end: '20:00' }
];

const newSlot = () => ({ startTime: '09:00', endTime: '18:00', daysOfWeek: [1, 2, 3, 4, 5] });

export function emptyDraft() {
  return {
    name: '',
    description: '',
    status: 'active',
    priority: 100,
    slotSeconds: 30,
    startDate: todayIso(),
    endDate: addDays(todayIso(), 30),
    targetType: 'boundary',
    boundaryIds: [],
    boxIds: [],
    items: [],
    slots: [newSlot()]
  };
}

export default function CampaignWizard({ initial, campaignId, media, boundaries, boxes, campaigns }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState(initial);
  const [previewDate, setPreviewDate] = useState(initial.startDate);
  const [busy, setBusy] = useState(false);
  const [toastNode, notify] = useToast();
  const [showBoundaryModal, setShowBoundaryModal] = useState(false);
  const [showBoxModal, setShowBoxModal] = useState(false);

  const set = (key, value) => setDraft((current) => ({ ...current, [key]: value }));

  const selectedMedia = useMemo(
    () => draft.items.map((item) => media.find((entry) => entry.id === item.mediaId)).filter(Boolean),
    [draft.items, media]
  );

  // Ads carry their own screen time; the campaign slot length is the default.
  const draftAds = draft.items.map((item) => {
    const asset = media.find((entry) => entry.id === item.mediaId);
    return {
      mediaId: item.mediaId,
      name: asset?.name || 'Ad',
      durationSeconds: item.durationSeconds || draft.slotSeconds
    };
  });

  const estimate = useMemo(
    () => estimateCampaign({ draft: { ...draft, id: campaignId, items: draftAds }, campaigns, serviceDate: previewDate }),
    [draft, draftAds, campaigns, previewDate, campaignId]
  );
  const conflicts = useMemo(
    () => findConflicts({ ...draft, id: campaignId }, campaigns),
    [draft, campaigns, campaignId]
  );

  const previewWeekday = weekdayOf(previewDate);
  const activeSlot = draft.slots.find((slot) => slot.daysOfWeek.includes(previewWeekday)) || draft.slots[0];
  const competingForSlot = estimate.slots[0]?.competing || [];
  const segments = activeSlot
    ? rotationPreview({
        draftSlot: activeSlot,
        draftAds,
        draftSlotSeconds: draft.slotSeconds,
        competing: competingForSlot
      })
    : [];

  const targetReady =
    draft.targetType === 'all' ||
    (draft.targetType === 'boundary' && draft.boundaryIds.length > 0) ||
    (draft.targetType === 'box' && draft.boxIds.length > 0);

  const ready = [
    Boolean(draft.name.trim()),
    draft.items.length > 0 && targetReady,
    draft.startDate <= draft.endDate &&
      draft.slots.length > 0 &&
      draft.slots.every((slot) => slot.daysOfWeek.length > 0 && toMinutes(slot.startTime) < toMinutes(slot.endTime)),
    true
  ];
  const reachable = ready.map((_, index) => ready.slice(0, index).every(Boolean));

  function toggleItem(asset) {
    const exists = draft.items.some((item) => item.mediaId === asset.id);
    set(
      'items',
      exists
        ? draft.items.filter((item) => item.mediaId !== asset.id)
        : [...draft.items, { mediaId: asset.id, durationSeconds: asset.durationSeconds || draft.slotSeconds }]
    );
  }

  function updateSlot(index, patch) {
    set('slots', draft.slots.map((slot, position) => (position === index ? { ...slot, ...patch } : slot)));
  }

  async function save() {
    setBusy(true);
    try {
      const payload = {
        name: draft.name.trim(),
        description: draft.description || null,
        status: draft.status,
        priority: Number(draft.priority),
        slotSeconds: Number(draft.slotSeconds),
        startDate: draft.startDate,
        endDate: draft.endDate,
        targetType: draft.targetType,
        boundaryIds: draft.targetType === 'boundary' ? draft.boundaryIds : [],
        boxIds: draft.targetType === 'box' ? draft.boxIds : [],
        slots: draft.slots,
        items: draft.items
      };
      if (campaignId) await api.updateCampaign(campaignId, payload);
      else await api.createCampaign(payload);
      router.push('/campaigns');
      router.refresh();
    } catch (error) {
      notify(error.message, true);
      setBusy(false);
    }
  }

  return (
    <section className="wizard">
      <div className="wizard-progress">
        {STEPS.map((label, index) => (
          <button
            key={label}
            className={`${index === step ? 'active' : index < step ? 'complete' : ''} ${index > step && !reachable[index] ? 'locked' : ''}`}
            disabled={index > step && !reachable[index]}
            onClick={() => setStep(index)}
          >
            <i>{index + 1}</i>
            <span>{label}</span>
          </button>
        ))}
      </div>

      <div className="wizard-body">
        {step === 0 && (
          <div className="wizard-step">
            <p className="eyebrow">Step 1 of 4</p>
            <h2>Name this campaign</h2>
            <p className="wizard-hint">Operators will see this in the calendar, the fleet timeline and every delivery record.</p>
            <label className="field" style={{ marginTop: 22, maxWidth: 620 }}>
              Campaign name
              <input
                autoFocus
                maxLength={160}
                value={draft.name}
                placeholder="e.g. Ikeja morning drive"
                onChange={(event) => set('name', event.target.value)}
              />
            </label>
            <label className="field" style={{ marginTop: 14, maxWidth: 620 }}>
              Description
              <textarea value={draft.description || ''} onChange={(event) => set('description', event.target.value)} />
            </label>
          </div>
        )}

        {step === 1 && (
          <div className="wizard-step">
            <p className="eyebrow">Step 2 of 4</p>
            <h2>Choose audience and ads</h2>
            <p className="wizard-hint">
              Boxes decide what to show based on their own GPS fix, so a boundary target reaches whichever box is inside
              it at the time.
            </p>

            <div style={{ marginTop: 22 }}>
              <span className="eyebrow" style={{ display: 'block', marginBottom: 6 }}>Target distribution</span>
              <div className="target-cards">
                <div
                  className={`target-card ${draft.targetType === 'boundary' ? 'selected' : ''}`}
                  onClick={() => {
                    set('targetType', 'boundary');
                    if (!draft.boundaryIds.length) setShowBoundaryModal(true);
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <span className="target-card-icon">◇</span>
                  <strong>Geographic boundary</strong>
                  <p>Target boxes inside specific geographic zones, cities or states.</p>
                </div>

                <div
                  className={`target-card ${draft.targetType === 'box' ? 'selected' : ''}`}
                  onClick={() => {
                    set('targetType', 'box');
                    if (!draft.boxIds.length) setShowBoxModal(true);
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <span className="target-card-icon">◉</span>
                  <strong>Specific boxes</strong>
                  <p>Assign explicitly to handpicked boxes by serial number or name.</p>
                </div>

                <div
                  className={`target-card ${draft.targetType === 'all' ? 'selected' : ''}`}
                  onClick={() => set('targetType', 'all')}
                  role="button"
                  tabIndex={0}
                >
                  <span className="target-card-icon">▦</span>
                  <strong>Whole fleet</strong>
                  <p>Deliver to every active box regardless of location (great for brand fallbacks).</p>
                </div>
              </div>

              {draft.targetType === 'boundary' && (
                <div className="target-selected-summary">
                  <div>
                    <strong>
                      {draft.boundaryIds.length} boundary zone(s) selected
                    </strong>
                    <div style={{ marginTop: 4, fontSize: 11, color: '#7f92a6' }}>
                      {draft.boundaryIds.length ? (
                        boundaries
                          .filter((b) => draft.boundaryIds.includes(b.id))
                          .map((b) => b.name)
                          .join(', ')
                      ) : (
                        'No zones selected yet — click Select zones to choose.'
                      )}
                    </div>
                  </div>
                  <button type="button" className="btn tiny primary" onClick={() => setShowBoundaryModal(true)}>
                    <EditIcon /> {draft.boundaryIds.length ? 'Edit zones' : 'Select zones'}
                  </button>
                </div>
              )}

              {draft.targetType === 'box' && (
                <div className="target-selected-summary">
                  <div>
                    <strong>
                      {draft.boxIds.length} specific box(es) selected
                    </strong>
                    <div style={{ marginTop: 4, fontSize: 11, color: '#7f92a6' }}>
                      {draft.boxIds.length ? (
                        boxes
                          .filter((b) => draft.boxIds.includes(b.id))
                          .map((b) => b.name)
                          .join(', ')
                      ) : (
                        'No boxes selected yet — click Select boxes to choose.'
                      )}
                    </div>
                  </div>
                  <button type="button" className="btn tiny primary" onClick={() => setShowBoxModal(true)}>
                    <EditIcon /> {draft.boxIds.length ? 'Edit boxes' : 'Select boxes'}
                  </button>
                </div>
              )}
            </div>

            <div className="media-guidelines">
              <div className="media-guidelines-head">
                <span>💡 Media size guidelines & best practices</span>
              </div>
              <div className="media-guidelines-grid">
                <div className="media-guideline-item">
                  <strong>Target panel resolution</strong>
                  <span>128×128 native per module (1920×1080 HDMI framebuffer).</span>
                </div>
                <div className="media-guideline-item">
                  <strong>Recommended image format</strong>
                  <span>High-contrast PNG or WebP, 1:1 or 16:9 ratio.</span>
                </div>
                <div className="media-guideline-item">
                  <strong>Resolution limit</strong>
                  <span>Keep under 1920×1080. Camera raw photos (4000+ px) exceed hardware GPU memory.</span>
                </div>
                <div className="media-guideline-item">
                  <strong>Legibility at a distance</strong>
                  <span>Use thick lines (≥3px) and high contrast colors. Tiny fonts blur on LED panels.</span>
                </div>
              </div>
            </div>

            <div className="wizard-section-head">
              <strong>Playlist</strong>
              <span>{draft.items.length} selected</span>
            </div>
            {media.length ? (
              <div className="media-grid">
                {media.map((asset) => {
                  const chosen = draft.items.find((item) => item.mediaId === asset.id);
                  return (
                    <article key={asset.id} className={`media-card ${chosen ? 'selected' : ''}`}>
                      <button type="button" onClick={() => toggleItem(asset)}>
                        {asset.type === 'video' ? (
                          <video src={asset.url} muted preload="metadata" />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={asset.url} alt={asset.name} loading="lazy" />
                        )}
                        <div className="meta">
                          <strong title={asset.name}>{asset.name}</strong>
                          <small>{chosen ? `in playlist · ${chosen.durationSeconds}s` : formatBytes(asset.bytes)}</small>
                        </div>
                      </button>
                      {chosen && (
                        <div className="row">
                          <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: '#7f92a6' }}>
                            <input
                              type="number"
                              min="1"
                              max="3600"
                              value={chosen.durationSeconds}
                              onChange={(event) =>
                                set(
                                  'items',
                                  draft.items.map((item) =>
                                    item.mediaId === asset.id
                                      ? { ...item, durationSeconds: Number(event.target.value) || 1 }
                                      : item
                                  )
                                )
                              }
                              style={{ width: 54, padding: '4px 6px', border: '1px solid #d7e8ec', borderRadius: 4, fontSize: 11 }}
                            />
                            s on screen
                          </label>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            ) : (
              <Empty icon="▤" title="No media yet">
                Upload artwork on the Media page first.
              </Empty>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="wizard-step">
            <p className="eyebrow">Step 3 of 4</p>
            <h2>Set the running times</h2>
            <p className="wizard-hint">
              Campaigns sharing a window interleave into one rotation, so the plays-per-ad figure below accounts for
              everything else already booked.
            </p>

            <div className="form-grid" style={{ marginTop: 20 }}>
              <label className="field">
                Starts
                <input type="date" value={draft.startDate} onChange={(event) => set('startDate', event.target.value)} />
              </label>
              <label className="field">
                Ends
                <input type="date" value={draft.endDate} min={draft.startDate} onChange={(event) => set('endDate', event.target.value)} />
              </label>
              <label className="field">
                Default screen time per ad
                <select value={draft.slotSeconds} onChange={(event) => set('slotSeconds', Number(event.target.value))}>
                  {SLOT_PRESETS.map((preset) => (
                    <option key={preset.value} value={preset.value}>
                      {preset.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Priority
                <input type="number" min="0" max="1000" value={draft.priority} onChange={(event) => set('priority', event.target.value)} />
                <span className="hint">Higher plays earlier in the cycle.</span>
              </label>
            </div>

            <div className="wizard-section-head">
              <strong>Dayparts</strong>
              <button className="btn tiny" onClick={() => set('slots', [...draft.slots, newSlot()])}>
                Add daypart
              </button>
            </div>

            {draft.slots.map((slot, index) => (
              <div className="daypart" key={index}>
                <div className="daypart-times">
                  <label className="field">
                    From
                    <input type="time" value={slot.startTime} onChange={(event) => updateSlot(index, { startTime: event.target.value })} />
                  </label>
                  <label className="field">
                    Until
                    <input type="time" value={slot.endTime} onChange={(event) => updateSlot(index, { endTime: event.target.value })} />
                  </label>
                  <label className="field">
                    Preset
                    <select
                      value=""
                      onChange={(event) => {
                        const preset = WINDOW_PRESETS.find((entry) => entry.value === event.target.value);
                        if (preset) updateSlot(index, { startTime: preset.start, endTime: preset.end });
                      }}
                    >
                      <option value="">Custom…</option>
                      {WINDOW_PRESETS.map((preset) => (
                        <option key={preset.value} value={preset.value}>
                          {preset.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  {draft.slots.length > 1 && (
                    <button
                      className="btn tiny danger"
                      onClick={() => set('slots', draft.slots.filter((_, position) => position !== index))}
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div className="day-toggles">
                  {DAY_NAMES.map((label, day) => (
                    <button
                      type="button"
                      key={label}
                      className={slot.daysOfWeek.includes(day) ? 'on' : ''}
                      onClick={() =>
                        updateSlot(index, {
                          daysOfWeek: slot.daysOfWeek.includes(day)
                            ? slot.daysOfWeek.filter((entry) => entry !== day)
                            : [...slot.daysOfWeek, day].sort()
                        })
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {toMinutes(slot.startTime) >= toMinutes(slot.endTime) && (
                  <div className="notice bad">The end time must be after the start time.</div>
                )}
              </div>
            ))}

            <DayBoard
              draft={draft}
              draftAds={draftAds}
              estimate={estimate}
              conflicts={conflicts}
              segments={segments}
              previewDate={previewDate}
              onPreviewDate={setPreviewDate}
            />
          </div>
        )}

        {step === 3 && (
          <div className="wizard-step">
            <p className="eyebrow">Step 4 of 4</p>
            <h2>Review</h2>
            <p className="wizard-hint">
              Nothing is pushed to a screen. Boxes collect this during their next sync window — 23:00 for tomorrow, or up
              to 07:00 for today.
            </p>

            <div className="kv" style={{ marginTop: 22 }}>
              <div>
                <small>Campaign</small>
                <strong>{draft.name}</strong>
              </div>
              <div>
                <small>Runs</small>
                <strong>
                  {draft.startDate} → {draft.endDate}
                </strong>
              </div>
              <div>
                <small>Dayparts</small>
                <strong>
                  {draft.slots
                    .map((slot) => `${slot.startTime}–${slot.endTime} (${slot.daysOfWeek.map((day) => DAY_NAMES[day]).join(' ')})`)
                    .join(' · ')}
                </strong>
              </div>
              <div>
                <small>Target</small>
                <strong>
                  {draft.targetType === 'all' && 'Whole fleet'}
                  {draft.targetType === 'boundary' &&
                    boundaries.filter((b) => draft.boundaryIds.includes(b.id)).map((b) => b.name).join(', ')}
                  {draft.targetType === 'box' && boxes.filter((b) => draft.boxIds.includes(b.id)).map((b) => b.name).join(', ')}
                </strong>
              </div>
              <div>
                <small>Playlist</small>
                <strong>{selectedMedia.map((item) => item.name).join(', ')}</strong>
              </div>
              <div>
                <small>Estimated on {previewDate}</small>
                <strong>
                  {Math.floor(estimate.runsPerAd)} plays per ad · {formatAirtime(estimate.airtimeSeconds)} airtime
                </strong>
              </div>
            </div>

            <label className="field" style={{ marginTop: 20, maxWidth: 320 }}>
              Status on save
              <select value={draft.status} onChange={(event) => set('status', event.target.value)}>
                <option value="active">Active — boxes will collect it</option>
                <option value="draft">Draft — saved but not served</option>
                <option value="paused">Paused</option>
              </select>
            </label>

            {conflicts.length > 0 && (
              <div className="notice" style={{ marginTop: 18 }}>
                {conflicts.length} existing daypart{conflicts.length === 1 ? '' : 's'} share this window. That is allowed —
                they interleave — but each ad plays less often. See the estimate on the previous step.
              </div>
            )}
          </div>
        )}
      </div>

      <div className="wizard-actions">
        <button className="btn" disabled={step === 0} onClick={() => setStep(step - 1)}>
          ‹ Back
        </button>
        {step < 3 ? (
          <button className="btn primary" disabled={!ready[step]} onClick={() => setStep(step + 1)}>
            Continue ›
          </button>
        ) : (
          <button className="btn primary" disabled={busy || !ready.every(Boolean)} onClick={save}>
            {busy ? 'Saving…' : campaignId ? 'Save changes' : 'Create campaign'}
          </button>
        )}
      </div>

      {toastNode}

      {showBoundaryModal && (
        <BoundaryPickerModal
          boundaries={boundaries}
          selectedIds={draft.boundaryIds}
          onConfirm={(ids) => set('boundaryIds', ids)}
          onClose={() => setShowBoundaryModal(false)}
        />
      )}

      {showBoxModal && (
        <BoxPickerModal
          boxes={boxes}
          selectedIds={draft.boxIds}
          onConfirm={(ids) => set('boxIds', ids)}
          onClose={() => setShowBoxModal(false)}
        />
      )}
    </section>
  );
}

function DayBoard({ draft, draftAds, estimate, conflicts, segments, previewDate, onPreviewDate }) {
  const weekday = weekdayOf(previewDate);
  const runsOnDay = draft.slots.some((slot) => slot.daysOfWeek.includes(weekday));

  return (
    <div className="day-board">
      <div className="day-board-head">
        <div>
          <strong>Day preview</strong>
          <span>Grey is already booked, teal is this campaign.</span>
        </div>
        <label className="field">
          Preview date
          <input type="date" value={previewDate} onChange={(event) => onPreviewDate(event.target.value)} />
        </label>
        <div className="day-board-metric">
          <strong>{draftAds.length ? `${Math.floor(estimate.runsPerAd)} plays per ad` : 'Select ads'}</strong>
          <span>
            {draftAds.length
              ? `${estimate.totalRuns} total plays · ${formatAirtime(estimate.airtimeSeconds)} airtime`
              : 'Add ads to estimate airtime'}
          </span>
        </div>
      </div>

      {!runsOnDay ? (
        <div className="notice">This campaign does not run on {DAY_NAMES[weekday]}. Pick another preview date.</div>
      ) : (
        <>
          <div className="day-hours">
            {['00:00', '06:00', '12:00', '18:00', '24:00'].map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>

          <div className="day-rows">
            {estimate.competingAll.map((part) => (
              <div className="day-row" key={part.key}>
                <span>
                  {part.name}
                  <small>
                    {part.adCount} ad{part.adCount === 1 ? '' : 's'} · {formatAirtime(part.cycleSeconds)} per pass
                  </small>
                </span>
                <div className="day-track">
                  <i
                    className="booked"
                    style={{
                      left: `${percentOfDay(part.startTime)}%`,
                      width: `${Math.max(percentOfDay(part.endTime) - percentOfDay(part.startTime), 1)}%`
                    }}
                  />
                </div>
              </div>
            ))}

            {draft.slots
              .filter((slot) => slot.daysOfWeek.includes(weekday))
              .map((slot, index) => (
                <div className="day-row proposed" key={index}>
                  <span>
                    {draft.name.trim() || 'This campaign'}
                    <small>
                      {draftAds.length} ad{draftAds.length === 1 ? '' : 's'} ·{' '}
                      {formatAirtime(draftAds.reduce((total, ad) => total + ad.durationSeconds, 0))} per pass
                    </small>
                  </span>
                  <div className="day-track">
                    <i
                      className="proposed"
                      style={{
                        left: `${percentOfDay(slot.startTime)}%`,
                        width: `${Math.max(percentOfDay(slot.endTime) - percentOfDay(slot.startTime), 1)}%`
                      }}
                    />
                  </div>
                </div>
              ))}

            {!estimate.competingAll.length && (
              <div className="day-board-empty">Nothing else is booked against this audience on {previewDate}.</div>
            )}
          </div>

          {estimate.slots[0]?.ranges?.length > 1 && (
            <div className="cycle-breakdown">
              <strong>Why the estimate changes across the window</strong>
              <table className="table">
                <thead>
                  <tr>
                    <th>Range</th>
                    <th>Sharing with</th>
                    <th className="numeric">Cycle</th>
                    <th className="numeric">Plays per ad</th>
                  </tr>
                </thead>
                <tbody>
                  {estimate.slots[0].ranges.map((range) => (
                    <tr key={`${range.startTime}-${range.endTime}`}>
                      <td>
                        {range.startTime}–{range.endTime}
                      </td>
                      <td>{range.competing.length ? range.competing.join(', ') : <Badge state="ok">exclusive</Badge>}</td>
                      <td className="numeric">{formatAirtime(range.cycleSeconds)}</td>
                      <td className="numeric">{range.passes.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {segments.length > 1 && (
            <div className="rotation">
              <div className="rotation-head">
                <strong>Rotation preview</strong>
                <span>First {segments.length} plays from {formatClock(segments[0].start)}</span>
              </div>
              <div className="rotation-strip">
                {segments.map((segment, index) => (
                  <div className={`rotation-segment ${segment.state}`} key={`${segment.id}-${index}`} style={{ flex: `${segment.end - segment.start} 0 0` }}>
                    <span>{segment.name}</span>
                    <small>{segment.duration}s</small>
                  </div>
                ))}
              </div>
            </div>
          )}

          {conflicts.length > 0 && (
            <div className="notice" style={{ marginTop: 12 }}>
              Sharing this window with: {[...new Set(conflicts.map((entry) => entry.campaign.name))].join(', ')}.
            </div>
          )}
        </>
      )}
    </div>
  );
}
