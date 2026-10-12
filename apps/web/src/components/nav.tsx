"use client";

import { shop } from "@/data/content";
import { useLenis } from "lenis/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";

const links = [
  { href: "#uslugi", label: "Услуги" },
  { href: "#mastera", label: "Мастера" },
  { href: "#o-nas", label: "О нас" },
  { href: "#kontakty", label: "Контакты" },
];

let pastTop = false;

function subscribe(onStoreChange: () => void) {
  const target = document.getElementById("top");
  if (!target) return () => {};

  const observer = new IntersectionObserver(([entry]) => {
    pastTop = !entry.isIntersecting;
    onStoreChange();
  });
  observer.observe(target);
  return () => observer.disconnect();
}

function getPastTop() {
  return pastTop;
}

export function Nav() {
  const pathname = usePathname();
  const home = pathname === "/";
  const solid = useSyncExternalStore(subscribe, getPastTop, () => false) || !home;
  const [open, setOpen] = useState(false);
  const lenis = useLenis();

  useEffect(() => {
    if (!lenis) return;
    if (open) lenis.stop();
    else lenis.start();
    return () => lenis.start();
  }, [lenis, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function close() {
    setOpen(false);
  }

  return (
    <header className={solid ? "nav is-solid" : "nav"}>
      <a className="skip" href="#content">
        К содержанию
      </a>
      {home ? (
        <a className="logo" href="#top">
          {shop.name}
        </a>
      ) : (
        <Link className="logo" href="/">
          {shop.name}
        </Link>
      )}
      <nav className="nav-links" aria-label="Разделы">
        {links.map((link) =>
          home ? (
            <a key={link.href} href={link.href}>
              {link.label}
            </a>
          ) : (
            <Link key={link.href} href={`/${link.href}`}>
              {link.label}
            </Link>
          ),
        )}
      </nav>
      {pathname === "/book" ? null : (
        <Link className="nav-cta" href="/book">
          Записаться
        </Link>
      )}
      <button
        type="button"
        className="menu-btn"
        aria-expanded={open}
        aria-controls="site-menu"
        onClick={() => setOpen((value) => !value)}
      >
        {open ? "Закрыть" : "Меню"}
      </button>
      {open ? (
        <div className="menu" id="site-menu" role="dialog" aria-modal="true" aria-label="Меню">
          {links.map((link) =>
            home ? (
              <a key={link.href} href={link.href} onClick={close}>
                {link.label}
              </a>
            ) : (
              <Link key={link.href} href={`/${link.href}`} onClick={close}>
                {link.label}
              </Link>
            ),
          )}
          {pathname === "/book" ? null : (
            <Link href="/book" onClick={close}>
              Записаться
            </Link>
          )}
        </div>
      ) : null}
    </header>
  );
}
