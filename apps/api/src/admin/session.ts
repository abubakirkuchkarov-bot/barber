import { createHmac, timingSafeEqual } from "node:crypto";

type Session = { sub: string; exp: number };

function secret() {
  return process.env.SESSION_SECRET?.trim() ?? "";
}

export function signSession(adminId: string, exp: number) {
  const key = secret();
  if (!key) return null;
  const body = Buffer.from(JSON.stringify({ sub: adminId, exp } satisfies Session)).toString("base64url");
  const sig = createHmac("sha256", key).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function readSession(token: string | undefined, now = Date.now()): Session | null {
  const key = secret();
  if (!key || !token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", key).update(body).digest("base64url");
  const left = Buffer.from(sig);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString()) as Session;
    if (!parsed.sub || typeof parsed.exp !== "number" || parsed.exp <= now) return null;
    return parsed;
  } catch {
    return null;
  }
}

export const ADMIN_COOKIE = "kromka_admin";
export const SESSION_MS = 14 * 24 * 60 * 60 * 1000;
