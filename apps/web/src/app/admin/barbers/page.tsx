"use client";

import { desk, DeskError } from "@/lib/desk";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

type Barber = {
  id: string;
  name: string;
  bio: string | null;
  experienceYears: number;
  isActive: boolean;
  telegramLinked: boolean;
};

export default function BarbersPage() {
  const [rows, setRows] = useState<Barber[]>([]);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState({ id: "", name: "", bio: "", experienceYears: 1 });

  async function load() {
    const body = await desk<{ barbers: Barber[] }>("/admin/barbers");
    setRows(body.barbers);
  }

  useEffect(() => {
    load().catch((reason: unknown) => setError(reason instanceof DeskError ? reason.message : "Мастера не открылись"));
  }, []);

  async function create(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await desk("/admin/barbers", {
        method: "POST",
        body: JSON.stringify({ ...draft, sortOrder: rows.length + 1, isActive: true, serviceIds: [] }),
      });
      setDraft({ id: "", name: "", bio: "", experienceYears: 1 });
      await load();
    } catch (reason) {
      setError(reason instanceof DeskError ? reason.message : "Мастер не добавлен");
    }
  }

  return (
    <>
      <h1>Мастера</h1>
      {error ? <p className="desk-error">{error}</p> : null}
      <ul className="desk-lines">
        {rows.map((row) => (
          <li key={row.id}>
            <div>
              <strong>{row.name}</strong>
              <span>
                {row.experienceYears} лет, {row.isActive ? "в смене" : "скрыт"}
                {row.telegramLinked ? ", Telegram привязан" : ""}
              </span>
            </div>
            <Link href={`/admin/barbers/${row.id}`}>График и фото</Link>
          </li>
        ))}
      </ul>
      <form className="desk-create" onSubmit={create}>
        <h2>Новый мастер</h2>
        <label>
          Код
          <input value={draft.id} onChange={(event) => setDraft({ ...draft, id: event.target.value })} placeholder="rustam" required />
        </label>
        <label>
          Имя
          <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} required />
        </label>
        <label>
          Опыт, лет
          <input
            type="number"
            min={0}
            value={draft.experienceYears}
            onChange={(event) => setDraft({ ...draft, experienceYears: Number(event.target.value) })}
          />
        </label>
        <button className="cta" type="submit">
          Добавить
        </button>
      </form>
    </>
  );
}
