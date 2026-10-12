import assert from "node:assert/strict";
import test from "node:test";
import { classifySlot, mergeIntervals, slotStarts, subtractIntervals } from "./slots";

const WORK = [{ start: 10 * 60, end: 21 * 60 }];
const LUNCH = [{ start: 13 * 60, end: 14 * 60 }];

test("слоты обходят обед и не вылезают за конец смены", () => {
  const starts = slotStarts({
    windows: WORK,
    blocks: LUNCH,
    durationMin: 45,
    stepMin: 15,
    earliestMin: 0,
  });
  assert.equal(starts[0], 10 * 60);
  assert.ok(starts.includes(12 * 60 + 15));
  assert.equal(starts.includes(12 * 60 + 30), false);
  assert.equal(starts.includes(13 * 60), false);
  assert.ok(starts.includes(14 * 60));
  assert.equal(starts.at(-1), 20 * 60 + 15);
});

test("существующая запись вырезает пересечения", () => {
  const starts = slotStarts({
    windows: WORK,
    blocks: [...LUNCH, { start: 10 * 60, end: 10 * 60 + 45 }],
    durationMin: 45,
    stepMin: 15,
    earliestMin: 0,
  });
  assert.equal(starts.includes(10 * 60), false);
  assert.equal(starts[0], 10 * 60 + 45);
});

test("слишком ранний старт отсекается, сетка сохраняется", () => {
  const starts = slotStarts({
    windows: WORK,
    blocks: LUNCH,
    durationMin: 30,
    stepMin: 15,
    earliestMin: 10 * 60 + 7,
  });
  assert.equal(starts[0], 10 * 60 + 15);
});

test("выходной без рабочих окон не даёт слотов", () => {
  const starts = slotStarts({
    windows: [],
    blocks: [],
    durationMin: 30,
    stepMin: 15,
    earliestMin: 0,
  });
  assert.deepEqual(starts, []);
});

test("интервалы сливаются и вычитаются по полуоткрытому краю", () => {
  assert.deepEqual(mergeIntervals([{ start: 10, end: 20 }, { start: 20, end: 30 }, { start: 40, end: 45 }]), [
    { start: 10, end: 30 },
    { start: 40, end: 45 },
  ]);
  assert.deepEqual(subtractIntervals([{ start: 0, end: 100 }], [{ start: 20, end: 40 }]), [
    { start: 0, end: 20 },
    { start: 40, end: 100 },
  ]);
});

test("вердикт отличает график, срок, горизонт и занятый слот", () => {
  const base = {
    startMin: 10 * 60,
    durationMin: 45,
    stepMin: 15,
    work: WORK,
    blocks: LUNCH,
    bookings: [] as Array<{ start: number; end: number }>,
    earliestMin: 0,
    dayTooSoon: false,
    dayTooFar: false,
  };
  assert.equal(classifySlot(base), "ok");
  assert.equal(classifySlot({ ...base, bookings: [{ start: 10 * 60, end: 11 * 60 }] }), "taken");
  assert.equal(classifySlot({ ...base, startMin: 13 * 60 }), "outside");
  assert.equal(classifySlot({ ...base, startMin: 10 * 60 + 7 }), "outside");
  assert.equal(classifySlot({ ...base, earliestMin: 11 * 60 }), "too_soon");
  assert.equal(classifySlot({ ...base, dayTooSoon: true }), "too_soon");
  assert.equal(classifySlot({ ...base, dayTooFar: true }), "too_far");
  assert.equal(classifySlot({ ...base, dayTooFar: true, startMin: 9 * 60 }), "outside");
});
