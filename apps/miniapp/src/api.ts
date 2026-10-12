export type Service = {
  id: string;
  name: string;
  description: string;
  durationMin: number;
  price: number;
};

export type Barber = {
  id: string;
  name: string;
  bio: string | null;
  experienceYears: number;
  photoUrl: string | null;
};

export type BookingView = {
  status: "confirmed" | "completed" | "cancelled" | "no_show";
  startsAt: string;
  totalPrice: number;
  totalDurationMin: number;
  manageToken: string;
  canManage: boolean;
  barber: { id: string; name: string };
  services: Array<{ id: string; name: string; durationMin: number; price: number }>;
};

export type DayAvailability = { date: string; open: boolean };

function request(path: string, init?: RequestInit) {
  const origin = import.meta.env.VITE_API_URL?.trim().replace(/\/+$/, "") ?? "";
  return fetch(origin ? `${origin}${path}` : path, init);
}

type Failure = { ok: false; status: number; code: string; message: string };

async function fail(response: Response): Promise<Failure> {
  try {
    const body = (await response.json()) as { code?: string; message?: string };
    return {
      ok: false,
      status: response.status,
      code: body.code ?? "INTERNAL",
      message: body.message ?? "Не удалось выполнить запрос",
    };
  } catch {
    return { ok: false, status: response.status, code: "INTERNAL", message: "Не удалось выполнить запрос" };
  }
}

function authHeaders(initData: string | null, json = false) {
  const headers: Record<string, string> = {};
  if (json) headers["content-type"] = "application/json";
  if (initData) headers.authorization = `tma ${initData}`;
  return headers;
}

export async function getServices() {
  const response = await request("/api/v1/services");
  if (!response.ok) return fail(response);
  const body = (await response.json()) as { services: Service[] };
  return { ok: true as const, services: body.services };
}

export async function getBarbers() {
  const response = await request("/api/v1/barbers");
  if (!response.ok) return fail(response);
  const body = (await response.json()) as { barbers: Barber[] };
  return { ok: true as const, barbers: body.barbers };
}

export async function getAvailabilityDays(serviceId: string, barberId: string) {
  const params = new URLSearchParams({ serviceIds: serviceId, barberId });
  const response = await request(`/api/v1/availability/days?${params}`);
  if (!response.ok) return fail(response);
  const body = (await response.json()) as { days: DayAvailability[] };
  return { ok: true as const, days: body.days };
}

export async function getAvailability(serviceId: string, barberId: string, date: string) {
  const params = new URLSearchParams({ serviceIds: serviceId, barberId, date });
  const response = await request(`/api/v1/availability?${params}`);
  if (!response.ok) return fail(response);
  const body = (await response.json()) as { slots: string[] };
  return { ok: true as const, slots: body.slots };
}

export async function createBooking(
  initData: string,
  body: { serviceIds: string[]; barberId: string; startsAt: string; client: { name: string; phone: string } },
) {
  const response = await request("/api/v1/bookings", {
    method: "POST",
    headers: authHeaders(initData, true),
    body: JSON.stringify(body),
  });
  if (!response.ok) return fail(response);
  const payload = (await response.json()) as { booking: BookingView };
  return { ok: true as const, booking: payload.booking };
}

export async function getMyBookings(initData: string) {
  const response = await request("/api/v1/me/bookings", { headers: authHeaders(initData) });
  if (!response.ok) return fail(response);
  const payload = (await response.json()) as { bookings: BookingView[] };
  return { ok: true as const, bookings: payload.bookings };
}

export async function getMe(initData: string) {
  const response = await request("/api/v1/me", { headers: authHeaders(initData) });
  if (!response.ok) return fail(response);
  const payload = (await response.json()) as {
    user: { id: string; name: string; username: string | null };
    client: { name: string; phone: string } | null;
  };
  return { ok: true as const, ...payload };
}

export async function cancelBooking(token: string) {
  const response = await request(`/api/v1/bookings/${token}/cancel`, { method: "POST" });
  if (!response.ok) return fail(response);
  const payload = (await response.json()) as { booking: BookingView };
  return { ok: true as const, booking: payload.booking };
}

export async function rescheduleBooking(token: string, startsAt: string) {
  const response = await request(`/api/v1/bookings/${token}/reschedule`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ startsAt }),
  });
  if (!response.ok) return fail(response);
  const payload = (await response.json()) as { booking: BookingView };
  return { ok: true as const, booking: payload.booking };
}

export async function fetchDevSession() {
  const response = await request("/api/v1/telegram/dev-session");
  if (!response.ok) return fail(response);
  const body = (await response.json()) as { initData: string };
  return { ok: true as const, initData: body.initData };
}

export const webOrigin = import.meta.env.VITE_WEB_ORIGIN ?? "http://localhost:3000";
