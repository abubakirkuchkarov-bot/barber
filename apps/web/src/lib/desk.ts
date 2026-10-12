const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export class DeskError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function desk<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData) && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  const response = await fetch(`${apiUrl}/api/v1${path}`, { ...init, headers, credentials: "include" });
  const body = (await response.json().catch(() => ({}))) as { message?: string };
  if (response.status === 401 && path !== "/admin/login") {
    window.location.assign("/admin/login");
  }
  if (!response.ok) throw new DeskError(body.message ?? "Не удалось выполнить запрос", response.status);
  return body as T;
}

export function tashkentDate(instant = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tashkent",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

export function tashkentTime(iso: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Asia/Tashkent",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}

export function tashkentInstant(date: string, time: string) {
  return `${date}T${time}:00+05:00`;
}

export const WEEKDAYS = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];

export const STATUS_LABEL = {
  confirmed: "Запись",
  completed: "Завершена",
  cancelled: "Отменена",
  no_show: "Не пришёл",
} as const;
