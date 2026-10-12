"use client";

import { desk, DeskError } from "@/lib/desk";
import { useEffect, useState } from "react";

type Review = {
  id: string;
  rating: number;
  comment: string | null;
  isPublic: boolean;
  createdAt: string;
  barber: string;
  client: string;
};

export default function ReviewsPage() {
  const [rows, setRows] = useState<Review[]>([]);
  const [error, setError] = useState("");

  async function load() {
    const body = await desk<{ reviews: Review[] }>("/admin/reviews");
    setRows(body.reviews);
  }

  useEffect(() => {
    load().catch((reason: unknown) => setError(reason instanceof DeskError ? reason.message : "Отзывы не открылись"));
  }, []);

  return (
    <>
      <h1>Отзывы</h1>
      {error ? <p className="desk-error">{error}</p> : null}
      {rows.length === 0 ? <p className="desk-empty">Оценок пока нет.</p> : null}
      <ul className="desk-lines">
        {rows.map((row) => (
          <li key={row.id}>
            <div>
              <strong>
                {row.rating} из 5, {row.client}
              </strong>
              <span>
                {row.barber}
                {row.comment ? `. ${row.comment}` : ""}
              </span>
            </div>
            <button
              type="button"
              onClick={async () => {
                await desk(`/admin/reviews/${row.id}`, {
                  method: "PATCH",
                  body: JSON.stringify({ isPublic: !row.isPublic }),
                });
                await load();
              }}
            >
              {row.isPublic ? "Скрыть с сайта" : "Показать на сайте"}
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
