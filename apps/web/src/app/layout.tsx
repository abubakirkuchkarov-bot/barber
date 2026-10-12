import { SmoothScroll } from "@/components/scroll/smooth-scroll";
import type { Metadata } from "next";
import { Golos_Text, Literata } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const display = Literata({
  subsets: ["cyrillic", "latin"],
  weight: "500",
  style: "normal",
  variable: "--font-display",
  display: "swap",
});

const displayItalic = Literata({
  subsets: ["cyrillic", "latin"],
  weight: "400",
  style: "italic",
  variable: "--font-italic",
  display: "swap",
});

const sans = Golos_Text({
  subsets: ["cyrillic", "latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Кромка. Барбершоп в Ташкенте",
  description:
    "Барбершоп на улице Амира Темура. Стрижка, борода и бритьё. Ежедневно с 10:00 до 21:00.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru" className={`${display.variable} ${displayItalic.variable} ${sans.variable}`}>
      <body>
        <SmoothScroll>{children}</SmoothScroll>
      </body>
    </html>
  );
}
