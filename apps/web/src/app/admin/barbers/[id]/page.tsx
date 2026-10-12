"use client";

import { desk, DeskError, tashkentInstant, WEEKDAYS } from "@/lib/desk";
import { useParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

type Span = { weekday: number; start: string; end: string };
type Detail = {
  id: string;
  name: string;
  bio: string | null;
  experienceYears: number;
  photoUrl: string | null;
  isActive: boolean;
  telegramLinked: boolean;
  serviceIds: string[];
  hours: Span[];
  breaks: Span[];
  portfolio: Array<{ id: string; imageUrl: string }>;
  timeOff: Array<{ id: string; type: string; note: string | null; startsAt: string; endsAt: string }>;
};

const blankWeek = () => WEEKDAYS.map((_, weekday) => ({ weekday, start: "10:00", end: "21:00", on: true, breakStart: "13:00", breakEnd: "14:00", lunch: true }));

export default function BarberPage() {
  const params = useParams<{ id: string }>();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [services, setServices] = useState<Array<{ id: string; name: string }>>([]);
  const [week, setWeek] = useState(blankWeek());
  const [error, setError] = useState("");
  const [offDate, setOffDate] = useState("");
  const [note, setNote] = useState("");

  async function load() {
    const [barber, catalog] = await Promise.all([
      desk<{ barber: Detail }>(`/admin/barbers/${params.id}`),
      desk<{ services: Array<{ id: string; name: string }> }>("/admin/services"),
    ]);
    setDetail(barber.barber);
    setServices(catalog.services);
    setWeek(
      blankWeek().map((day) => {
        const hour = barber.barber.hours.find((item) => item.weekday === day.weekday);
        const lunch = barber.barber.breaks.find((item) => item.weekday === day.weekday);
        return {
          ...day,
          on: Boolean(hour),
          start: hour?.start ?? day.start,
          end: hour?.end ?? day.end,
          lunch: Boolean(lunch),
          breakStart: lunch?.start ?? day.breakStart,
          breakEnd: lunch?.end ?? day.breakEnd,
        };
      }),
    );
  }

  useEffect(() => {
    load().catch((reason: unknown) => setError(reason instanceof DeskError ? reason.message : "Мастер не открылся"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  if (!detail) return error ? <p className="desk-error">{error}</p> : <p>Открываем мастера</p>;
  const barberId = detail.id;

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await desk(`/admin/barbers/${barberId}`, {
      method: "PATCH",
      body: JSON.stringify({
        name: String(form.get("name") ?? ""),
        bio: String(form.get("bio") ?? ""),
        experienceYears: Number(form.get("years") ?? 0),
        photoUrl: String(form.get("photo") ?? ""),
        isActive: form.get("active") === "on",
        serviceIds: form.getAll("service").map(String),
      }),
    });
    await load();
  }

  async function saveWeek(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      await desk(`/admin/barbers/${barberId}/schedule`, {
        method: "PUT",
        body: JSON.stringify({
          hours: week.filter((day) => day.on).map(({ weekday, start, end }) => ({ weekday, start, end })),
          breaks: week
            .filter((day) => day.on && day.lunch)
            .map(({ weekday, breakStart, breakEnd }) => ({ weekday, start: breakStart, end: breakEnd })),
        }),
      });
      await load();
    } catch (reason) {
      setError(reason instanceof DeskError ? reason.message : "График не сохранился");
    }
  }

  async function upload(file: File) {
    const body = new FormData();
    body.set("file", file);
    const stored = await desk<{ url: string }>("/admin/uploads", { method: "POST", body });
    await desk(`/admin/barbers/${barberId}/portfolio`, {
      method: "POST",
      body: JSON.stringify({ imageUrl: stored.url }),
    });
    await load();
  }

  async function addOff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await desk("/admin/time-off", {
      method: "POST",
      body: JSON.stringify({
        barberId,
        startsAt: tashkentInstant(offDate, "00:00"),
        endsAt: tashkentInstant(shiftDate(offDate), "00:00"),
        type: "day_off",
        note,
      }),
    });
    setNote("");
    await load();
  }

  async function linkTelegram() {
    const body = await desk<{ link: { url: string | null; code: string } }>(`/admin/barbers/${barberId}/telegram-link`, {
      method: "POST",
    });
    window.prompt("Одноразовая ссылка для мастера", body.link.url ?? body.link.code);
  }

  return (
    <>
      <h1>{detail.name}</h1>
      {error ? <p className="desk-error">{error}</p> : null}
      <form className="desk-create" onSubmit={saveProfile}>
        <label>
          Имя
          <input name="name" defaultValue={detail.name} required />
        </label>
        <label>
          О мастере
          <input name="bio" defaultValue={detail.bio ?? ""} />
        </label>
        <label>
          Опыт, лет
          <input name="years" type="number" min={0} defaultValue={detail.experienceYears} />
        </label>
        <label>
          Фото, адрес
          <input name="photo" defaultValue={detail.photoUrl ?? ""} />
        </label>
        <label className="desk-check">
          <input name="active" type="checkbox" defaultChecked={detail.isActive} /> В смене
        </label>
        <fieldset>
          <legend>Услуги</legend>
          {services.map((service) => (
            <label key={service.id} className="desk-check">
              <input name="service" type="checkbox" value={service.id} defaultChecked={detail.serviceIds.includes(service.id)} />
              {service.name}
            </label>
          ))}
        </fieldset>
        <button className="cta" type="submit">
          Сохранить мастера
        </button>
      </form>

      <form className="desk-week" onSubmit={saveWeek}>
        <h2>Неделя и обед</h2>
        {week.map((day, index) => (
          <div key={day.weekday}>
            <label className="desk-check">
              <input
                type="checkbox"
                checked={day.on}
                onChange={(event) => setWeek(week.map((item, itemIndex) => (itemIndex === index ? { ...item, on: event.target.checked } : item)))}
              />
              {WEEKDAYS[day.weekday]}
            </label>
            <input
              type="time"
              value={day.start}
              disabled={!day.on}
              onChange={(event) => setWeek(week.map((item, itemIndex) => (itemIndex === index ? { ...item, start: event.target.value } : item)))}
            />
            <input
              type="time"
              value={day.end}
              disabled={!day.on}
              onChange={(event) => setWeek(week.map((item, itemIndex) => (itemIndex === index ? { ...item, end: event.target.value } : item)))}
            />
            <label className="desk-check">
              <input
                type="checkbox"
                checked={day.lunch}
                disabled={!day.on}
                onChange={(event) => setWeek(week.map((item, itemIndex) => (itemIndex === index ? { ...item, lunch: event.target.checked } : item)))}
              />
              Обед
            </label>
            <input
              type="time"
              value={day.breakStart}
              disabled={!day.on || !day.lunch}
              onChange={(event) => setWeek(week.map((item, itemIndex) => (itemIndex === index ? { ...item, breakStart: event.target.value } : item)))}
            />
            <input
              type="time"
              value={day.breakEnd}
              disabled={!day.on || !day.lunch}
              onChange={(event) => setWeek(week.map((item, itemIndex) => (itemIndex === index ? { ...item, breakEnd: event.target.value } : item)))}
            />
          </div>
        ))}
        <button className="cta" type="submit">
          Сохранить график
        </button>
      </form>

      <section>
        <h2>Портфолио</h2>
        <ul className="desk-photos">
          {detail.portfolio.map((item) => (
            <li key={item.id}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.imageUrl} alt="" />
              <button
                type="button"
                onClick={async () => {
                  await desk(`/admin/portfolio/${item.id}`, { method: "DELETE" });
                  await load();
                }}
              >
                Убрать
              </button>
            </li>
          ))}
        </ul>
        <label>
          Загрузить фото
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              setError("");
              try {
                await upload(file);
              } catch (reason) {
                setError(reason instanceof DeskError ? reason.message : "Фото не сохранилось");
              }
            }}
          />
        </label>
        <button type="button" onClick={linkTelegram}>
          {detail.telegramLinked ? "Новая ссылка Telegram" : "Привязать Telegram"}
        </button>
      </section>

      <section>
        <h2>Выходные</h2>
        <ul className="desk-lines">
          {detail.timeOff.map((item) => (
            <li key={item.id}>
              <span>
                {item.startsAt.slice(0, 10)} {item.note ?? "выходной"}
              </span>
              <button
                type="button"
                onClick={async () => {
                  await desk(`/admin/time-off/${item.id}`, { method: "DELETE" });
                  await load();
                }}
              >
                Убрать
              </button>
            </li>
          ))}
        </ul>
        <form className="desk-create" onSubmit={addOff}>
          <label>
            Дата
            <input type="date" value={offDate} onChange={(event) => setOffDate(event.target.value)} required />
          </label>
          <label>
            Заметка
            <input value={note} onChange={(event) => setNote(event.target.value)} />
          </label>
          <button type="submit">Закрыть день</button>
        </form>
      </section>
    </>
  );
}

function shiftDate(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1));
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}
