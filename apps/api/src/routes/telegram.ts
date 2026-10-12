import type { FastifyInstance } from "fastify";
import type { Update } from "grammy/types";
import { getBot } from "../bot/bot";

export async function telegramWebhookRoutes(app: FastifyInstance) {
  app.post("/telegram/webhook", async (request, reply) => {
    const bot = getBot();
    if (!bot) return reply.status(503).send({ ok: false });

    const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
    if (secret && request.headers["x-telegram-bot-api-secret-token"] !== secret) {
      return reply.status(401).send({ ok: false });
    }

    try {
      await bot.handleUpdate(request.body as Update);
    } catch (error) {
      const token = process.env.TELEGRAM_BOT_TOKEN ?? "";
      const message = error instanceof Error ? error.message.replaceAll(token, "[token]") : "webhook failed";
      request.log.error({ message }, "telegram webhook");
    }
    return { ok: true };
  });
}
