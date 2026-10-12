import { config } from "dotenv";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import test from "node:test";

config({ path: resolve(process.cwd(), "../../.env") });

const day = "2027-06-03";

test("сводка за 3 июня 2027 совпадает с пятью визитами", async () => {
  const { prisma } = await import("./db");
  const { loadAnalytics, readPeriod } = await import("./analytics/query");
  const stamp = randomBytes(3).toString("hex");
  const clients = await Promise.all(
    ["a", "b", "c", "d", "e"].map((mark, index) =>
      prisma.client.create({
        data: { name: `Сводка ${mark}`, phone: `+998 90 700 0${index} ${stamp.slice(0, 2)}` },
      }),
    ),
  );
  const [clientA, clientB, clientC, clientD, clientE] = clients;
  const ids: string[] = [];

  const book = async (
    clientId: string,
    barberId: string,
    hour: number,
    status: "completed" | "cancelled" | "no_show",
    service: { id: string; name: string; durationMin: number; price: number },
    date = day,
  ) => {
    const startsAt = new Date(`${date}T${String(hour).padStart(2, "0")}:00:00+05:00`);
    const row = await prisma.booking.create({
      data: {
        clientId,
        barberId,
        startsAt,
        endsAt: new Date(startsAt.getTime() + service.durationMin * 60_000),
        totalPrice: service.price,
        totalDurationMin: service.durationMin,
        status,
        source: "admin",
        manageToken: randomBytes(24).toString("base64url"),
        services: { create: [{ serviceId: service.id, name: service.name, durationMin: service.durationMin, price: service.price }] },
      },
    });
    ids.push(row.id);
  };

  const haircut = { id: "haircut", name: "Мужская стрижка", durationMin: 45, price: 120_000 };
  const beard = { id: "beard", name: "Борода", durationMin: 30, price: 80_000 };

  try {
    await book(clientA.id, "aziz", 11, "completed", haircut);
    await book(clientA.id, "aziz", 15, "completed", haircut);
    await book(clientB.id, "aziz", 16, "cancelled", haircut);
    await book(clientC.id, "aziz", 17, "no_show", beard);
    await book(clientD.id, "timur", 12, "completed", haircut);
    await book(clientE.id, "aziz", 11, "completed", haircut, "2027-06-04");

    const report = await loadAnalytics(await readPeriod({ from: day, to: day }));
    assert.equal(report.revenue.total, 360_000);
    assert.equal(report.revenue.completed, 3);
    assert.equal(report.revenue.bookings, 5);
    assert.deepEqual(
      report.services.map((item) => [item.id, item.count, item.revenue]),
      [
        ["haircut", 3, 360_000],
        ["beard", 1, 0],
      ],
    );
    const aziz = report.load.find((item) => item.id === "aziz");
    const timur = report.load.find((item) => item.id === "timur");
    assert.equal(aziz?.openMin, 600);
    assert.equal(aziz?.bookedMin, 120);
    assert.equal(aziz?.visits, 3);
    assert.equal(aziz?.load, 0.2);
    assert.equal(timur?.openMin, 600);
    assert.equal(timur?.bookedMin, 45);
    assert.equal(timur?.load, 0.075);
    assert.equal(report.cancellations.cancelled, 1);
    assert.equal(report.cancellations.noShow, 1);
    assert.equal(report.cancellations.cancelRate, 0.2);
    assert.equal(report.cancellations.noShowRate, 0.2);
    assert.deepEqual(report.retention, { clients: 2, returning: 1, rate: 0.5 });
    const busy = report.heatmap.rows.find((row) => row.counts.some((count) => count > 0));
    const hour = (value: number) => busy?.counts[report.heatmap.hours.indexOf(value)];
    assert.equal(hour(11), 1);
    assert.equal(hour(16), 0);
    assert.equal(hour(17), 1);
  } finally {
    await prisma.booking.deleteMany({ where: { id: { in: ids } } });
    await prisma.client.deleteMany({ where: { id: { in: clients.map((client) => client.id) } } });
    await prisma.$disconnect();
  }
});
