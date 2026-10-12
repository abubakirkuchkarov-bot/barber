const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export type BookingView = {
  id: string;
  status: "confirmed" | "completed" | "cancelled" | "no_show";
  startsAt: string;
  endsAt: string;
  totalPrice: number;
  totalDurationMin: number;
  manageToken: string;
  canManage: boolean;
  barber: { id: string; name: string };
  services: Array<{ id: string; name: string; durationMin: number; price: number }>;
  client: { name: string; phone: string };
  telegramUrl: string | null;
};

export type DayAvailability = { date: string; open: boolean };

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

export async function getAvailabilityDays(serviceId: string, barberId: string) {
  const params = new URLSearchParams({ serviceIds: serviceId, barberId });
  const response = await fetch(`${apiUrl}/api/v1/availability/days?${params}`, { cache: "no-store" });
  if (!response.ok) return fail(response);
  const body = (await response.json()) as { days: DayAvailability[] };
  return { ok: true as const, days: body.days };
}

export async function getAvailability(serviceId: string, barberId: string, date: string) {
  const params = new URLSearchParams({ serviceIds: serviceId, barberId, date });
  const response = await fetch(`${apiUrl}/api/v1/availability?${params}`, { cache: "no-store" });
  if (!response.ok) return fail(response);
  const body = (await response.json()) as { slots: string[] };
  return { ok: true as const, slots: body.slots };
}

export async function createBookingRequest(body: {
  serviceIds: string[];
  barberId: string;
  startsAt: string;
  client: { name: string; phone: string };
}) {
  const response = await fetch(`${apiUrl}/api/v1/bookings`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) return fail(response);
  const payload = (await response.json()) as { booking: BookingView };
  return { ok: true as const, booking: payload.booking };
}

export async function getBooking(token: string) {
  const response = await fetch(`${apiUrl}/api/v1/bookings/${token}`, { cache: "no-store" });
  if (!response.ok) return fail(response);
  const payload = (await response.json()) as { booking: BookingView };
  return { ok: true as const, booking: payload.booking };
}

export async function cancelBookingRequest(token: string) {
  const response = await fetch(`${apiUrl}/api/v1/bookings/${token}/cancel`, { method: "POST" });
  if (!response.ok) return fail(response);
  const payload = (await response.json()) as { booking: BookingView };
  return { ok: true as const, booking: payload.booking };
}

export async function rescheduleBookingRequest(token: string, startsAt: string) {
  const response = await fetch(`${apiUrl}/api/v1/bookings/${token}/reschedule`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ startsAt }),
  });
  if (!response.ok) return fail(response);
  const payload = (await response.json()) as { booking: BookingView };
  return { ok: true as const, booking: payload.booking };
}
