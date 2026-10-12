import { useEffect, useState } from "react";
import {
  cancelBooking,
  createBooking,
  fetchDevSession,
  getAvailability,
  getAvailabilityDays,
  getBarbers,
  getMe,
  getMyBookings,
  getServices,
  rescheduleBooking,
  webOrigin,
  type Barber,
  type BookingView,
  type DayAvailability,
  type Service,
} from "./api";
import {
  applyTheme,
  formatDayMonth,
  formatDuration,
  formatPrice,
  formatWeekday,
  formatWhen,
  isValidName,
  normalizePhone,
  tashkentInstant,
} from "./format";

type Tab = "book" | "mine";
type Step = "service" | "barber" | "date" | "time" | "contacts" | "done";
type Load = "idle" | "loading" | "ready" | "empty" | "error";

const ANY = "any";

export function App() {
  const [tab, setTab] = useState<Tab>("book");
  const [initData, setInitData] = useState<string | null>(null);
  const [sessionNote, setSessionNote] = useState("");
  const [userName, setUserName] = useState("");
  const [services, setServices] = useState<Service[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [catalogError, setCatalogError] = useState("");
  const [step, setStep] = useState<Step>("service");
  const [serviceId, setServiceId] = useState("");
  const [barberId, setBarberId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [days, setDays] = useState<DayAvailability[]>([]);
  const [dayLoad, setDayLoad] = useState<Load>("idle");
  const [slots, setSlots] = useState<string[]>([]);
  const [slotLoad, setSlotLoad] = useState<Load>("idle");
  const [slotRetry, setSlotRetry] = useState(0);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState<BookingView | null>(null);
  const [bookings, setBookings] = useState<BookingView[]>([]);
  const [mineLoad, setMineLoad] = useState<Load>("idle");
  const [moving, setMoving] = useState<BookingView | null>(null);

  const service = services.find((item) => item.id === serviceId);
  const barber = barbers.find((item) => item.id === barberId);

  useEffect(() => {
    const webApp = window.Telegram?.WebApp;
    webApp?.ready();
    webApp?.expand();
    applyTheme(webApp?.themeParams);
    const onTheme = () => applyTheme(window.Telegram?.WebApp.themeParams);
    webApp?.onEvent("themeChanged", onTheme);
    let cancel = false;
    const existing = webApp?.initData ?? "";
    if (existing) {
      setInitData(existing);
    } else if (import.meta.env.DEV) {
      fetchDevSession().then((result) => {
        if (cancel) return;
        if (result.ok) setInitData(result.initData);
        else setSessionNote("Локальная сессия Telegram не открылась. Запись и «Мои» ждут initData.");
      });
    } else {
      setSessionNote("Откройте Кромку внутри Telegram, чтобы записать и видеть свои визиты.");
    }
    return () => {
      cancel = true;
      webApp?.offEvent("themeChanged", onTheme);
    };
  }, []);

  useEffect(() => {
    if (!initData) return;
    getMe(initData).then((result) => {
      if (!result.ok) return;
      setUserName(result.user.name);
      setName((current) => current || result.client?.name || result.user.name);
      setPhone((current) => current || result.client?.phone || "");
    });
  }, [initData]);

  useEffect(() => {
    let cancel = false;
    Promise.all([getServices(), getBarbers()]).then(([serviceResult, barberResult]) => {
      if (cancel) return;
      if (!serviceResult.ok || !barberResult.ok) {
        setCatalogError("Не удалось загрузить услуги и мастеров.");
        return;
      }
      setServices(serviceResult.services);
      setBarbers(barberResult.barbers);
    });
    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    if (step !== "date" || !serviceId || !barberId) return;
    let cancel = false;
    getAvailabilityDays(serviceId, barberId).then((result) => {
      if (cancel) return;
      if (!result.ok) {
        setDayLoad("error");
        return;
      }
      setDays(result.days);
      setDayLoad(result.days.some((day) => day.open) ? "ready" : "empty");
    });
    return () => {
      cancel = true;
    };
  }, [step, serviceId, barberId]);

  useEffect(() => {
    const activeService = moving ? moving.services.map((item) => item.id).join(",") : serviceId;
    const activeBarber = moving ? moving.barber.id : barberId;
    const activeDate = date;
    if ((!moving && step !== "time") || !activeDate || !activeService || !activeBarber) return;
    let cancel = false;
    getAvailability(activeService, activeBarber, activeDate).then((result) => {
      if (cancel) return;
      if (!result.ok) {
        setSlotLoad("error");
        setNotice(result.message);
        return;
      }
      setSlots(result.slots);
      setSlotLoad(result.slots.length ? "ready" : "empty");
    });
    return () => {
      cancel = true;
    };
  }, [step, date, serviceId, barberId, moving, slotRetry]);

  useEffect(() => {
    if (tab !== "mine" || !initData) return;
    let cancel = false;
    getMyBookings(initData).then((result) => {
      if (cancel) return;
      if (!result.ok) {
        setMineLoad("error");
        setNotice(result.message);
        return;
      }
      setBookings(result.bookings);
      setMineLoad(result.bookings.length ? "ready" : "empty");
    });
    return () => {
      cancel = true;
    };
  }, [tab, initData]);

  function openMine() {
    setTab("mine");
    setMoving(null);
    setMineLoad("loading");
    setNotice("");
  }

  async function submit() {
    const phoneValue = normalizePhone(phone);
    if (!initData || !serviceId || !date || !time || !isValidName(name) || !phoneValue || busy) return;
    setBusy(true);
    setNotice("");
    const result = await createBooking(initData, {
      serviceIds: [serviceId],
      barberId,
      startsAt: tashkentInstant(date, time),
      client: { name: name.trim(), phone: phoneValue },
    });
    setBusy(false);
    if (!result.ok) {
      setNotice(result.message);
      if (result.code === "SLOT_TAKEN") {
        setTime("");
        setSlotLoad("loading");
        setSlots([]);
        setSlotRetry((value) => value + 1);
        setStep("time");
      }
      return;
    }
    setConfirmation(result.booking);
    setStep("done");
  }

  async function cancelVisit(booking: BookingView) {
    setBusy(true);
    setNotice("");
    const result = await cancelBooking(booking.manageToken);
    setBusy(false);
    if (!result.ok) {
      setNotice(result.message);
      return;
    }
    setBookings((current) => current.map((item) => (item.manageToken === booking.manageToken ? result.booking : item)));
    setMoving(null);
  }

  async function moveVisit() {
    if (!moving || !date || !time || busy) return;
    setBusy(true);
    setNotice("");
    const result = await rescheduleBooking(moving.manageToken, tashkentInstant(date, time));
    setBusy(false);
    if (!result.ok) {
      setNotice(result.message);
      if (result.code === "SLOT_TAKEN") {
        setTime("");
        setSlotLoad("loading");
        setSlots([]);
        setSlotRetry((value) => value + 1);
      }
      return;
    }
    setBookings((current) => current.map((item) => (item.manageToken === moving.manageToken ? result.booking : item)));
    setMoving(null);
    setNotice("Время обновлено.");
  }

  const nextDisabled =
    busy ||
    (step === "service" && !serviceId) ||
    (step === "barber" && !barberId) ||
    (step === "date" && !date) ||
    (step === "time" && !time) ||
    (step === "contacts" && (!isValidName(name) || !normalizePhone(phone)));

  function onNext() {
    setNotice("");
    if (step === "service" && serviceId) setStep("barber");
    else if (step === "barber" && barberId) {
      setDayLoad("loading");
      setDays([]);
      setStep("date");
    } else if (step === "date" && date) {
      setSlotLoad("loading");
      setSlots([]);
      setStep("time");
    } else if (step === "time" && time) setStep("contacts");
    else if (step === "contacts") void submit();
  }

  return (
    <div className="app">
      <header className="top">
        <p className="mark">Кромка</p>
        <p className="place">{userName ? userName : "Ташкент"}</p>
      </header>

      {tab === "book" ? (
        <main>
          {catalogError ? <p className="lead">{catalogError}</p> : null}
          {sessionNote && step === "contacts" ? <p className="lead">{sessionNote}</p> : null}
          <h1>
            {step === "service" && "Услуга"}
            {step === "barber" && "Мастер"}
            {step === "date" && "Дата"}
            {step === "time" && "Время"}
            {step === "contacts" && "Как к вам обращаться"}
            {step === "done" && "Вы записаны."}
          </h1>
          {notice && step !== "done" ? <p className="notice">{notice}</p> : null}

          {step === "service" ? (
            <ul className="rows">
              {services.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={item.id === serviceId ? "row is-on" : "row"}
                    aria-pressed={item.id === serviceId}
                    onClick={() => {
                      setServiceId(item.id);
                      setDate("");
                      setTime("");
                    }}
                  >
                    <span>
                      <strong>{item.name}</strong>
                      <small>
                        {item.description} {formatDuration(item.durationMin)}
                      </small>
                    </span>
                    <em>{formatPrice(item.price)}</em>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {step === "barber" ? (
            <ul className="rows">
              <li>
                <button
                  type="button"
                  className={barberId === ANY ? "row is-on" : "row"}
                  aria-pressed={barberId === ANY}
                  onClick={() => {
                    setBarberId(ANY);
                    setDate("");
                    setTime("");
                  }}
                >
                  <span>
                    <strong>Любой свободный</strong>
                    <small>Кто освободится в это время</small>
                  </span>
                </button>
              </li>
              {barbers.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={item.id === barberId ? "row is-on" : "row"}
                    aria-pressed={item.id === barberId}
                    onClick={() => {
                      setBarberId(item.id);
                      setDate("");
                      setTime("");
                    }}
                  >
                    {item.photoUrl ? (
                      <img src={`${webOrigin}${item.photoUrl}`} alt="" />
                    ) : (
                      <span className="photo-fallback" />
                    )}
                    <span>
                      <strong>{item.name}</strong>
                      <small>
                        {item.bio ?? "Мастер"}. Опыт {item.experienceYears} лет
                      </small>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {step === "date" ? (
            <DateList
              load={dayLoad}
              days={days}
              date={date}
              onPick={(iso) => {
                setDate(iso);
                setTime("");
              }}
              onRetry={() => {
                setDayLoad("loading");
                setStep("barber");
                setTimeout(() => setStep("date"), 0);
              }}
            />
          ) : null}

          {step === "time" ? <TimeList load={slotLoad} slots={slots} time={time} onPick={setTime} /> : null}

          {step === "contacts" ? (
            <form
              className="fields"
              onSubmit={(event) => {
                event.preventDefault();
                void submit();
              }}
            >
              <label>
                Имя
                <input value={name} autoComplete="name" onChange={(event) => setName(event.target.value)} />
              </label>
              <label>
                Телефон
                <input
                  value={phone}
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="+998 90 123 45 67"
                  onChange={(event) => setPhone(event.target.value)}
                />
              </label>
            </form>
          ) : null}

          {step === "done" && confirmation ? (
            <div className="receipt">
              <p>{formatWhen(confirmation.startsAt)}</p>
              <p>
                {confirmation.services.map((item) => item.name).join(", ")}, {formatDuration(confirmation.totalDurationMin)}
              </p>
              <p>{confirmation.barber.name}</p>
              <p>{formatPrice(confirmation.totalPrice)}</p>
            </div>
          ) : null}
        </main>
      ) : (
        <main>
          <h1>Мои записи</h1>
          {notice ? <p className="notice">{notice}</p> : null}
          {!initData ? <p className="lead">{sessionNote || "Нужна сессия Telegram."}</p> : null}
          {mineLoad === "loading" ? <p className="lead">Смотрим записи.</p> : null}
          {mineLoad === "empty" ? <p className="lead">Записей пока нет.</p> : null}
          {mineLoad === "error" ? <p className="lead">Список не загрузился.</p> : null}
          <ul className="rows">
            {bookings.map((booking) => (
              <li key={booking.manageToken} className="visit">
                <strong>{formatWhen(booking.startsAt)}</strong>
                <small>
                  {booking.services.map((item) => item.name).join(", ")}. {booking.barber.name}.{" "}
                  {statusLabel(booking.status)}
                </small>
                {booking.canManage ? (
                  <span className="visit-actions">
                    <button type="button" className="text" onClick={() => startMove(booking)}>
                      Перенести
                    </button>
                    <button type="button" className="text" disabled={busy} onClick={() => void cancelVisit(booking)}>
                      Отменить
                    </button>
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
          {moving ? (
            <section className="move">
              <h2>Новое время</h2>
              <DateList
                load={dayLoad}
                days={days}
                date={date}
                onPick={(iso) => {
                  setDate(iso);
                  setTime("");
                  setSlotLoad("loading");
                  setSlots([]);
                }}
                onRetry={() => setDayLoad("loading")}
              />
              {date ? <TimeList load={slotLoad} slots={slots} time={time} onPick={setTime} /> : null}
              <button type="button" className="primary" disabled={!time || busy} onClick={() => void moveVisit()}>
                {busy ? "Переносим" : "Сохранить время"}
              </button>
            </section>
          ) : null}
        </main>
      )}

      {tab === "book" && step !== "done" ? (
        <div className="dock">
          {step !== "service" ? (
            <button
              type="button"
              className="ghost"
              onClick={() => {
                const order: Step[] = ["service", "barber", "date", "time", "contacts"];
                const previous = order[order.indexOf(step) - 1];
                if (previous) setStep(previous);
              }}
            >
              Назад
            </button>
          ) : (
            <span />
          )}
          <button type="button" className="primary" disabled={nextDisabled} onClick={onNext}>
            {busy ? "Записываем" : step === "contacts" ? "Записаться" : "Дальше"}
          </button>
        </div>
      ) : null}
      {tab === "book" && step === "done" ? (
        <div className="dock">
          <button type="button" className="primary" onClick={openMine}>
            Мои записи
          </button>
        </div>
      ) : null}

      <nav className="tabs">
        <button type="button" aria-current={tab === "book" ? "page" : undefined} onClick={() => setTab("book")}>
          Запись
        </button>
        <button type="button" aria-current={tab === "mine" ? "page" : undefined} onClick={openMine}>
          Мои
        </button>
      </nav>
    </div>
  );

  function startMove(booking: BookingView) {
    setMoving(booking);
    setDate("");
    setTime("");
    setDays([]);
    setSlots([]);
    setDayLoad("loading");
    setSlotLoad("idle");
    setNotice("");
    const serviceIds = booking.services.map((item) => item.id).join(",");
    getAvailabilityDays(serviceIds, booking.barber.id).then((result) => {
      if (!result.ok) {
        setDayLoad("error");
        return;
      }
      setDays(result.days);
      setDayLoad(result.days.some((day) => day.open) ? "ready" : "empty");
    });
  }
}

function statusLabel(status: BookingView["status"]) {
  if (status === "confirmed") return "Подтверждена";
  if (status === "cancelled") return "Отменена";
  if (status === "completed") return "Завершена";
  return "Неявка";
}

function DateList({
  load,
  days,
  date,
  onPick,
  onRetry,
}: {
  load: Load;
  days: DayAvailability[];
  date: string;
  onPick: (iso: string) => void;
  onRetry: () => void;
}) {
  if (load === "loading") return <p className="lead">Смотрим свободные дни.</p>;
  if (load === "error")
    return (
      <button type="button" className="primary" onClick={onRetry}>
        Повторить
      </button>
    );
  if (load === "empty") return <p className="lead">В ближайшие дни свободных окон нет.</p>;
  return (
    <ul className="days">
      {days.map((day) => (
        <li key={day.date}>
          <button
            type="button"
            className={day.date === date ? "day is-on" : "day"}
            disabled={!day.open}
            aria-pressed={day.date === date}
            onClick={() => onPick(day.date)}
          >
            <span>{formatWeekday(day.date)}</span>
            <strong>{formatDayMonth(day.date)}</strong>
          </button>
        </li>
      ))}
    </ul>
  );
}

function TimeList({
  load,
  slots,
  time,
  onPick,
}: {
  load: Load;
  slots: string[];
  time: string;
  onPick: (value: string) => void;
}) {
  if (load === "loading") return <p className="lead">Смотрим окна.</p>;
  if (load === "empty") return <p className="lead">В этот день свободных окон нет.</p>;
  if (load === "error") return <p className="lead">Свободное время не загрузилось.</p>;
  return (
    <ul className="times">
      {slots.map((slot) => (
        <li key={slot}>
          <button
            type="button"
            className={slot === time ? "time is-on" : "time"}
            aria-pressed={slot === time}
            onClick={() => onPick(slot)}
          >
            {slot}
          </button>
        </li>
      ))}
    </ul>
  );
}
