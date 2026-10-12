import { randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { HttpError } from "./http-error";
import { notifyBooking } from "./bot/notify";
import { telegramBotUrl, bookingStartPayload } from "./bot/payload";
import { loadRules, pickBarbers, type ServiceLine } from "./schedule";

export type PublicBooking = {
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

const bookingInclude = {
  barber: true,
  services: true,
  client: true,
} satisfies Prisma.BookingInclude;

type BookingRow = Prisma.BookingGetPayload<{ include: typeof bookingInclude }>;

function canManage(status: BookingRow["status"], startsAt: Date, cutoffMin: number, now: Date) {
  return status === "confirmed" && startsAt.getTime() - now.getTime() >= cutoffMin * 60_000;
}

function toPublic(booking: BookingRow, cutoffMin: number, now = new Date()): PublicBooking {
  return {
    id: booking.id,
    status: booking.status,
    startsAt: booking.startsAt.toISOString(),
    endsAt: booking.endsAt.toISOString(),
    totalPrice: booking.totalPrice,
    totalDurationMin: booking.totalDurationMin,
    manageToken: booking.manageToken,
    canManage: canManage(booking.status, booking.startsAt, cutoffMin, now),
    barber: { id: booking.barber.id, name: booking.barber.name },
    services: booking.services.map((service) => ({
      id: service.serviceId,
      name: service.name,
      durationMin: service.durationMin,
      price: service.price,
    })),
    client: { name: booking.client.name, phone: booking.client.phone },
    telegramUrl: telegramBotUrl(bookingStartPayload(booking.manageToken)),
  };
}

export function isExclusionViolation(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const meta = error && typeof error === "object" && "meta" in error ? JSON.stringify(error.meta) : "";
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  const blob = `${code} ${message} ${meta}`;
  return blob.includes("23P01") || blob.includes("bookings_no_overlap");
}

async function insertBooking(
  barberId: string,
  startsAt: Date,
  endsAt: Date,
  totalPrice: number,
  totalDurationMin: number,
  client: { name: string; phone: string },
  lines: ServiceLine[],
  source: "web" | "telegram" | "admin",
  telegramId?: string,
) {
  try {
    return await prisma.$transaction(async (tx) => {
      const existing = telegramId
        ? await tx.client.findUnique({ where: { telegramId } })
        : null;
      const saved = existing
        ? await tx.client.update({
            where: { id: existing.id },
            data: { name: client.name, phone: client.phone, telegramChatId: telegramId },
          })
        : await tx.client.create({
            data: {
              ...client,
              telegramId,
              telegramChatId: telegramId,
            },
          });
      return tx.booking.create({
        data: {
          clientId: saved.id,
          barberId,
          startsAt,
          endsAt,
          totalPrice,
          totalDurationMin,
          status: "confirmed",
          source,
          manageToken: randomBytes(24).toString("base64url"),
          services: {
            create: lines.map((line) => ({
              serviceId: line.serviceId,
              name: line.name,
              durationMin: line.durationMin,
              price: line.price,
            })),
          },
        },
        include: bookingInclude,
      });
    });
  } catch (error) {
    if (isExclusionViolation(error)) {
      throw new HttpError(409, "SLOT_TAKEN", "Это время уже занято");
    }
    throw error;
  }
}

export async function createBooking(input: {
  serviceIds: string[];
  barberId: string;
  startsAt: Date;
  client: { name: string; phone: string };
  now?: Date;
  telegramId?: string;
  source?: "web" | "telegram" | "admin";
  desk?: boolean;
}) {
  const now = input.now ?? new Date();
  const source = input.source ?? (input.telegramId ? "telegram" : "web");
  const { rules, profiles } = await pickBarbers(
    input.serviceIds,
    input.barberId,
    input.startsAt,
    now,
    undefined,
    undefined,
    input.desk,
  );
  let lastTaken: HttpError | null = null;
  for (const profile of profiles) {
    const endsAt = new Date(input.startsAt.getTime() + profile.durationMin * 60_000);
    try {
      const booking = await insertBooking(
        profile.id,
        input.startsAt,
        endsAt,
        profile.price,
        profile.durationMin,
        input.client,
        profile.lines,
        source,
        input.telegramId,
      );
      await notifyBooking("created", booking);
      return toPublic(booking, rules.cancelCutoffMin, now);
    } catch (error) {
      if (error instanceof HttpError && error.code === "SLOT_TAKEN") {
        lastTaken = error;
        continue;
      }
      throw error;
    }
  }
  throw lastTaken ?? new HttpError(409, "SLOT_TAKEN", "Это время уже занято");
}

async function bookingByToken(token: string) {
  const booking = await prisma.booking.findUnique({
    where: { manageToken: token },
    include: bookingInclude,
  });
  if (!booking) throw new HttpError(404, "NOT_FOUND", "Запись не найдена");
  return booking;
}

export async function listTelegramBookings(telegramId: string, now = new Date()) {
  const rules = await loadRules();
  const client = await prisma.client.findUnique({ where: { telegramId } });
  if (!client) return [];
  const rows = await prisma.booking.findMany({
    where: { clientId: client.id },
    include: bookingInclude,
    orderBy: { startsAt: "desc" },
    take: 20,
  });
  return rows.map((row) => toPublic(row, rules.cancelCutoffMin, now));
}

export async function getBooking(token: string, now = new Date()) {
  const rules = await loadRules();
  return toPublic(await bookingByToken(token), rules.cancelCutoffMin, now);
}

function assertManageable(booking: BookingRow, cutoffMin: number, now: Date) {
  if (booking.status !== "confirmed") {
    throw new HttpError(
      422,
      "NOT_CANCELLABLE",
      booking.status === "cancelled" ? "Запись уже отменена" : "Эту запись нельзя изменить",
    );
  }
  if (!canManage(booking.status, booking.startsAt, cutoffMin, now)) {
    throw new HttpError(422, "TOO_LATE", "Изменить запись можно не позже чем за 30 минут до начала");
  }
}

export async function cancelBooking(token: string, now = new Date()) {
  const rules = await loadRules();
  const booking = await bookingByToken(token);
  assertManageable(booking, rules.cancelCutoffMin, now);
  const updated = await prisma.booking.update({
    where: { id: booking.id },
    data: { status: "cancelled" },
    include: bookingInclude,
  });
  await notifyBooking("cancelled", updated);
  return toPublic(updated, rules.cancelCutoffMin, now);
}

export async function rescheduleBooking(token: string, startsAt: Date, now = new Date()) {
  const rules = await loadRules();
  const booking = await bookingByToken(token);
  assertManageable(booking, rules.cancelCutoffMin, now);
  const serviceIds = booking.services.map((service) => service.serviceId);
  await pickBarbers(serviceIds, booking.barberId, startsAt, now, booking.id, booking.totalDurationMin);
  const endsAt = new Date(startsAt.getTime() + booking.totalDurationMin * 60_000);
  try {
    const updated = await prisma.booking.update({
      where: { id: booking.id },
      data: { startsAt, endsAt },
      include: bookingInclude,
    });
    await notifyBooking("moved", updated);
    return toPublic(updated, rules.cancelCutoffMin, now);
  } catch (error) {
    if (isExclusionViolation(error)) {
      throw new HttpError(409, "SLOT_TAKEN", "Это время уже занято");
    }
    throw error;
  }
}
