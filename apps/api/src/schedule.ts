import type { Break, Service, WorkingHour } from "@prisma/client";
import { prisma } from "./db";
import { HttpError } from "./http-error";
import { classifySlot, slotStarts, type Interval } from "./slots";
import { addDays, clipToLocalMinutes, clockMinutes, formatMinutes, localDayBounds, zonedDateTime, zonedParts } from "./time";

export type Rules = {
  slotStepMin: number;
  horizonDays: number;
  minNoticeMin: number;
  cancelCutoffMin: number;
  timeZone: string;
};

type ServiceRow = Pick<Service, "id" | "name" | "durationMin" | "price">;

export type ServiceLine = {
  serviceId: string;
  name: string;
  durationMin: number;
  price: number;
};

export type BarberProfile = {
  id: string;
  name: string;
  sortOrder: number;
  durationMin: number;
  price: number;
  lines: ServiceLine[];
  work: Map<number, Interval[]>;
  breaks: Map<number, Interval[]>;
};

type BlockRow = { barberId: string | null; startsAt: Date; endsAt: Date };

const DEFAULTS: Rules = {
  slotStepMin: 15,
  horizonDays: 30,
  minNoticeMin: 30,
  cancelCutoffMin: 30,
  timeZone: "Asia/Tashkent",
};

