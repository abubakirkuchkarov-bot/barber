"use client";

import { gsap, ScrollTrigger } from "@/lib/gsap";
import { ReactLenis, useLenis, type LenisRef } from "lenis/react";
import type { LenisOptions } from "lenis";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import "lenis/dist/lenis.css";

const LENIS_OPTIONS: LenisOptions = {
  autoRaf: false,
  lerp: 0.08,
  wheelMultiplier: 0.9,
  touchMultiplier: 1,
  syncTouch: false,
  anchors: true,
  stopInertiaOnNavigate: true,
};

function ScrollTriggerBridge() {
  useLenis(ScrollTrigger.update);
  return null;
}

export function SmoothScroll({ children }: { children: ReactNode }) {
  const path = usePathname();
  const lenisRef = useRef<LenisRef>(null);
  const desk = path.startsWith("/admin");

  useEffect(() => {
    if (desk) return;
    const tick = (time: number) => {
      lenisRef.current?.lenis?.raf(time * 1000);
    };
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    const refresh = () => ScrollTrigger.refresh();
    window.addEventListener("load", refresh);
    document.fonts.ready.then(refresh).catch(() => undefined);

    return () => {
      window.removeEventListener("load", refresh);
      gsap.ticker.remove(tick);
      gsap.ticker.lagSmoothing(500, 33);
    };
  }, [desk]);

  if (desk) return children;

  return (
    <ReactLenis root options={LENIS_OPTIONS} ref={lenisRef}>
      <ScrollTriggerBridge />
      {children}
    </ReactLenis>
  );
}
