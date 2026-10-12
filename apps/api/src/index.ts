import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), "../../.env") });

async function setupBotMenu() {
  const { getBot } = await import("./bot/bot");
  const current = getBot();
  if (!current) return;
  await current.api.setMyCommands([
    { command: "start", description: "Начать" },
    { command: "bookings", description: "Мои записи" },
  ]);
}

async function main() {
  const { buildApp } = await import("./app");
  const app = await buildApp();
  try {
    await app.listen({ host: "0.0.0.0", port: Number(process.env.PORT ?? 3011) });
  } catch (error: unknown) {
    console.error(error);
    process.exit(1);
  }
  try {
    await setupBotMenu();
  } catch (error: unknown) {
    const token = process.env.TELEGRAM_BOT_TOKEN ?? "";
    const message = error instanceof Error ? error.message.replaceAll(token, "[token]") : "bot menu failed";
    console.error("telegram menu", message);
  }
  if (process.env.TELEGRAM_POLLING === "1") {
    const { startPolling } = await import("./bot/bot");
    void startPolling().catch((error: unknown) => {
      const token = process.env.TELEGRAM_BOT_TOKEN ?? "";
      const message = error instanceof Error ? error.message.replaceAll(token, "[token]") : "polling failed";
      console.error("telegram polling", message);
    });
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
