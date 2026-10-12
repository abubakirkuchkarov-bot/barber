import { config } from "dotenv";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import test from "node:test";

config({ path: resolve(process.cwd(), "../../.env") });

const MINUTE = 60 * 1000;

test("напоминания идемпотентны и не трогают чужие записи", async () => {
  const { prisma } = await import("./db");
  const { runNotifications } = await import("./notifications/run");
  const { saveTelegramRating } = await import("./reviews");
  const query = (text: string, params: unknown[]) => prisma.$queryRawUnsafe(text, ...params);
  const now = new Date("2027-06-02T10:00:00.000Z");
  const client = await prisma.client.create({
    data: {
      name: "Напоминание Тест",
      phone: "+998 90 000 00 08",
      telegramId: `notify-${randomBytes(4).toString("hex")}`,
      telegramChatId: "42424242",
    },
  });
  const silent = await prisma.client.create({
    data: {
      name: "Без Чата",
      phone: "+998 90 000 00 09",
      telegramId: `silent-${randomBytes(4).toString("hex")}`,
    },
  });

  const created: string[] = [];
  const book = async (owner: string, startsAt: Date, endsAt: Date, status: "confirmed" | "cancelled" = "confirmed") => {
    const row = await prisma.booking.create({
      data: {
        clientId: owner,
        barberId: "aziz",
        startsAt,
        endsAt,
        totalPrice: 120_000,
        totalDurationMin: 45,
        status,
        source: "web",
        manageToken: randomBytes(24).toString("base64url"),
        services: {
          create: [{ serviceId: "haircut", name: "Мужская стрижка", durationMin: 45, price: 120_000 }],
        },
      },
    });
    created.push(row.id);
    return row;
  };

  try {
    const dayVisit = await book(client.id, new Date(now.getTime() + 12 * 60 * MINUTE), new Date(now.getTime() + 12 * 60 * MINUTE + 45 * MINUTE));
    const quietVisit = await book(silent.id, new Date(now.getTime() + 10 * 60 * MINUTE), new Date(now.getTime() + 10 * 60 * MINUTE + 45 * MINUTE));
    const soon = await book(client.id, new Date(now.getTime() + 20 * MINUTE), new Date(now.getTime() + 65 * MINUTE));
    const finished = await book(client.id, new Date(now.getTime() - 75 * MINUTE), new Date(now.getTime() - 30 * MINUTE));
    const cancelled = await book(client.id, new Date(now.getTime() - 5 * 60 * MINUTE), new Date(now.getTime() - 4 * 60 * MINUTE), "cancelled");

    const sent: string[] = [];
    const send = async (message: { kind: string; bookingId: string }) => {
      sent.push(`${message.kind}:${message.bookingId}`);
    };
    const scope = { clientId: client.id };

    const first = await runNotifications(query, send, now, scope);
    const second = await runNotifications(query, send, now, scope);
    assert.deepEqual(first, { day: 1, short: 1, completed: 1, reviews: 0 });
    assert.deepEqual(second, { day: 0, short: 0, completed: 0, reviews: 0 });
    assert.equal(sent.filter((item) => item.startsWith("day:")).length, 1);
    assert.equal(sent.filter((item) => item.startsWith("short:")).length, 1);

    const dayRow = await prisma.booking.findUniqueOrThrow({ where: { id: dayVisit.id } });
    const soonRow = await prisma.booking.findUniqueOrThrow({ where: { id: soon.id } });
    const doneRow = await prisma.booking.findUniqueOrThrow({ where: { id: finished.id } });
    const quietRow = await prisma.booking.findUniqueOrThrow({ where: { id: quietVisit.id } });
    const cancelledRow = await prisma.booking.findUniqueOrThrow({ where: { id: cancelled.id } });
    assert.ok(dayRow.reminderDaySentAt);
    assert.equal(dayRow.reminder30mSentAt, null);
    assert.ok(soonRow.reminder30mSentAt);
    assert.equal(soonRow.reminderDaySentAt, null);
    assert.equal(doneRow.status, "completed");
    assert.ok(doneRow.autoCompletedAt);
    assert.equal(doneRow.reviewRequestedAt, null);
    assert.equal(quietRow.reminderDaySentAt, null);
    assert.equal(cancelledRow.status, "cancelled");

    let failed = true;
    const reviewAt = new Date(finished.endsAt.getTime() + 61 * MINUTE);
    const flaky = await runNotifications(
      query,
      async () => {
        if (failed) throw new Error("telegram down");
      },
      reviewAt,
      scope,
    );
    assert.equal(flaky.reviews, 0);
    const held = await prisma.booking.findUniqueOrThrow({ where: { id: finished.id } });
    assert.equal(held.reviewRequestedAt, null);

    failed = false;
    const asked = await runNotifications(query, send, reviewAt, scope);
    const repeated = await runNotifications(query, send, reviewAt, scope);
    assert.equal(asked.reviews, 1);
    assert.equal(repeated.reviews, 0);
    assert.equal(sent.filter((item) => item.startsWith("review:")).length, 1);

    assert.equal(await saveTelegramRating(client.telegramId!, 5), "saved");
    assert.equal(await saveTelegramRating(client.telegramId!, 4), "none");
    const review = await prisma.review.findUniqueOrThrow({ where: { bookingId: finished.id } });
    assert.equal(review.rating, 5);
    assert.equal(review.isPublic, true);
  } finally {
    await prisma.review.deleteMany({ where: { bookingId: { in: created } } });
    await prisma.booking.deleteMany({ where: { id: { in: created } } });
    await prisma.client.deleteMany({ where: { id: { in: [client.id, silent.id] } } });
  }
});
