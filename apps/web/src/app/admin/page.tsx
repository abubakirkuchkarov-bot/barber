"use client";

import { desk, DeskError, STATUS_LABEL, tashkentDate, tashkentInstant, tashkentTime } from "@/lib/desk";
import { useEffect, useState, type FormEvent } from "react";

type Booking = {
  id: string;
  status: keyof typeof STATUS_LABEL;
  startsAt: string;
  totalDurationMin: number;
  totalPrice: number;
  barber: { id: string; name: string };
  services: Array<{ id: string; name: string }>;
  client: { name: string; phone: string };
};

type Option = { id: string; name: string; isActive?: boolean };

export default function BookingsPage() {
  const [date, setDate] = useState(tashkentDate());
  const [rows, setRows] = useState<Booking[]>([]);
  const [services, setServices] = useState<Option[]>([]);
  const [barbers, setBarbers] = useState<Option[]>([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ serviceId: "", barberId: "", time: "11:00", name: "", phone: "" });

  async function load(next = date) {
    const [bookings, serviceList, barberList] = await Promise.all([
      desk<{ bookings: Booking[] }>(`/admin/bookings?date=${next}`),
      desk<{ services: Option[] }>("/admin/services"),
      desk<{ barbers: Option[] }>("/admin/barbers"),
    ]);
    setRows(bookings.bookings);
    const activeServices = serviceList.services.filter((item) => item.isActive !== false);
    const activeBarbers = barberList.barbers.filter((item) => item.isActive !== false);
    setServices(activeServices);
    setBarbers(activeBarbers);
    setForm((current) => ({
      ...current,
      serviceId: current.serviceId || activeServices[0]?.id || "",
      barberId: current.barberId || activeBarbers[0]?.id || "",
    }));
  }

  useEffect(() => {
    load(date).catch((reason: unknown) => setError(reason instanceof DeskError ? reason.message : "Не удалось открыть день"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  async function create(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await desk("/admin/bookings", {
        method: "POST",
        body: JSON.stringify({
          serviceIds: [form.serviceId],
          barberId: form.barberId,
          startsAt: tashkentInstant(date, form.time),
          client: { name: form.name, phone: form.phone },
        }),
      });
      setForm((current) => ({ ...current, name: "", phone: "" }));
      await load(date);
    } catch (reason) {
      setError(reason instanceof DeskError ? reason.message : "Запись не создана");
    }
  }

  async function patch(id: string, body: object) {
    setError("");
    try {
      await desk(`/admin/bookings/${id}`, { method: "PATCH", body: JSON.stringify(body) });
      await load(date);
    } catch (reason) {
      setError(reason instanceof DeskError ? reason.message : "Запись не изменилась");
    }
  }

  return (
    <>
      <div className="desk-head">
        <h1>День</h1>
        <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
      </div>
      {error ? <p className="desk-error">{error}</p> : null}
      {rows.length === 0 ? <p className="desk-empty">На этот день записей нет.</p> : null}
      <ul className="desk-book">
        {rows.map((row) => (
          <li key={row.id}>
            <time>{tashkentTime(row.startsAt)}</time>
            <div>
              <strong>{row.client.name}</strong>
              <span>{row.client.phone}</span>
              <span>
                {row.services.map((service) => service.name).join(", ")}, {row.totalDurationMin} мин
              </span>
              <span>{row.barber.name}</span>
            </div>
            <div className="desk-row-actions">
              <select
                aria-label="Статус"
                value={row.status}
                onChange={(event) => patch(row.id, { status: event.target.value })}
              >
                {Object.entries(STATUS_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  const time = new FormData(event.currentTarget).get("time");
                  if (typeof time === "string" && time) patch(row.id, { startsAt: tashkentInstant(date, time) });
                }}
              >
                <input name="time" type="time" step={900} defaultValue={tashkentTime(row.startsAt)} aria-label="Новое время" />
                <button type="submit">Перенести</button>
              </form>
              {row.status === "confirmed" ? (
                <button type="button" onClick={() => patch(row.id, { status: "cancelled" })}>
                  Отменить
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      <form className="desk-create" onSubmit={create}>
        <h2>Новая запись</h2>
        <label>
          Услуга
          <select value={form.serviceId} onChange={(event) => setForm({ ...form, serviceId: event.target.value })}>
            {services.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Мастер
          <select value={form.barberId} onChange={(event) => setForm({ ...form, barberId: event.target.value })}>
            {barbers.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Время
          <input type="time" step={900} value={form.time} onChange={(event) => setForm({ ...form, time: event.target.value })} required />
        </label>
        <label>
          Имя
          <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
        </label>
        <label>
          Телефон
          <input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="+998" required />
        </label>
        <button className="cta" type="submit">
          Записать
        </button>
      </form>
    </>
  );
}
