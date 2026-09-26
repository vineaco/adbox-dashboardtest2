'use client';

/**
 * Ad airtime maths.
 *
 * Campaigns whose dayparts overlap do not queue behind one another: the box
 * interleaves them into a single rotation, playing one pass of every active
 * ad before starting again. So the time an individual ad waits between plays
 * is the length of the *combined* cycle, not of its own campaign.
 *
 *   cycle  = sum of every active ad's screen time
 *   plays  = window seconds / cycle
 *
 * These are planning estimates. The device is authoritative: it rebuilds its
 * rotation every iteration from whatever it has cached.
 */

export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MINUTES_PER_DAY = 1440;

export function toMinutes(clock) {
  const [hours = 0, minutes = 0] = String(clock || '00:00').slice(0, 5).split(':').map(Number);
  return hours * 60 + minutes;
}

export function fromMinutes(minutes) {
  const total = ((Math.round(minutes) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export function percentOfDay(clock) {
  return Math.max(0, Math.min(100, (toMinutes(clock) / MINUTES_PER_DAY) * 100));
}

export function formatClock(seconds) {
  const value = Math.max(0, Math.floor(seconds));
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(Math.floor(value / 3600))}:${pad(Math.floor((value % 3600) / 60))}:${pad(value % 60)}`;
}

export function formatAirtime(seconds) {
  if (!seconds) return '0s';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${Math.round(seconds % 60)}s`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export const timesOverlap = (aStart, aEnd, bStart, bEnd) => aStart < bEnd && bStart < aEnd;
export const datesOverlap = (aStart, aEnd, bStart, bEnd) => aStart <= bEnd && bStart <= aEnd;

export function weekdayOf(serviceDate) {
  return new Date(`${serviceDate}T00:00:00Z`).getUTCDay();
}

/** Seconds of screen time one pass of a campaign's playlist takes. */
export function campaignCycleSeconds(campaign) {
  return (campaign.items || []).reduce(
    (total, item) => total + (Number(item.durationSeconds) || Number(campaign.slotSeconds) || 10),
    0
  );
}

/**
 * Flattens campaigns into the individual dayparts that run on `serviceDate`.
 * A campaign with two dayparts contributes two entries.
 */
export function daypartsOn(campaigns, serviceDate, { statuses = ['active'] } = {}) {
  const weekday = weekdayOf(serviceDate);

  return (campaigns || [])
    .filter((campaign) => statuses.includes(campaign.status))
    .filter((campaign) => campaign.startDate <= serviceDate && campaign.endDate >= serviceDate)
    .flatMap((campaign) =>
      (campaign.slots || [])
        .filter((slot) => !slot.daysOfWeek?.length || slot.daysOfWeek.includes(weekday))
        .map((slot) => ({
          key: `${campaign.id}:${slot.id}`,
          campaignId: campaign.id,
          name: campaign.name,
          priority: campaign.priority,
          status: campaign.status,
          targetType: campaign.targetType,
          boundaries: campaign.boundaries || [],
          boxes: campaign.boxes || [],
          startTime: slot.startTime,
          endTime: slot.endTime,
          items: campaign.items || [],
          adCount: (campaign.items || []).length,
          cycleSeconds: campaignCycleSeconds(campaign)
        }))
    );
}

/** True when two campaigns could ever land on the same screen. */
export function targetsIntersect(a, b) {
  if (a.targetType === 'all' || b.targetType === 'all') return true;
  if (a.targetType === 'boundary' && b.targetType === 'boundary') {
    const ids = new Set((b.boundaryIds ?? b.boundaries?.map((x) => x.id)) || []);
    return ((a.boundaryIds ?? a.boundaries?.map((x) => x.id)) || []).some((id) => ids.has(id));
  }
  if (a.targetType === 'box' && b.targetType === 'box') {
    const ids = new Set((b.boxIds ?? b.boxes?.map((x) => x.id)) || []);
    return ((a.boxIds ?? a.boxes?.map((x) => x.id)) || []).some((id) => ids.has(id));
  }
  // A boundary campaign and a box campaign may still coincide, since a box's
  // position decides at sync time. Treat as a possible overlap.
  return true;
}

/** Existing dayparts that clash with a draft: dates, weekday, clock and target. */
export function findConflicts(draft, campaigns) {
  const draftDays = new Set(draft.slots.flatMap((slot) => slot.daysOfWeek));

  return (campaigns || [])
    .filter((campaign) => campaign.id !== draft.id && campaign.status === 'active')
    .filter((campaign) => datesOverlap(draft.startDate, draft.endDate, campaign.startDate, campaign.endDate))
    .filter((campaign) => targetsIntersect(draft, campaign))
    .flatMap((campaign) =>
      (campaign.slots || [])
        .filter((slot) => slot.daysOfWeek.some((day) => draftDays.has(day)))
        .filter((slot) =>
          draft.slots.some(
            (draftSlot) =>
              draftSlot.daysOfWeek.some((day) => slot.daysOfWeek.includes(day)) &&
              timesOverlap(
                toMinutes(draftSlot.startTime),
                toMinutes(draftSlot.endTime),
                toMinutes(slot.startTime),
                toMinutes(slot.endTime)
              )
          )
        )
        .map((slot) => ({ campaign, slot }))
    );
}

/**
 * Estimates how often each draft ad plays inside one daypart.
 *
 * The window is split at every point where a competing campaign starts or
 * stops, because the cycle length changes there. Each sub-range is then
 * divided by its own cycle length and the results summed.
 */
export function estimateDaypart({ draftSlot, draftAds, draftSlotSeconds, competing }) {
  const windowStart = toMinutes(draftSlot.startTime);
  const windowEnd = toMinutes(draftSlot.endTime);
  if (windowEnd <= windowStart || !draftAds.length) {
    return { runsPerAd: 0, totalRuns: 0, ranges: [], windowMinutes: Math.max(0, windowEnd - windowStart) };
  }

  const draftCycle = draftAds.reduce(
    (total, ad) => total + (Number(ad.durationSeconds) || draftSlotSeconds || 10),
    0
  );

  const edges = [
    windowStart,
    windowEnd,
    ...competing.flatMap((entry) => [toMinutes(entry.startTime), toMinutes(entry.endTime)])
  ]
    .filter((value) => value >= windowStart && value <= windowEnd)
    .sort((a, b) => a - b);
  const boundaries = [...new Set(edges)];

  const ranges = [];
  let runsPerAd = 0;

  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const start = boundaries[index];
    const end = boundaries[index + 1];
    if (end <= start) continue;

    const active = competing.filter(
      (entry) => toMinutes(entry.startTime) < end && toMinutes(entry.endTime) > start
    );
    const competingSeconds = active.reduce((total, entry) => total + entry.cycleSeconds, 0);
    const cycleSeconds = competingSeconds + draftCycle;
    if (!cycleSeconds) continue;

    const passes = ((end - start) * 60) / cycleSeconds;
    runsPerAd += passes;
    ranges.push({
      startTime: fromMinutes(start),
      endTime: fromMinutes(end),
      minutes: end - start,
      competing: active.map((entry) => entry.name),
      cycleSeconds,
      passes
    });
  }

  return {
    runsPerAd,
    totalRuns: Math.floor(runsPerAd * draftAds.length),
    draftCycleSeconds: draftCycle,
    windowMinutes: windowEnd - windowStart,
    ranges
  };
}

/** Totals across every daypart of a draft, for the given service date. */
export function estimateCampaign({ draft, campaigns, serviceDate }) {
  const weekday = weekdayOf(serviceDate);
  const competingAll = daypartsOn(campaigns, serviceDate).filter(
    (entry) => entry.campaignId !== draft.id && targetsIntersect(draft, entry)
  );

  const slots = draft.slots
    .filter((slot) => slot.daysOfWeek.includes(weekday))
    .map((slot) => {
      const competing = competingAll.filter((entry) =>
        timesOverlap(toMinutes(slot.startTime), toMinutes(slot.endTime), toMinutes(entry.startTime), toMinutes(entry.endTime))
      );
      return {
        slot,
        competing,
        ...estimateDaypart({
          draftSlot: slot,
          draftAds: draft.items,
          draftSlotSeconds: draft.slotSeconds,
          competing
        })
      };
    });

  const runsPerAd = slots.reduce((total, entry) => total + entry.runsPerAd, 0);
  const totalRuns = slots.reduce((total, entry) => total + entry.totalRuns, 0);
  const airtimeSeconds = draft.items.reduce(
    (total, ad) => total + (Number(ad.durationSeconds) || draft.slotSeconds || 10) * runsPerAd,
    0
  );

  return { slots, competingAll, runsPerAd, totalRuns, airtimeSeconds, runsOnThisDay: slots.length > 0 };
}

/**
 * The first N plays as they would actually appear on screen, interleaving the
 * draft with whatever else is already booked in that window.
 */
export function rotationPreview({ draftSlot, draftAds, draftSlotSeconds, competing, limit = 16, fromSeconds = null }) {
  const start = fromSeconds ?? toMinutes(draftSlot.startTime) * 60;
  const end = toMinutes(draftSlot.endTime) * 60;

  const queue = [
    ...competing.flatMap((entry) =>
      (entry.items || []).map((item) => ({
        id: `booked-${entry.key}-${item.mediaId || item.id}`,
        name: item.media?.name || item.name || entry.name,
        duration: Number(item.durationSeconds) || entry.cycleSeconds / Math.max(1, entry.adCount) || 10,
        state: 'booked'
      }))
    ),
    ...draftAds.map((ad) => ({
      id: `draft-${ad.mediaId || ad.id}`,
      name: ad.name || ad.media?.name || 'New ad',
      duration: Number(ad.durationSeconds) || draftSlotSeconds || 10,
      state: 'draft'
    }))
  ];

  const segments = [];
  let cursor = start;
  while (queue.length && cursor < end && segments.length < limit) {
    const ad = queue[segments.length % queue.length];
    const stop = Math.min(cursor + ad.duration, end);
    segments.push({ ...ad, start: cursor, end: stop });
    cursor = stop;
  }
  return segments;
}
