import { ManageBooking } from "@/components/book/manage-booking";
import { Nav } from "@/components/nav";
import { getBooking } from "@/lib/api";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Запись. Кромка",
  description: "Отмена и перенос записи.",
};

export default async function BookingTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const result = await getBooking(token);

  return (
    <>
      <Nav />
      <main id="content" className="book">
        {result.ok ? (
          <ManageBooking initial={result.booking} />
        ) : (
          <p className="catalog-note">Запись не найдена.</p>
        )}
      </main>
    </>
  );
}
