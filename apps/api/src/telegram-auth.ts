import type { FastifyRequest } from "fastify";
import { HttpError } from "./http-error";
import { verifyInitData, type TelegramUser } from "./telegram";

function initDataFrom(request: FastifyRequest) {
  const header = request.headers.authorization;
  if (!header) return null;
  if (!header.startsWith("tma ")) {
    throw new HttpError(401, "UNAUTHORIZED", "Откройте приложение в Telegram");
  }
  return header.slice(4).trim();
}

export function readTelegramUser(request: FastifyRequest, required: boolean): TelegramUser | null {
  const initData = initDataFrom(request);
  if (!initData) {
    if (required) throw new HttpError(401, "UNAUTHORIZED", "Откройте приложение в Telegram");
    return null;
  }
  const botToken = process.env.TELEGRAM_BOT_TOKEN ?? "";
  if (!botToken) throw new HttpError(503, "TELEGRAM_NOT_CONFIGURED", "Telegram не настроен");
  const user = verifyInitData(initData, botToken);
  if (!user) throw new HttpError(401, "UNAUTHORIZED", "Сессия Telegram недействительна");
  return user;
}
