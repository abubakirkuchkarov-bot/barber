"use client";

import type { Barber } from "@/lib/catalog";
import { gsap, useGSAP } from "@/lib/gsap";
import { useLenis } from "lenis/react";
import { useEffect, useRef } from "react";

export function Masters({ barbers }: { barbers: Barber[] }) {
  const root = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const lenis = useLenis();
  const lenisRef = useRef(lenis);

  useEffect(() => {
    lenisRef.current = lenis;
  }, [lenis]);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(min-width: 1024px) and (prefers-reduced-motion: no-preference)", () => {
        const el = track.current;
        if (!el) return;
        const distance = () => Math.max(0, el.scrollWidth - window.innerWidth);

        const scrollTween = gsap.to(el, {
          x: () => -distance(),
          ease: "none",
          scrollTrigger: {
            trigger: root.current,
            start: "top top",
            end: () => "+=" + distance(),
            pin: true,
            pinType: "transform",
            scrub: true,
            invalidateOnRefresh: true,
            anticipatePin: 1,
          },
        });

        gsap.utils.toArray<HTMLElement>(".frame").forEach((card) => {
          const image = card.querySelector(".frame-img");
          if (!image) return;
          gsap.fromTo(
            image,
            { xPercent: -6 },
            {
              xPercent: 6,
              ease: "none",
              scrollTrigger: {
                trigger: card,
                containerAnimation: scrollTween,
                start: "left right",
                end: "right left",
                scrub: true,
              },
            },
          );
        });

        const st = scrollTween.scrollTrigger;
        const onFocus = (event: FocusEvent) => {
          const card = (event.target as HTMLElement).closest<HTMLElement>(".frame");
          if (!card || !st) return;
          const ratio = gsap.utils.clamp(0, 1, (card.offsetLeft - window.innerWidth * 0.08) / distance());
          const y = st.start + ratio * (st.end - st.start);
          if (lenisRef.current) lenisRef.current.scrollTo(y, { immediate: true });
          else window.scrollTo(0, y);
        };
        el.addEventListener("focusin", onFocus);
        return () => el.removeEventListener("focusin", onFocus);
      });
    },
    { scope: root },
  );

  return (
    <section className="atmosphere masters" id="mastera" ref={root} aria-labelledby="masters-title">
      <h2 id="masters-title">Мастера</h2>
      <div className="frame-track" ref={track}>
        {barbers.map((barber) => (
          <figure key={barber.id} className="frame">
            <div className="frame-photo">
              {barber.photoUrl ? (
                // Wider than the frame so the horizontal parallax does not expose edges.
                // eslint-disable-next-line @next/next/no-img-element
                <img className="frame-img" src={barber.photoUrl} alt={`Портрет ${barber.name}`} />
              ) : null}
            </div>
            <figcaption>
              <span className="master-name">{barber.name}</span>
              <span className="master-meta">
                {barber.bio ?? "Мастер"}. Опыт {barber.experienceYears} лет
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
