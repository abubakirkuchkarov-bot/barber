import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { cancelBooking, createBooking, getBooking, rescheduleBooking } from "../bookings";
import { HttpError } from "../http-error";
import { readTelegramUser } from "../telegram-auth";

const tokenParams = z.object({
  token: z.string().trim().regex(/^[A-Za-z0-9_-]{20,80}$/),
});

const instant = z.string().trim().refine((value) => {
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.getUTCSeconds() === 0 && date.getUTCMilliseconds() === 0;
}, "Некорректное время");

const createBody = z.object({
  serviceIds: z.array(z.string().trim().min(1).max(64)).min(1).max(8),
  barberId: z.string().trim().min(1).max(64),
  startsAt: instant,
  client: z.object({
    name: z
      .string()
      .trim()
      .min(2)
      .max(80)
      .regex(/^[\p{L}][\p{L}\s'-]+$/u),
    phone: z.string().trim().min(9).max(24),
  }),
});

function normalizePhone(raw: string) {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("998") && digits.length === 12) digits = digits.slice(3);
  if (!/^\d{9}$/.test(digits)) return null;
  return `+998 ${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 7)} ${digits.slice(7)}`;
}

export async function bookingRoutes(app: FastifyInstance) {
  app.post("/bookings", async (request, reply) => {
    const body = createBody.parse(request.body);
    const phone = normalizePhone(body.client.phone);
    if (!phone) throw new HttpError(400, "VALIDATION", "Нужен номер из 9 цифр");
    const telegram = readTelegramUser(request, false);
    const booking = await createBooking({
      serviceIds: body.serviceIds,
      barberId: body.barberId,
      startsAt: new Date(body.startsAt),
      client: { name: body.client.name.trim(), phone },
      telegramId: telegram?.id,
    });
    return reply.status(201).send({ booking });
  });

  app.get("/bookings/:token", async (request) => {
    const params = tokenParams.parse(request.params);
    return { booking: await getBooking(params.token) };
  });

  app.post("/bookings/:token/cancel", async (request) => {
    const params = tokenParams.parse(request.params);
    return { booking: await cancelBooking(params.token) };
  });

  app.post("/bookings/:token/reschedule", async (request) => {
    const params = tokenParams.parse(request.params);
    const body = z.object({ startsAt: instant }).parse(request.body);
    return { booking: await rescheduleBooking(params.token, new Date(body.startsAt)) };
  });
}
