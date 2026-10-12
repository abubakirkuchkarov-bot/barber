import { formatWhen } from "../bot/messages";

const ADDRESS = "улица Амира Темура, 108";

export type NoticeKind = "day" | "short" | "review";

export type NoticeVisit = {
  startsAt: Date;
  totalDurationMin: number;
  barberName: string;
  services: Array<{ name: string }>;
};

function serviceLine(visit: NoticeVisit) {
  const names = visit.services.map((service) => service.name).join(", ");
  return `${names}, ${visit.totalDurationMin} мин`;
}

export function reminderText(kind: NoticeKind, visit: NoticeVisit, shortMinutes = 30) {
  const line = serviceLine(visit);
  if (kind === "review") {
    return ["Как прошёл визит?", line, visit.barberName, "Ответьте оценкой от 1 до 5."].join("\n");
  }
  const title = kind === "short" ? `До визита меньше ${shortMinutes} мин.` : "Напоминаем о записи.";
  return [title, line, visit.barberName, formatWhen(visit.startsAt), ADDRESS].join("\n");
}
