import { config } from "dotenv";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import test from "node:test";
import { HttpError } from "./http-error";

config({ path: resolve(process.cwd(), "../../.env") });

const PHONE = "+998 90 000 00 01";

test("две одновременные записи в один слот: одна создаётся, вторая получает SLOT_TAKEN", async () => {
  const { prisma } = await import("./db");
  const { createBooking, isExclusionViolation } = await import("./bookings");
  const { slotsOnDate } = await import("./schedule");
  const { addDays, zonedParts } = await import("./time");

  await cleanup(prisma);
  const createdIds: string[] = [];

  try {
    const rules = await prisma.setting.findUnique({ where: { key: "timezone" } });
    const timeZone = rules?.value || "Asia/Tashkent";
    const today = zonedParts(new Date(), timeZone).iso;
    const date = addDays(today, 18);
    const slots = await slotsOnDate(["kids"], "sardor", date);
    assert.ok(slots.length > 0, "у Сардора есть окно для теста");
    const time = slots[slots.length - 1];
    const [hour, minute] = time.split(":").map(Number);
    const startsAt = new Date(`${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+05:00`);
    const input = {
      serviceIds: ["kids"],
      barberId: "sardor",
      startsAt,
      client: { name: "Тест Гонка", phone: PHONE },
    };

    const [left, right] = await Promise.allSettled([createBooking(input), createBooking(input)]);
    const fulfilled = [left, right].filter((item) => item.status === "fulfilled");
    const rejected = [left, right].filter((item) => item.status === "rejected");
    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 1);
    const failure = rejected[0].status === "rejected" ? rejected[0].reason : null;
    assert.ok(failure instanceof HttpError);
    assert.equal(failure.status, 409);
    assert.equal(failure.code, "SLOT_TAKEN");
    if (fulfilled[0].status === "fulfilled") createdIds.push(fulfilled[0].value.id);

    const winner = fulfilled[0].status === "fulfilled" ? fulfilled[0].value : null;
    assert.ok(winner);
    const client = await prisma.client.create({ data: { name: "Тест Гонка", phone: PHONE } });
    let violation = false;
    let detail = "";
    try {
      await prisma.booking.create({
        data: {
          clientId: client.id,
          barberId: "sardor",
          startsAt: new Date(winner.startsAt),
          endsAt: new Date(winner.endsAt),
          totalPrice: winner.totalPrice,
          totalDurationMin: winner.totalDurationMin,
          status: "confirmed",
          source: "web",
          manageToken: randomBytes(24).toString("base64url"),
          services: {
            create: {
              serviceId: "kids",
              name: "Детская стрижка",
              durationMin: winner.totalDurationMin,
              price: winner.totalPrice,
            },
          },
        },
      });
    } catch (error) {
      violation = isExclusionViolation(error);
      detail = error instanceof Error ? error.message : String(error);
    }
    assert.equal(violation, true, detail);

    await prisma.booking.update({ where: { id: winner.id }, data: { status: "cancelled" } });
    const again = await createBooking(input);
    createdIds.push(again.id);
    assert.equal(again.barber.id, "sardor");
  } finally {
    await cleanup(prisma);
    await prisma.$disconnect();
  }
});

async function cleanup(prisma: {
  bookingService: { deleteMany: (args: { where: { booking: { client: { phone: string } } } }) => Promise<unknown> };
  booking: { deleteMany: (args: { where: { client: { phone: string } } }) => Promise<unknown> };
  client: { deleteMany: (args: { where: { phone: string } }) => Promise<unknown> };
}) {
  await prisma.bookingService.deleteMany({ where: { booking: { client: { phone: PHONE } } } });
  await prisma.booking.deleteMany({ where: { client: { phone: PHONE } } });
  await prisma.client.deleteMany({ where: { phone: PHONE } });
}
