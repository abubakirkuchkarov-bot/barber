import assert from "node:assert/strict";
import test from "node:test";
import { cronAuth } from "./notifications/auth";
import { reminderText } from "./notifications/text";

const visit = {
  startsAt: new Date("2026-10-13T06:00:00.000Z"),
  totalDurationMin: 45,
  barberName: "Азиз Каримов",
  services: [{ name: "Мужская стрижка" }],
};

test("тексты напоминания, короткого окна и отзыва", () => {
  const day = reminderText("day", visit);
  assert.match(day, /Напоминаем о записи/);
  assert.match(day, /Мужская стрижка, 45 мин/);
  assert.match(day, /Азиз Каримов/);
  assert.match(day, /11:00/);
  assert.match(day, /Амира Темура/);
  assert.match(reminderText("short", visit, 30), /меньше 30 мин/);
  assert.match(reminderText("review", visit), /оценкой от 1 до 5/);
});

test("секрет крона сравнивается целиком", () => {
  assert.equal(cronAuth(undefined, ""), "unconfigured");
  assert.equal(cronAuth(undefined, undefined), "unconfigured");
  assert.equal(cronAuth("Bearer wrong", "sekret"), "forbidden");
  assert.equal(cronAuth("sekret", "sekret"), "forbidden");
  assert.equal(cronAuth("Bearer sekret", "sekret"), "ok");
  assert.equal(cronAuth("Bearer sekret-extra", "sekret"), "forbidden");
});
