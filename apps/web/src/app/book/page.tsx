import { BookingFlow } from "@/components/book/booking-flow";
import { Nav } from "@/components/nav";
import { getBarbers, getServices } from "@/lib/catalog";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Запись. Кромка",
  description: "Выберите услугу, мастера, дату и время.",
};

export default async function BookPage({
  searchParams,
}: {
  searchParams: Promise<{ service?: string | string[] }>;
}) {
  const params = await searchParams;
  const service = Array.isArray(params.service) ? params.service[0] : params.service;
  const catalog = await loadCatalog();

  return (
    <>
      <Nav />
      <main id="content" className="book">
        {catalog.ok ? (
          <BookingFlow initialService={service} services={catalog.services} barbers={catalog.barbers} />
        ) : (
          <p className="catalog-note">Не удалось загрузить услуги и мастеров.</p>
        )}
      </main>
    </>
  );
}

async function loadCatalog() {
  try {
    const [services, barbers] = await Promise.all([getServices(), getBarbers()]);
    return { ok: true as const, services, barbers };
  } catch {
    return { ok: false as const };
  }
}
