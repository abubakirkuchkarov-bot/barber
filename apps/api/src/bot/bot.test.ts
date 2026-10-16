import assert from "node:assert/strict";
import test from "node:test";
import { barberNotice, clientNotice, formatWhen } from "./messages";
import { barberStartPayload, bookingStartPayload, parseStartPayload, telegramBotUrl } from "./payload";
import { resetBot } from "./bot";
import { buildApp } from "../create-app";

const visit = {
  startsAt: new Date("2026-10-10T06:00:00.000Z"),
  totalDurationMin: 45,
  client: { name: "Тимур Тест", phone: "+998 90 111 22 33" },
  barber: { name: "Азиз Каримов" },
  services: [{ name: "Мужская стрижка" }],
};

test("deep link разбирает запись и привязку мастера", () => {
  const token = "a".repeat(24);
  const code = "b".repeat(24);
  assert.deepEqual(parseStartPayload(undefined), { type: "plain" });
  assert.deepEqual(parseStartPayload(bookingStartPayload(token)), { type: "booking", token });
  assert.deepEqual(parseStartPayload(barberStartPayload(code)), { type: "barber", code });
  assert.deepEqual(parseStartPayload("b_short"), { type: "plain" });
  assert.deepEqual(parseStartPayload("hello"), { type: "plain" });
  const previous = process.env.TELEGRAM_BOT_USERNAME;
  process.env.TELEGRAM_BOT_USERNAME = "@KromkaBot";
  assert.equal(telegramBotUrl(bookingStartPayload(token)), `https://t.me/KromkaBot?start=b_${token}`);
  process.env.TELEGRAM_BOT_USERNAME = "";
  assert.equal(telegramBotUrl(token), null);
  if (previous === undefined) delete process.env.TELEGRAM_BOT_USERNAME;
  else process.env.TELEGRAM_BOT_USERNAME = previous;
});

test("сообщения о записи называют услугу, мастера и время Ташкента", () => {
  assert.equal(formatWhen(visit.startsAt), "суббота, 10 октября, 11:00");
  const created = clientNotice("created", visit);
  assert.match(created, /Вы записаны/);
  assert.match(created, /Мужская стрижка, 45 мин/);
  assert.match(created, /Азиз Каримов/);
  assert.match(created, /11:00/);
  assert.match(clientNotice("cancelled", visit), /Запись отменена/);
  assert.match(clientNotice("moved", visit), /Время записи изменено/);
  const forBarber = barberNotice(visit);
  assert.match(forBarber, /Новая запись/);
  assert.match(forBarber, /Тимур Тест/);
  assert.match(forBarber, /\+998 90 111 22 33/);
});

test("webhook без токена отвечает 503 и не принимает чужой секрет", async () => {
  const previousToken = process.env.TELEGRAM_BOT_TOKEN;
  const previousSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  process.env.TELEGRAM_BOT_TOKEN = "";
  delete process.env.TELEGRAM_WEBHOOK_SECRET;
  resetBot();
  const closed = await buildApp();
  const missing = await closed.inject({ method: "POST", url: "/telegram/webhook", payload: {} });
  assert.equal(missing.statusCode, 503);
  await closed.close();

  process.env.TELEGRAM_BOT_TOKEN = "8000000001:local";
  process.env.TELEGRAM_WEBHOOK_SECRET = "sekret";
  resetBot();
  const guarded = await buildApp();
  const rejected = await guarded.inject({
    method: "POST",
    url: "/telegram/webhook",
    headers: { "x-telegram-bot-api-secret-token": "other" },
    payload: { update_id: 1 },
  });
  assert.equal(rejected.statusCode, 401);
  await guarded.close();

  if (previousToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
  else process.env.TELEGRAM_BOT_TOKEN = previousToken;
  if (previousSecret === undefined) delete process.env.TELEGRAM_WEBHOOK_SECRET;
  else process.env.TELEGRAM_WEBHOOK_SECRET = previousSecret;
  resetBot();
});
