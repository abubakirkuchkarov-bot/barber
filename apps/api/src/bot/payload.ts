export type StartPayload =
  | { type: "plain" }
  | { type: "booking"; token: string }
  | { type: "barber"; code: string };

const TOKEN = /^[A-Za-z0-9_-]{20,80}$/;

export function parseStartPayload(payload: string | undefined): StartPayload {
  const value = payload?.trim() ?? "";
  if (!value) return { type: "plain" };
  if (value.startsWith("b_")) {
    const token = value.slice(2);
    return TOKEN.test(token) ? { type: "booking", token } : { type: "plain" };
  }
  if (value.startsWith("barber_")) {
    const code = value.slice("barber_".length);
    return TOKEN.test(code) ? { type: "barber", code } : { type: "plain" };
  }
  return { type: "plain" };
}

export function bookingStartPayload(token: string) {
  return `b_${token}`;
}

export function barberStartPayload(code: string) {
  return `barber_${code}`;
}

export function telegramBotUrl(payload?: string) {
  const username = (process.env.TELEGRAM_BOT_USERNAME ?? "").replace(/^@/, "").trim();
  if (!username) return null;
  const base = `https://t.me/${username}`;
  return payload ? `${base}?start=${payload}` : base;
}
