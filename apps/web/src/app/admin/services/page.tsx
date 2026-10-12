"use client";

import { desk, DeskError } from "@/lib/desk";
import { useEffect, useState, type FormEvent } from "react";

type Service = {
  id: string;
  name: string;
  description: string;
  durationMin: number;
  price: number;
  isActive: boolean;
  sortOrder: number;
};

const empty = { id: "", name: "", description: "", durationMin: 45, price: 100000, sortOrder: 10 };

export default function ServicesPage() {
  const [rows, setRows] = useState<Service[]>([]);
  const [draft, setDraft] = useState(empty);
  const [error, setError] = useState("");

  async function load() {
    const body = await desk<{ services: Service[] }>("/admin/services");
    setRows(body.services);
  }

  useEffect(() => {
    load().catch((reason: unknown) => setError(reason instanceof DeskError ? reason.message : "Услуги не открылись"));
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await desk("/admin/services", { method: "POST", body: JSON.stringify({ ...draft, isActive: true }) });
      setDraft(empty);
      await load();
    } catch (reason) {
      setError(reason instanceof DeskError ? reason.message : "Услуга не сохранена");
    }
  }

  async function toggle(row: Service) {
    await desk(`/admin/services/${row.id}`, { method: "PATCH", body: JSON.stringify({ isActive: !row.isActive }) });
    await load();
  }

  async function remove(id: string) {
    await desk(`/admin/services/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <>
      <h1>Услуги</h1>
      {error ? <p className="desk-error">{error}</p> : null}
      <ul className="desk-lines">
        {rows.map((row) => (
          <li key={row.id}>
            <div>
              <strong>{row.name}</strong>
              <span>
                {row.durationMin} мин, {row.price.toLocaleString("ru-RU")} сум
              </span>
              <span>{row.isActive ? "На сайте" : "Скрыта"}</span>
            </div>
            <button type="button" onClick={() => toggle(row)}>
              {row.isActive ? "Скрыть" : "Показать"}
            </button>
            <button type="button" onClick={() => remove(row.id)}>
              Убрать
            </button>
          </li>
        ))}
      </ul>
      <form className="desk-create" onSubmit={save}>
        <h2>Новая услуга</h2>
        <label>
          Код
          <input value={draft.id} onChange={(event) => setDraft({ ...draft, id: event.target.value })} placeholder="beard" required />
        </label>
        <label>
          Название
          <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} required />
        </label>
        <label>
          Описание
          <input value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} required />
        </label>
        <label>
          Минуты
          <input
            type="number"
            min={5}
            value={draft.durationMin}
            onChange={(event) => setDraft({ ...draft, durationMin: Number(event.target.value) })}
          />
        </label>
        <label>
          Цена, сум
          <input type="number" min={0} value={draft.price} onChange={(event) => setDraft({ ...draft, price: Number(event.target.value) })} />
        </label>
        <button className="cta" type="submit">
          Добавить
        </button>
      </form>
    </>
  );
}
