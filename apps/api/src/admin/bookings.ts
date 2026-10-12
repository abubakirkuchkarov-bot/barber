import type { BookingStatus } from "@prisma/client";
import { prisma } from "../db";
import { createBooking, isExclusionViolation } from "../bookings";
import { notifyBooking } from "../bot/notify";
import { HttpError } from "../http-error";
import { issueBarberLink } from "../bot/link";
import { loadRules, pickBarbers } from "../schedule";

const bookingInclude = { barber: true, services: true, client: true } as const;

export async function adminPatchBooking(
  id: string,
  patch: { status?: BookingStatus; startsAt?: Date; barberId?: string },
  now = new Date(),
) {
  const booking = await prisma.booking.findUnique({ where: { id }, include: bookingInclude });
  if (!booking) throw new HttpError(404, "NOT_FOUND", "Запись не найдена");
  const rules = await loadRules();
  const startsAt = patch.startsAt ?? booking.startsAt;
  const barberId = patch.barberId ?? booking.barberId;
  const moving = startsAt.getTime() !== booking.startsAt.getTime() || barberId !== booking.barberId;
  if (moving) {
    const serviceIds = booking.services.map((service) => service.serviceId);
    await pickBarbers(serviceIds, barberId, startsAt, now, booking.id, booking.totalDurationMin, true);
  }
  const endsAt = new Date(startsAt.getTime() + booking.totalDurationMin * 60_000);
  const status = patch.status ?? booking.status;
  try {
    const updated = await prisma.booking.update({
      where: { id },
      data: { status, startsAt, endsAt, barberId },
      include: bookingInclude,
    });
    if (status === "cancelled" && booking.status !== "cancelled") await notifyBooking("cancelled", updated);
    else if (moving && status === "confirmed") await notifyBooking("moved", updated);
    return { booking: updated, cutoffMin: rules.cancelCutoffMin };
  } catch (error) {
    if (isExclusionViolation(error)) throw new HttpError(409, "SLOT_TAKEN", "Это время уже занято");
    throw error;
  }
}

export async function adminCreateBooking(input: {
  serviceIds: string[];
  barberId: string;
  startsAt: Date;
  client: { name: string; phone: string };
}) {
  return createBooking({ ...input, source: "admin", desk: true });
}

export { issueBarberLink };
