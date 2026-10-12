"use client";

import { gsap, useGSAP } from "@/lib/gsap";
import Link from "next/link";
import { useEffect, useRef } from "react";

export function Hero() {
  const root = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      if (motion.matches) {
        video.pause();
        return;
      }
      video.play().catch(() => undefined);
    };
    sync();
    motion.addEventListener("change", sync);
    return () => motion.removeEventListener("change", sync);
  }, []);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(
        {
          desktop: "(min-width: 1024px)",
          reduce: "(prefers-reduced-motion: reduce)",
        },
        (ctx) => {
          const { desktop, reduce } = ctx.conditions as { desktop: boolean; reduce: boolean };
          if (reduce) return;

          gsap.from(".line-inner", {
            yPercent: 110,
            duration: 1.25,
            stagger: 0.12,
            ease: "expo.out",
          });
          gsap.from(".hero-rest", {
            autoAlpha: 0,
            y: 18,
            duration: 1,
            delay: 0.35,
            ease: "expo.out",
          });

          if (!desktop) return;

          gsap
            .timeline({
              defaults: { ease: "none" },
              scrollTrigger: {
                trigger: root.current,
                start: "top top",
                end: "+=120%",
                pin: true,
                pinType: "transform",
                scrub: true,
                anticipatePin: 1,
                invalidateOnRefresh: true,
              },
            })
            .fromTo(
              ".hero-media",
              { scale: 1 },
              { scale: 1.08, immediateRender: false },
              0,
            )
            .to(".hero-copy", { yPercent: -14, autoAlpha: 0, duration: 0.45 }, 0);
        },
      );
    },
    { scope: root },
  );

  return (
    <section className="hero" ref={root} aria-labelledby="hero-title">
      <div className="hero-frame">
        <video
          ref={videoRef}
          className="hero-media"
          src="/prewiews.mp4"
          poster="/images/hero.jpg"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden="true"
        />
        <div className="hero-scrim" />
      </div>
      <div className="hero-copy">
        <p className="brand-mark">Tashkent</p>
        <h1 id="hero-title">
          <span className="line">
            <span className="line-inner">Стиль</span>
          </span>
          <span className="line">
            <span className="line-inner line-italic">это детали.</span>
          </span>
        </h1>
        <div className="hero-rest">
          <p className="dek">
            Стрижка, борода и бритьё на улице Амира Темура.
          </p>
          <div className="hero-actions">
            <Link className="cta" href="/book">
              Записаться
            </Link>
            <a className="quiet" href="#uslugi">
              Посмотреть услуги
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
