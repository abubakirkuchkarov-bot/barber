"use client";

import { desk, DeskError } from "@/lib/desk";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [login, setLogin] = useState("owner");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      await desk("/admin/login", { method: "POST", body: JSON.stringify({ login, password }) });
      router.push("/admin");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof DeskError ? reason.message : "Не удалось войти");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="desk-login">
      <form onSubmit={submit}>
        <h1>Стойка</h1>
        <p>Записи, график и отзывы барбершопа.</p>
        <label>
          Логин
          <input value={login} onChange={(event) => setLogin(event.target.value)} autoComplete="username" required />
        </label>
        <label>
          Пароль
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        {error ? <p className="desk-error">{error}</p> : null}
        <button className="cta" type="submit" disabled={pending}>
          {pending ? "Входим" : "Войти"}
        </button>
      </form>
    </main>
  );
}
