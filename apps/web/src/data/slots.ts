const WEEKDAY = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"] as const;

export function weekdayIndex(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function formatWeekday(iso: string) {
  return WEEKDAY[weekdayIndex(iso)];
}

export function formatDayMonth(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function formatFullDate(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function formatVisit(instant: string) {
  const date = new Date(instant);
  const day = new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Asia/Tashkent",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
  const time = new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Asia/Tashkent",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
  return { day, time };
}

export function tashkentInstant(isoDate: string, time: string) {
  return `${isoDate}T${time}:00+05:00`;
}

export function normalizePhone(raw: string) {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("998") && digits.length === 12) digits = digits.slice(3);
  if (!/^\d{9}$/.test(digits)) return null;
  return `+998 ${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 7)} ${digits.slice(7)}`;
}

export function isValidName(raw: string) {
  const name = raw.trim();
  return name.length >= 2 && /^[\p{L}][\p{L}\s'-]+$/u.test(name);
}
