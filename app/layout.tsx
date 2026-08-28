import type { Metadata, Viewport } from "next";
import AppShell from "@/components/app-shell";
import HelpHintNormalizer from "@/components/help-hint-normalizer";
import "./globals.css";
import "./standards.css";
import "./legacy-theme-overrides.css";
import "./brand-system-v2.css";
import "./brand-home-v3.css";
import "./theme-system-v3.css";
import "./sidebar-premium-v1.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://scnva.com"),
  title: "SCENOVA — AI Cinematic Studio",
  description: "เปลี่ยนทุกไอเดียให้กลายเป็นภาพยนตร์ ด้วยพื้นที่สร้างสรรค์ที่ขับเคลื่อนด้วย AI",
  applicationName: "SCENOVA",
  icons: {
    icon: [{ url: "/brand/scenova-mark.png", type: "image/png" }],
    shortcut: "/brand/scenova-mark.png",
    apple: "/brand/scenova-mark.png",
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "SCENOVA",
    title: "SCENOVA — AI Cinematic Studio",
    description: "MAKE IT CINEMATIC. เปลี่ยนทุกไอเดียให้กลายเป็นภาพยนตร์ด้วย AI",
    images: [{ url: "/og.png", width: 1536, height: 1024, alt: "SCENOVA AI Cinematic Studio" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "SCENOVA — AI Cinematic Studio",
    description: "MAKE IT CINEMATIC. เปลี่ยนทุกไอเดียให้กลายเป็นภาพยนตร์ด้วย AI",
    images: ["/og.png"],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f4fa" },
    { media: "(prefers-color-scheme: dark)", color: "#07040d" },
  ],
  colorScheme: "dark light",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <body>
        <HelpHintNormalizer />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
