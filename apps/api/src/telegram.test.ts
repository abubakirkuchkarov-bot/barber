import assert from "node:assert/strict";
import test from "node:test";
import { signInitData, verifyInitData } from "./telegram";

const TOKEN = "8000000001:test-token";

function sample(authDate: number) {
  return signInitData(
    {
      auth_date: String(authDate),
      query_id: "aa",
      user: JSON.stringify({ id: 42, first_name: "Азиз", last_name: "Каримов", username: "aziz" }),
    },
    TOKEN,
  );
}

test("подпись initData проходит проверку и отдаёт пользователя", () => {
  const now = new Date("2026-10-09T12:00:00Z");
  const initData = sample(Math.floor(now.getTime() / 1000) - 30);
  const user = verifyInitData(initData, TOKEN, now);
  assert.ok(user);
  assert.equal(user.id, "42");
  assert.equal(user.name, "Азиз Каримов");
  assert.equal(user.username, "aziz");
});

test("чужой токен и просроченная сессия отклоняются", () => {
  const now = new Date("2026-10-09T12:00:00Z");
  const initData = sample(Math.floor(now.getTime() / 1000));
  assert.equal(verifyInitData(initData, "other-token", now), null);
  const stale = sample(Math.floor(now.getTime() / 1000) - 25 * 60 * 60);
  assert.equal(verifyInitData(stale, TOKEN, now), null);
});

test("подмена hash не проходит", () => {
  const now = new Date("2026-10-09T12:00:00Z");
  const initData = sample(Math.floor(now.getTime() / 1000)).replace(/hash=[0-9a-f]+/, `hash=${"ab".repeat(32)}`);
  assert.equal(verifyInitData(initData, TOKEN, now), null);
});
