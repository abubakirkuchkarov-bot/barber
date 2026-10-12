import argon2 from "argon2";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { HttpError } from "../http-error";
import { clockMinutes, formatMinutes, localDayBounds, zonedParts } from "../time";
import { ADMIN_COOKIE, readSession, SESSION_MS, signSession } from "../admin/session";
import { loginBlocked, loginFailed } from "../admin/limit";
import { storeImage } from "../admin/storage";
import { adminCreateBooking, adminPatchBooking, issueBarberLink } from "../admin/bookings";
import { registerAnalytics } from "./analytics";

const slug = z
  .string()
  .trim()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(32);
const clock = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/);
const instant = z.string().trim().refine((value) => !Number.isNaN(new Date(value).getTime()));

const loginBody = z.object({
  login: z.string().trim().min(2).max(40),
  password: z.string().min(8).max(80),
});

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

async function requireAdmin(request: FastifyRequest) {
  const session = readSession(request.cookies[ADMIN_COOKIE]);
  if (!session) throw new HttpError(401, "UNAUTHORIZED", "Нужен вход");
  const admin = await prisma.adminUser.findUnique({ where: { id: session.sub } });
  if (!admin) throw new HttpError(401, "UNAUTHORIZED", "Нужен вход");
}

function normalizePhone(raw: string) {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("998") && digits.length === 12) digits = digits.slice(3);
  if (!/^\d{9}$/.test(digits)) return null;
  return `+998 ${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 7)} ${digits.slice(7)}`;
}

function clockDate(value: string) {
  return new Date(`1970-01-01T${value}:00.000Z`);
}

function showClock(value: Date) {
  return formatMinutes(clockMinutes(value));
}

function isForeignKey(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2003" || error.code === "P2014");
}

const SETTING_KEYS = [
  "cancel_cutoff_min",
  "slot_step_min",
  "booking_horizon_days",
  "min_notice_min",
  "reminder_day_minutes",
  "reminder_short_minutes",
  "review_delay_min",
  "timezone",
  "review_public_min_rating",
] as const;

