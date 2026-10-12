"use client";

import { formatDuration, formatPrice, shop } from "@/data/content";
import { formatDayMonth, formatVisit, formatWeekday, tashkentInstant } from "@/data/slots";
import {
  cancelBookingRequest,
  getAvailability,
  getAvailabilityDays,
  rescheduleBookingRequest,
  type BookingView,
  type DayAvailability,
} from "@/lib/api";
import Link from "next/link";
import { useEffect, useState } from "react";

type LoadStatus = "idle" | "loading" | "ready" | "empty" | "error";

export function ManageBooking({ initial }: { initial: BookingView }) {
  const [booking, setBooking] = useState(initial);
  const [mode, setMode] = useState<"view" | "move">("view");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [days, setDays] = useState<DayAvailability[]>([]);
  const [dayStatus, setDayStatus] = useState<LoadStatus>("idle");
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<string[]>([]);
  const [slotStatus, setSlotStatus] = useState<LoadStatus>("idle");
  const [time, setTime] = useState("");
  const [dayRetry, setDayRetry] = useState(0);
  const [slotRetry, setSlotRetry] = useState(0);

  const serviceIds = booking.services.map((item) => item.id).join(",");
  const visit = formatVisit(booking.startsAt);
  const title =
    booking.status === "cancelled"
      ? "Запись отменена."
      : booking.status === "confirmed"
        ? "Ваша запись."
        : "Визит завершён.";

  useEffect(() => {
    if (mode !== "move") return;
    let cancel = false;
    getAvailabilityDays(serviceIds, booking.barber.id).then((result) => {
      if (cancel) return;
      if (!result.ok) {
        setDays([]);
        setDayStatus("error");
        return;
      }
      setDays(result.days);
      setDayStatus(result.days.some((day) => day.open) ? "ready" : "empty");
    });
    return () => {
      cancel = true;
    };
  }, [mode, serviceIds, booking.barber.id, dayRetry]);

  useEffect(() => {
    if (mode !== "move" || !date) return;
    let cancel = false;
    getAvailability(serviceIds, booking.barber.id, date).then((result) => {
      if (cancel) return;
      if (!result.ok) {
        setSlots([]);
        setSlotStatus("error");
        return;
      }
      setSlots(result.slots);
      setSlotStatus(result.slots.length > 0 ? "ready" : "empty");
      setTime((current) => (result.slots.includes(current) ? current : ""));
    });
    return () => {
      cancel = true;
    };
  }, [mode, date, serviceIds, booking.barber.id, slotRetry]);

  function startMove() {
    setMode("move");
    setDayStatus("loading");
    setDays([]);
    setDate("");
    setTime("");
    setSlots([]);
    setSlotStatus("idle");
    setError("");
    setNotice("");
    setConfirmCancel(false);
  }

  async function cancelVisit() {
    setBusy(true);
    setError("");
    const result = await cancelBookingRequest(booking.manageToken);
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setBooking(result.booking);
    setMode("view");
    setConfirmCancel(false);
    setNotice("Запись отменена.");
  }

  async function moveVisit() {
    if (!date || !time || busy) return;
    setBusy(true);
    setError("");
    const result = await rescheduleBookingRequest(booking.manageToken, tashkentInstant(date, time));
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      if (result.code === "SLOT_TAKEN") {
        setTime("");
        setSlotStatus("loading");
        setSlots([]);
        setSlotRetry((value) => value + 1);
      }
      return;
    }
    setBooking(result.booking);
    setMode("view");
    setNotice("Время обновлено.");
  }

  return (
    <section className="book-done" aria-labelledby="manage-title">
      <h1 id="manage-title">{title}</h1>
      <p className="book-lead">
        {visit.day}, {visit.time}. {shop.address}.
      </p>
      <dl className="book-receipt">
        <div>
          <dt>Услуга</dt>
          <dd>
            {booking.services.map((item) => item.name).join(", ")}, {formatDuration(booking.totalDurationMin)}
          </dd>
        </div>
        <div>
          <dt>Мастер</dt>
          <dd>{booking.barber.name}</dd>
        </div>
        <div>
          <dt>Имя</dt>
          <dd>{booking.client.name}</dd>
        </div>
        <div>
          <dt>Телефон</dt>
          <dd>{booking.client.phone}</dd>
        </div>
        <div>
          <dt>Сумма</dt>
          <dd>{formatPrice(booking.totalPrice)}</dd>
        </div>
      </dl>

      {notice ? <p className="book-lead">{notice}</p> : null}
      {error ? <p className="field-error">{error}</p> : null}

      {booking.canManage && mode === "view" ? (
        <div className="book-actions">
          <button type="button" className="cta" onClick={startMove}>
            Перенести
          </button>
          {confirmCancel ? (
            <button type="button" className="quiet" disabled={busy} onClick={() => void cancelVisit()}>
              {busy ? "Отменяем" : "Да, отменить"}
            </button>
          ) : (
            <button type="button" className="quiet" onClick={() => setConfirmCancel(true)}>
              Отменить запись
            </button>
          )}
        </div>
      ) : null}

      {booking.status === "confirmed" && !booking.canManage ? (
        <p className="book-lead">Отменить и перенести уже нельзя.</p>
      ) : null}

      {mode === "move" ? (
        <div className="book-move">
          <h2>Новое время</h2>
          {dayStatus === "loading" ? <p className="book-lead">Смотрим свободные дни.</p> : null}
          {dayStatus === "error" ? (
            <button
              type="button"
              className="cta"
              onClick={() => {
                setDayStatus("loading");
                setDayRetry((value) => value + 1);
              }}
            >
              Повторить
            </button>
          ) : null}
          {dayStatus === "empty" ? <p className="book-lead">В ближайшие дни свободных окон нет.</p> : null}
          {dayStatus === "ready" ? (
            <ul className="book-dates" data-lenis-prevent>
              {days.map((iso) => (
                <li key={iso.date}>
                  <button
                    type="button"
                    className={iso.date === date ? "date-cell is-on" : "date-cell"}
                    aria-pressed={iso.date === date}
                    disabled={!iso.open}
                    onClick={() => {
                      setDate(iso.date);
                      setTime("");
                      setSlotStatus("loading");
                      setSlots([]);
                      setError("");
                    }}
                  >
                    <span>{formatWeekday(iso.date)}</span>
                    <strong>{formatDayMonth(iso.date)}</strong>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {slotStatus === "loading" ? <p className="book-lead">Смотрим окна.</p> : null}
          {slotStatus === "empty" ? <p className="book-lead">В этот день свободных окон нет.</p> : null}
          {slotStatus === "error" ? (
            <button
              type="button"
              className="cta"
              onClick={() => {
                setSlotStatus("loading");
                setSlotRetry((value) => value + 1);
              }}
            >
              Повторить
            </button>
          ) : null}
          {slotStatus === "ready" ? (
            <ul className="time-grid">
              {slots.map((slot) => (
                <li key={slot}>
                  <button
                    type="button"
                    className={slot === time ? "time-cell is-on" : "time-cell"}
                    aria-pressed={slot === time}
                    onClick={() => setTime(slot)}
                  >
                    {slot}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="book-actions">
            <button type="button" className="cta" disabled={!time || busy} onClick={() => void moveVisit()}>
              {busy ? "Переносим" : "Сохранить время"}
            </button>
            <button type="button" className="quiet" onClick={() => setMode("view")}>
              Назад
            </button>
          </div>
        </div>
      ) : (
        <div className="book-actions">
          <Link className="quiet" href="/">
            На главную
          </Link>
        </div>
      )}
    </section>
  );
}
