import type { Prisma } from "@prisma/client";
import { InlineKeyboard } from "grammy";
import { clientNotice, barberNotice } from "./messages";

const withPeople = {
  client: true,
  barber: true,
  services: true,
} satisfies Prisma.BookingInclude;

export type NoticeBooking = Prisma.BookingGetPayload<{ include: typeof withPeople }>;

export async function notifyBooking(kind: "created" | "cancelled" | "moved", booking: NoticeBooking) {
  const { getBot } = await import("./bot");
  const bot = getBot();
  if (!bot) return;
  const token = process.env.TELEGRAM_BOT_TOKEN ?? "";
  try {
    if (booking.client.telegramChatId) {
      const keyboard = kind === "cancelled" ? undefined : clientKeyboard(booking.manageToken);
      await bot.api.sendMessage(booking.client.telegramChatId, clientNotice(kind, booking), {
        reply_markup: keyboard,
      });
    }
    if (kind === "created" && booking.barber.telegramChatId) {
      await bot.api.sendMessage(booking.barber.telegramChatId, barberNotice(booking));
    }
  } catch (error) {
    const message = error instanceof Error ? error.message.replaceAll(token, "[token]") : "notify failed";
    console.error("telegram notify", message);
  }
}

function clientKeyboard(token: string) {
  const keyboard = new InlineKeyboard().text("Отменить", `x:${token}`);
  const origin = process.env.WEB_ORIGIN ?? "http://localhost:3000";
  if (origin.startsWith("https://")) keyboard.url("Перенести", `${origin}/booking/${token}`);
  return keyboard;
}
