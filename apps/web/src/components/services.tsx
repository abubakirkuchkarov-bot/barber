"use client";

import { fallbackServiceImage, formatDuration, formatPrice, serviceImages } from "@/data/content";
import type { Service } from "@/lib/catalog";
import { ArrowRight } from "@phosphor-icons/react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

export function Services({ services }: { services: Service[] }) {
  const [active, setActive] = useState(services[0]?.id ?? "");
  const current = services.find((service) => service.id === active) ?? services[0];

  return (
    <section className="section services" id="uslugi" aria-labelledby="services-title">
      <div className="section-head">
        <h2 id="services-title">Услуги</h2>
      </div>
      {services.length === 0 ? <p className="catalog-note">Услуг пока нет.</p> : null}
      <div className="services-layout">
        <ol className="service-list">
          {services.map((service, index) => {
            const number = String(index + 1).padStart(2, "0");
            const selected = service.id === current?.id;
            return (
              <li key={service.id}>
                <Link
                  className={selected ? "service-row is-on" : "service-row"}
                  href={`/book?service=${service.id}`}
                  onMouseEnter={() => setActive(service.id)}
                  onFocus={() => setActive(service.id)}
                >
                  <span className="service-no">{number}</span>
                  <span className="service-copy">
                    <span className="service-name">{service.name}</span>
                    <span className="service-meta">
                      {service.description} {formatDuration(service.durationMin)}
                    </span>
                  </span>
                  <span className="service-end">
                    <span className="service-price">{formatPrice(service.price)}</span>
                    <ArrowRight className="arrow" size={22} weight="regular" aria-hidden="true" />
                  </span>
                  <span className="rule" aria-hidden="true" />
                </Link>
              </li>
            );
          })}
        </ol>
        {current ? (
          <div className="service-preview">
            {services.map((service) => {
              const media = serviceImages[service.id] ?? fallbackServiceImage;
              return (
                <Image
                  key={service.id}
                  src={media.src}
                  alt={service.id === current.id ? media.alt : ""}
                  fill
                  sizes="32vw"
                  className={service.id === current.id ? "is-on" : ""}
                />
              );
            })}
          </div>
        ) : null}
      </div>
    </section>
  );
}
