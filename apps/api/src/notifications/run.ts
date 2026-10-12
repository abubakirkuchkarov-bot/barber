import { claimDaySql, claimReviewSql, claimShortSql, completeSql, loadSettingsSql, loadVisitSql, releaseSql } from "./sql";
import { reminderText, type NoticeKind, type NoticeVisit } from "./text";

export type SqlQuery = (text: string, params: unknown[]) => Promise<unknown>;

export type NoticeMessage = {
  chatId: string;
  text: string;
  bookingId: string;
  kind: NoticeKind;
};

export type NotificationReport = {
  day: number;
  short: number;
  completed: number;
  reviews: number;
};

type Scope = { clientId?: string };

const DEFAULTS = {
  reminder_day_minutes: 1440,
  reminder_short_minutes: 30,
  review_delay_min: 60,
};

export async function runNotifications(
  query: SqlQuery,
  send: (message: NoticeMessage) => Promise<void>,
  now = new Date(),
  scope: Scope = {},
): Promise<NotificationReport> {
  const settings = await loadSettings(query);
  const clientId = scope.clientId ?? null;
  const day = await claimAndSend(query, send, "day", claimDaySql, [now, settings.reminder_day_minutes, settings.reminder_short_minutes, clientId], now, settings.reminder_short_minutes);
  const short = await claimAndSend(query, send, "short", claimShortSql, [now, settings.reminder_short_minutes, clientId], now, settings.reminder_short_minutes);
  const completed = await completePast(query, now, clientId);
  const reviews = await claimAndSend(query, send, "review", claimReviewSql, [now, settings.review_delay_min, clientId], now, settings.reminder_short_minutes);
  return { day, short, completed, reviews };
}

async function loadSettings(query: SqlQuery) {
  const rows = asRows<{ key: string; value: string }>(await query(loadSettingsSql, []));
  const values = { ...DEFAULTS };
  for (const row of rows) {
    const parsed = Number(row.value);
    if (row.key in values && Number.isFinite(parsed) && parsed > 0) {
      values[row.key as keyof typeof values] = parsed;
    }
  }
  return values;
}

async function completePast(query: SqlQuery, now: Date, clientId: string | null) {
  const rows = asRows<{ id: string }>(await query(completeSql, [now, clientId]));
  return rows.length;
}

async function claimAndSend(
  query: SqlQuery,
  send: (message: NoticeMessage) => Promise<void>,
  kind: NoticeKind,
  claim: string,
  params: unknown[],
  now: Date,
  shortMinutes: number,
) {
  const claimed = asRows<{ id: string }>(await query(claim, params));
  let sent = 0;
  for (const row of claimed) {
    const visit = asRows<VisitRow>(await query(loadVisitSql, [row.id]))[0];
    if (!visit?.telegram_chat_id) {
      await query(releaseSql(kind), [row.id, now]);
      continue;
    }
    try {
      await send({
        chatId: visit.telegram_chat_id,
        bookingId: visit.id,
        kind,
        text: reminderText(kind, toVisit(visit), shortMinutes),
      });
      sent += 1;
    } catch (error) {
      await query(releaseSql(kind), [row.id, now]);
      const message = error instanceof Error ? error.message : "notify failed";
      console.error("notification send", message.replaceAll(process.env.TELEGRAM_BOT_TOKEN ?? "", "[token]"));
    }
  }
  return sent;
}

type VisitRow = {
  id: string;
  starts_at: Date | string;
  total_duration_min: number;
  telegram_chat_id: string | null;
  barber_name: string;
  services: unknown;
};

function toVisit(row: VisitRow): NoticeVisit {
  return {
    startsAt: new Date(row.starts_at),
    totalDurationMin: row.total_duration_min,
    barberName: row.barber_name,
    services: serviceNames(row.services).map((name) => ({ name })),
  };
}

function serviceNames(value: unknown) {
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map((item) => (item && typeof item === "object" && "name" in item ? String(item.name) : ""))
    .filter(Boolean);
}

function asRows<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}
