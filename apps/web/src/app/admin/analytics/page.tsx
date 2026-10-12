"use client";

import { desk, DeskError, tashkentDate, WEEKDAYS } from "@/lib/desk";
import { useEffect, useState } from "react";

type Revenue = { total: number; completed: number; bookings: number };
type ServiceRow = { id: string; name: string; count: number; revenue: number };
type LoadRow = { id: string; name: string; bookedMin: number; openMin: number; visits: number; load: number };
type Cancels = { total: number; cancelled: number; noShow: number; cancelRate: number; noShowRate: number };
type Retention = { clients: number; returning: number; rate: number };
type Heat = { hours: number[]; rows: Array<{ weekday: number; counts: number[] }> };

function shiftDate(iso: string, days: number) {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, (month ?? 1) - 1, (day ?? 1) + days));
  return date.toISOString().slice(0, 10);
}

function money(value: number) {
  return `${value.toLocaleString("ru-RU")} сум`;
}

function percent(value: number) {
  return `${Math.round(value * 1000) / 10}%`;
}

export default function AnalyticsPage() {
  const today = tashkentDate();
  const [from, setFrom] = useState(shiftDate(today, -29));
  const [to, setTo] = useState(today);
  const [error, setError] = useState("");
  const [revenue, setRevenue] = useState<Revenue | null>(null);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [barbers, setBarbers] = useState<LoadRow[]>([]);
  const [cancels, setCancels] = useState<Cancels | null>(null);
  const [retention, setRetention] = useState<Retention | null>(null);
  const [heat, setHeat] = useState<Heat | null>(null);

  useEffect(() => {
    const query = `from=${from}&to=${to}`;
    let gone = false;
    setError("");
    Promise.all([
      desk<Revenue>(`/admin/analytics/revenue?${query}`),
      desk<{ services: ServiceRow[] }>(`/admin/analytics/services?${query}`),
      desk<{ barbers: LoadRow[] }>(`/admin/analytics/load?${query}`),
      desk<Cancels>(`/admin/analytics/cancellations?${query}`),
      desk<Retention>(`/admin/analytics/retention?${query}`),
      desk<Heat>(`/admin/analytics/heatmap?${query}`),
    ])
      .then(([moneyRow, serviceRow, loadRow, cancelRow, retentionRow, heatRow]) => {
        if (gone) return;
        setRevenue(moneyRow);
        setServices(serviceRow.services);
        setBarbers(loadRow.barbers);
        setCancels(cancelRow);
        setRetention(retentionRow);
        setHeat(heatRow);
      })
      .catch((reason: unknown) => {
        if (!gone) setError(reason instanceof DeskError ? reason.message : "Сводка не открылась");
      });
    return () => {
      gone = true;
    };
  }, [from, to]);

  const peak = Math.max(1, ...services.map((item) => item.count));
  const hottest = Math.max(1, ...(heat?.rows.flatMap((row) => row.counts) ?? [1]));

  return (
    <>
      <div className="desk-head">
        <h1>Сводка</h1>
        <form className="desk-period">
          <label>
            С
            <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </label>
          <label>
            По
            <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </label>
          <button type="button" onClick={() => { setFrom(shiftDate(today, -6)); setTo(today); }}>
            7 дней
          </button>
          <button type="button" onClick={() => { setFrom(shiftDate(today, -29)); setTo(today); }}>
            30 дней
          </button>
        </form>
      </div>
      {error ? <p className="desk-error">{error}</p> : null}
      <dl className="desk-figures">
        <div>
          <dt>Выручка</dt>
          <dd>{revenue ? money(revenue.total) : "…"}</dd>
        </div>
        <div>
          <dt>Записи</dt>
          <dd>{revenue ? revenue.bookings : "…"}</dd>
        </div>
        <div>
          <dt>Завершено</dt>
          <dd>{revenue ? revenue.completed : "…"}</dd>
        </div>
        <div>
          <dt>Отмены</dt>
          <dd>{cancels ? `${cancels.cancelled} · ${percent(cancels.cancelRate)}` : "…"}</dd>
        </div>
        <div>
          <dt>Неявки</dt>
          <dd>{cancels ? `${cancels.noShow} · ${percent(cancels.noShowRate)}` : "…"}</dd>
        </div>
        <div>
          <dt>Возвращаемость</dt>
          <dd>{retention ? `${retention.returning} из ${retention.clients}` : "…"}</dd>
        </div>
      </dl>

      <h2>Услуги</h2>
      {services.length === 0 ? <p className="desk-empty">В этом периоде услуг нет.</p> : null}
      <ul className="desk-rank">
        {services.map((item) => (
          <li key={item.id}>
            <span>{item.name}</span>
            <span className="desk-meter" aria-hidden="true">
              <span style={{ width: `${(item.count / peak) * 100}%` }} />
            </span>
            <span>
              {item.count} · {money(item.revenue)}
            </span>
          </li>
        ))}
      </ul>

      <h2>Мастера</h2>
      <ul className="desk-lines">
        {barbers.map((item) => (
          <li key={item.id}>
            <div>
              <strong>{item.name}</strong>
              <span>
                {item.visits} визитов, {item.bookedMin} из {item.openMin} мин
              </span>
            </div>
            <span>{percent(item.load)}</span>
          </li>
        ))}
      </ul>

      <h2>День и час</h2>
      <div className="desk-heat-wrap">
        <table className="desk-heat">
          <thead>
            <tr>
              <th />
              {heat?.hours.map((hour) => (
                <th key={hour}>{hour}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {heat?.rows.map((row) => (
              <tr key={row.weekday}>
                <th>{WEEKDAYS[row.weekday]}</th>
                {row.counts.map((count, index) => (
                  <td
                    key={heat.hours[index]}
                    style={{ background: count ? `rgba(154, 123, 79, ${0.18 + (count / hottest) * 0.82})` : undefined }}
                  >
                    {count || ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
