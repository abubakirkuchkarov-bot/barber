import { randomBytes } from "node:crypto";
import { prisma } from "../db";
import { HttpError } from "../http-error";
import { barberStartPayload, telegramBotUrl } from "./payload";

const DAY_MS = 24 * 60 * 60 * 1000;

export async function issueBarberLink(barberId: string, now = new Date()) {
  const barber = await prisma.barber.findUnique({ where: { id: barberId } });
  if (!barber || !barber.isActive) throw new HttpError(404, "NOT_FOUND", "Мастер не найден");
  const code = randomBytes(18).toString("base64url");
  const expiresAt = new Date(now.getTime() + DAY_MS);
  await prisma.barberLinkCode.create({
    data: { code, barberId, expiresAt },
  });
  const payload = barberStartPayload(code);
  return { code, payload, expiresAt: expiresAt.toISOString(), url: telegramBotUrl(payload) };
}

export async function consumeBarberLink(code: string, chatId: string, now = new Date()) {
  const claimed = await prisma.barberLinkCode.updateMany({
    where: { code, usedAt: null, expiresAt: { gt: now } },
    data: { usedAt: now },
  });
  if (claimed.count !== 1) return null;
  const row = await prisma.barberLinkCode.findUnique({ where: { code }, include: { barber: true } });
  if (!row) return null;
  await prisma.barber.update({
    where: { id: row.barberId },
    data: { telegramChatId: chatId },
  });
  return row.barber.name;
}

export async function linkBookingToTelegram(input: {
  token: string;
  telegramId: string;
  chatId: string;
  name: string;
}) {
  const booking = await prisma.booking.findUnique({
    where: { manageToken: input.token },
    include: { client: true, barber: true, services: true },
  });
  if (!booking) return null;

  const existing = await prisma.client.findUnique({ where: { telegramId: input.telegramId } });
  if (existing && existing.id !== booking.clientId) {
    await prisma.client.update({
      where: { id: existing.id },
      data: { telegramChatId: input.chatId, name: input.name || existing.name },
    });
    return prisma.booking.update({
      where: { id: booking.id },
      data: { clientId: existing.id },
      include: { client: true, barber: true, services: true },
    });
  }

  if (booking.client.telegramId && booking.client.telegramId !== input.telegramId) {
    return null;
  }

  await prisma.client.update({
    where: { id: booking.clientId },
    data: {
      telegramId: input.telegramId,
      telegramChatId: input.chatId,
      name: input.name || booking.client.name,
    },
  });
  return prisma.booking.findUnique({
    where: { id: booking.id },
    include: { client: true, barber: true, services: true },
  });
}
