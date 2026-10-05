import type { Metadata } from "next";
import { AppShell } from "@/components/app/app-shell";

export const metadata: Metadata = { title: "Back office" };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
