const SHOP = {
  address: "улица Амира Темура, 108",
  phone: "+998 71 200 19 30",
  hours: "Ежедневно, 10:00–21:00",
};

type Visit = {
  startsAt: Date;
  totalDurationMin: number;
  client: { name: string; phone: string };
  barber: { name: string };
  services: Array<{ name: string }>;
};

export function formatWhen(instant: Date) {
  const day = new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Asia/Tashkent",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(instant);
  const time = new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Asia/Tashkent",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(instant);
  return `${day}, ${time}`;
}

function serviceLine(visit: Visit) {
  const names = visit.services.map((service) => service.name).join(", ");
  return `${names}, ${visit.totalDurationMin} мин`;
}

export function welcomeText() {
  return [
    "Кромка. Барбершоп на улице Амира Темура.",
    "Здесь можно записаться и держать визит под рукой.",
  ].join("\n");
}

export function contactsText() {
  return [SHOP.address, SHOP.phone, SHOP.hours].join("\n");
}

export function bookHintText() {
  const site = process.env.WEB_ORIGIN ?? "http://localhost:3000";
  return `Запись открывается на сайте:\n${site}/book`;
}

export function clientNotice(kind: "created" | "cancelled" | "moved", visit: Visit) {
  const when = formatWhen(visit.startsAt);
  if (kind === "cancelled") {
    return ["Запись отменена.", serviceLine(visit), visit.barber.name, when].join("\n");
  }
  const title = kind === "moved" ? "Время записи изменено." : "Вы записаны.";
  return [title, serviceLine(visit), visit.barber.name, when, SHOP.address].join("\n");
}

export function barberNotice(visit: Visit) {
  return [
    "Новая запись.",
    `${visit.client.name}, ${visit.client.phone}`,
    serviceLine(visit),
    formatWhen(visit.startsAt),
  ].join("\n");
}

export function bookingsListText(visits: Visit[]) {
  if (visits.length === 0) return "Предстоящих записей нет.";
  return ["Ваши записи.", ...visits.map((visit) => `${formatWhen(visit.startsAt)}. ${serviceLine(visit)}. ${visit.barber.name}`)].join(
    "\n",
  );
}
