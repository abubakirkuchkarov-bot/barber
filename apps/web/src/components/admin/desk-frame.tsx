"use client";

import { desk } from "@/lib/desk";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

const LINKS = [
  ["/admin", "Сегодня"],
  ["/admin/services", "Услуги"],
  ["/admin/barbers", "Мастера"],
  ["/admin/reviews", "Отзывы"],
  ["/admin/analytics", "Сводка"],
  ["/admin/settings", "Настройки"],
] as const;

export function DeskFrame({ children }: { children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [login, setLogin] = useState<string | null>(null);

  useEffect(() => {
    if (path === "/admin/login") return;
    let gone = false;
    desk<{ login: string }>("/admin/me")
      .then((body) => {
        if (!gone) setLogin(body.login);
      })
      .catch(() => undefined);
    return () => {
      gone = true;
    };
  }, [path]);

  if (path === "/admin/login") return <div className="desk">{children}</div>;

  async function logout() {
    await desk("/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <div className="desk">
      <header className="desk-bar">
        <Link className="desk-mark" href="/admin">
          Кромка
        </Link>
        <nav className="desk-nav" aria-label="Стойка">
          {LINKS.map(([href, label]) => {
            const current = href === "/admin" ? path === "/admin" : path.startsWith(href);
            return (
              <Link key={href} href={href} aria-current={current ? "page" : undefined}>
                {label}
              </Link>
            );
          })}
        </nav>
        <button type="button" className="quiet" onClick={logout}>
          {login ? `Выйти, ${login}` : "Выйти"}
        </button>
      </header>
      <main className="desk-main">{children}</main>
    </div>
  );
}
