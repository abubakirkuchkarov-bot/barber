import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db";

const idParams = z.object({
  id: z.string().trim().min(1).max(64),
});

export async function catalogRoutes(app: FastifyInstance) {
  app.get("/services", async () => {
    const rows = await prisma.service.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    });

    return {
      services: rows.map((service) => ({
        id: service.id,
        name: service.name,
        description: service.description,
        durationMin: service.durationMin,
        price: service.price,
      })),
    };
  });

  app.get("/barbers", async () => {
    const rows = await prisma.barber.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    });

    return { barbers: rows.map(toBarber) };
  });

  app.get("/barbers/:id", async (request, reply) => {
    const params = idParams.parse(request.params);
    const barber = await prisma.barber.findFirst({
      where: { id: params.id, isActive: true },
      include: {
        services: {
          where: { isEnabled: true, service: { isActive: true } },
          include: { service: true },
        },
      },
    });

    if (!barber) {
      return reply.status(404).send({ code: "NOT_FOUND", message: "Мастер не найден" });
    }

    const services = barber.services
      .slice()
      .sort((left, right) => left.service.sortOrder - right.service.sortOrder)
      .map((link) => ({
        id: link.service.id,
        name: link.service.name,
        description: link.service.description,
        durationMin: link.durationMin ?? link.service.durationMin,
        price: link.price ?? link.service.price,
      }));

    return { barber: { ...toBarber(barber), services } };
  });
}

function toBarber(barber: {
  id: string;
  name: string;
  bio: string | null;
  experienceYears: number;
  photoUrl: string | null;
}) {
  return {
    id: barber.id,
    name: barber.name,
    bio: barber.bio,
    experienceYears: barber.experienceYears,
    photoUrl: barber.photoUrl,
  };
}
