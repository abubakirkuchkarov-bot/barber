import { Bot, Keyboard, type Context } from "grammy";
import { cancelBooking } from "../bookings";
import { HttpError } from "../http-error";
import { prisma } from "../db";
import { consumeBarberLink, linkBookingToTelegram } from "./link";
import { bookingsListText, bookHintText, clientNotice, contactsText, welcomeText } from "./messages";
import { parseStartPayload } from "./payload";
import { saveTelegramRating } from "../reviews";

let bot: Bot | null = null;

export function getBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) return null;
  if (!bot) bot = buildBot(token);
  return bot;
}

function menuKeyboard() {
  const miniApp = process.env.TELEGRAM_MINIAPP_URL?.trim();
  const keyboard = new Keyboard();
  if (miniApp?.startsWith("https://")) keyboard.webApp("Записаться", miniApp);
  else keyboard.text("Записаться");
  keyboard.text("Мои записи").row().text("Контакты").resized().persistent();
  return keyboard;
}

function buildBot(token: string) {
  const instance = new Bot(token);
  const menu = menuKeyboard();

  instance.command("start", async (ctx) => {
    if (!ctx.chat) return;
    const payload = parseStartPayload(typeof ctx.match === "string" ? ctx.match : "");
    const chatId = String(ctx.chat.id);
    const telegramId = String(ctx.from?.id ?? ctx.chat.id);
    const name = [ctx.from?.first_name, ctx.from?.last_name].filter(Boolean).join(" ");

    if (payload.type === "booking") {
      const booking = await linkBookingToTelegram({ token: payload.token, telegramId, chatId, name });
      if (!booking) {
        await ctx.reply("Запись не найдена.", { reply_markup: menu });
        return;
      }
      await ctx.reply(clientNotice("created", booking), { reply_markup: menu });
      return;
    }

    if (payload.type === "barber") {
      const barberName = await consumeBarberLink(payload.code, chatId);
      await ctx.reply(
        barberName ? `Вы привязаны. Новые записи ${barberName} будут приходить сюда.` : "Код привязки недействителен.",
        { reply_markup: menu },
      );
      return;
    }

    await ctx.reply(welcomeText(), { reply_markup: menu });
  });

  instance.command("bookings", (ctx) => replyBookings(ctx));
  instance.hears("Мои записи", (ctx) => replyBookings(ctx));
  instance.hears("Записаться", (ctx) => ctx.reply(bookHintText(), { reply_markup: menu }));
  instance.hears("Контакты", (ctx) => ctx.reply(contactsText(), { reply_markup: menu }));
  instance.hears(/^\s*[1-5]\s*$/, async (ctx) => {
    const telegramId = String(ctx.from?.id ?? "");
    const rating = Number(ctx.message?.text?.trim());
    if (!telegramId || !Number.isInteger(rating)) return;
    const result = await saveTelegramRating(telegramId, rating);
    if (result === "saved") await ctx.reply("Спасибо, оценка записана.");
    if (result === "exists") await ctx.reply("Оценка уже записана.");
  });

  instance.callbackQuery(/^x:([A-Za-z0-9_-]{20,80})$/, async (ctx) => {
    const token = ctx.match[1] ?? "";
    try {
      const booking = await cancelBooking(token);
      await ctx.answerCallbackQuery({ text: "Запись отменена" });
      await ctx.editMessageText(["Запись отменена.", booking.barber.name].join("\n"));
    } catch (error) {
      const message = error instanceof HttpError ? error.message : "Не удалось отменить запись";
      await ctx.answerCallbackQuery({ text: message, show_alert: true });
    }
  });

  instance.catch((error) => {
    const text = error.message.replaceAll(token, "[token]");
    console.error("telegram bot", text);
  });

  return instance;
}

async function replyBookings(ctx: Context) {
  if (!ctx.chat) return;
  const telegramId = String(ctx.from?.id ?? ctx.chat.id);
  const client = await prisma.client.findUnique({ where: { telegramId } });
  if (!client) {
    await ctx.reply("Предстоящих записей нет.");
    return;
  }
  const rows = await prisma.booking.findMany({
    where: { clientId: client.id, status: "confirmed", startsAt: { gt: new Date() } },
    include: { services: true, barber: true, client: true },
    orderBy: { startsAt: "asc" },
    take: 8,
  });
  await ctx.reply(bookingsListText(rows));
}

export async function startPolling() {
  const current = getBot();
  if (!current || process.env.TELEGRAM_POLLING !== "1") return;
  await current.api.setMyCommands([
    { command: "start", description: "Начать" },
    { command: "bookings", description: "Мои записи" },
  ]);
  await current.start();
}

export function resetBot() {
  bot = null;
}
