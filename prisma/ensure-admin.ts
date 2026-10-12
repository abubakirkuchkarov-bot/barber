import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";
import { config } from "dotenv";

export async function ensureAdmin(prisma: PrismaClient) {
  const login = process.env.ADMIN_LOGIN?.trim() ?? "";
  const password = process.env.ADMIN_PASSWORD ?? "";
  if (!login || password.length < 8) {
    console.log("admin: пропущен, задайте ADMIN_LOGIN и ADMIN_PASSWORD от 8 символов");
    return;
  }
  const passwordHash = await argon2.hash(password);
  await prisma.adminUser.upsert({
    where: { login },
    update: { passwordHash },
    create: { login, passwordHash },
  });
  console.log(`admin: ${login}`);
}

const entry = process.argv[1]?.replaceAll("\\", "/") ?? "";
if (entry.endsWith("prisma/ensure-admin.ts")) {
  config();
  const prisma = new PrismaClient();
  ensureAdmin(prisma)
    .then(() => prisma.$disconnect())
    .catch(async (error: unknown) => {
      console.error(error);
      await prisma.$disconnect();
      process.exit(1);
    });
}
