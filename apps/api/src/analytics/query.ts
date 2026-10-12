import { prisma } from "../db";
import { HttpError } from "../http-error";
import { subtractIntervals, type Interval } from "../slots";
import { addDays, clipToLocalMinutes, clockMinutes, isRealDate, localDayBounds, zonedParts } from "../time";
import { cancellationsOf, heatmapOf, loadOf, retentionOf, revenueOf, servicesOf, type Visit } from "./calc";

const MAX_DAYS = 366;

export async function readPeriod(query: unknown) {
  const parsed = query as { from?: string; to?: string };
  const zone = await prisma.setting.findUnique({ where: { key: "timezone" } });
  const timeZone = zone?.value || "Asia/Tashkent";
  const today = zonedParts(new Date(), timeZone).iso;
  const to = parsed.to || today;
  const from = parsed.from || addDays(to, -29);
  if (!isRealDate(from) || !isRealDate(to) || from > to) {
    throw new HttpError(400, "VALIDATION", "Период задан неверно");
  }
  const dates = datesBetween(from, to);
  if (dates.length > MAX_DAYS) throw new HttpError(400, "VALIDATION", "Период длиннее года");
  return {
    from,
    to,
    timeZone,
    dates,
    start: localDayBounds(from, timeZone).start,
    end: localDayBounds(to, timeZone).end,
  };
}

export async function loadAnalytics(period: Awaited<ReturnType<typeof readPeriod>>) {
  const [rows, barbers, timeOff] = await Promise.all([
    prisma.booking.findMany({
      where: { startsAt: { gte: period.start, lt: period.end } },
      include: { services: true, barber: true },
    }),
    prisma.barber.findMany({ include: { workingHours: true, breaks: true }, orderBy: { sortOrder: "asc" } }),
    prisma.timeOff.findMany({
      where: { startsAt: { lt: period.end }, endsAt: { gt: period.start } },
    }),
  ]);

  const visits: Visit[] = rows.map((row) => ({
    clientId: row.clientId,
    barberId: row.barberId,
    barberName: row.barber.name,
    startsAt: row.startsAt,
    totalPrice: row.totalPrice,
    totalDurationMin: row.totalDurationMin,
    status: row.status,
    services: row.services.map((service) => ({
      id: service.serviceId,
      name: service.name,
      price: service.price,
    })),
  }));

  const days = barbers.flatMap((barber) =>
    period.dates.map((date) => {
      const weekday = zonedParts(localDayBounds(date, period.timeZone).start, period.timeZone).weekday;
      const work = barber.workingHours
        .filter((item) => item.weekday === weekday)
        .map((item) => ({ start: clockMinutes(item.startTime), end: clockMinutes(item.endTime) }));
      const breaks = barber.breaks
        .filter((item) => item.weekday === weekday)
        .map((item) => ({ start: clockMinutes(item.startTime), end: clockMinutes(item.endTime) }));
      const off = timeOff.flatMap((item) => {
        if (item.barberId && item.barberId !== barber.id) return [];
        const clipped = clipToLocalMinutes(item.startsAt, item.endsAt, date, period.timeZone);
        return clipped ? [clipped] : [];
      });
      return {
        barberId: barber.id,
        barberName: barber.name,
        openMin: openMinutes(work, [...breaks, ...off]),
      };
    }),
  );

  return {
    revenue: revenueOf(visits),
    services: servicesOf(visits),
    load: loadOf(visits, days),
    cancellations: cancellationsOf(visits),
    retention: retentionOf(visits),
    heatmap: heatmapOf(visits, period.timeZone),
  };
}

function openMinutes(work: Interval[], blocks: Interval[]) {
  return subtractIntervals(work, blocks).reduce((sum, item) => sum + (item.end - item.start), 0);
}

function datesBetween(from: string, to: string) {
  const dates: string[] = [];
  for (let cursor = from; cursor <= to; cursor = addDays(cursor, 1)) dates.push(cursor);
  return dates;
}
