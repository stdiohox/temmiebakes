import type { Metadata, Viewport } from "next";
import { Figtree, JetBrains_Mono, Playfair_Display } from "next/font/google";
import { DemoProvider } from "@/components/demo-provider";
import "./globals.css";

const display = Playfair_Display({ variable: "--font-display-face", subsets: ["latin"], weight: ["500", "600", "700"], style: ["normal", "italic"] });
const body = Figtree({ variable: "--font-body", subsets: ["latin"] });
const mono = JetBrains_Mono({ variable: "--font-mono-face", subsets: ["latin"], weight: ["400", "500"], preload: false });

export const metadata: Metadata = {
  title: { default: "Koretbakes · Cakes & desserts in Lagos", template: "%s · Koretbakes" },
  description: "Celebration cakes, desserts, corporate breakfasts and baking classes in Lagos. Interactive demo of the Koretbakes ordering, kitchen and automation platform.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbf6f7" },
    { media: "(prefers-color-scheme: dark)", color: "#160c14" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full">
        <DemoProvider>{children}</DemoProvider>
      </body>
    </html>
  );
}
