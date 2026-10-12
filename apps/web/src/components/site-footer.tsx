import { shop } from "@/data/content";

export function SiteFooter() {
  return (
    <footer className="footer" id="kontakty">
      <a className="logo" href="#top">
        {shop.name}
      </a>
      <address>
        <span>
          {shop.city}, Узбекистан
          <br />
          {shop.address}
        </span>
        <a href={shop.phoneHref}>{shop.phone}</a>
        <a href={shop.instagram} target="_blank" rel="noreferrer">
          Instagram {shop.instagramLabel}
        </a>
        <a href={shop.telegram} target="_blank" rel="noreferrer">
          Telegram {shop.telegramLabel}
        </a>
        <span>{shop.hours}</span>
        <a href={shop.mapLink} target="_blank" rel="noreferrer">
          Карта
        </a>
      </address>
      <p className="signoff">Crafted in Tashkent.</p>
    </footer>
  );
}
