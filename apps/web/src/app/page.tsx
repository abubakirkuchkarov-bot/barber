import { Atmosphere } from "@/components/atmosphere";
import { Finale } from "@/components/finale";
import { Hero } from "@/components/hero";
import { Masters } from "@/components/masters";
import { Nav } from "@/components/nav";
import { Philosophy } from "@/components/philosophy";
import { Reviews } from "@/components/reviews";
import { Services } from "@/components/services";
import { SiteFooter } from "@/components/site-footer";
import { Tashkent } from "@/components/tashkent";
import { getBarbers, getServices } from "@/lib/catalog";

export default async function HomePage() {
  const catalog = await loadCatalog();

  return (
    <>
      <Nav />
      <main id="content">
        <div id="top" className="scroll-sentinel" />
        <Hero />
        <Philosophy />
        {catalog.ok ? (
          <>
            <Services services={catalog.services} />
            <Masters barbers={catalog.barbers} />
          </>
        ) : (
          <p className="catalog-note">Не удалось загрузить услуги и мастеров.</p>
        )}
        <Atmosphere />
        <Tashkent />
        <Reviews />
        <Finale />
      </main>
      <SiteFooter />
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
