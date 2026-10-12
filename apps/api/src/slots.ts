export type Interval = { start: number; end: number };

export type SlotVerdict = "ok" | "too_soon" | "too_far" | "outside" | "taken";

export function mergeIntervals(items: Interval[]) {
  const sorted = items
    .filter((item) => item.end > item.start)
    .sort((left, right) => left.start - right.start || left.end - right.end);
  const merged: Interval[] = [];
  for (const item of sorted) {
    const last = merged[merged.length - 1];
    if (!last || item.start > last.end) merged.push({ start: item.start, end: item.end });
    else last.end = Math.max(last.end, item.end);
  }
  return merged;
}

export function subtractIntervals(windows: Interval[], blocks: Interval[]) {
  const cuts = mergeIntervals(blocks);
  const open: Interval[] = [];
  for (const window of windows) {
    let cursor = window.start;
    for (const cut of cuts) {
      if (cut.end <= cursor) continue;
      if (cut.start >= window.end) break;
      if (cut.start > cursor) open.push({ start: cursor, end: Math.min(cut.start, window.end) });
      cursor = Math.max(cursor, cut.end);
      if (cursor >= window.end) break;
    }
    if (cursor < window.end) open.push({ start: cursor, end: window.end });
  }
  return open.filter((item) => item.end > item.start);
}

export function slotStarts(input: {
  windows: Interval[];
  blocks: Interval[];
  durationMin: number;
  stepMin: number;
  earliestMin: number;
}) {
  if (input.durationMin <= 0 || input.stepMin <= 0) return [];
  const free = subtractIntervals(input.windows, input.blocks);
  const starts: number[] = [];
  for (const window of free) {
    let start = Math.ceil(Math.max(window.start, input.earliestMin) / input.stepMin) * input.stepMin;
    for (; start + input.durationMin <= window.end; start += input.stepMin) {
      starts.push(start);
    }
  }
  return starts;
}

function fitsOpenWindow(startMin: number, durationMin: number, windows: Interval[], blocks: Interval[]) {
  const end = startMin + durationMin;
  return subtractIntervals(windows, blocks).some((window) => startMin >= window.start && end <= window.end);
}

export function classifySlot(input: {
  startMin: number;
  durationMin: number;
  stepMin: number;
  work: Interval[];
  blocks: Interval[];
  bookings: Interval[];
  earliestMin: number;
  dayTooSoon: boolean;
  dayTooFar: boolean;
}): SlotVerdict {
  const onGrid = input.startMin % input.stepMin === 0;
  const fits =
    onGrid &&
    input.startMin >= 0 &&
    fitsOpenWindow(input.startMin, input.durationMin, input.work, input.blocks);
  if (input.dayTooFar) return fits ? "too_far" : "outside";
  if (input.dayTooSoon || input.startMin < input.earliestMin) return fits ? "too_soon" : "outside";
  if (!fits) return "outside";
  const end = input.startMin + input.durationMin;
  const taken = input.bookings.some((booking) => input.startMin < booking.end && end > booking.start);
  return taken ? "taken" : "ok";
}
