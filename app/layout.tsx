import type { Metadata } from "next";
import AppShell from "@/components/app-shell";
import "./globals.css";
import "./scenova-yellow-theme.css";
import "./mobile-overrides.css";

export const metadata: Metadata = {
  title: "SCENOVA — AI Movie & Series Studio",
  description: "สตูดิโอ AI สำหรับออกแบบหนังและซีรีส์ด้วย Story, Character Lock, Timeline, Cinematic Prompt และ Multi-model Render Planning",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <body><AppShell>{children}</AppShell></body>
    </html>
  );
}
