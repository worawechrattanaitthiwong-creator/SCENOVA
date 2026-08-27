import type { Metadata, Viewport } from "next";
import AppShell from "@/components/app-shell";
import HelpHintNormalizer from "@/components/help-hint-normalizer";
import "./globals.css";
import "./standards.css";
import "./legacy-theme-overrides.css";
import "./brand-system-v2.css";

export const metadata: Metadata = {
  title: "SCENOVA",
  description: "SCENOVA — AI cinematic production studio",
  applicationName: "SCENOVA",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: "/icon.svg",
    apple: "/icon.svg",
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
