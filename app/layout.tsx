import type { Metadata, Viewport } from "next";
import AppShell from "@/components/app-shell";
import HelpHintNormalizer from "@/components/help-hint-normalizer";
import SingleEpisodePreferences from "@/components/single-episode-preferences";
import WorkspaceDraftTray from "@/components/workspace-draft-tray";
import WorkspacePageDraftBridgeV2 from "@/components/workspace-page-draft-bridge-v2";
import "./globals.css";
import "./standards.css";
import "./legacy-theme-overrides.css";
import "./brand-system-v2.css";
import "./brand-home-v3.css";
import "./theme-system-v3.css";
import "./sidebar-premium-v1.css";
import "./series-workspace-v4.css";
import "./story-mode-polish-v2.css";
import "./theme-audit-v4.css";
import "./series-theme-fix-v5.css";
import "./single-episode-compact-v1.css";
import "./single-episode-options-v2.css";
import "./settings-system-v1.css";
import "./help-system-v2.css";
import "./single-episode-row-balance-v7.css";
import "./single-episode-layout-v8.css";
import "./theme-audit-v5.css";
import "./theme-audit-cinematic-v1.css";
import "./agent-workspace-v1.css";
import "./theme-audit-admin-v1.css";
import "./public-theme-v1.css";
import "./single-episode-reference-v9.css";

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
    { media: "(prefers-color-scheme: light)", color: "#f7f3fa" },
    { media: "(prefers-color-scheme: dark)", color: "#050309" },
  ],
  colorScheme: "dark light",
};

const themeBootstrap = `
(function () {
  try {
    var saved = localStorage.getItem('scenova-theme');
    var theme = saved === 'light' || saved === 'dark'
      ? saved
      : (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    document.documentElement.dataset.theme = theme;
  } catch (_) {
    document.documentElement.dataset.theme = 'dark';
  }
})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body>
        <HelpHintNormalizer />
        <SingleEpisodePreferences />
        <AppShell>{children}</AppShell>
        <WorkspacePageDraftBridgeV2 />
        <WorkspaceDraftTray />
      </body>
    </html>
  );
}