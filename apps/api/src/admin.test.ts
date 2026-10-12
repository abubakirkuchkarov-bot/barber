import assert from "node:assert/strict";
import test from "node:test";
import { loginBlocked, loginFailed, resetLoginLimit } from "./admin/limit";
import { readSession, signSession } from "./admin/session";

test("сессия подписывается и не принимается после срока", () => {
  process.env.SESSION_SECRET = "test-session-secret";
  const token = signSession("admin-1", 5_000);
  assert.equal(readSession(token ?? "", 1_000)?.sub, "admin-1");
  assert.equal(readSession(token ?? "", 5_000), null);
  assert.equal(readSession(`${token}x`, 1_000), null);
  delete process.env.SESSION_SECRET;
  assert.equal(signSession("admin-1", 5_000), null);
});

test("восьмая ошибка входа закрывает логин на 15 минут", () => {
  resetLoginLimit();
  const now = 1_000_000;
  for (let index = 0; index < 7; index += 1) loginFailed("10.0.0.8", now);
  assert.equal(loginBlocked("10.0.0.8", now + 1_000), false);
  loginFailed("10.0.0.8", now);
  assert.equal(loginBlocked("10.0.0.8", now + 1_000), true);
  assert.equal(loginBlocked("10.0.0.8", now + 16 * 60 * 1000), false);
  resetLoginLimit();
});
