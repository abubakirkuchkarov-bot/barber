import { zonedParts } from "../time";

export type VisitStatus = "confirmed" | "completed" | "cancelled" | "no_show";

export type Visit = {
  clientId: string;
  barberId: string;
  barberName: string;
  startsAt: Date;
  totalPrice: number;
  totalDurationMin: number;
  status: VisitStatus;
  services: Array<{ id: string; name: string; price: number }>;
};

export type OpenDay = {
  barberId: string;
  barberName: string;
  openMin: number;
};

const OCCUPIED = new Set<VisitStatus>(["confirmed", "completed", "no_show"]);

export function ratio(part: number, whole: number) {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 1000) / 1000;
}

export function revenueOf(visits: Visit[]) {
  const completed = visits.filter((visit) => visit.status === "completed");
  return {
    total: completed.reduce((sum, visit) => sum + visit.totalPrice, 0),
    completed: completed.length,
    bookings: visits.length,
  };
}

export function servicesOf(visits: Visit[]) {
  const map = new Map<string, { id: string; name: string; count: number; revenue: number }>();
  for (const visit of visits) {
    if (!OCCUPIED.has(visit.status)) continue;
    for (const service of visit.services) {
      const row = map.get(service.id) ?? { id: service.id, name: service.name, count: 0, revenue: 0 };
      row.count += 1;
      if (visit.status === "completed") row.revenue += service.price;
      map.set(service.id, row);
    }
  }
  return [...map.values()].sort((left, right) => right.count - left.count || left.name.localeCompare(right.name, "ru"));
}

export function loadOf(visits: Visit[], days: OpenDay[]) {
  const map = new Map<string, { id: string; name: string; bookedMin: number; openMin: number; visits: number }>();
  for (const day of days) {
    const row = map.get(day.barberId) ?? { id: day.barberId, name: day.barberName, bookedMin: 0, openMin: 0, visits: 0 };
    row.openMin += day.openMin;
    map.set(day.barberId, row);
  }
  for (const visit of visits) {
    if (!OCCUPIED.has(visit.status)) continue;
    const row = map.get(visit.barberId) ?? {
      id: visit.barberId,
      name: visit.barberName,
      bookedMin: 0,
      openMin: 0,
      visits: 0,
    };
    row.bookedMin += visit.totalDurationMin;
    row.visits += 1;
    map.set(visit.barberId, row);
  }
  return [...map.values()]
    .map((row) => ({ ...row, load: ratio(row.bookedMin, row.openMin) }))
    .sort((left, right) => right.load - left.load || left.name.localeCompare(right.name, "ru"));
}

export function cancellationsOf(visits: Visit[]) {
  const cancelled = visits.filter((visit) => visit.status === "cancelled").length;
  const noShow = visits.filter((visit) => visit.status === "no_show").length;
  return {
    total: visits.length,
    cancelled,
    noShow,
    cancelRate: ratio(cancelled, visits.length),
    noShowRate: ratio(noShow, visits.length),
  };
}

export function retentionOf(visits: Visit[]) {
  const counts = new Map<string, number>();
  for (const visit of visits) {
    if (visit.status !== "completed") continue;
    counts.set(visit.clientId, (counts.get(visit.clientId) ?? 0) + 1);
  }
  const clients = counts.size;
  const returning = [...counts.values()].filter((count) => count >= 2).length;
  return { clients, returning, rate: ratio(returning, clients) };
}

export function heatmapOf(visits: Visit[], timeZone: string) {
  const hours = new Set<number>();
  for (let hour = 10; hour <= 20; hour += 1) hours.add(hour);
  const grid = Array.from({ length: 7 }, () => new Map<number, number>());
  for (const visit of visits) {
    if (!OCCUPIED.has(visit.status)) continue;
    const parts = zonedParts(visit.startsAt, timeZone);
    const hour = Math.floor(parts.minutes / 60);
    hours.add(hour);
    const row = grid[parts.weekday] ?? new Map<number, number>();
    row.set(hour, (row.get(hour) ?? 0) + 1);
    grid[parts.weekday] = row;
  }
  const columns = [...hours].sort((left, right) => left - right);
  return {
    hours: columns,
    rows: grid.map((row, weekday) => ({
      weekday,
      counts: columns.map((hour) => row.get(hour) ?? 0),
    })),
  };
}
