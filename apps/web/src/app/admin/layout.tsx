import { DeskFrame } from "@/components/admin/desk-frame";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Кромка. Стойка",
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <DeskFrame>{children}</DeskFrame>;
}