export async function adminRoutes(app: FastifyInstance) {
  const guard = { preHandler: requireAdmin };
  registerAnalytics(app, guard);

  app.post("/admin/login", async (request, reply) => {
    if (!process.env.SESSION_SECRET?.trim()) {
      throw new HttpError(503, "SESSION_NOT_CONFIGURED", "Сессия не настроена");
    }
    if (loginBlocked(request.ip)) throw new HttpError(429, "RATE_LIMIT", "Слишком много попыток. Подождите");
    const body = loginBody.parse(request.body);
    const admin = await prisma.adminUser.findUnique({ where: { login: body.login } });
    let ok = false;
    if (admin) {
      try {
        ok = await argon2.verify(admin.passwordHash, body.password);
      } catch {
        ok = false;
      }
    }
    if (!admin || !ok) {
      loginFailed(request.ip);
      throw new HttpError(401, "UNAUTHORIZED", "Неверный логин или пароль");
    }
    const token = signSession(admin.id, Date.now() + SESSION_MS);
    if (!token) throw new HttpError(503, "SESSION_NOT_CONFIGURED", "Сессия не настроена");
    reply.setCookie(ADMIN_COOKIE, token, cookieOptions(SESSION_MS / 1000));
    return { login: admin.login };
  });

  app.post("/admin/logout", async (_request, reply) => {
    reply.clearCookie(ADMIN_COOKIE, { path: "/" });
    return { ok: true };
  });

  app.get("/admin/me", guard, async (request) => {
    const session = readSession(request.cookies[ADMIN_COOKIE]);
    const admin = session ? await prisma.adminUser.findUnique({ where: { id: session.sub } }) : null;
    return { login: admin?.login ?? "" };
  });

  app.get("/admin/bookings", guard, async (request) => {
    const query = z
      .object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() })
      .parse(request.query);
    const rules = await prisma.setting.findUnique({ where: { key: "timezone" } });
    const timeZone = rules?.value || "Asia/Tashkent";
    const date = query.date ?? zonedParts(new Date(), timeZone).iso;
    const bounds = localDayBounds(date, timeZone);
    const rows = await prisma.booking.findMany({
      where: { startsAt: { gte: bounds.start, lt: bounds.end } },
      include: { barber: true, services: true, client: true },
      orderBy: { startsAt: "asc" },
    });
    return {
      date,
      bookings: rows.map((row) => ({
        id: row.id,
        status: row.status,
        startsAt: row.startsAt.toISOString(),
        endsAt: row.endsAt.toISOString(),
        totalPrice: row.totalPrice,
        totalDurationMin: row.totalDurationMin,
        source: row.source,
        barber: { id: row.barber.id, name: row.barber.name },
        services: row.services.map((service) => ({ id: service.serviceId, name: service.name })),
        client: { name: row.client.name, phone: row.client.phone },
      })),
    };
  });

  app.post("/admin/bookings", guard, async (request, reply) => {
    const body = z
      .object({
        serviceIds: z.array(z.string().trim().min(1)).min(1).max(8),
        barberId: z.string().trim().min(1),
        startsAt: instant,
        client: z.object({
          name: z.string().trim().min(2).max(80),
          phone: z.string().trim().min(9).max(24),
        }),
      })
      .parse(request.body);
    const phone = normalizePhone(body.client.phone);
    if (!phone) throw new HttpError(400, "VALIDATION", "Телефон нужен в формате +998");
    const booking = await adminCreateBooking({
      serviceIds: body.serviceIds,
      barberId: body.barberId,
      startsAt: new Date(body.startsAt),
      client: { name: body.client.name, phone },
    });
    return reply.status(201).send({ booking });
  });

  app.patch("/admin/bookings/:id", guard, async (request) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = z
      .object({
        status: z.enum(["confirmed", "completed", "cancelled", "no_show"]).optional(),
        startsAt: instant.optional(),
        barberId: z.string().trim().min(1).optional(),
      })
      .parse(request.body);
    const { booking } = await adminPatchBooking(params.id, {
      status: body.status,
      startsAt: body.startsAt ? new Date(body.startsAt) : undefined,
      barberId: body.barberId,
    });
    return {
      booking: {
        id: booking.id,
        status: booking.status,
        startsAt: booking.startsAt.toISOString(),
        endsAt: booking.endsAt.toISOString(),
        barber: { id: booking.barber.id, name: booking.barber.name },
      },
    };
  });

  app.get("/admin/services", guard, async () => {
    const rows = await prisma.service.findMany({ orderBy: { sortOrder: "asc" } });
    return { services: rows };
  });

  app.post("/admin/services", guard, async (request, reply) => {
    const body = serviceBody.parse(request.body);
    const row = await prisma.service.create({ data: { ...body, id: body.id } });
    return reply.status(201).send({ service: row });
  });

  app.patch("/admin/services/:id", guard, async (request) => {
    const params = z.object({ id: slug }).parse(request.params);
    const body = serviceBody.partial().omit({ id: true }).parse(request.body);
    try {
      const service = await prisma.service.update({ where: { id: params.id }, data: body });
      return { service };
    } catch {
      throw new HttpError(404, "NOT_FOUND", "Услуга не найдена");
    }
  });

  app.delete("/admin/services/:id", guard, async (request) => {
    const params = z.object({ id: slug }).parse(request.params);
    try {
      await prisma.service.delete({ where: { id: params.id } });
      return { ok: true, retired: false };
    } catch (error) {
      if (!isForeignKey(error)) throw new HttpError(404, "NOT_FOUND", "Услуга не найдена");
      const service = await prisma.service.update({ where: { id: params.id }, data: { isActive: false } });
      return { ok: true, retired: true, service };
    }
  });

  app.get("/admin/barbers", guard, async () => {
    const rows = await prisma.barber.findMany({ orderBy: { sortOrder: "asc" } });
    return {
      barbers: rows.map((row) => ({
        id: row.id,
        name: row.name,
        bio: row.bio,
        experienceYears: row.experienceYears,
        photoUrl: row.photoUrl,
        isActive: row.isActive,
        sortOrder: row.sortOrder,
        telegramLinked: Boolean(row.telegramChatId),
      })),
    };
  });

  app.get("/admin/barbers/:id", guard, async (request) => {
    const params = z.object({ id: slug }).parse(request.params);
    const barber = await prisma.barber.findUnique({
      where: { id: params.id },
      include: {
        services: true,
        workingHours: { orderBy: { weekday: "asc" } },
        breaks: { orderBy: { weekday: "asc" } },
        portfolio: { orderBy: { sortOrder: "asc" } },
        timeOff: { where: { endsAt: { gt: new Date() } }, orderBy: { startsAt: "asc" } },
      },
    });
    if (!barber) throw new HttpError(404, "NOT_FOUND", "Мастер не найден");
    return {
      barber: {
        id: barber.id,
        name: barber.name,
        bio: barber.bio,
        experienceYears: barber.experienceYears,
        photoUrl: barber.photoUrl,
        isActive: barber.isActive,
        sortOrder: barber.sortOrder,
        telegramLinked: Boolean(barber.telegramChatId),
        serviceIds: barber.services.filter((item) => item.isEnabled).map((item) => item.serviceId),
        hours: barber.workingHours.map((item) => ({
          weekday: item.weekday,
          start: showClock(item.startTime),
          end: showClock(item.endTime),
        })),
        breaks: barber.breaks.map((item) => ({
          weekday: item.weekday,
          start: showClock(item.startTime),
          end: showClock(item.endTime),
        })),
        portfolio: barber.portfolio.map((item) => ({ id: item.id, imageUrl: item.imageUrl })),
        timeOff: barber.timeOff.map(presentTimeOff),
      },
    };
  });

  app.post("/admin/barbers", guard, async (request, reply) => {
    const body = barberBody.parse(request.body);
    const barber = await prisma.barber.create({
      data: {
        id: body.id,
        name: body.name,
        bio: body.bio ?? null,
        experienceYears: body.experienceYears,
        photoUrl: body.photoUrl || null,
        sortOrder: body.sortOrder,
        isActive: body.isActive,
        services: { create: body.serviceIds.map((serviceId) => ({ serviceId, isEnabled: true })) },
      },
    });
    return reply.status(201).send({ barber: { id: barber.id, name: barber.name } });
  });

  app.patch("/admin/barbers/:id", guard, async (request) => {
    const params = z.object({ id: slug }).parse(request.params);
    const body = barberBody.partial().omit({ id: true }).parse(request.body);
    const { serviceIds, ...data } = body;
    try {
      await prisma.barber.update({
        where: { id: params.id },
        data: {
          ...data,
          photoUrl: data.photoUrl === "" ? null : data.photoUrl,
          bio: data.bio,
        },
      });
    } catch {
      throw new HttpError(404, "NOT_FOUND", "Мастер не найден");
    }
    if (serviceIds !== undefined) {
      await prisma.barberService.deleteMany({ where: { barberId: params.id } });
      if (serviceIds.length) {
        await prisma.barberService.createMany({
          data: serviceIds.map((serviceId) => ({ barberId: params.id, serviceId, isEnabled: true })),
        });
      }
    }
    return { ok: true };
  });

  app.delete("/admin/barbers/:id", guard, async (request) => {
    const params = z.object({ id: slug }).parse(request.params);
    try {
      await prisma.barber.delete({ where: { id: params.id } });
      return { ok: true, retired: false };
    } catch (error) {
      if (!isForeignKey(error)) throw new HttpError(404, "NOT_FOUND", "Мастер не найден");
      await prisma.barber.update({ where: { id: params.id }, data: { isActive: false } });
      return { ok: true, retired: true };
    }
  });

  app.put("/admin/barbers/:id/schedule", guard, async (request) => {
    const params = z.object({ id: slug }).parse(request.params);
    const body = z
      .object({
        hours: z.array(span).max(21),
        breaks: z.array(span).max(21),
      })
      .parse(request.body);
    const barber = await prisma.barber.findUnique({ where: { id: params.id } });
    if (!barber) throw new HttpError(404, "NOT_FOUND", "Мастер не найден");
    for (const item of body.breaks) {
      const fits = body.hours.some(
        (hour) => hour.weekday === item.weekday && hour.start <= item.start && hour.end >= item.end,
      );
      if (!fits) throw new HttpError(422, "OUTSIDE_WORKING_HOURS", "Обед должен попадать в рабочий день");
    }
    await prisma.$transaction([
      prisma.workingHour.deleteMany({ where: { barberId: params.id } }),
      prisma.break.deleteMany({ where: { barberId: params.id } }),
      prisma.workingHour.createMany({
        data: body.hours.map((item) => ({
          barberId: params.id,
          weekday: item.weekday,
          startTime: clockDate(item.start),
          endTime: clockDate(item.end),
        })),
      }),
      prisma.break.createMany({
        data: body.breaks.map((item) => ({
          barberId: params.id,
          weekday: item.weekday,
          startTime: clockDate(item.start),
          endTime: clockDate(item.end),
        })),
      }),
    ]);
    return { ok: true };
  });

  app.post("/admin/barbers/:id/telegram-link", guard, async (request) => {
    const params = z.object({ id: slug }).parse(request.params);
    return { link: await issueBarberLink(params.id) };
  });

  app.post("/admin/barbers/:id/portfolio", guard, async (request, reply) => {
    const params = z.object({ id: slug }).parse(request.params);
    const body = z.object({ imageUrl: z.string().trim().url().max(500) }).parse(request.body);
    const last = await prisma.portfolioItem.aggregate({ where: { barberId: params.id }, _max: { sortOrder: true } });
    const item = await prisma.portfolioItem.create({
      data: { barberId: params.id, imageUrl: body.imageUrl, sortOrder: (last._max.sortOrder ?? 0) + 1 },
    });
    return reply.status(201).send({ item: { id: item.id, imageUrl: item.imageUrl } });
  });

  app.delete("/admin/portfolio/:id", guard, async (request) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    await prisma.portfolioItem.delete({ where: { id: params.id } }).catch(() => {
      throw new HttpError(404, "NOT_FOUND", "Снимок не найден");
    });
    return { ok: true };
  });

  app.get("/admin/time-off", guard, async (request) => {
    const query = z.object({ barberId: z.string().trim().optional() }).parse(request.query);
    const rows = await prisma.timeOff.findMany({
      where:
        query.barberId === "shop"
          ? { barberId: null, endsAt: { gt: new Date() } }
          : query.barberId
            ? { barberId: query.barberId, endsAt: { gt: new Date() } }
            : { endsAt: { gt: new Date() } },
      orderBy: { startsAt: "asc" },
      include: { barber: true },
    });
    return { timeOff: rows.map(presentTimeOff) };
  });

  app.post("/admin/time-off", guard, async (request, reply) => {
    const body = timeOffBody.parse(request.body);
    if (new Date(body.endsAt) <= new Date(body.startsAt)) {
      throw new HttpError(400, "VALIDATION", "Конец должен быть позже начала");
    }
    const row = await prisma.timeOff.create({
      data: {
        barberId: body.barberId ?? null,
        startsAt: new Date(body.startsAt),
        endsAt: new Date(body.endsAt),
        type: body.type,
        note: body.note ?? null,
      },
      include: { barber: true },
    });
    return reply.status(201).send({ timeOff: presentTimeOff(row) });
  });

  app.delete("/admin/time-off/:id", guard, async (request) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    await prisma.timeOff.delete({ where: { id: params.id } }).catch(() => {
      throw new HttpError(404, "NOT_FOUND", "Исключение не найдено");
    });
    return { ok: true };
  });

  app.get("/admin/reviews", guard, async () => {
    const rows = await prisma.review.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { barber: true, client: true },
    });
    return {
      reviews: rows.map((row) => ({
        id: row.id,
        rating: row.rating,
        comment: row.comment,
        isPublic: row.isPublic,
        createdAt: row.createdAt.toISOString(),
        barber: row.barber.name,
        client: row.client.name,
      })),
    };
  });

  app.patch("/admin/reviews/:id", guard, async (request) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = z.object({ isPublic: z.boolean() }).parse(request.body);
    try {
      const review = await prisma.review.update({ where: { id: params.id }, data: { isPublic: body.isPublic } });
      return { review: { id: review.id, isPublic: review.isPublic } };
    } catch {
      throw new HttpError(404, "NOT_FOUND", "Отзыв не найден");
    }
  });

  app.get("/admin/settings", guard, async () => {
    const rows = await prisma.setting.findMany({ where: { key: { in: [...SETTING_KEYS] } } });
    return { settings: Object.fromEntries(rows.map((row) => [row.key, row.value])) };
  });

  app.put("/admin/settings", guard, async (request) => {
    const body = z.object({ settings: z.record(z.string(), z.string().trim().min(1).max(80)) }).parse(request.body);
    for (const [key, value] of Object.entries(body.settings)) {
      if (!SETTING_KEYS.includes(key as (typeof SETTING_KEYS)[number])) {
        throw new HttpError(400, "VALIDATION", "Неизвестная настройка");
      }
      if (key === "timezone") {
        try {
          Intl.DateTimeFormat("ru-RU", { timeZone: value });
        } catch {
          throw new HttpError(400, "VALIDATION", "Неизвестный часовой пояс");
        }
      } else if (!/^\d+$/.test(value) || Number(value) <= 0 || Number(value) > 10080) {
        throw new HttpError(400, "VALIDATION", "Значение должно быть целым числом");
      }
      await prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
    }
    return { ok: true };
  });

  app.post("/admin/uploads", guard, async (request) => {
    const file = await request.file();
    if (!file) throw new HttpError(400, "VALIDATION", "Нужен файл");
    const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
    if (!allowed.has(file.mimetype)) throw new HttpError(400, "VALIDATION", "Нужна фотография JPEG, PNG или WebP");
    const bytes = await file.toBuffer();
    try {
      const url = await storeImage(bytes, file.mimetype, "desk");
      if (!url) throw new HttpError(503, "STORAGE_NOT_CONFIGURED", "Хранилище фото не настроено");
      return { url };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      request.log.error({ message: error instanceof Error ? error.message : "upload failed" }, "admin upload");
      throw new HttpError(502, "STORAGE_FAILED", "Фото не сохранилось");
    }
  });
}

