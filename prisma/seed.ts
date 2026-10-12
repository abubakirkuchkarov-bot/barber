import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const services = [
  {
    id: "haircut",
    name: "Мужская стрижка",
    description: "Ножницы, машинка и форма, которая держится до следующего визита.",
    durationMin: 45,
    price: 120_000,
    sortOrder: 1,
  },
  {
    id: "clipper",
    name: "Стрижка машинкой",
    description: "Одна длина или мягкий переход. Короче обычной стрижки.",
    durationMin: 30,
    price: 70_000,
    sortOrder: 2,
  },
  {
    id: "beard",
    name: "Борода",
    description: "Линия, плотность и кожа под бородой.",
    durationMin: 30,
    price: 80_000,
    sortOrder: 3,
  },
  {
    id: "shave",
    name: "Бритьё",
    description: "Горячее полотенце, опасная бритва, холодный компресс.",
    durationMin: 40,
    price: 90_000,
    sortOrder: 4,
  },
  {
    id: "combo",
    name: "Стрижка и борода",
    description: "Оба пункта за один визит, без паузы между ними.",
    durationMin: 75,
    price: 180_000,
    sortOrder: 5,
  },
  {
    id: "kids",
    name: "Детская стрижка",
    description: "Для мальчиков до 12 лет. Можно прийти с родителем.",
    durationMin: 30,
    price: 90_000,
    sortOrder: 6,
  },
] as const;

const barbers = [
  { id: "aziz", name: "Азиз Каримов", bio: "Старший барбер", experienceYears: 8, photoUrl: "/images/master-1.jpg", sortOrder: 1 },
  { id: "timur", name: "Тимур Юсупов", bio: "Барбер", experienceYears: 5, photoUrl: "/images/master-2.jpg", sortOrder: 2 },
  { id: "sherzod", name: "Шерзод Алиев", bio: "Мастер", experienceYears: 11, photoUrl: "/images/master-3.jpg", sortOrder: 3 },
  { id: "behruz", name: "Бехруз Рахимов", bio: "Барбер", experienceYears: 6, photoUrl: "/images/master-4.jpg", sortOrder: 4 },
  { id: "jahongir", name: "Жахонгир Саидов", bio: "Мастер", experienceYears: 9, photoUrl: "/images/master-5.jpg", sortOrder: 5 },
  { id: "sardor", name: "Сардор Нурматов", bio: "Барбер", experienceYears: 7, photoUrl: "/images/master-6.jpg", sortOrder: 6 },
] as const;

const settings = [
  ["cancel_cutoff_min", "30"],
  ["slot_step_min", "15"],
  ["booking_horizon_days", "30"],
  ["min_notice_min", "30"],
  ["reminder_day_minutes", "1440"],
  ["reminder_short_minutes", "30"],
  ["review_delay_min", "60"],
  ["timezone", "Asia/Tashkent"],
  ["review_public_min_rating", "4"],
] as const;

function clock(value: string) {
  return new Date(`1970-01-01T${value}:00.000Z`);
}

async function main() {
  for (const service of services) {
    await prisma.service.upsert({
      where: { id: service.id },
      update: service,
      create: service,
    });
  }

  for (const barber of barbers) {
    await prisma.barber.upsert({
      where: { id: barber.id },
      update: { ...barber, isActive: true },
      create: { ...barber, isActive: true },
    });
  }

  await prisma.barberService.deleteMany({
    where: { barberId: { in: barbers.map((barber) => barber.id) } },
  });
  await prisma.barberService.createMany({
    data: barbers.flatMap((barber) =>
      services.map((service) => ({
        barberId: barber.id,
        serviceId: service.id,
        isEnabled: true,
      })),
    ),
  });

  await prisma.workingHour.deleteMany({
    where: { barberId: { in: barbers.map((barber) => barber.id) } },
  });
  await prisma.break.deleteMany({
    where: { barberId: { in: barbers.map((barber) => barber.id) } },
  });

  const week = [0, 1, 2, 3, 4, 5, 6];
  await prisma.workingHour.createMany({
    data: barbers.flatMap((barber) =>
      week.map((weekday) => ({
        barberId: barber.id,
        weekday,
        startTime: clock("10:00"),
        endTime: clock("21:00"),
      })),
    ),
  });
  await prisma.break.createMany({
    data: barbers.flatMap((barber) =>
      week.map((weekday) => ({
        barberId: barber.id,
        weekday,
        startTime: clock("13:00"),
        endTime: clock("14:00"),
      })),
    ),
  });

  for (const [key, value] of settings) {
    await prisma.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }

  const { ensureAdmin } = await import("./ensure-admin");
  await ensureAdmin(prisma);

  const [serviceCount, barberCount, hourCount, breakCount, settingCount] = await Promise.all([
    prisma.service.count(),
    prisma.barber.count(),
    prisma.workingHour.count(),
    prisma.break.count(),
    prisma.setting.count(),
  ]);

  console.log(
    `seed: services=${serviceCount} barbers=${barberCount} working_hours=${hourCount} breaks=${breakCount} settings=${settingCount}`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
