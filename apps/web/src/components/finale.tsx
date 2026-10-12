import { shop } from "@/data/content";
import Image from "next/image";
import Link from "next/link";

export function Finale() {
  return (
    <section className="finale" id="zapis" aria-labelledby="finale-title">
      <Image src="/images/room.jpg" alt="Зал барбершопа: кресла и тёплый свет" fill priority={false} sizes="100vw" />
      <div className="finale-copy">
        <h2 id="finale-title">
          Твой новый образ
          <span> начинается здесь.</span>
        </h2>
        <p>{shop.hours}</p>
        <Link className="cta" href="/book">
          Записаться
        </Link>
      </div>
    </section>
  );
}