const serviceBody = z.object({
  id: slug,
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().min(2).max(400),
  durationMin: z.number().int().min(5).max(480),
  price: z.number().int().min(0).max(10_000_000),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(999).default(0),
});

const barberBody = z.object({
  id: slug,
  name: z.string().trim().min(2).max(80),
  bio: z.string().trim().max(400).optional(),
  experienceYears: z.number().int().min(0).max(60),
  photoUrl: z.string().trim().max(500).optional(),
  sortOrder: z.number().int().min(0).max(999).default(0),
  isActive: z.boolean().default(true),
  serviceIds: z.array(slug).max(20),
});

const span = z
  .object({
    weekday: z.number().int().min(0).max(6),
    start: clock,
    end: clock,
  })
  .refine((item) => item.start < item.end, "Конец раньше начала");

const timeOffBody = z.object({
  barberId: slug.nullable().optional(),
  startsAt: instant,
  endsAt: instant,
  type: z.enum(["day_off", "vacation", "closed"]),
  note: z.string().trim().max(200).optional(),
});

function presentTimeOff(row: {
  id: string;
  barberId: string | null;
  startsAt: Date;
  endsAt: Date;
  type: string;
  note: string | null;
  barber?: { name: string } | null;
}) {
  return {
    id: row.id,
    barberId: row.barberId,
    barberName: row.barber?.name ?? null,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    type: row.type,
    note: row.note,
  };
}
