import { createHmac, timingSafeEqual } from "node:crypto";

const MAX_AGE_SEC = 24 * 60 * 60;

export type TelegramUser = {
  id: string;
  name: string;
  username: string | null;
};

export function signInitData(fields: Record<string, string>, botToken: string) {
  const dataCheck = Object.keys(fields)
    .sort()
    .map((key) => `${key}=${fields[key]}`)
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
  const hash = createHmac("sha256", secret).update(dataCheck).digest("hex");
  return new URLSearchParams({ ...fields, hash }).toString();
}

export function verifyInitData(initData: string, botToken: string, now = new Date()): TelegramUser | null {
  if (!initData || initData.length > 4096 || !botToken) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash || !/^[0-9a-f]{64}$/i.test(hash)) return null;
  params.delete("hash");

  const dataCheck = [...params.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
  const expected = createHmac("sha256", secret).update(dataCheck).digest("hex");
  const left = Buffer.from(expected, "hex");
  const right = Buffer.from(hash, "hex");
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;

  const authDate = Number(params.get("auth_date"));
  if (!Number.isFinite(authDate)) return null;
  const age = Math.floor(now.getTime() / 1000) - authDate;
  if (age > MAX_AGE_SEC || age < -60) return null;

  const rawUser = params.get("user");
  if (!rawUser) return null;
  let user: { id?: number; first_name?: string; last_name?: string; username?: string };
  try {
    user = JSON.parse(rawUser) as typeof user;
  } catch {
    return null;
  }
  if (!user.id || !Number.isFinite(user.id)) return null;
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ").trim();
  return {
    id: String(user.id),
    name: name || "Гость",
    username: user.username ?? null,
  };
}
