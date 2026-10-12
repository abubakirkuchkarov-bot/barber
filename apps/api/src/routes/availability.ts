import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { HttpError } from "../http-error";
import { daysOpen, slotsOnDate } from "../schedule";
import { isRealDate } from "../time";

const queryBase = z.object({
  serviceIds: z.string().trim().min(1),
  barberId: z.string().trim().min(1).max(64),
});

function serviceIdsFrom(value: string) {
  const ids = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (ids.length === 0 || ids.length > 8 || ids.some((id) => id.length > 64)) {
    throw new HttpError(400, "VALIDATION", "Некорректный запрос");
  }
  return ids;
}

export async function availabilityRoutes(app: FastifyInstance) {
  app.get("/availability", async (request) => {
    const query = queryBase
      .extend({ date: z.string().trim() })
      .parse(request.query);
    if (!isRealDate(query.date)) throw new HttpError(400, "VALIDATION", "Некорректный запрос");
    const slots = await slotsOnDate(serviceIdsFrom(query.serviceIds), query.barberId, query.date);
    return { slots };
  });

  app.get("/availability/days", async (request) => {
    const query = queryBase.parse(request.query);
    const days = await daysOpen(serviceIdsFrom(query.serviceIds), query.barberId);
    return { days };
  });
}
