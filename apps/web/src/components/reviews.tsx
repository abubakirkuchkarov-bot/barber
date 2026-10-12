"use client";

import { reviews } from "@/data/content";
import { gsap, useGSAP } from "@/lib/gsap";
import Image from "next/image";
import { useRef, type CSSProperties } from "react";

const stills: Record<string, { src: string; alt: string }> = {
  rustam: { src: "/images/cut.jpg", alt: "Бритьё бороды" },
  jasur: { src: "/images/detail.jpg", alt: "Контур стрижки" },
  bekzod: { src: "/images/still.jpg", alt: "Инструменты на камне" },
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function splitCredit(attribution: string) {
  const [name, role] = attribution.split(", ");
  return { name: name ?? attribution, role: role ?? "клиент" };
}

export function Reviews() {
  const root = useRef<HTMLElement>(null);
  const total = reviews.length;
  const totalLabel = pad(total);

  useGSAP(
    () => {
      const section = root.current;
      if (!section) return;

      const mm = gsap.matchMedia();

      const build = (clip: boolean) => {
        section.classList.add("is-scene");

        const panels = gsap.utils.toArray<HTMLElement>(".reviews-panel", section);
        const quotes = gsap.utils.toArray<HTMLElement>(".reviews-quote-text", section);
        const credits = gsap.utils.toArray<HTMLElement>(".reviews-credit", section);
        const frames = gsap.utils.toArray<HTMLElement>(".reviews-still", section);
        const nums = gsap.utils.toArray<HTMLElement>(".reviews-num", section);
        const progressNums = gsap.utils.toArray<HTMLElement>(".reviews-progress-num", section);
        const fill = section.querySelector<HTMLElement>(".reviews-progress-fill");
        const shift = clip ? 30 : 16;

        const mark = (index: number) => {
          panels.forEach((panel, i) => {
            panel.setAttribute("aria-hidden", i === index ? "false" : "true");
          });
        };

        gsap.set(panels, { zIndex: (index) => index + 1 });
        gsap.set(quotes.slice(1), { y: shift, ...(clip ? {} : { autoAlpha: 0 }) });
        gsap.set(credits.slice(1), { autoAlpha: 0, y: shift * 0.45 });
        gsap.set(frames.slice(1), { autoAlpha: 0 });
        gsap.set(nums.slice(1), { autoAlpha: 0, y: 10 });
        gsap.set(progressNums.slice(1), { autoAlpha: 0, y: 10 });
        if (clip) {
          gsap.set(quotes, { clipPath: "inset(0% 0% 0% 0%)" });
          gsap.set(quotes.slice(1), { clipPath: "inset(100% 0% 0% 0%)" });
          gsap.set(frames, { clipPath: "inset(0% 0% 0% 0%)", scale: 1 });
          gsap.set(frames.slice(1), { clipPath: "inset(100% 0% 0% 0%)", scale: 1.06 });
        }
        mark(0);

        const tl = gsap.timeline({
          defaults: { ease: "none" },
          scrollTrigger: {
            trigger: section,
            start: "top top",
            end: "bottom bottom",
            scrub: 0.65,
            invalidateOnRefresh: true,
            onUpdate: (self) => {
              mark(Math.round(self.progress * (panels.length - 1)));
            },
          },
        });

        const dwell = 0.5;
        const span = 0.75;
        let cursor = 0;

        for (let i = 0; i < panels.length - 1; i += 1) {
          cursor += dwell;
          const at = cursor;

          if (clip) {
            tl.to(quotes[i], { y: -shift, clipPath: "inset(0% 0% 100% 0%)", duration: span }, at);
            tl.fromTo(
              quotes[i + 1],
              { y: shift, clipPath: "inset(100% 0% 0% 0%)" },
              { y: 0, clipPath: "inset(0% 0% 0% 0%)", duration: span, immediateRender: false },
              at,
            );
          } else {
            tl.to(quotes[i], { y: -shift, autoAlpha: 0, duration: span }, at);
            tl.fromTo(
              quotes[i + 1],
              { y: shift, autoAlpha: 0 },
              { y: 0, autoAlpha: 1, duration: span, immediateRender: false },
              at,
            );
          }

          tl.to(credits[i], { y: -shift * 0.4, autoAlpha: 0, duration: span * 0.75 }, at);
          tl.fromTo(
            credits[i + 1],
            { y: shift * 0.4, autoAlpha: 0 },
            { y: 0, autoAlpha: 1, duration: span * 0.75, immediateRender: false },
            at,
          );

          tl.to([nums[i], progressNums[i]], { y: -10, autoAlpha: 0, duration: span * 0.55 }, at);
          tl.fromTo(
            [nums[i + 1], progressNums[i + 1]],
            { y: 10, autoAlpha: 0 },
            { y: 0, autoAlpha: 1, duration: span * 0.55, immediateRender: false },
            at,
          );

          if (clip) {
            tl.to(
              frames[i],
              { autoAlpha: 0, scale: 1.06, clipPath: "inset(0% 0% 100% 0%)", duration: span },
              at,
            );
            tl.fromTo(
              frames[i + 1],
              { autoAlpha: 0, scale: 1.06, clipPath: "inset(100% 0% 0% 0%)" },
              {
                autoAlpha: 1,
                scale: 1,
                clipPath: "inset(0% 0% 0% 0%)",
                duration: span,
                immediateRender: false,
              },
              at,
            );
          } else {
            tl.to(frames[i], { autoAlpha: 0, duration: span }, at);
            tl.to(frames[i + 1], { autoAlpha: 1, duration: span, immediateRender: false }, at);
          }

          cursor += span;
        }

        cursor += dwell;
        if (fill) {
          tl.fromTo(fill, { scaleX: 0 }, { scaleX: 1, duration: cursor, ease: "none" }, 0);
        }
        tl.set(section, {}, cursor);

        return () => section.classList.remove("is-scene");
      };

      mm.add("(prefers-reduced-motion: no-preference) and (max-width: 1023px)", () => build(false));
      mm.add("(prefers-reduced-motion: no-preference) and (min-width: 1024px)", () => build(true));
    },
    { scope: root },
  );

  return (
    <section
      className="reviews"
      ref={root}
      style={{ "--review-steps": total } as CSSProperties}
      aria-labelledby="reviews-title"
    >
      <div className="reviews-stage">
        <div className="reviews-meta">
          <h2 id="reviews-title" className="reviews-label">
            Отзывы
          </h2>
          <p className="reviews-count">
            <span className="reviews-num-slot">
              {reviews.map((review, index) => (
                <span className="reviews-num" key={review.id}>
                  {pad(index + 1)}
                </span>
              ))}
            </span>
            <span aria-hidden="true">/</span>
            <span>{totalLabel}</span>
          </p>
        </div>

        {reviews.map((review, index) => {
          const credit = splitCredit(review.attribution);
          const still = stills[review.id];
          return (
            <article className="reviews-panel" key={review.id} aria-hidden={index === 0 ? undefined : true}>
              <p className="reviews-kicker">
                {pad(index + 1)} / {totalLabel}
              </p>
              <blockquote>
                <p className="reviews-quote-text">{review.quote}</p>
              </blockquote>
              <footer className="reviews-credit">
                <span className="reviews-name">{credit.name}</span>
                <span className="reviews-role">{credit.role}</span>
              </footer>
              {still ? (
                <figure className="reviews-still">
                  <Image src={still.src} alt={still.alt} fill sizes="210px" />
                </figure>
              ) : null}
            </article>
          );
        })}

        <div className="reviews-progress" aria-hidden="true">
          <span className="reviews-num-slot">
            {reviews.map((review, index) => (
              <span className="reviews-progress-num" key={review.id}>
                {pad(index + 1)}
              </span>
            ))}
          </span>
          <span className="reviews-progress-track">
            <span className="reviews-progress-fill" />
          </span>
          <span>{totalLabel}</span>
        </div>
      </div>
    </section>
  );
}
