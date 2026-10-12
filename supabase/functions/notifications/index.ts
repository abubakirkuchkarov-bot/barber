import postgres from "npm:postgres@3.4.5";
import { cronAuth } from "../../../apps/api/src/notifications/auth.ts";
import { runNotifications, type SqlQuery } from "../../../apps/api/src/notifications/run.ts";

const token = () => Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response("method", { status: 405 });
  const verdict = cronAuth(request.headers.get("authorization") ?? undefined, Deno.env.get("CRON_SECRET"));
  if (verdict === "unconfigured") return Response.json({ ok: false }, { status: 503 });
  if (verdict === "forbidden") return Response.json({ ok: false }, { status: 401 });

  const databaseUrl = Deno.env.get("DATABASE_URL");
  if (!databaseUrl) return Response.json({ ok: false }, { status: 503 });

  const sql = postgres(databaseUrl, { prepare: false, max: 1, ssl: "require" });
  const query: SqlQuery = async (text, params) => await sql.unsafe(text, params as never[]);
  try {
    const report = await runNotifications(query, async (message) => {
      const botToken = token();
      if (!botToken) throw new Error("telegram is not configured");
      const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: message.chatId, text: message.text }),
      });
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail.replaceAll(botToken, "[token]"));
      }
    });
    return Response.json({ ok: true, ...report });
  } catch (error) {
    const message = error instanceof Error ? error.message : "notifications failed";
    console.error("notifications", message.replaceAll(token(), "[token]"));
    return Response.json({ ok: false }, { status: 500 });
  } finally {
    await sql.end({ timeout: 5 });
  }
});
