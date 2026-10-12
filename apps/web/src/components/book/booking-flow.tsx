"use client";

import { formatDuration, formatPrice, shop } from "@/data/content";
import {
  formatDayMonth,
  formatFullDate,
  formatVisit,
  formatWeekday,
  isValidName,
  normalizePhone,
  tashkentInstant,
} from "@/data/slots";
import { createBookingRequest, getAvailability, getAvailabilityDays, type BookingView, type DayAvailability } from "@/lib/api";
import type { Barber, Service } from "@/lib/catalog";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";

const STEPS = ["service", "barber", "date", "time", "contacts"] as const;

type Step = (typeof STEPS)[number] | "done";

const STEP_LABEL: Record<(typeof STEPS)[number], string> = {
  service: "Услуга",
  barber: "Мастер",
  date: "Дата",
  time: "Время",
  contacts: "Контакты",
};

const ANY_BARBER = "any";

type SlotStatus = "idle" | "loading" | "ready" | "empty" | "error";

export function BookingFlow({
  initialService,
  services,
  barbers,
}: {
  initialService?: string;
  services: Service[];
  barbers: Barber[];
}) {
  const knownService = services.some((service) => service.id === initialService)
    ? initialService
    : "";

  const [step, setStep] = useState<Step>("service");
  const [serviceId, setServiceId] = useState(knownService ?? "");
  const [barberId, setBarberId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [slotStatus, setSlotStatus] = useState<SlotStatus>("idle");
  const [slots, setSlots] = useState<string[]>([]);
  const [dayStatus, setDayStatus] = useState<SlotStatus>("idle");
  const [days, setDays] = useState<DayAvailability[]>([]);
  const [retryToken, setRetryToken] = useState(0);
  const [dayRetry, setDayRetry] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [triedSubmit, setTriedSubmit] = useState(false);
  const [formError, setFormError] = useState("");
  const [confirmation, setConfirmation] = useState<BookingView | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const mounted = useRef(false);
  const nameErrorId = useId();
  const phoneErrorId = useId();

  const service = services.find((item) => item.id === serviceId);
  const barber = barbers.find((item) => item.id === barberId);
  const phoneValue = normalizePhone(phone);
  const nameOk = isValidName(name);
  const phoneOk = Boolean(phoneValue);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  useEffect(() => {
    if (step !== "date" || !serviceId || !barberId) return;
    let cancel = false;
    getAvailabilityDays(serviceId, barberId).then((result) => {
      if (cancel) return;
      if (!result.ok) {
        setDays([]);
        setDayStatus("error");
        return;
      }
      setDays(result.days);
      setDate((current) => (result.days.some((day) => day.date === current && day.open) ? current : ""));
      setDayStatus(result.days.some((day) => day.open) ? "ready" : "empty");
    });
    return () => {
      cancel = true;
    };
  }, [step, serviceId, barberId, dayRetry]);

  useEffect(() => {
    if (step !== "time" || !date || !barberId || !serviceId) return;
    let cancel = false;
    getAvailability(serviceId, barberId, date).then((result) => {
      if (cancel) return;
      if (!result.ok) {
        setSlots([]);
        setSlotStatus("error");
        setFormError(result.message);
        return;
      }
      setSlots(result.slots);
      setSlotStatus(result.slots.length > 0 ? "ready" : "empty");
      setTime((current) => (result.slots.includes(current) ? current : ""));
    });
    return () => {
      cancel = true;
    };
  }, [step, date, barberId, serviceId, retryToken]);

  function go(next: Step) {
    if (next === "time") {
      setSlotStatus("loading");
      setSlots([]);
    }
    if (next === "date") {
      setDayStatus("loading");
      setDays([]);
    }
    setFormError("");
    setStep(next);
  }

  function reachable(target: (typeof STEPS)[number]) {
    if (target === "service") return true;
    if (target === "barber") return Boolean(serviceId);
    if (target === "date") return Boolean(serviceId && barberId);
    if (target === "time") return Boolean(serviceId && barberId && date);
    return Boolean(serviceId && barberId && date && time);
  }

  async function submit() {
    setTriedSubmit(true);
    if (!nameOk || !phoneOk || !phoneValue || submitting || !serviceId || !date || !time) return;
    setSubmitting(true);
    setFormError("");
    const result = await createBookingRequest({
      serviceIds: [serviceId],
      barberId,
      startsAt: tashkentInstant(date, time),
      client: { name: name.trim(), phone: phoneValue },
    });
    setSubmitting(false);
    if (!result.ok) {
      setFormError(result.message);
      if (result.code === "SLOT_TAKEN") {
        setTime("");
        setSlotStatus("loading");
        setSlots([]);
        setRetryToken((value) => value + 1);
        setStep("time");
      }
      return;
    }
    setConfirmation(result.booking);
    setStep("done");
  }

  function reset() {
    setStep("service");
    setServiceId("");
    setBarberId("");
    setDate("");
    setTime("");
    setName("");
    setPhone("");
    setSlotStatus("idle");
    setSlots([]);
    setDayStatus("idle");
    setDays([]);
    setRetryToken(0);
    setDayRetry(0);
    setTriedSubmit(false);
    setFormError("");
    setConfirmation(null);
  }

  const nextLabel = step === "contacts" ? "Записаться" : "Дальше";
  const nextDisabled =
    submitting ||
    (step === "service" && !serviceId) ||
    (step === "barber" && !barberId) ||
    (step === "date" && !date) ||
    (step === "time" && (slotStatus !== "ready" || !time)) ||
    (step === "contacts" && triedSubmit && (!nameOk || !phoneOk));

  function onNext() {
    if (step === "service" && serviceId) go("barber");
    else if (step === "barber" && barberId) go("date");
    else if (step === "date" && date) {
      setRetryToken(0);
      go("time");
    } else if (step === "time" && time) go("contacts");
    else if (step === "contacts") void submit();
  }

  const compact = [
    service?.name,
    barberId ? barberLabel(barberId, barber) : "",
    date ? formatDayMonth(date) : "",
    time,
  ]
    .filter(Boolean)
    .join(", ");

  if (step === "done" && confirmation && phoneValue) {
    const visit = formatVisit(confirmation.startsAt);
    return (
      <section className="book-done" aria-labelledby="book-title">
        <h1 id="book-title" ref={headingRef} tabIndex={-1}>
          Вы записаны.
        </h1>
        <p className="book-lead">
          {visit.day}, {visit.time}. {shop.address}.
        </p>
        <dl className="book-receipt">
          <div>
            <dt>Услуга</dt>
            <dd>
              {confirmation.services.map((item) => item.name).join(", ")},{" "}
              {formatDuration(confirmation.totalDurationMin)}
            </dd>
          </div>
          <div>
            <dt>Мастер</dt>
            <dd>{confirmation.barber.name}</dd>
          </div>
          <div>
            <dt>Имя</dt>
            <dd>{confirmation.client.name}</dd>
          </div>
          <div>
            <dt>Телефон</dt>
            <dd>{confirmation.client.phone}</dd>
          </div>
          <div>
            <dt>Сумма</dt>
            <dd>{formatPrice(confirmation.totalPrice)}</dd>
          </div>
        </dl>
        <div className="book-actions">
          <Link className="cta" href={`/booking/${confirmation.manageToken}`}>
            Изменить или отменить
          </Link>
          {confirmation.telegramUrl ? (
            <a className="quiet" href={confirmation.telegramUrl}>
              Получить подтверждение в Telegram
            </a>
          ) : null}
          <Link className="quiet" href="/">
            На главную
          </Link>
          <button type="button" className="quiet" onClick={reset}>
            Новая запись
          </button>
        </div>
      </section>
    );
  }

  return (
    <div className="book-layout">
      <div className="book-main">
        <ol className="book-steps">
          {STEPS.map((item) => {
            const current = item === step;
            const allowed = reachable(item) && !current;
            return (
              <li key={item}>
                {allowed ? (
                  <button type="button" onClick={() => go(item)}>
                    {STEP_LABEL[item]}
                  </button>
                ) : (
                  <span aria-current={current ? "step" : undefined}>{STEP_LABEL[item]}</span>
                )}
              </li>
            );
          })}
        </ol>

        {step !== "service" ? (
          <button
            type="button"
            className="book-back"
            onClick={() => {
              const index = STEPS.indexOf(step as (typeof STEPS)[number]);
              const previous = STEPS[index - 1];
              if (previous) go(previous);
            }}
          >
            Назад
          </button>
        ) : null}

        <h1 id="book-title" ref={headingRef} tabIndex={-1}>
          {step === "service" && "Выберите услугу"}
          {step === "barber" && "Выберите мастера"}
          {step === "date" && "Выберите дату"}
          {step === "time" && "Выберите время"}
          {step === "contacts" && "Имя и телефон"}
        </h1>

        {step === "service" ? (
          <ol className="service-list book-services">
            {services.map((item, index) => (
              <li key={item.id}>
                <ServiceChoice
                  service={item}
                  index={index}
                  pressed={item.id === serviceId}
                  onChoose={() => {
                    setServiceId(item.id);
                    setDate("");
                    setTime("");
                  }}
                />
              </li>
            ))}
          </ol>
        ) : null}

        {step === "barber" ? (
          <div className="book-barbers" data-lenis-prevent>
            <BarberChoice
              pressed={barberId === ANY_BARBER}
              onChoose={() => {
                setBarberId(ANY_BARBER);
                setDate("");
                setTime("");
              }}
              name="Любой свободный"
              meta="Кто освободится в это время"
            />
            {barbers.map((item) => (
              <BarberChoice
                key={item.id}
                barber={item}
                pressed={item.id === barberId}
                onChoose={() => {
                  setBarberId(item.id);
                  setDate("");
                  setTime("");
                }}
                name={item.name}
                meta={item.bio ?? "Мастер"}
              />
            ))}
          </div>
        ) : null}

        {step === "date" ? (
          <div aria-live="polite">
            {dayStatus === "loading" ? (
              <ul className="book-dates" aria-busy="true" aria-label="Загрузка дат">
                {Array.from({ length: 6 }, (_, index) => (
                  <li key={index}>
                    <span className="time-skeleton" />
                  </li>
                ))}
              </ul>
            ) : null}
            {dayStatus === "error" ? (
              <div className="book-status">
                <p>Даты не загрузились.</p>
                <button
                  type="button"
                  className="cta"
                  onClick={() => {
                    setDayStatus("loading");
                    setDays([]);
                    setDayRetry((value) => value + 1);
                  }}
                >
                  Повторить
                </button>
              </div>
            ) : null}
            {dayStatus === "empty" ? (
              <div className="book-status">
                <p>В ближайшие дни свободных окон нет.</p>
              </div>
            ) : null}
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
                        setRetryToken(0);
                      }}
                    >
                      <span>{formatWeekday(iso.date)}</span>
                      <strong>{formatDayMonth(iso.date)}</strong>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {step === "time" ? (
          <div className="book-times" aria-live="polite">
            {slotStatus === "loading" ? (
              <div className="time-grid" aria-busy="true" aria-label="Загрузка времени">
                {Array.from({ length: 5 }, (_, index) => (
                  <span key={index} className="time-skeleton" />
                ))}
              </div>
            ) : null}
            {slotStatus === "empty" ? (
              <div className="book-status">
                <p>В этот день свободных окон нет.</p>
                <button type="button" className="quiet" onClick={() => go("date")}>
                  Другая дата
                </button>
              </div>
            ) : null}
            {slotStatus === "error" ? (
              <div className="book-status">
                <p>{formError || "Свободное время не загрузилось."}</p>
                <button
                  type="button"
                  className="cta"
                  onClick={() => {
                    setSlotStatus("loading");
                    setSlots([]);
                    setRetryToken((value) => value + 1);
                  }}
                >
                  Повторить
                </button>
              </div>
            ) : null}
            {slotStatus === "ready" ? (
              <>
                {formError ? <p className="field-error">{formError}</p> : null}
                <ul className="time-grid">
                  {slots.map((slot) => (
                    <li key={slot}>
                      <button
                        type="button"
                        className={slot === time ? "time-cell is-on" : "time-cell"}
                        aria-pressed={slot === time}
                        onClick={() => {
                          setTime(slot);
                          setFormError("");
                        }}
                      >
                        {slot}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>
        ) : null}

        {step === "contacts" ? (
          <form
            id="book-form"
            className="book-form"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <div className="field">
              <label htmlFor="book-name">Имя</label>
              <input
                id="book-name"
                name="name"
                autoComplete="name"
                value={name}
                aria-invalid={triedSubmit && !nameOk}
                aria-describedby={triedSubmit && !nameOk ? nameErrorId : undefined}
                onChange={(event) => setName(event.target.value)}
              />
              {triedSubmit && !nameOk ? (
                <p id={nameErrorId} className="field-error">
                  Напишите имя
                </p>
              ) : null}
            </div>
            <div className="field">
              <label htmlFor="book-phone">Телефон</label>
              <input
                id="book-phone"
                name="tel"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="+998 90 123 45 67"
                value={phone}
                aria-invalid={triedSubmit && !phoneOk}
                aria-describedby={triedSubmit && !phoneOk ? phoneErrorId : undefined}
                onChange={(event) => setPhone(event.target.value)}
              />
              {triedSubmit && !phoneOk ? (
                <p id={phoneErrorId} className="field-error">
                  Нужен номер из 9 цифр, можно с +998
                </p>
              ) : null}
            </div>
            {formError ? <p className="field-error">{formError}</p> : null}
          </form>
        ) : null}
      </div>

      <aside className="book-summary" aria-label="Выбранная запись">
        <div className="book-summary-full">
          <h2>Ваша запись</h2>
          <dl className="book-receipt">
            <div>
              <dt>Услуга</dt>
              <dd>{service ? `${service.name}, ${formatDuration(service.durationMin)}` : "Не выбрана"}</dd>
            </div>
            <div>
              <dt>Мастер</dt>
              <dd>{barberId ? barberLabel(barberId, barber) : "Не выбран"}</dd>
            </div>
            <div>
              <dt>Дата</dt>
              <dd>{date ? formatFullDate(date) : "Не выбрана"}</dd>
            </div>
            <div>
              <dt>Время</dt>
              <dd>{time || "Не выбрано"}</dd>
            </div>
            {service ? (
              <div>
                <dt>Сумма</dt>
                <dd>{formatPrice(service.price)}</dd>
              </div>
            ) : null}
          </dl>
        </div>
        <p className="book-summary-compact">{compact || "Выберите услугу"}</p>
        {step === "time" && (slotStatus === "empty" || slotStatus === "error") ? null : (
          <button
            type={step === "contacts" ? "submit" : "button"}
            form={step === "contacts" ? "book-form" : undefined}
            className="cta"
            disabled={nextDisabled}
            aria-busy={submitting}
            onClick={() => {
              if (step !== "contacts") onNext();
            }}
          >
            {submitting ? "Записываем" : nextLabel}
          </button>
        )}
      </aside>
    </div>
  );
}

function barberLabel(id: string, barber: Barber | undefined) {
  if (id === ANY_BARBER) return "Любой свободный";
  return barber?.name ?? "";
}

function ServiceChoice({
  service,
  index,
  pressed,
  onChoose,
}: {
  service: Service;
  index: number;
  pressed: boolean;
  onChoose: () => void;
}) {
  return (
    <button
      type="button"
      className={pressed ? "service-row is-on" : "service-row"}
      aria-pressed={pressed}
      onClick={onChoose}
    >
      <span className="service-no">{String(index + 1).padStart(2, "0")}</span>
      <span className="service-copy">
        <span className="service-name">{service.name}</span>
        <span className="service-meta">{formatDuration(service.durationMin)}</span>
      </span>
      <span className="service-end">
        <span className="service-price">{formatPrice(service.price)}</span>
      </span>
      <span className="rule" aria-hidden="true" />
    </button>
  );
}

function BarberChoice({
  barber,
  pressed,
  onChoose,
  name,
  meta,
}: {
  barber?: Barber;
  pressed: boolean;
  onChoose: () => void;
  name: string;
  meta: string;
}) {
  return (
    <button
      type="button"
      className={pressed ? "book-barber is-on" : "book-barber"}
      aria-pressed={pressed}
      onClick={onChoose}
    >
      <span className="barber-photo">
        {barber?.photoUrl ? (
          <Image src={barber.photoUrl} alt="" fill sizes="180px" />
        ) : (
          <span className="barber-any">Свободный мастер</span>
        )}
      </span>
      <span className="master-name">{name}</span>
      <span className="master-meta">{meta}</span>
    </button>
  );
}
