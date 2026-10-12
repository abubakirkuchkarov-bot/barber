import type { FastifyInstance } from "fastify";
import { prisma } from "../db";
import { listTelegramBookings } from "../bookings";
import { readTelegramUser } from "../telegram-auth";

export async function meRoutes(app: FastifyInstance) {
  app.get("/me", async (request) => {
    const user = readTelegramUser(request, true);
    const client = user
      ? await prisma.client.findUnique({
          where: { telegramId: user.id },
          select: { name: true, phone: true },
        })
      : null;
    return {
      user: user ? { id: user.id, name: user.name, username: user.username } : null,
      client,
    };
  });

  app.get("/me/bookings", async (request) => {
    const user = readTelegramUser(request, true);
    return { bookings: user ? await listTelegramBookings(user.id) : [] };
  });
}
