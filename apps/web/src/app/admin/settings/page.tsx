"use client";

import { desk, DeskError, tashkentInstant } from "@/lib/desk";
import { useEffect, useState, type FormEvent } from "react";

const LABELS: Record<string, string> = {
  cancel_cutoff_min: "Отмена не позже, минут",
  slot_step_min: "Шаг слота, минут",
  booking_horizon_days: "Горизонт записи, дней",
  min_notice_min: "Минимальное предупреждение, минут",
  reminder_day_minutes: "Напоминание за, минут",
  reminder_short_minutes: "Короткое напоминание, минут",
  review_delay_min: "Просьба об отзыве через, минут",
  timezone: "Часовой пояс",
  review_public_min_rating: "Публичный отзыв от оценки",
};

type Off = { id: string; startsAt: string; note: string | null };

export default function SettingsPage() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [closed, setClosed] = useState<Off[]>([]);
  const [date, setDate] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function load() {
    const [settings, timeOff] = await Promise.all([
      desk<{ settings: Record<string, string> }>("/admin/settings"),
      desk<{ timeOff: Off[] }>("/admin/time-off?barberId=shop"),
    ]);
    setValues(settings.settings);
    setClosed(timeOff.timeOff);
  }

  useEffect(() => {
    load().catch((reason: unknown) => setError(reason instanceof DeskError ? reason.message : "Настройки не открылись"));
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaved(false);
    setError("");
    try {
      await desk("/admin/settings", { method: "PUT", body: JSON.stringify({ settings: values }) });
      setSaved(true);
    } catch (reason) {
      setError(reason instanceof DeskError ? reason.message : "Настройки не сохранились");
    }
  }

  async function closeShop(event: FormEvent) {
    event.preventDefault();
    const [year, month, day] = date.split("-").map(Number);
    const next = new Date(Date.UTC(year, (month ?? 1) - 1, (day ?? 1) + 1)).toISOString().slice(0, 10);
    await desk("/admin/time-off", {
      method: "POST",
      body: JSON.stringify({
        barberId: null,
        startsAt: tashkentInstant(date, "00:00"),
        endsAt: tashkentInstant(next, "00:00"),
        type: "closed",
        note: "Салон закрыт",
      }),
    });
    await load();
  }

  return (
    <>
      <h1>Настройки</h1>
      {error ? <p className="desk-error">{error}</p> : null}
      {saved ? <p>Сохранено.</p> : null}
      <form className="desk-create" onSubmit={save}>
        {Object.entries(LABELS).map(([key, label]) => (
          <label key={key}>
            {label}
            <input value={values[key] ?? ""} onChange={(event) => setValues({ ...values, [key]: event.target.value })} />
          </label>
        ))}
        <button className="cta" type="submit">
          Сохранить настройки
        </button>
      </form>
      <section>
        <h2>Салон закрыт</h2>
        <ul className="desk-lines">
          {closed.map((item) => (
            <li key={item.id}>
              <span>{item.startsAt.slice(0, 10)}</span>
              <button
                type="button"
                onClick={async () => {
                  await desk(`/admin/time-off/${item.id}`, { method: "DELETE" });
                  await load();
                }}
              >
                Открыть
              </button>
            </li>
          ))}
        </ul>
        <form className="desk-create" onSubmit={closeShop}>
          <label>
            Дата
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
          </label>
          <button type="submit">Закрыть салон</button>
        </form>
      </section>
    </>
  );
}
