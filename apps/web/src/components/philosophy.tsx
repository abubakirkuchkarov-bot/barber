"use client";

import { gsap, useGSAP } from "@/lib/gsap";
import Image from "next/image";
import { useRef } from "react";

const statement = "Мы не просто стрижём. Мы создаём образ.";

export function Philosophy() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.fromTo(
          ".word",
          { opacity: 0.2 },
          {
            opacity: 1,
            ease: "none",
            stagger: 0.08,
            scrollTrigger: {
              trigger: root.current,
              start: "top 75%",
              end: "bottom 55%",
              scrub: true,
            },
          },
        );
      });
    },
    { scope: root },
  );

  return (
    <section className="philosophy" id="o-nas" ref={root} aria-labelledby="about-title">
      <div className="philosophy-copy">
        <h2 id="about-title" className="manifesto">
          {statement.split(" ").map((word, index) => (
            <span className="word" key={`${word}-${index}`}>
              {word}{" "}
            </span>
          ))}
        </h2>
        <p>
          Кромка стоит на Амире Темура. Здесь не торопят и не предлагают чужую форму.
          Мастер смотрит, как вы носите волосы, и оставляет то, что вам идёт.
        </p>
      </div>
      <div className="philosophy-photo">
        <Image src="/images/cut.jpg" alt="Ножницы у линии бороды" fill sizes="(min-width: 1024px) 46vw, 90vw" />
      </div>
    </section>
  );
}
