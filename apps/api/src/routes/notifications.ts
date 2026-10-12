import type { FastifyInstance } from "fastify";
import { prisma } from "../db";
import { getBot } from "../bot/bot";
import { cronAuth } from "../notifications/auth";
import { runNotifications, type SqlQuery } from "../notifications/run";

const query: SqlQuery = (text, params) => prisma.$queryRawUnsafe(text, ...params);

export async function notificationRoutes(app: FastifyInstance) {
  app.post("/internal/notifications", async (request, reply) => {
    const header = request.headers.authorization;
    const verdict = cronAuth(typeof header === "string" ? header : undefined, process.env.CRON_SECRET);
    if (verdict === "unconfigured") return reply.status(503).send({ ok: false });
    if (verdict === "forbidden") return reply.status(401).send({ ok: false });

    const report = await runNotifications(query, async (message) => {
      const bot = getBot();
      if (!bot) throw new Error("telegram is not configured");
      await bot.api.sendMessage(message.chatId, message.text);
    });
    return { ok: true, ...report };
  });
}
