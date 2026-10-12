import Image from "next/image";

export function Tashkent() {
  return (
    <section className="tashkent" aria-labelledby="city-title">
      <div className="tashkent-copy">
        <h2 id="city-title">
          Создано в Ташкенте.
          <span> Для тех, кто ценит стиль.</span>
        </h2>
      </div>
      <div className="tashkent-photo">
        <Image
          src="/images/city.jpg"
          alt="Вечерний проспект с платанами и тёплым светом фонарей"
          fill
          sizes="(min-width: 1024px) 55vw, 100vw"
        />
      </div>
    </section>
  );
}
