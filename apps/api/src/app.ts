import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import Fastify from "fastify";
import { registerErrorHandler } from "./errors";
import { adminRoutes } from "./routes/admin";
import { availabilityRoutes } from "./routes/availability";
import { bookingRoutes } from "./routes/bookings";
import { catalogRoutes } from "./routes/catalog";
import { meRoutes } from "./routes/me";
import { telegramDevRoutes } from "./routes/telegram-dev";
import { notificationRoutes } from "./routes/notifications";
import { telegramWebhookRoutes } from "./routes/telegram";

export async function buildApp() {
  const app = Fastify({ logger: true });
  const localOrigins = [
    "http://localhost:3000",
    "http://localhost:3010",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
  ];
  const fromEnv = (process.env.CORS_ORIGIN ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const origin = [...new Set([...fromEnv, ...localOrigins])];

  await app.register(cors, {
    origin,
    credentials: true,
    allowedHeaders: ["content-type", "authorization"],
  });
  await app.register(cookie);
  await app.register(multipart, { limits: { fileSize: 5 * 1024 * 1024, files: 1 } });
  registerErrorHandler(app);

  app.get("/health", async () => ({ ok: true }));
  await app.register(telegramWebhookRoutes);
  await app.register(notificationRoutes);
  await app.register(catalogRoutes, { prefix: "/api/v1" });
  await app.register(availabilityRoutes, { prefix: "/api/v1" });
  await app.register(bookingRoutes, { prefix: "/api/v1" });
  await app.register(meRoutes, { prefix: "/api/v1" });
  await app.register(adminRoutes, { prefix: "/api/v1" });
  if (process.env.TELEGRAM_DEV === "1" && process.env.NODE_ENV !== "production") {
    await app.register(telegramDevRoutes, { prefix: "/api/v1" });
  }

  return app;
}
