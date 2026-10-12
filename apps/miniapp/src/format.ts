const WEEKDAY = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"] as const;

export function formatPrice(value: number) {
  return `${new Intl.NumberFormat("ru-RU").format(value)} сум`;
}

export function formatDuration(minutes: number) {
  return `${minutes} мин`;
}

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

export function formatWhen(instant: string) {
  const date = new Date(instant);
  const day = new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Asia/Tashkent",
    weekday: "short",
    day: "numeric",
    month: "long",
  }).format(date);
  const time = new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Asia/Tashkent",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
  return `${day}, ${time}`;
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

export function applyTheme(theme: TelegramTheme | undefined) {
  if (!theme?.bg_color || !theme.text_color) return;
  const root = document.documentElement;
  root.style.setProperty("--bg", theme.bg_color);
  root.style.setProperty("--fg", theme.text_color);
  if (theme.hint_color) root.style.setProperty("--muted", theme.hint_color);
  if (theme.secondary_bg_color) root.style.setProperty("--surface", theme.secondary_bg_color);
  if (theme.button_color) root.style.setProperty("--accent", theme.button_color);
  if (theme.button_text_color) root.style.setProperty("--on-accent", theme.button_text_color);
  root.style.colorScheme = theme.bg_color.toLowerCase() === "#ffffff" ? "light" : "dark";
}
