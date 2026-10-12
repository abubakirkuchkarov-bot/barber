import assert from "node:assert/strict";
import test from "node:test";
import { cancellationsOf, heatmapOf, loadOf, retentionOf, revenueOf, servicesOf, type Visit } from "./analytics/calc";

const day = "2027-06-03";

function at(hour: number) {
  return new Date(`${day}T${String(hour - 5).padStart(2, "0")}:00:00.000Z`);
}

function visit(patch: Partial<Visit> & Pick<Visit, "clientId" | "status">): Visit {
  return {
    barberId: "aziz",
    barberName: "Азиз Каримов",
    startsAt: at(11),
    totalPrice: 120_000,
    totalDurationMin: 45,
    services: [{ id: "haircut", name: "Мужская стрижка", price: 120_000 }],
    ...patch,
  };
}

const visits: Visit[] = [
  visit({ clientId: "a", status: "completed", startsAt: at(11) }),
  visit({ clientId: "a", status: "completed", startsAt: at(15) }),
  visit({ clientId: "b", status: "cancelled", startsAt: at(16) }),
  visit({
    clientId: "c",
    status: "no_show",
    startsAt: at(17),
    totalPrice: 80_000,
    totalDurationMin: 30,
    services: [{ id: "beard", name: "Борода", price: 80_000 }],
  }),
  visit({
    clientId: "d",
    status: "completed",
    barberId: "timur",
    barberName: "Тимур Юсупов",
    startsAt: at(12),
  }),
];

test("выручка берётся только из завершённых визитов", () => {
  const revenue = revenueOf(visits);
  assert.equal(revenue.total, 360_000);
  assert.equal(revenue.completed, 3);
  assert.equal(revenue.bookings, 5);
});

test("услуги считают занятые визиты, а деньги только завершённые", () => {
  const services = servicesOf(visits);
  assert.deepEqual(
    services.map((item) => [item.id, item.count, item.revenue]),
    [
      ["haircut", 3, 360_000],
      ["beard", 1, 0],
    ],
  );
});

test("загрузка, отмены, неявки и возвращаемость сходятся с визитами", () => {
  const load = loadOf(visits, [
    { barberId: "aziz", barberName: "Азиз Каримов", openMin: 600 },
    { barberId: "timur", barberName: "Тимур Юсупов", openMin: 600 },
  ]);
  const aziz = load.find((item) => item.id === "aziz");
  const timur = load.find((item) => item.id === "timur");
  assert.equal(aziz?.bookedMin, 120);
  assert.equal(aziz?.visits, 3);
  assert.equal(aziz?.load, 0.2);
  assert.equal(timur?.bookedMin, 45);
  assert.equal(timur?.load, 0.075);
  assert.deepEqual(cancellationsOf(visits), {
    total: 5,
    cancelled: 1,
    noShow: 1,
    cancelRate: 0.2,
    noShowRate: 0.2,
  });
  assert.deepEqual(retentionOf(visits), { clients: 2, returning: 1, rate: 0.5 });
});

test("тепловая карта кладёт визит в час Ташкента и пропускает отмену", () => {
  const heat = heatmapOf(visits, "Asia/Tashkent");
  const row = heat.rows.find((item) => item.counts.some((count) => count > 0));
  assert.ok(row);
  const atHour = (hour: number) => row.counts[heat.hours.indexOf(hour)];
  assert.equal(atHour(11), 1);
  assert.equal(atHour(12), 1);
  assert.equal(atHour(15), 1);
  assert.equal(atHour(16), 0);
  assert.equal(atHour(17), 1);
});
