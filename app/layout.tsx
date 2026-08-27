import type { Metadata, Viewport } from "next";
import AppShell from "@/components/app-shell";
import HelpHintNormalizer from "@/components/help-hint-normalizer";
import "./globals.css";
import "./standards.css";
import "./legacy-theme-overrides.css";
import "./brand-system-v2.css";
import "./brand-home-v3.css";

export const metadata: Metadata = {
  title: "SCENOVA",
  description: "SCENOVA — AI cinematic production studio",
  applicationName: "SCENOVA",
  icons: {
    icon: [{ url: "/brand/scenova-mark.webp", type: "image/webp" }],
    shortcut: "/brand/scenova-mark.webp",
    apple: "/brand/scenova-mark.webp",
  },
};

export const viewport: Viewport = {
  themeColor: "#07040d",
  colorScheme: "dark",
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
