import { config } from "dotenv";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";

config({ path: resolve(process.cwd(), "../../.env") });

test("одноразовый код привязывает мастера и повторно не срабатывает", async () => {
  const { prisma } = await import("../db");
  const { consumeBarberLink, issueBarberLink } = await import("./link");
  const barber = await prisma.barber.findUnique({ where: { id: "aziz" } });
  assert.ok(barber);
  const previous = barber.telegramChatId;
  const issued = await issueBarberLink("aziz");
  try {
    assert.equal(await consumeBarberLink(issued.code, "424242"), barber.name);
    assert.equal(await consumeBarberLink(issued.code, "424242"), null);
    const updated = await prisma.barber.findUnique({ where: { id: "aziz" } });
    assert.equal(updated?.telegramChatId, "424242");
  } finally {
    await prisma.barber.update({ where: { id: "aziz" }, data: { telegramChatId: previous } });
    await prisma.barberLinkCode.deleteMany({ where: { code: issued.code } });
  }
});
