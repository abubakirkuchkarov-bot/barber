import { Prisma } from "@prisma/client";
import { prisma } from "./db";

export async function saveTelegramRating(telegramId: string, rating: number): Promise<"saved" | "exists" | "none"> {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return "none";
  const client = await prisma.client.findUnique({ where: { telegramId } });
  if (!client) return "none";
  const booking = await prisma.booking.findFirst({
    where: {
      clientId: client.id,
      status: "completed",
      reviewRequestedAt: { not: null },
      review: { is: null },
    },
    orderBy: { endsAt: "desc" },
  });
  if (!booking) return "none";
  const setting = await prisma.setting.findUnique({ where: { key: "review_public_min_rating" } });
  const threshold = Number(setting?.value ?? 4);
  try {
    await prisma.review.create({
      data: {
        bookingId: booking.id,
        barberId: booking.barberId,
        clientId: client.id,
        rating,
        isPublic: Number.isFinite(threshold) && rating >= threshold,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return "exists";
    throw error;
  }
  return "saved";
}
