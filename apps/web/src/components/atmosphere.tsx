"use client";

import { frames } from "@/data/content";
import { gsap, useGSAP } from "@/lib/gsap";
import { useLenis } from "lenis/react";
import { useEffect, useRef } from "react";

export function Atmosphere() {
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
    <section className="atmosphere" ref={root} aria-labelledby="atmosphere-title">
      <h2 id="atmosphere-title">Атмосфера</h2>
      <div className="frame-track" ref={track}>
        {frames.map((frame) => (
          <figure key={frame.id} className="frame">
            <div className="frame-photo">
              {/* Wider than the frame so the horizontal parallax does not expose edges. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="frame-img" src={frame.src} alt={frame.alt} />
            </div>
            <figcaption>{frame.caption}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
