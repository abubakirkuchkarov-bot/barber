import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { issueBarberLink } from "../bot/link";
import { HttpError } from "../http-error";
import { signInitData } from "../telegram";

export async function telegramDevRoutes(app: FastifyInstance) {
  app.get("/telegram/dev-session", async () => {
    const botToken = process.env.TELEGRAM_BOT_TOKEN ?? "";
    if (!botToken) throw new HttpError(503, "TELEGRAM_NOT_CONFIGURED", "Telegram не настроен");
    const user = JSON.stringify({
      id: 900001,
      first_name: "Тимур",
      last_name: "Тест",
      username: "kromka_dev",
      language_code: "ru",
    });
    const initData = signInitData(
      {
        auth_date: String(Math.floor(Date.now() / 1000)),
        query_id: "dev",
        user,
      },
      botToken,
    );
    return { initData };
  });

  app.post("/telegram/barber-links", async (request) => {
    const body = z.object({ barberId: z.string().trim().min(1).max(64) }).parse(request.body);
    return { link: await issueBarberLink(body.barberId) };
  });
}