function integerSetting(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export async function loadRules(): Promise<Rules> {
  const rows = await prisma.setting.findMany();
  const map = new Map(rows.map((row) => [row.key, row.value]));
  return {
    slotStepMin: integerSetting(map.get("slot_step_min"), DEFAULTS.slotStepMin),
    horizonDays: integerSetting(map.get("booking_horizon_days"), DEFAULTS.horizonDays),
    minNoticeMin: integerSetting(map.get("min_notice_min"), DEFAULTS.minNoticeMin),
    cancelCutoffMin: integerSetting(map.get("cancel_cutoff_min"), DEFAULTS.cancelCutoffMin),
    timeZone: map.get("timezone") || DEFAULTS.timeZone,
  };
}

function intervalsByWeekday(rows: Array<WorkingHour | Break>) {
  const map = new Map<number, Interval[]>();
  for (const row of rows) {
    const list = map.get(row.weekday) ?? [];
    list.push({ start: clockMinutes(row.startTime), end: clockMinutes(row.endTime) });
    map.set(row.weekday, list);
  }
  return map;
}

export async function loadProfiles(serviceIds: string[], barberId: string) {
  if (new Set(serviceIds).size !== serviceIds.length) {
    throw new HttpError(400, "VALIDATION", "Некорректный запрос");
  }

  const services = await prisma.service.findMany({
    where: { id: { in: serviceIds }, isActive: true },
  });
  if (services.length !== serviceIds.length) {
    throw new HttpError(404, "NOT_FOUND", "Услуга не найдена");
  }
  const serviceById = new Map(services.map((service) => [service.id, service]));

  if (barberId !== "any") {
    const barber = await prisma.barber.findUnique({ where: { id: barberId } });
    if (!barber || !barber.isActive) {
      throw new HttpError(404, "NOT_FOUND", "Мастер не найден");
    }
  }

  const barbers = await prisma.barber.findMany({
    where: {
      isActive: true,
      ...(barberId === "any" ? {} : { id: barberId }),
      AND: serviceIds.map((id) => ({
        services: { some: { serviceId: id, isEnabled: true } },
      })),
    },
    orderBy: { sortOrder: "asc" },
    include: {
      services: { where: { serviceId: { in: serviceIds }, isEnabled: true } },
      workingHours: true,
      breaks: true,
    },
  });

  if (barberId !== "any" && barbers.length === 0) {
    throw new HttpError(422, "SERVICE_DISABLED", "Мастер не выполняет эту услугу");
  }

  const profiles: BarberProfile[] = barbers.map((barber) => {
    const lines = serviceIds.map((id) => {
      const service = serviceById.get(id) as ServiceRow;
      const link = barber.services.find((item) => item.serviceId === id);
      const durationMin = link?.durationMin ?? service.durationMin;
      const price = link?.price ?? service.price;
      return { serviceId: id, name: service.name, durationMin, price };
    });
    return {
      id: barber.id,
      name: barber.name,
      sortOrder: barber.sortOrder,
      durationMin: lines.reduce((sum, line) => sum + line.durationMin, 0),
      price: lines.reduce((sum, line) => sum + line.price, 0),
      lines,
      work: intervalsByWeekday(barber.workingHours),
      breaks: intervalsByWeekday(barber.breaks),
    };
  });

  return profiles;
}

async function loadBlocks(barberIds: string[], rangeStart: Date, rangeEnd: Date, excludeBookingId?: string) {
  const [timeOff, bookings] = await Promise.all([
    prisma.timeOff.findMany({
      where: {
        startsAt: { lt: rangeEnd },
        endsAt: { gt: rangeStart },
        OR: [{ barberId: null }, { barberId: { in: barberIds } }],
      },
      select: { barberId: true, startsAt: true, endsAt: true },
    }),
    prisma.booking.findMany({
      where: {
        barberId: { in: barberIds },
        status: "confirmed",
        startsAt: { lt: rangeEnd },
        endsAt: { gt: rangeStart },
        ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
      },
      select: { barberId: true, startsAt: true, endsAt: true },
    }),
  ]);
  return { timeOff, bookings };
}

function clipped(rows: BlockRow[], barberId: string, dayIso: string, timeZone: string, shopWide: boolean) {
  const intervals: Interval[] = [];
  for (const row of rows) {
    if (shopWide) {
      if (row.barberId !== null && row.barberId !== barberId) continue;
    } else if (row.barberId !== barberId) {
      continue;
    }
    const clip = clipToLocalMinutes(row.startsAt, row.endsAt, dayIso, timeZone);
    if (clip) intervals.push(clip);
  }
  return intervals;
}

function dayContext(profile: BarberProfile, dayIso: string, rules: Rules, now: Date) {
  const parts = zonedParts(zonedDateTime(dayIso, 12 * 60, rules.timeZone), rules.timeZone);
  const weekday = parts.weekday;
  const today = zonedParts(now, rules.timeZone).iso;
  const horizonEnd = addDays(today, rules.horizonDays);
  const noticeAt = new Date(now.getTime() + rules.minNoticeMin * 60_000);
  const bounds = localDayBounds(dayIso, rules.timeZone);
  let earliestMin = 0;
  if (noticeAt > bounds.start) {
    earliestMin = Math.ceil((noticeAt.getTime() - bounds.start.getTime()) / 60_000);
  }
  return {
    work: profile.work.get(weekday) ?? [],
    breaks: profile.breaks.get(weekday) ?? [],
    dayTooSoon: dayIso < today,
    dayTooFar: dayIso >= horizonEnd,
    earliestMin,
  };
}

export function openSlotsFor(
  profile: BarberProfile,
  dayIso: string,
  rules: Rules,
  now: Date,
  timeOff: BlockRow[],
  bookings: BlockRow[],
) {
  const day = dayContext(profile, dayIso, rules, now);
  if (day.dayTooSoon || day.dayTooFar || day.work.length === 0) return [];
  const blocks = [
    ...day.breaks,
    ...clipped(timeOff, profile.id, dayIso, rules.timeZone, true),
    ...clipped(bookings, profile.id, dayIso, rules.timeZone, false),
  ];
  return slotStarts({
    windows: day.work,
    blocks,
    durationMin: profile.durationMin,
    stepMin: rules.slotStepMin,
    earliestMin: day.earliestMin,
  }).map(formatMinutes);
}

export function verdictFor(
  profile: BarberProfile,
  startsAt: Date,
  rules: Rules,
  now: Date,
  timeOff: BlockRow[],
  bookings: BlockRow[],
) {
  const local = zonedParts(startsAt, rules.timeZone);
  const day = dayContext(profile, local.iso, rules, now);
  const closed = [
    ...day.breaks,
    ...clipped(timeOff, profile.id, local.iso, rules.timeZone, true),
  ];
  return classifySlot({
    startMin: local.minutes,
    durationMin: profile.durationMin,
    stepMin: rules.slotStepMin,
    work: day.work,
    blocks: closed,
    bookings: clipped(bookings, profile.id, local.iso, rules.timeZone, false),
    earliestMin: day.earliestMin,
    dayTooSoon: day.dayTooSoon,
    dayTooFar: day.dayTooFar,
  });
}

function rejection(verdicts: Array<"ok" | "too_soon" | "too_far" | "outside" | "taken">) {
  if (verdicts.includes("taken")) return new HttpError(409, "SLOT_TAKEN", "Это время уже занято");
  if (verdicts.includes("too_soon")) {
    return new HttpError(422, "TOO_SOON", "До записи осталось слишком мало времени");
  }
  if (verdicts.includes("too_far")) return new HttpError(422, "TOO_FAR", "Эта дата ещё не открыта для записи");
  return new HttpError(422, "OUTSIDE_WORKING_HOURS", "Это время вне графика");
}

export async function slotsOnDate(serviceIds: string[], barberId: string, dayIso: string, now = new Date()) {
  const rules = await loadRules();
  const profiles = await loadProfiles(serviceIds, barberId);
  if (profiles.length === 0) return [];
  const bounds = localDayBounds(dayIso, rules.timeZone);
  const blocks = await loadBlocks(
    profiles.map((profile) => profile.id),
    bounds.start,
    bounds.end,
  );
  const times = new Set<string>();
  for (const profile of profiles) {
    for (const slot of openSlotsFor(profile, dayIso, rules, now, blocks.timeOff, blocks.bookings)) {
      times.add(slot);
    }
  }
  return [...times].sort();
}

export async function daysOpen(serviceIds: string[], barberId: string, now = new Date()) {
  const rules = await loadRules();
  const profiles = await loadProfiles(serviceIds, barberId);
  const today = zonedParts(now, rules.timeZone).iso;
  const dates = Array.from({ length: rules.horizonDays }, (_, index) => addDays(today, index));
  if (profiles.length === 0) return dates.map((date) => ({ date, open: false }));
  const blocks = await loadBlocks(
    profiles.map((profile) => profile.id),
    zonedDateTime(dates[0], 0, rules.timeZone),
    zonedDateTime(addDays(dates[dates.length - 1], 1), 0, rules.timeZone),
  );
  return dates.map((date) => ({
    date,
    open: profiles.some(
      (profile) => openSlotsFor(profile, date, rules, now, blocks.timeOff, blocks.bookings).length > 0,
    ),
  }));
}

export async function pickBarbers(
  serviceIds: string[],
  barberId: string,
  startsAt: Date,
  now = new Date(),
  excludeBookingId?: string,
  durationMin?: number,
  desk = false,
) {
  const rules = await loadRules();
  const profiles = await loadProfiles(serviceIds, barberId);
  if (profiles.length === 0) {
    throw new HttpError(422, "SERVICE_DISABLED", "Нет мастера для этой услуги");
  }
  const local = zonedParts(startsAt, rules.timeZone);
  const bounds = localDayBounds(local.iso, rules.timeZone);
  const blocks = await loadBlocks(
    profiles.map((profile) => profile.id),
    bounds.start,
    bounds.end,
    excludeBookingId,
  );
  const ranked = profiles.map((profile) => {
    const judged = durationMin === undefined ? profile : { ...profile, durationMin };
    return {
      profile: judged,
      verdict: verdictFor(judged, startsAt, rules, now, blocks.timeOff, blocks.bookings),
    };
  });
  const available = ranked
    .filter((item) => item.verdict === "ok" || (desk && (item.verdict === "too_soon" || item.verdict === "too_far")))
    .map((item) => item.profile);
  if (available.length === 0) throw rejection(ranked.map((item) => item.verdict));
  return { rules, profiles: available };
}
