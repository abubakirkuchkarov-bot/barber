export type ZonedParts = {
  iso: string;
  minutes: number;
  weekday: number;
};

const WEEKDAY: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export function zonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  const hour = Number(pick("hour"));
  return {
    iso: `${pick("year")}-${pick("month")}-${pick("day")}`,
    minutes: (hour === 24 ? 0 : hour) * 60 + Number(pick("minute")),
    weekday: WEEKDAY[pick("weekday")] ?? 0,
  };
}

export function addDays(iso: string, days: number) {
  const [year, month, day] = iso.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return next.toISOString().slice(0, 10);
}

export function isRealDate(iso: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function zonedDateTime(iso: string, minutes: number, timeZone: string) {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const [year, month, day] = iso.split("-").map(Number);
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const actual = zonedParts(guess, timeZone);
  const [actualYear, actualMonth, actualDay] = actual.iso.split("-").map(Number);
  const actualAsUtc = Date.UTC(
    actualYear,
    actualMonth - 1,
    actualDay,
    Math.floor(actual.minutes / 60),
    actual.minutes % 60,
  );
  const desiredAsUtc = Date.UTC(year, month - 1, day, hour, minute);
  return new Date(guess.getTime() - (actualAsUtc - desiredAsUtc));
}

export function clockMinutes(value: Date) {
  return value.getUTCHours() * 60 + value.getUTCMinutes();
}

export function formatMinutes(minutes: number) {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function localDayBounds(iso: string, timeZone: string) {
  return {
    start: zonedDateTime(iso, 0, timeZone),
    end: zonedDateTime(addDays(iso, 1), 0, timeZone),
  };
}

export function clipToLocalMinutes(start: Date, end: Date, dayIso: string, timeZone: string) {
  const bounds = localDayBounds(dayIso, timeZone);
  const from = Math.max(start.getTime(), bounds.start.getTime());
  const to = Math.min(end.getTime(), bounds.end.getTime());
  if (to <= from) return null;
  return {
    start: Math.round((from - bounds.start.getTime()) / 60000),
    end: Math.round((to - bounds.start.getTime()) / 60000),
  };
}
